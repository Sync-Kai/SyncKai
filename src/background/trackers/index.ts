import { hasMalToken, hasValidAniListToken } from '../../browser/storage/tokens';
import type { TrackerId } from '../../shared/tracker.types';
import { deleteListEntry, getMediaListInfo, getScoreFormat, saveListEntry, saveListNotes, saveListStatus, saveProgress, saveScore } from '../api/list';
import { deleteMalEntry, getMalAnime, saveMalEntry, saveMalListStatus, saveMalNotes, saveMalProgress, saveMalScore } from '../api/mal';
import { markSeriesStale } from '../compare-snapshot';
import type { ListEntryState } from '../sync/rules';
import { toAniListScore, toMalScore } from '../../shared/score';
import type { TrackerService } from './tracker';

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

export const anilistTracker: TrackerService = invalidatingComparison({
  id: 'anilist',
  // Présence et expiration lues sans déchiffrement ; le token est déchiffré à la requête (api/client.ts)
  isConnected: hasValidAniListToken,
  resolveId: (media) => media.mediaId,
  async getEntry(id) {
    const { title, episodes, entry, notes } = await getMediaListInfo(id);
    return { title, episodes, entry, notes };
  },
  saveProgress: (id, progress, status, repeat) => saveProgress(id, progress, status, repeat),
  // Le score d'AniList s'exprime dans le format choisi par l'utilisateur (sur 100, 10, 5, 3…)
  saveScore: async (id, score) => saveScore(id, toAniListScore(score, await getScoreFormat())),
  startRewatch: (id, progress) => saveProgress(id, progress, 'REPEATING'),
  saveStatus: (id, status, progress, repeat) => saveListStatus(id, status, progress, repeat),
  saveEntry: (id, write) => saveListEntry(id, write),
  deleteEntry: (id) => deleteListEntry(id),
  saveNotes: (id, notes) => saveListNotes(id, notes),
});

export const malTracker: TrackerService = invalidatingComparison({
  id: 'mal',
  // Token présent (même expiré) : il sera renouvelé à la première requête
  isConnected: hasMalToken,
  resolveId: (media) => media.idMal,
  getEntry: (id) => getMalAnime(id),
  saveProgress: (id, progress, status, repeat) => saveMalProgress(id, progress, status, repeat),
  saveScore: (id, score) => saveMalScore(id, toMalScore(score)),
  startRewatch: (id, progress) => saveMalProgress(id, progress, 'REPEATING'),
  saveStatus: (id, status, progress, repeat) => saveMalListStatus(id, status, progress, repeat),
  saveEntry: (id, write) => saveMalEntry(id, write),
  deleteEntry: (id) => deleteMalEntry(id),
  saveNotes: (id, notes) => saveMalNotes(id, notes),
});

const TRACKERS: readonly TrackerService[] = [anilistTracker, malTracker];

/** Services connectés, éventuellement restreints à `only` (nouvelle tentative ciblée). */
export async function getConnectedTrackers(only: readonly TrackerId[] | null = null): Promise<TrackerService[]> {
  const candidates = only ? TRACKERS.filter((t) => only.includes(t.id)) : TRACKERS;
  const connected = await Promise.all(candidates.map((t) => t.isConnected()));
  return candidates.filter((_, i) => connected[i]);
}
