import { isEpisodeInfo, type EpisodeInfo } from './episode.types';
import { isRecord } from './guards';
import { isSessionEpochs, liveServices, pickSessions, sessionsOf, type SessionEpochs } from './session-epochs';
import { isTrackerId, type TrackerId } from './tracker.types';

/**
 * Synchronisation en échec passager (réseau, limite de requêtes, erreur serveur), relancée
 * automatiquement par le service worker via chrome.alarms.
 * - pending : sera retentée à `nextAttemptAt`
 * - failed  : abandonnée après la dernière tentative ; l'utilisateur choisit « Réessayer » ou « Abandonner »
 */
export interface SyncQueueItem {
  /** Identifiant stable : `${platform}:${episodeId}` (une seule entrée par épisode) */
  id: string;
  episode: EpisodeInfo;
  /** Services à relancer (seulement ceux en échec) ; null = tous les services de `epochs` */
  services: TrackerId[] | null;
  /** Sessions ouvertes au premier échec : jamais relancé sur une autre (absent : élément antérieur à la 2.2.0) */
  epochs?: SessionEpochs;
  attempts: number;
  status: 'pending' | 'failed';
  /** Prochaine tentative (ms) — sans objet si status = failed */
  nextAttemptAt: number;
  /** Premier échec (ms) : sert au délai d'abandon (~24 h) */
  firstFailedAt: number;
  /** Dernière erreur, en français, affichée dans le popup */
  lastError: string;
}

/** Élément rattaché à ses sessions, services explicites */
export type BoundQueueItem = SyncQueueItem & { services: TrackerId[]; epochs: SessionEpochs };

export function queueItemId(episode: Pick<EpisodeInfo, 'platform' | 'episodeId'>): string {
  return `${episode.platform}:${episode.episodeId}`;
}

export function isSyncQueueItem(value: unknown): value is SyncQueueItem {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    isEpisodeInfo(value.episode) &&
    (value.services === null || (Array.isArray(value.services) && value.services.every(isTrackerId))) &&
    (value.epochs === undefined || isSessionEpochs(value.epochs)) &&
    typeof value.attempts === 'number' &&
    (value.status === 'pending' || value.status === 'failed') &&
    typeof value.nextAttemptAt === 'number' &&
    typeof value.firstFailedAt === 'number' &&
    typeof value.lastError === 'string'
  );
}

/**
 * Élément réduit aux services dont la session de création est toujours ouverte (`current`), null s'il n'en reste
 * aucun. Une liste `null` (« tous ») devient la liste explicite de ces services. Sans `epochs` (élément antérieur à
 * la 2.2.0) : `legacy` décide (session courante à la relance, aucune à la purge d'une déconnexion).
 */
export function restrictToSession(item: SyncQueueItem, current: SessionEpochs, legacy: 'current' | 'none' = 'none'): BoundQueueItem | null {
  if (item.epochs === undefined && legacy === 'none') return null;
  const epochs = sessionsOf(item.epochs, current);
  const live = liveServices(epochs, current);
  const services = item.services === null ? live : item.services.filter((s) => live.includes(s));
  if (services.length === 0) return null;
  return { ...item, services, epochs: pickSessions(epochs, services) };
}
