import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale, t } from '../../i18n';
import type { EpisodeInfo } from '../../shared/episode.types';
import type { SyncQueueItem } from '../../shared/queue.types';
import type { SyncOutcome } from '../../shared/sync.types';
import { installFakeChrome } from '../../test/fake-chrome';

// File de relance : vrai queue.ts, vrai stockage et vraies alarmes (fausse API chrome partagée), Web Locks en
// file par nom avec `ifAvailable` ; syncEpisode relevé.

const mocks = vi.hoisted(() => ({ syncEpisode: vi.fn<(...args: unknown[]) => Promise<SyncOutcome>>() }));
vi.mock('./sync-service', () => ({ syncEpisode: mocks.syncEpisode }));
vi.mock('../../shared/badge', () => ({ refreshReviewBadge: async () => undefined }));

const fake = installFakeChrome();

const { processSyncQueue, QUEUE_ALARM, recordSyncOutcome, retryQueued } = await import('./queue');
const { BACKOFF_MS } = await import('./queue-policy');
const { getSyncQueue, SYNC_QUEUE_KEY } = await import('../../shared/sync-queue-store');

setLocale('fr');

const episodeN = (n: number): EpisodeInfo => ({
  platform: 'crunchyroll',
  episodeId: `EP${n}`,
  seriesId: 'GSERIES',
  seriesSlug: 'serie',
  animeTitle: 'Série',
  seasonNumber: 1,
  seasonTitle: null,
  seasonEpisodeNumber: n,
  displayedEpisodeNumber: n,
  episodeTitle: null,
  url: `https://www.crunchyroll.com/watch/EP${n}`,
});
const episode = episodeN(5);

const item = (overrides: Partial<SyncQueueItem> = {}): SyncQueueItem => ({
  id: 'crunchyroll:EP5',
  episode,
  services: null,
  attempts: 1,
  status: 'pending',
  nextAttemptAt: 0,
  firstFailedAt: Date.now(),
  lastError: 'Hors ligne',
  ...overrides,
});

const SYNCED: SyncOutcome = { status: 'synced', mediaTitle: 'Série', results: [] };
const NETWORK: SyncOutcome = { status: 'error', message: 'Connexion impossible.', code: 'NETWORK' };
/** AniList hors ligne, MAL écrit */
const PARTIAL: SyncOutcome = {
  status: 'synced',
  mediaTitle: 'Série',
  results: [
    { service: 'anilist', outcome: { status: 'error', message: 'Connexion impossible.', code: 'NETWORK' } },
    { service: 'mal', outcome: { status: 'updated', progress: 5, completed: false } },
  ],
};

/** Sessions AniList et MAL ouvertes, première génération */
const BOTH = { anilist: 0, mal: 0 };
const BOTH_OPEN = {
  anilistToken: { accessToken: 'A', expiresAt: Number.MAX_SAFE_INTEGER },
  malToken: { accessToken: 'M', refreshToken: 'R', expiresAt: Number.MAX_SAFE_INTEGER },
  sessionEpoch: BOTH,
};

/** Compte B connecté sur AniList (génération 1 : le compte A a été déconnecté), MAL de la génération 0 */
function signedInAsB(withMal = false): void {
  fake.reset({
    anilistToken: { accessToken: 'B', expiresAt: Number.MAX_SAFE_INTEGER },
    ...(withMal ? { malToken: { accessToken: 'M', refreshToken: 'R', expiresAt: Number.MAX_SAFE_INTEGER } } : {}),
    sessionEpoch: { anilist: 1, mal: 0 },
  });
}

/** Réponse de syncEpisode retenue jusqu'à ce que le test la libère */
function deferredOutcome(): { promise: Promise<SyncOutcome>; resolve: (outcome: SyncOutcome) => void } {
  let resolve: (outcome: SyncOutcome) => void = () => undefined;
  const promise = new Promise<SyncOutcome>((r) => (resolve = r));
  return { promise, resolve };
}

beforeEach(() => {
  fake.reset();
  mocks.syncEpisode.mockReset();
  mocks.syncEpisode.mockResolvedValue(SYNCED);
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('relance de la file (DATA-01)', () => {
  it('élément enregistré sous le compte A (génération 0) relancé sous le compte B : retiré sans écriture', async () => {
    signedInAsB();
    fake.local.data.set(SYNC_QUEUE_KEY, [item({ epochs: { anilist: 0 } })]);
    await processSyncQueue();
    expect(mocks.syncEpisode).not.toHaveBeenCalled();
    expect(await getSyncQueue()).toEqual([]);
  });

  it('« Réessayer » sur un élément de l’ancien compte : retiré avec un message, sans écriture', async () => {
    signedInAsB();
    fake.local.data.set(SYNC_QUEUE_KEY, [item({ status: 'failed', epochs: { anilist: 0 } })]);
    expect(await retryQueued('crunchyroll:EP5')).toEqual({ status: 'error', message: expect.stringContaining('compte déconnecté') });
    expect(mocks.syncEpisode).not.toHaveBeenCalled();
    expect(await getSyncQueue()).toEqual([]);
  });

  it('AniList changé, MAL inchangé : relancé sur MAL seul, avec la session MAL de l’échec', async () => {
    signedInAsB(true);
    fake.local.data.set(SYNC_QUEUE_KEY, [item({ epochs: { anilist: 0, mal: 0 } })]);
    await processSyncQueue();
    expect(mocks.syncEpisode).toHaveBeenCalledWith(episode, ['mal'], { mal: 0 });
    expect(await getSyncQueue()).toEqual([]);
  });

  it('élément antérieur à la 2.2.0 encore présent (aucune déconnexion depuis) : relancé sur la session courante', async () => {
    signedInAsB();
    fake.local.data.set(SYNC_QUEUE_KEY, [item()]);
    await processSyncQueue();
    expect(mocks.syncEpisode).toHaveBeenCalledWith(episode, ['anilist'], { anilist: 1 });
  });
});

describe('mise en file (DATA-01)', () => {
  it('échec passager d’une synchro commencée sous le compte A, terminée après sa déconnexion : rien en file', async () => {
    signedInAsB();
    expect(await recordSyncOutcome(episode, null, NETWORK, { anilist: 0 })).toEqual(NETWORK);
    expect(await getSyncQueue()).toEqual([]);
  });

  it('échec passager sous la session courante : en file, lié à cette session', async () => {
    signedInAsB();
    expect(await recordSyncOutcome(episode, null, NETWORK, { anilist: 1 })).toMatchObject({ queued: true });
    expect(await getSyncQueue()).toMatchObject([{ services: ['anilist'], epochs: { anilist: 1 } }]);
  });
});

describe('cycle de la file et alarme de relance (TEST-07)', () => {
  const T0 = 1_000_000_000_000;

  beforeEach(() => {
    fake.reset(BOTH_OPEN);
    vi.useFakeTimers({ toFake: ['Date'], now: T0 });
  });

  // Entrée réduite aux sessions ouvertes : « tous les services » devient la liste explicite des deux comptes
  it('échec réseau : entrée pending et alarme ; avant l’échéance rien n’est relancé ; succès ultérieur : file vidée, alarme retirée', async () => {
    expect(await recordSyncOutcome(episode, null, NETWORK, BOTH)).toEqual({ ...NETWORK, queued: true });
    expect(await getSyncQueue()).toEqual([
      { id: 'crunchyroll:EP5', episode, services: ['anilist', 'mal'], epochs: BOTH, attempts: 1, status: 'pending', nextAttemptAt: T0 + BACKOFF_MS[0], firstFailedAt: T0, lastError: NETWORK.message },
    ]);
    expect(await chrome.alarms.get(QUEUE_ALARM)).toMatchObject({ scheduledTime: T0 + BACKOFF_MS[0] });

    // Alarme réveillée trop tôt (ou démarrage du navigateur) : l'entrée n'est pas due
    await processSyncQueue();
    expect(mocks.syncEpisode).not.toHaveBeenCalled();
    expect(await chrome.alarms.get(QUEUE_ALARM)).toMatchObject({ scheduledTime: T0 + BACKOFF_MS[0] });

    vi.setSystemTime(T0 + BACKOFF_MS[0]);
    await processSyncQueue();
    expect(mocks.syncEpisode).toHaveBeenCalledExactlyOnceWith(episode, ['anilist', 'mal'], BOTH);
    expect(await getSyncQueue()).toEqual([]);
    expect(fake.local.peek(SYNC_QUEUE_KEY)).toBeUndefined();
    expect(await chrome.alarms.get(QUEUE_ALARM)).toBeUndefined();
  });

  it('nouvel échec à la relance : tentative comptée et alarme replanifiée selon le délai suivant', async () => {
    fake.local.data.set(SYNC_QUEUE_KEY, [item({ epochs: BOTH, firstFailedAt: T0 })]);
    mocks.syncEpisode.mockResolvedValue(NETWORK);
    await processSyncQueue();
    expect(await getSyncQueue()).toMatchObject([{ attempts: 2, status: 'pending', nextAttemptAt: T0 + BACKOFF_MS[1] }]);
    expect(await chrome.alarms.get(QUEUE_ALARM)).toMatchObject({ scheduledTime: T0 + BACKOFF_MS[1] });
  });

  it('succès partiel `only=[\'mal\']` d’une synchro en direct : MAL retiré de l’entrée, AniList conservé avec l’alarme', async () => {
    fake.local.data.set(SYNC_QUEUE_KEY, [item({ services: ['anilist', 'mal'], epochs: BOTH, nextAttemptAt: T0 + BACKOFF_MS[0] })]);
    const synced: SyncOutcome = { status: 'synced', mediaTitle: 'Série', results: [{ service: 'mal', outcome: { status: 'updated', progress: 5, completed: false } }] };
    expect(await recordSyncOutcome(episode, ['mal'], synced, BOTH)).toEqual(synced);
    expect(await getSyncQueue()).toMatchObject([{ services: ['anilist'], status: 'pending' }]);
    expect(await chrome.alarms.get(QUEUE_ALARM)).toMatchObject({ scheduledTime: T0 + BACKOFF_MS[0] });
  });

  it('relance en succès partiel (AniList hors ligne, MAL écrit) : seul AniList reste en file', async () => {
    fake.local.data.set(SYNC_QUEUE_KEY, [item({ epochs: BOTH, firstFailedAt: T0 })]);
    mocks.syncEpisode.mockResolvedValue(PARTIAL);
    await processSyncQueue();
    expect(await getSyncQueue()).toMatchObject([{ services: ['anilist'], attempts: 2, status: 'pending', nextAttemptAt: T0 + BACKOFF_MS[1] }]);
    expect(await chrome.alarms.get(QUEUE_ALARM)).toBeDefined();
  });

  it('vérification demandée ensuite (résolu) : entrée retirée et alarme supprimée', async () => {
    fake.local.data.set(SYNC_QUEUE_KEY, [item({ epochs: BOTH, nextAttemptAt: T0 + BACKOFF_MS[0] })]);
    await chrome.alarms.create(QUEUE_ALARM, { when: T0 + BACKOFF_MS[0] });
    await recordSyncOutcome(episode, null, { status: 'needs-review', reason: 'À vérifier' }, BOTH);
    expect(await getSyncQueue()).toEqual([]);
    expect(await chrome.alarms.get(QUEUE_ALARM)).toBeUndefined();
  });

  it('deux processSyncQueue simultanés (alarme et démarrage) : un seul syncEpisode', async () => {
    fake.local.data.set(SYNC_QUEUE_KEY, [item({ epochs: BOTH })]);
    const pending = deferredOutcome();
    mocks.syncEpisode.mockReturnValue(pending.promise);

    const first = processSyncQueue();
    // Laisse la première exécution prendre le verrou et appeler syncEpisode
    await vi.waitFor(() => expect(mocks.syncEpisode).toHaveBeenCalledTimes(1));
    await processSyncQueue();
    expect(mocks.syncEpisode).toHaveBeenCalledTimes(1);

    pending.resolve(SYNCED);
    await first;
    expect(mocks.syncEpisode).toHaveBeenCalledTimes(1);
    expect(await getSyncQueue()).toEqual([]);
  });

  it('« Réessayer » sur une entrée disparue : message « n’existe plus », aucune synchro', async () => {
    expect(await retryQueued('crunchyroll:EP404')).toEqual({ status: 'error', message: t('queue.gone') });
    expect(mocks.syncEpisode).not.toHaveBeenCalled();
  });

  it('une relance qui lève n’arrête pas les éléments suivants ; l’élément reste en file avec l’alarme', async () => {
    vi.useFakeTimers({ now: T0 });
    fake.local.data.set(SYNC_QUEUE_KEY, [item({ epochs: BOTH }), item({ id: 'crunchyroll:EP6', episode: episodeN(6), epochs: BOTH, nextAttemptAt: 1 })]);
    mocks.syncEpisode.mockRejectedValueOnce(new Error('inattendue'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const run = processSyncQueue();
    // Pause d'une seconde entre deux relances
    await vi.runAllTimersAsync();
    await run;
    expect(mocks.syncEpisode).toHaveBeenCalledTimes(2);
    expect(mocks.syncEpisode).toHaveBeenLastCalledWith(episodeN(6), ['anilist', 'mal'], BOTH);
    expect(await getSyncQueue()).toMatchObject([{ id: 'crunchyroll:EP5', attempts: 1 }]);
    expect(await chrome.alarms.get(QUEUE_ALARM)).toBeDefined();
  });
});
