// Barre d'état du popup et du panneau latéral (docs/design/README.md › Status bar) : état affiché et logos des comptes,
// fonctions pures (testées). Un seul état à la fois, par priorité :
// synchros en échec › à vérifier (et relances en attente) › relances en attente › session expirée › aucun compte ›
// import ou alignement en cours › import prêt › synchro terminée non vue › import terminé non vu › à noter › Synchro… ›
// tout est synchronisé. « Synchro terminée » et « Import terminé » restent jusqu'à ce que l'utilisateur les ait vus
// (× ou clic), 24 h au plus. Les comptes en cours de lecture n'affichent rien (pas d'« Aucun compte » fugitif).
import type { ImportPlatform } from '../shared/cr-import';
import type { JobStatus } from '../shared/job';
import type { RecentSync } from '../shared/review.types';
import { TRACKER_IDS, type TrackerId } from '../shared/tracker.types';
import type { AccountState } from './state';

/** Durée maximale de « Synchro terminée », « Import terminé », « Import prêt » et d'une tâche sans signe de vie */
export const SEEN_MAX_MS = 24 * 60 * 60 * 1000;
/** « Synchro… » ignoré au-delà : service worker arrêté pendant l'écriture (le signal n'a pas été retiré) */
export const SYNC_ACTIVITY_MAX_MS = 60_000;

/** Tâche d'import d'historique (analyse puis application), réduite par ui/status-bar-source.ts */
export interface ImportJobView {
  phase: 'analyze' | 'apply';
  status: JobStatus;
  done: number;
  total: number;
  /** Séries écrites (application) */
  updated: number;
  updatedAt: number;
  platform: ImportPlatform;
  /** Analyse terminée : séries de l'aperçu à valider ; null sans aperçu */
  planItems: number | null;
}

/** Alignement des listes AniList ↔ MAL (Activité › Écarts) */
export interface AlignJobView {
  status: JobStatus;
  done: number;
  total: number;
  updatedAt: number;
}

export interface StatusBarInput {
  accounts: Readonly<Record<TrackerId, AccountState<unknown>>>;
  /** Cartes « À vérifier » */
  reviews: number;
  /** File de synchro : abandonnées (à traiter) et en attente de relance automatique */
  queue: { failed: number; pending: number };
  /** Séries terminées dont la note a été reportée (Activité › À noter) */
  toRate: number;
  /** Dernières synchros, la plus récente en premier */
  recentSyncs: readonly RecentSync[];
  /** Dernière fois où l'utilisateur a vu les synchros / la fin de l'import (× ou clic), null : jamais */
  syncsSeenAt: number | null;
  importSeenAt: number | null;
  importJob: ImportJobView | null;
  alignJob: AlignJobView | null;
  /** Début de la synchro en cours (signal du service worker), null sans synchro */
  syncStartedAt: number | null;
  now: number;
}

export type StatusBarState =
  | { kind: 'loading' }
  | { kind: 'queue-failed'; count: number }
  /** Cartes « À vérifier », et relances en attente à la suite (« 2 à vérifier · 1 en attente ») */
  | { kind: 'review'; count: number; pending: number }
  | { kind: 'queue-pending'; count: number }
  | { kind: 'expired'; service: TrackerId }
  | { kind: 'none' }
  /** Import ou alignement en cours ; `platform` : import seulement */
  | { kind: 'job'; job: 'import' | 'align'; platform: ImportPlatform | null; done: number; total: number }
  | { kind: 'import-ready'; platform: ImportPlatform; count: number }
  /** Synchros non vues : nombre d'épisodes, série et épisode de la plus récente */
  | { kind: 'synced'; count: number; series: string; episode: number; latestAt: number }
  | { kind: 'import-done'; platform: ImportPlatform; count: number; at: number }
  | { kind: 'to-rate'; count: number }
  | { kind: 'syncing' }
  | { kind: 'ok'; lastSyncAt: number | null };

export type AccountLogoState = 'none' | 'connected' | 'expired';

/** Logos des comptes : connecté, session expirée (logo grisé, point rouge), jamais connecté ou en lecture (aucun logo) */
export function accountLogos(accounts: StatusBarInput['accounts']): { service: TrackerId; state: AccountLogoState }[] {
  return TRACKER_IDS.map((service) => {
    const state = accounts[service];
    return { service, state: state.status === 'logged-in' ? 'connected' : state.status === 'logged-out' && state.expired ? 'expired' : 'none' };
  });
}

/** Moment encore dans la fenêtre « non vu » : après la marque, moins de 24 h */
const unseen = (at: number, seenAt: number | null, now: number): boolean => (seenAt === null || at > seenAt) && now - at < SEEN_MAX_MS;

/**
 * Synchros non vues : chaque épisode compte (synchros précédentes de la même saison comprises, `earlierSyncs`) ; la plus
 * récente est nommée. null si aucune
 */
export function unseenSyncs(syncs: readonly RecentSync[], seenAt: number | null, now: number): { count: number; latest: RecentSync } | null {
  let count = 0;
  let latest: RecentSync | null = null;
  for (const sync of syncs) {
    const times = [sync.syncedAt, ...(sync.earlierSyncs ?? [])].filter((at) => unseen(at, seenAt, now));
    if (times.length === 0) continue;
    count += times.length;
    if (unseen(sync.syncedAt, seenAt, now) && (latest === null || sync.syncedAt > latest.syncedAt)) latest = sync;
  }
  return latest ? { count, latest } : null;
}

/** Tâche en cours, avec un signe de vie de moins de 24 h (une tâche jamais reprise ne reste pas affichée) */
const running = (job: { status: JobStatus; updatedAt: number } | null, now: number): boolean => job?.status === 'running' && now - job.updatedAt < SEEN_MAX_MS;

export function statusBarState(input: StatusBarInput): StatusBarState {
  const { accounts, now } = input;
  if (TRACKER_IDS.some((service) => accounts[service].status === 'loading')) return { kind: 'loading' };
  const connected = TRACKER_IDS.some((service) => accounts[service].status === 'logged-in');
  const expired = TRACKER_IDS.find((service) => {
    const state = accounts[service];
    return state.status === 'logged-out' && state.expired;
  });
  const { failed, pending } = input.queue;

  if (connected && failed > 0) return { kind: 'queue-failed', count: failed };
  if (connected && input.reviews > 0) return { kind: 'review', count: input.reviews, pending };
  if (connected && pending > 0) return { kind: 'queue-pending', count: pending };
  if (expired) return { kind: 'expired', service: expired };
  if (!connected) return { kind: 'none' };

  const { importJob, alignJob } = input;
  if (importJob && running(importJob, now)) return { kind: 'job', job: 'import', platform: importJob.platform, done: importJob.done, total: importJob.total };
  if (alignJob && running(alignJob, now)) return { kind: 'job', job: 'align', platform: null, done: alignJob.done, total: alignJob.total };
  if (importJob?.phase === 'analyze' && importJob.status === 'done' && importJob.planItems !== null && importJob.planItems > 0 && now - importJob.updatedAt < SEEN_MAX_MS) {
    return { kind: 'import-ready', platform: importJob.platform, count: importJob.planItems };
  }
  const synced = unseenSyncs(input.recentSyncs, input.syncsSeenAt, now);
  if (synced) return { kind: 'synced', count: synced.count, series: synced.latest.mediaTitle, episode: synced.latest.progress, latestAt: synced.latest.syncedAt };
  if (importJob?.phase === 'apply' && importJob.status === 'done' && unseen(importJob.updatedAt, input.importSeenAt, now)) {
    return { kind: 'import-done', platform: importJob.platform, count: importJob.updated, at: importJob.updatedAt };
  }
  // Une note reportée n'empêche rien de fonctionner
  if (input.toRate > 0) return { kind: 'to-rate', count: input.toRate };
  if (input.syncStartedAt !== null && now - input.syncStartedAt < SYNC_ACTIVITY_MAX_MS) return { kind: 'syncing' };
  const lastSyncAt = input.recentSyncs.reduce<number | null>((latest, sync) => (latest === null || sync.syncedAt > latest ? sync.syncedAt : latest), null);
  return { kind: 'ok', lastSyncAt };
}
