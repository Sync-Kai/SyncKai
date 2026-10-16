import { t } from '../i18n';
import { isSessionOpen } from '../browser/storage/sessions';
import { isSessionExpired } from '../browser/storage/tokens';
import type { SessionEpochs } from '../shared/session-epochs';
import type { ServiceOutcome, ServiceResult } from '../shared/sync.types';
import { TRACKER_LABELS, type TrackerId } from '../shared/tracker.types';
import { ApiError } from './errors';
import type { RequestLane } from './rate-limit';
import { withEntryLock } from './sync/entry-lock';
import type { ListEntryState } from './sync/rules';
import type { CatalogMedia, TrackerEntry, TrackerService } from './ports/tracker';
import { createLogger } from '../browser/logger';

// Écriture gardée sur une fiche d'un service (audit 1-I6 / 6-P3) : verrou de la fiche → lecture fraîche → décision pure
// → session revérifiée → écriture. Seul chemin d'écriture des actions sur une entrée (+1 / −1, statut, ajout, note,
// revisionnage, commentaire, retrait), de la synchro et de l'import : un nouveau chemin ne peut plus oublier une étape.

const log = createLogger('entry');

/** Fiche visée sur un service */
export interface EntryTarget {
  tracker: TrackerService;
  id: number;
}

/** Décision prise sur l'entrée relue : résultat sans écriture, ou écriture (faite seulement si la session est toujours ouverte) */
export type EntryStep<R> = { done: R } | { write: () => Promise<R> };

export interface GuardedWrite<R> {
  /** Session du service à laquelle appartient l'écriture : vérifiée avant le verrou puis juste avant l'écriture */
  epoch: number | undefined;
  /** File des requêtes (import : 'background', places réservées avant l'appel) */
  lane?: RequestLane;
  /** Décision pure sur l'entrée relue sous le verrou */
  decide(current: TrackerEntry): EntryStep<R>;
  /** Résultat quand la session est fermée (déconnexion, autre compte) : rien n'est écrit */
  sessionClosed(): R | Promise<R>;
}

/** Écriture gardée sur UNE fiche ; lève les erreurs d'API (l'appelant décide de leur rendu ou d'une relance). */
export async function runGuarded<R>({ tracker, id }: EntryTarget, { epoch, lane, decide, sessionClosed }: GuardedWrite<R>): Promise<R> {
  if (!(await isSessionOpen(tracker.id, epoch))) return sessionClosed();
  // Sous le verrou de la fiche : deux actions simultanées (panneau et popup, synchro et +1) ne se perdent pas
  return withEntryLock(tracker.id, id, async (): Promise<R> => {
    // Lecture fraîche juste avant l'écriture (la liste a pu changer depuis un autre appareil)
    const step = decide(await tracker.getEntry(id, lane));
    if ('done' in step) return step.done;
    // Déconnexion (puis autre compte) pendant la lecture ou l'attente du verrou : la décision vaut pour l'ancienne session
    if (!(await isSessionOpen(tracker.id, epoch))) return sessionClosed();
    return step.write();
  });
}

/**
 * Identifiant de la fiche sur un service (une seule résolution, audit 6-D9) : AniList = la fiche du catalogue ou de
 * l'écran ; MAL = l'idMal du catalogue, sinon celui de l'écran (entrée MAL sans fiche AniList, idMal absent du catalogue).
 */
export function entryTargetId(service: TrackerId, ref: { mediaId: number | null; malId: number | null }, catalog: CatalogMedia | null = null): number | null {
  return service === 'anilist' ? (catalog?.mediaId ?? ref.mediaId) : (catalog?.idMal ?? ref.malId);
}

/** Services connectés où la série a un identifiant */
export function entryTargets(trackers: readonly TrackerService[], ref: { mediaId: number | null; malId: number | null }, catalog: CatalogMedia | null = null): EntryTarget[] {
  return trackers.flatMap((tracker) => {
    const id = entryTargetId(tracker.id, ref, catalog);
    return id !== null ? [{ tracker, id }] : [];
  });
}

/** Résultat d'une action sur un service, avec l'entrée lue avant l'écriture (null : non lue, session fermée ou erreur) */
export interface ServiceRun {
  result: ServiceResult;
  title: string | null;
  entry: ListEntryState | null;
}

/** Action sur une entrée : décision pure sur l'entrée relue (résultat sans écriture, ou écriture qui rend son résultat) */
export interface EntryCommand {
  /** Libellé du journal en cas d'échec (« ajustement », « changement de statut »…) */
  readonly name: string;
  decide(current: TrackerEntry, target: EntryTarget): ServiceOutcome | (() => Promise<ServiceOutcome>);
}

function sessionExpired(service: TrackerId): ServiceOutcome {
  return { status: 'error', message: t('api.sessionExpired', { service: TRACKER_LABELS[service] }), code: 'TOKEN_INVALID' };
}

function errorOutcome(error: unknown): ServiceOutcome {
  return error instanceof ApiError ? { status: 'error', message: error.message, code: error.code } : { status: 'error', message: t('error.unexpected') };
}

/** Action sur UNE fiche ; ne lève jamais (l'échec est un résultat) */
async function runOnService(target: EntryTarget, command: EntryCommand, epochs: SessionEpochs): Promise<ServiceRun> {
  const service = target.tracker.id;
  try {
    return await runGuarded<ServiceRun>(target, {
      epoch: epochs[service],
      // Token refusé pendant l'action (la lecture a fermé la session) : « Session expirée », comme une écriture refusée
      sessionClosed: async () => ({
        result: { service, outcome: (await isSessionExpired(service)) ? sessionExpired(service) : { status: 'skipped', reason: t('sync.sessionClosed') } },
        title: null,
        entry: null,
      }),
      decide: (current) => {
        const step = command.decide(current, target);
        const run = (outcome: ServiceOutcome): ServiceRun => ({ result: { service, outcome }, title: current.title, entry: current.entry });
        return typeof step === 'function' ? { write: async () => run(await step()) } : { done: run(step) };
      },
    });
  } catch (error: unknown) {
    log.error(`${TRACKER_LABELS[service]} : échec (${command.name})`, error);
    return { result: { service, outcome: errorOutcome(error) }, title: null, entry: null };
  }
}

/**
 * Action sur chaque fiche visée, en parallèle. `epochs` : sessions auxquelles appartient l'action (relevées avant
 * toute requête, ou celles d'une carte « À noter ») ; rien n'est écrit sur une session fermée ou rouverte depuis.
 */
export function runOnServices(targets: readonly EntryTarget[], command: EntryCommand, epochs: SessionEpochs): Promise<ServiceRun[]> {
  return Promise.all(targets.map((target) => runOnService(target, command, epochs)));
}
