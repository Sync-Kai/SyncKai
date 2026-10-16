import { hasMalToken, hasValidAniListToken } from '../../browser/storage/tokens';
import { entryIdOn, type TrackerId } from '../../shared/tracker.types';
import { deleteListEntry, getMediaListInfo, getScoreFormat, saveListEntry, saveListNotes, saveListStatus, saveProgress, saveScore } from '../anilist/list';
import { fetchAniListFullList } from '../anilist/full-list';
import { deleteMalEntry, getMalAnime, saveMalEntry, saveMalListStatus, saveMalNotes, saveMalProgress, saveMalScore } from '../mal/client';
import { fetchMalFullList } from '../mal/full-list';
import { markSeriesStale } from '../compare/compare-snapshot';
import type { ListEntryState } from '../sync/rules';
import { aniListScores, MAL_SCORES } from '../../shared/score';
import type { TrackerService } from '../ports/tracker';
import { forgetCachedEntries } from './entry-cache';
import { ApiError } from '../errors';
import { trace } from '../../browser/debug-trace-client';
import { entryTraceData } from '../../shared/debug-trace';
import { isRecord } from '../../shared/guards';

/**
 * Trace de débogage (builds de développement seulement : jamais posé dans les bundles publiés) : chaque écriture sur un
 * service, ses arguments (progression, statut, note ; longueur du commentaire, jamais son texte), l'état de l'entrée après
 * l'écriture ou le code de l'erreur, et sa durée.
 */
function tracingWrites(tracker: TrackerService): TrackerService {
  const wrap =
    <A extends unknown[], R>(op: string, write: (id: number, ...args: A) => Promise<R>) =>
    async (id: number, ...args: A): Promise<R> => {
      const startedAt = Date.now();
      const fields = args.find(isRecord);
      const input = op === 'saveNotes' ? { notesLength: typeof args[0] === 'string' ? args[0].length : null } : { args: args.filter((a) => typeof a !== 'object'), ...(fields ? { write: fields } : {}) };
      try {
        const saved = await write(id, ...args);
        const after = isRecord(saved) && typeof saved.status === 'string' && typeof saved.progress === 'number' ? entryTraceData({ status: saved.status, progress: saved.progress }) : null;
        trace('sync', 'write', { service: tracker.id, op, id, ...input, after, ms: Date.now() - startedAt });
        return saved;
      } catch (error: unknown) {
        const failure = error instanceof ApiError ? { code: error.code, httpStatus: error.httpStatus } : { code: 'UNEXPECTED' };
        trace('sync', 'write-failed', { service: tracker.id, op, id, ...input, ...failure, ms: Date.now() - startedAt });
        throw error;
      }
    };
  return {
    ...tracker,
    forSession: (epoch) => tracingWrites(tracker.forSession(epoch)),
    saveProgress: wrap('saveProgress', tracker.saveProgress),
    saveScore: wrap('saveScore', tracker.saveScore),
    startRewatch: wrap('startRewatch', tracker.startRewatch),
    saveStatus: wrap('saveStatus', tracker.saveStatus),
    saveEntry: wrap('saveEntry', tracker.saveEntry),
    deleteEntry: wrap('deleteEntry', tracker.deleteEntry),
    saveNotes: wrap('saveNotes', tracker.saveNotes),
  };
}

/**
 * Toute écriture réussie hors alignement (synchro en direct ou en file, carte vérifiée, +1/−1, statut, note,
 * revisionnage, import) rend périmé l'écart de la comparaison des listes pour cette fiche. Fait ici, une seule
 * fois pour tous les chemins d'écriture ; `saveEntry` (l'alignement) retire lui-même l'écart aligné.
 */
function invalidatingComparison(tracker: TrackerService): TrackerService {
  const then =
    <A extends unknown[]>(write: (id: number, ...args: A) => Promise<ListEntryState>) =>
    async (id: number, ...args: A): Promise<ListEntryState> => {
      const saved = await write(id, ...args);
      await markSeriesStale(tracker.id, id);
      return saved;
    };
  return {
    ...tracker,
    saveProgress: then(tracker.saveProgress),
    saveScore: then(tracker.saveScore),
    startRewatch: then(tracker.startRewatch),
    saveStatus: then(tracker.saveStatus),
    // Retrait de la liste : l'écart change aussi (série présente d'un seul côté). Le commentaire n'entre pas dans la comparaison.
    deleteEntry: async (id: number): Promise<void> => {
      await tracker.deleteEntry(id);
      await markSeriesStale(tracker.id, id);
    },
  };
}

/**
 * Toute écriture (réussie ou non : elle a pu être appliquée) oublie les entrées de ce service gardées pour l'affichage
 * (entry-cache.ts) : la fiche de la page relue après une synchro ou une action montre la liste à jour.
 */
function forgettingEntries(tracker: TrackerService): TrackerService {
  const forget =
    <A extends unknown[], R>(write: (...args: A) => Promise<R>) =>
    async (...args: A): Promise<R> => {
      try {
        return await write(...args);
      } finally {
        forgetCachedEntries(tracker.id);
      }
    };
  return {
    ...tracker,
    saveProgress: forget(tracker.saveProgress),
    saveScore: forget(tracker.saveScore),
    startRewatch: forget(tracker.startRewatch),
    saveStatus: forget(tracker.saveStatus),
    saveEntry: forget(tracker.saveEntry),
    deleteEntry: forget(tracker.deleteEntry),
    saveNotes: forget(tracker.saveNotes),
  };
}

/** Adaptateur d'un service ; `session` : ses requêtes liées à cette session (forSession, L2), sinon à la session courante */
type TrackerAdapter = (session: number | undefined) => Omit<TrackerService, 'forSession'>;

/** Service complet (invalidation de la comparaison, oubli des entrées gardées), et sa version liée à une session */
function assemble(adapter: TrackerAdapter, session?: number): TrackerService {
  return forgettingEntries(invalidatingComparison({ ...adapter(session), forSession: (epoch) => assemble(adapter, epoch) }));
}

const aniListAdapter: TrackerAdapter = (session) => ({
  id: 'anilist',
  // Présence et expiration lues sans déchiffrement ; le token est déchiffré à la requête (anilist/client.ts)
  isConnected: hasValidAniListToken,
  resolveId: (media) => entryIdOn('anilist', { mediaId: media.mediaId, malId: media.idMal }),
  fullList: async () => (await fetchAniListFullList()).map((e) => ({ id: e.mediaId, status: e.status, progress: e.progress })),
  async getEntry(id, lane) {
    const { title, episodes, entry, notes } = await getMediaListInfo(id, lane, session);
    return { title, episodes, entry, notes };
  },
  saveProgress: (id, progress, status, repeat, lane) => saveProgress(id, progress, status, repeat, lane, session),
  // Le score d'AniList s'exprime dans le format choisi par l'utilisateur (sur 100, 10, 5, 3…)
  saveScore: async (id, score) => saveScore(id, aniListScores(await getScoreFormat('interactive', session)).encode(score), session),
  startRewatch: (id, progress) => saveProgress(id, progress, 'REPEATING', undefined, 'interactive', session),
  saveStatus: (id, status, progress, repeat) => saveListStatus(id, status, progress, repeat, session),
  saveEntry: (id, write, lane) => saveListEntry(id, write, lane, session),
  deleteEntry: (id) => deleteListEntry(id, session),
  saveNotes: (id, notes) => saveListNotes(id, notes, session),
});

const malAdapter: TrackerAdapter = (session) => ({
  id: 'mal',
  // Token présent (même expiré) : il sera renouvelé à la première requête
  isConnected: hasMalToken,
  resolveId: (media) => entryIdOn('mal', { mediaId: media.mediaId, malId: media.idMal }),
  fullList: async () => (await fetchMalFullList()).map((e) => ({ id: e.malId, status: e.status, progress: e.progress })),
  getEntry: (id) => getMalAnime(id, session),
  saveProgress: (id, progress, status, repeat) => saveMalProgress(id, progress, status, repeat, session),
  saveScore: (id, score) => saveMalScore(id, MAL_SCORES.encode(score), session),
  startRewatch: (id, progress) => saveMalProgress(id, progress, 'REPEATING', undefined, session),
  saveStatus: (id, status, progress, repeat) => saveMalListStatus(id, status, progress, repeat, session),
  saveEntry: (id, write) => saveMalEntry(id, write, session),
  deleteEntry: (id) => deleteMalEntry(id, session),
  saveNotes: (id, notes) => saveMalNotes(id, notes, session),
});

export const anilistTracker: TrackerService = assemble(aniListAdapter);
export const malTracker: TrackerService = assemble(malAdapter);

// Build de développement : écritures tracées (tracingWrites) ; tableau d'origine sinon
const TRACKERS: readonly TrackerService[] = __SYNCKAI_DEBUG__ ? [tracingWrites(anilistTracker), tracingWrites(malTracker)] : [anilistTracker, malTracker];

/** Services connectés, éventuellement restreints à `only` (nouvelle tentative ciblée). */
export async function getConnectedTrackers(only: readonly TrackerId[] | null = null): Promise<TrackerService[]> {
  const candidates = only ? TRACKERS.filter((t) => only.includes(t.id)) : TRACKERS;
  const connected = await Promise.all(candidates.map((t) => t.isConnected()));
  return candidates.filter((_, i) => connected[i]);
}
