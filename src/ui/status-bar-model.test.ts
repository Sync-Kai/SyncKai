import { describe, expect, it } from 'vitest';
import type { EpisodeInfo } from '../shared/episode.types';
import type { RecentSync } from '../shared/review.types';
import type { AccountState } from './state';
import { accountLogos, SEEN_MAX_MS, statusBarState, SYNC_ACTIVITY_MAX_MS, unseenSyncs, type AlignJobView, type ImportJobView, type StatusBarInput } from './status-bar-model';

// Barre d'état (popup et panneau) : priorités de l'état affiché, synchros terminées non vues (24 h au plus), import et
// alignement en cours, logos des comptes (jamais connecté / session expirée)

const IN: AccountState<unknown> = { status: 'logged-in', viewer: null, error: null };
const OUT: AccountState<unknown> = { status: 'logged-out', pending: false, error: null, expired: false };
const EXPIRED: AccountState<unknown> = { status: 'logged-out', pending: false, error: null, expired: true };
const NOW = 1_800_000_000_000;
const MIN = 60_000;
const HOUR = 60 * MIN;

const episode = (n: number): EpisodeInfo => ({
  platform: 'crunchyroll',
  episodeId: `EP${n}`,
  seriesId: `G${n}`,
  seriesSlug: 'serie',
  animeTitle: `Série ${n}`,
  seasonNumber: 1,
  seasonTitle: null,
  seasonEpisodeNumber: n,
  displayedEpisodeNumber: n,
  episodeTitle: null,
  url: `https://www.crunchyroll.com/watch/EP${n}`,
});

const sync = (n: number, syncedAt: number, earlierSyncs?: number[]): RecentSync => ({
  key: `crunchyroll:G${n}:s1`,
  episode: episode(n),
  mediaId: n,
  mediaTitle: `Fiche ${n}`,
  progress: n,
  syncedAt,
  ...(earlierSyncs ? { earlierSyncs } : {}),
});

const importJob = (patch: Partial<ImportJobView> = {}): ImportJobView => ({
  phase: 'apply',
  status: 'running',
  done: 42,
  total: 120,
  updated: 0,
  updatedAt: NOW - MIN,
  platform: 'crunchyroll',
  planItems: null,
  ...patch,
});

const alignJob = (patch: Partial<AlignJobView> = {}): AlignJobView => ({ status: 'running', done: 3, total: 10, updatedAt: NOW - MIN, ...patch });

function input(patch: Partial<StatusBarInput> = {}): StatusBarInput {
  return {
    accounts: { anilist: IN, mal: OUT },
    reviews: 0,
    queue: { failed: 0, pending: 0 },
    toRate: 0,
    recentSyncs: [],
    syncsSeenAt: null,
    importSeenAt: null,
    importJob: null,
    alignJob: null,
    syncStartedAt: null,
    now: NOW,
    ...patch,
  };
}

describe('statusBarState : priorités', () => {
  it('échecs, puis « À vérifier » (avec les relances en attente), puis relances seules', () => {
    expect(statusBarState(input({ queue: { failed: 2, pending: 3 }, reviews: 1 }))).toEqual({ kind: 'queue-failed', count: 2 });
    expect(statusBarState(input({ queue: { failed: 0, pending: 3 }, reviews: 1 }))).toEqual({ kind: 'review', count: 1, pending: 3 });
    expect(statusBarState(input({ reviews: 2 }))).toEqual({ kind: 'review', count: 2, pending: 0 });
    expect(statusBarState(input({ queue: { failed: 0, pending: 3 } }))).toEqual({ kind: 'queue-pending', count: 3 });
  });

  it('session expirée : après la file, avant tout le reste ; sans compte connecté, l’emporte sur « aucun compte »', () => {
    const accounts = { anilist: IN, mal: EXPIRED };
    expect(statusBarState(input({ accounts, queue: { failed: 1, pending: 0 } }))).toEqual({ kind: 'queue-failed', count: 1 });
    expect(statusBarState(input({ accounts, queue: { failed: 0, pending: 1 } }))).toEqual({ kind: 'queue-pending', count: 1 });
    expect(statusBarState(input({ accounts, toRate: 2, recentSyncs: [sync(1, NOW - MIN)] }))).toEqual({ kind: 'expired', service: 'mal' });
    expect(statusBarState(input({ accounts: { anilist: EXPIRED, mal: OUT }, reviews: 4 }))).toEqual({ kind: 'expired', service: 'anilist' });
  });

  it('aucun compte connecté : file, vérifications, synchros et tâches ignorées', () => {
    expect(
      statusBarState(input({ accounts: { anilist: OUT, mal: OUT }, reviews: 3, queue: { failed: 1, pending: 1 }, recentSyncs: [sync(1, NOW - MIN)], importJob: importJob() })),
    ).toEqual({ kind: 'none' });
  });

  it('comptes en cours de lecture : aucun message (pas d’« Aucun compte connecté » fugitif à l’ouverture)', () => {
    expect(statusBarState(input({ accounts: { anilist: { status: 'loading' }, mal: OUT } }))).toEqual({ kind: 'loading' });
    expect(statusBarState(input({ accounts: { anilist: IN, mal: { status: 'loading' } }, reviews: 2 }))).toEqual({ kind: 'loading' });
  });

  it('synchro terminée non vue : après échecs, vérifications, relances et session expirée ; avant les notes, « Synchro… » et « à jour »', () => {
    const recentSyncs = [sync(1, NOW - MIN)];
    const synced = { kind: 'synced', count: 1, series: 'Fiche 1', episode: 1, latestAt: NOW - MIN };
    expect(statusBarState(input({ recentSyncs, reviews: 1 }))).toEqual({ kind: 'review', count: 1, pending: 0 });
    expect(statusBarState(input({ recentSyncs, queue: { failed: 0, pending: 1 } }))).toEqual({ kind: 'queue-pending', count: 1 });
    expect(statusBarState(input({ recentSyncs, toRate: 2, syncStartedAt: NOW - 1000 }))).toEqual(synced);
    expect(statusBarState(input({ recentSyncs }))).toEqual(synced);
  });

  it('import et alignement en cours : avant la synchro non vue ; import prêt ensuite ; import terminé après la synchro', () => {
    const recentSyncs = [sync(1, NOW - MIN)];
    expect(statusBarState(input({ recentSyncs, importJob: importJob() }))).toEqual({ kind: 'job', job: 'import', platform: 'crunchyroll', done: 42, total: 120 });
    expect(statusBarState(input({ recentSyncs, alignJob: alignJob() }))).toEqual({ kind: 'job', job: 'align', platform: null, done: 3, total: 10 });
    // Import et alignement à la fois : l'import d'abord
    expect(statusBarState(input({ importJob: importJob({ phase: 'analyze', platform: 'adn' }), alignJob: alignJob() }))).toMatchObject({ kind: 'job', job: 'import', platform: 'adn' });
    const ready = importJob({ phase: 'analyze', status: 'done', planItems: 38, platform: 'netflix' });
    expect(statusBarState(input({ importJob: ready, recentSyncs }))).toEqual({ kind: 'import-ready', platform: 'netflix', count: 38 });
    const done = importJob({ status: 'done', updated: 36, updatedAt: NOW - HOUR });
    expect(statusBarState(input({ importJob: done, recentSyncs }))).toMatchObject({ kind: 'synced' });
    expect(statusBarState(input({ importJob: done, toRate: 1 }))).toEqual({ kind: 'import-done', platform: 'crunchyroll', count: 36, at: NOW - HOUR });
  });

  it('notes reportées, puis « Synchro… », puis « à jour »', () => {
    expect(statusBarState(input({ toRate: 2, syncStartedAt: NOW - 1000 }))).toEqual({ kind: 'to-rate', count: 2 });
    expect(statusBarState(input({ syncStartedAt: NOW - 1000 }))).toEqual({ kind: 'syncing' });
    expect(statusBarState(input())).toEqual({ kind: 'ok', lastSyncAt: null });
  });

  it('« à jour » : date de la dernière synchro, même vue', () => {
    expect(statusBarState(input({ recentSyncs: [sync(2, NOW - 5 * MIN), sync(1, NOW - HOUR)], syncsSeenAt: NOW - MIN }))).toEqual({ kind: 'ok', lastSyncAt: NOW - 5 * MIN });
  });
});

describe('synchro terminée : vue (× ou clic) et 24 h au plus', () => {
  it('vue : plus affichée ; une synchro plus récente que la marque réapparaît', () => {
    expect(statusBarState(input({ recentSyncs: [sync(1, NOW - 10 * MIN)], syncsSeenAt: NOW - 5 * MIN }))).toMatchObject({ kind: 'ok' });
    expect(statusBarState(input({ recentSyncs: [sync(2, NOW - MIN), sync(1, NOW - 10 * MIN)], syncsSeenAt: NOW - 5 * MIN }))).toEqual({
      kind: 'synced',
      count: 1,
      series: 'Fiche 2',
      episode: 2,
      latestAt: NOW - MIN,
    });
  });

  it('plus de 24 h : plus affichée, même jamais vue', () => {
    expect(statusBarState(input({ recentSyncs: [sync(1, NOW - SEEN_MAX_MS)] }))).toMatchObject({ kind: 'ok', lastSyncAt: NOW - SEEN_MAX_MS });
    expect(statusBarState(input({ recentSyncs: [sync(1, NOW - SEEN_MAX_MS + MIN)] }))).toMatchObject({ kind: 'synced' });
  });

  it('une nouvelle synchro s’ajoute au compte (autres séries et épisodes précédents de la même saison), série la plus récente nommée', () => {
    const recentSyncs = [sync(3, NOW - MIN, [NOW - 30 * MIN, NOW - 50 * MIN]), sync(2, NOW - 20 * MIN), sync(1, NOW - 2 * HOUR)];
    expect(unseenSyncs(recentSyncs, NOW - HOUR, NOW)).toEqual({ count: 4, latest: recentSyncs[0] });
    expect(statusBarState(input({ recentSyncs, syncsSeenAt: NOW - HOUR }))).toEqual({ kind: 'synced', count: 4, series: 'Fiche 3', episode: 3, latestAt: NOW - MIN });
    // Épisodes précédents vus ou trop anciens : non comptés
    expect(unseenSyncs([sync(3, NOW - MIN, [NOW - 30 * MIN, NOW - SEEN_MAX_MS - MIN])], NOW - 40 * MIN, NOW)?.count).toBe(2);
    expect(unseenSyncs([sync(3, NOW - MIN)], NOW, NOW)).toBeNull();
  });
});

describe('import : en cours, prêt, terminé', () => {
  it('terminé : jusqu’à ce que l’utilisateur l’ait vu, 24 h au plus', () => {
    const done = importJob({ status: 'done', updated: 36, updatedAt: NOW - HOUR });
    expect(statusBarState(input({ importJob: done }))).toMatchObject({ kind: 'import-done', count: 36 });
    expect(statusBarState(input({ importJob: done, importSeenAt: NOW - MIN }))).toMatchObject({ kind: 'ok' });
    expect(statusBarState(input({ importJob: { ...done, updatedAt: NOW - SEEN_MAX_MS } }))).toMatchObject({ kind: 'ok' });
  });

  it('prêt : analyse terminée avec des séries à valider, 24 h au plus ; aperçu vide ou absent : rien', () => {
    const ready = importJob({ phase: 'analyze', status: 'done', planItems: 2, updatedAt: NOW - HOUR });
    expect(statusBarState(input({ importJob: ready }))).toEqual({ kind: 'import-ready', platform: 'crunchyroll', count: 2 });
    expect(statusBarState(input({ importJob: { ...ready, planItems: 0 } }))).toMatchObject({ kind: 'ok' });
    expect(statusBarState(input({ importJob: { ...ready, planItems: null } }))).toMatchObject({ kind: 'ok' });
    expect(statusBarState(input({ importJob: { ...ready, updatedAt: NOW - SEEN_MAX_MS } }))).toMatchObject({ kind: 'ok' });
  });

  it('arrêtée ou interrompue : rien ; en cours sans signe de vie depuis 24 h : rien', () => {
    expect(statusBarState(input({ importJob: importJob({ status: 'cancelled' }) }))).toMatchObject({ kind: 'ok' });
    expect(statusBarState(input({ importJob: importJob({ status: 'stopped' }) }))).toMatchObject({ kind: 'ok' });
    expect(statusBarState(input({ importJob: importJob({ updatedAt: NOW - SEEN_MAX_MS }) }))).toMatchObject({ kind: 'ok' });
    expect(statusBarState(input({ alignJob: alignJob({ status: 'done' }) }))).toMatchObject({ kind: 'ok' });
  });
});

describe('« Synchro… »', () => {
  it('signal du service worker borné : ignoré au-delà de SYNC_ACTIVITY_MAX_MS (service worker arrêté pendant l’écriture)', () => {
    expect(statusBarState(input({ syncStartedAt: NOW - SYNC_ACTIVITY_MAX_MS + 1000 }))).toEqual({ kind: 'syncing' });
    expect(statusBarState(input({ syncStartedAt: NOW - SYNC_ACTIVITY_MAX_MS }))).toMatchObject({ kind: 'ok' });
  });
});

describe('accountLogos', () => {
  it('connecté, session expirée, jamais connecté (aucun logo) ; en cours de lecture : aucun logo', () => {
    expect(accountLogos({ anilist: IN, mal: EXPIRED })).toEqual([
      { service: 'anilist', state: 'connected' },
      { service: 'mal', state: 'expired' },
    ]);
    expect(accountLogos({ anilist: { status: 'loading' }, mal: OUT })).toEqual([
      { service: 'anilist', state: 'none' },
      { service: 'mal', state: 'none' },
    ]);
  });
});
