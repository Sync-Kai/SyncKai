import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EpisodeInfo } from '../shared/episode.types';
import type { PageMediaInfo, PageMediaView } from '../shared/page-media.types';
import type { PageMediaResponse } from '../shared/content-messages';
import type { CachedPageMedia } from '../shared/page-media-cache';
import type { PanelMedia } from '../shared/panel-media.types';
import type { PageMediaController } from './page-media-controller';

// Contrôleur « fiche de la page » (popup et panneau) avec un faux service worker (sendMessage) et un faux script de
// contenu (requestPageMedia) : chaque réponse est rendue à la main pour reproduire les courses de l'audit
// (UI-01, UI-02 du lot 6, migrés depuis le contrôleur du panneau ; ARCH-05).

interface PendingCall {
  type: string;
  payload: unknown;
  resolve: (value: unknown) => void;
}

type ChangeListener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => void;

const fake = vi.hoisted(() => ({
  calls: [] as PendingCall[],
  /** Page lue dans chaque onglet */
  pages: new Map<number, PageMediaResponse>(),
  /** Lecture de page bloquée jusqu'à `release` (détection en cours) */
  gate: null as { release: () => void; wait: Promise<void> } | null,
  /** Nombre de lectures de page (GET_PAGE_MEDIA) */
  reads: 0,
  /** Fiche en cache de l'onglet (lecture) et horodatage de la prochaine écriture */
  cached: null as CachedPageMedia | null,
  writtenAt: 1_000,
  listeners: [] as ChangeListener[],
}));

vi.mock('../shared/messages', () => ({
  sendMessage: (type: string, payload: unknown) => new Promise((resolve) => fake.calls.push({ type, payload, resolve })),
}));

vi.mock('./page-media-request', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./page-media-request')>()),
  requestPageMedia: async (tabId: number) => {
    fake.reads++;
    const gate = fake.gate;
    if (gate) await gate.wait;
    return fake.pages.has(tabId) ? fake.pages.get(tabId) : 'unreachable';
  },
}));

vi.mock('../shared/page-media-cache', async (importOriginal) => {
  const original = await importOriginal<typeof import('../shared/page-media-cache')>();
  return {
    ...original,
    readCachedPageMedia: () => Promise.resolve(fake.cached),
    storeCachedPageMedia: (_tabId: number, page: PageMediaInfo, view: PageMediaView) => Promise.resolve(original.toCachedPageMedia(page, view, 'resolve', fake.writtenAt)),
  };
});

vi.stubGlobal('chrome', {
  storage: {
    local: { get: () => Promise.resolve({}) },
    onChanged: { addListener: (listener: ChangeListener) => void fake.listeners.push(listener) },
  },
});

const { createPageMediaController } = await import('./page-media-controller');
const { sendMessage } = await import('../shared/messages');
const { pageMediaCacheKey, toCachedPageMedia } = await import('../shared/page-media-cache');

function episode(seriesId: string, title: string, number: number): EpisodeInfo {
  return {
    platform: 'crunchyroll',
    episodeId: `${seriesId}-E${number}`,
    seriesId,
    seriesSlug: null,
    animeTitle: title,
    seasonNumber: 1,
    seasonTitle: null,
    seasonEpisodeNumber: number,
    displayedEpisodeNumber: number,
    episodeTitle: null,
    url: `https://www.crunchyroll.com/watch/${seriesId}-E${number}/`,
  };
}

function page(seriesId: string, title: string, number: number): PageMediaInfo {
  return { platform: 'crunchyroll', kind: 'episode', seriesId, seriesSlug: null, seriesTitle: title, seasonNumber: 1, seasonTitle: null, episode: episode(seriesId, title, number) };
}

const FRIEREN = page('FRIEREN', 'Frieren', 27);
const DANDADAN = page('DANDADAN', 'Dandadan', 7);
const MEDIA_IDS: Record<string, number> = { FRIEREN: 154587, DANDADAN: 185660 };

function view(target: PageMediaInfo, mediaId: number = MEDIA_IDS[target.seriesId ?? ''] ?? 1): PageMediaView {
  return {
    media: {
      mediaId,
      idMal: null,
      title: target.seriesTitle,
      coverUrl: null,
      episodes: 28,
      format: 'TV',
      year: 2023,
      airingStatus: 'FINISHED',
      nextEpisode: null,
      siteUrl: `https://anilist.co/anime/${mediaId}`,
    },
    lists: [{ service: 'anilist', state: 'in-list', status: 'CURRENT', progress: 26, score: null, siteUrl: `https://anilist.co/anime/${mediaId}` }],
    confidence: 'certain',
    source: 'page',
    seasons: [],
    episodeProgress: target.episode?.displayedEpisodeNumber ?? null,
  };
}

/** Laisse s'écouler toutes les promesses en attente */
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** Appels en attente d'un type (sans les retirer) */
const pending = (type: string): PendingCall[] => fake.calls.filter((call) => call.type === type);

function answer(call: PendingCall | undefined, value: unknown): void {
  if (!call) throw new Error('Aucun appel en attente');
  fake.calls.splice(fake.calls.indexOf(call), 1);
  call.resolve(value);
}

const payloadOf = (call: PendingCall): { page: PageMediaInfo; mediaId: number | null } => call.payload as { page: PageMediaInfo; mediaId: number | null };
const payloadPage = (call: PendingCall): PageMediaInfo => payloadOf(call).page;

/** Répond à toutes les résolutions (fiche de la page demandée) puis aux détails AniList, jusqu'à épuisement */
async function answerAll(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await settle();
    const [call] = fake.calls.filter((c) => c.type === 'RESOLVE_PAGE_MEDIA' || c.type === 'GET_PANEL_MEDIA');
    if (!call) return;
    answer(call, call.type === 'RESOLVE_PAGE_MEDIA' ? { ok: true, data: view(payloadPage(call), payloadOf(call).mediaId ?? undefined) } : { ok: false, code: 'API_ERROR', message: 'détails indisponibles' });
  }
}

const SYNCED = { status: 'synced', mediaTitle: 'Frieren', results: [{ service: 'anilist', outcome: { status: 'updated', progress: 27, completed: false } }] };

function holdDetection(): () => void {
  let release = (): void => undefined;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  fake.gate = { wait, release };
  return () => {
    fake.gate = null;
    release();
  };
}

/** Contrôleur du panneau : détails chargés après la fiche (GET_PANEL_MEDIA) */
function panelController(): PageMediaController<PanelMedia> {
  return createPageMediaController<PanelMedia>({ onChange: () => undefined, loadDetails: (mediaId) => sendMessage('GET_PANEL_MEDIA', { mediaId }) });
}

/** Panneau prêt sur Frieren (onglet 1) */
async function readyOnFrieren(): Promise<ReturnType<typeof panelController>> {
  fake.pages.set(1, FRIEREN);
  const ctl = panelController();
  ctl.setTab(1);
  await answerAll();
  expect(ctl.content.status).toBe('ready');
  return ctl;
}

/** Fiche de l'onglet réécrite dans le cache de session (synchro, autre écran, ou écho de sa propre écriture) */
function emitCacheWrite(tabId: number, resolvedAt: number): void {
  const entry = { ...toCachedPageMedia(FRIEREN, view(FRIEREN), 'sync', resolvedAt) };
  for (const listener of fake.listeners) listener({ [pageMediaCacheKey(tabId)]: { newValue: entry } }, 'session');
}

beforeEach(() => {
  fake.calls.length = 0;
  fake.pages.clear();
  fake.gate = null;
  fake.reads = 0;
  fake.cached = null;
  fake.writtenAt = 1_000;
  fake.listeners.length = 0;
});

describe('états alignés (popup et panneau)', () => {
  it('detecting → loading → ready', async () => {
    fake.pages.set(1, FRIEREN);
    const ctl = panelController();
    const release = holdDetection();
    ctl.setTab(1);
    expect(ctl.content.status).toBe('detecting');
    release();
    await settle();
    expect(ctl.content).toEqual({ status: 'loading', page: FRIEREN });
    await answerAll();
    expect(ctl.content.status === 'ready' && ctl.content.view.media.title).toBe('Frieren');
  });

  it('NOT_FOUND → not-found (pas une erreur), NOT_TRACKED → not-found `untracked`, même message que le service worker', async () => {
    for (const [code, untracked] of [['NOT_FOUND', false], ['NOT_TRACKED', true]] as const) {
      const ctl = createPageMediaController({ onChange: () => undefined });
      ctl.open(1, FRIEREN);
      await settle();
      answer(pending('RESOLVE_PAGE_MEDIA')[0], { ok: false, code, message: `message ${code}` });
      await settle();
      expect(ctl.content).toEqual({ status: 'not-found', page: FRIEREN, message: `message ${code}`, untracked });
    }
  });

  it('erreur de l’API ou service worker muet → error avec le message, « Réessayer » relance sans cache', async () => {
    const ctl = createPageMediaController({ onChange: () => undefined });
    ctl.open(1, FRIEREN);
    await settle();
    answer(pending('RESOLVE_PAGE_MEDIA')[0], { ok: false, code: 'NETWORK', message: 'AniList injoignable' });
    await settle();
    expect(ctl.content).toEqual({ status: 'error', page: FRIEREN, message: 'AniList injoignable' });

    fake.cached = toCachedPageMedia(FRIEREN, view(FRIEREN), 'resolve', Date.now());
    ctl.retry();
    await settle();
    expect(pending('RESOLVE_PAGE_MEDIA')).toHaveLength(1);
  });

  it('popup (`open`, sans détails) : fiche prête dès la réponse, sans relire la page', async () => {
    const ctl = createPageMediaController({ onChange: () => undefined });
    ctl.open(1, FRIEREN);
    expect(ctl.content).toEqual({ status: 'loading', page: FRIEREN });
    await answerAll();
    expect(ctl.content).toMatchObject({ status: 'ready', details: null, detailsError: null, refreshing: false });
    expect(fake.reads).toBe(0);
    expect(pending('GET_PANEL_MEDIA')).toHaveLength(0);
  });

  it('fiche en cache de l’onglet : affichée sans RESOLVE_PAGE_MEDIA', async () => {
    fake.cached = toCachedPageMedia(FRIEREN, view(FRIEREN), 'sync', Date.now());
    const ctl = createPageMediaController({ onChange: () => undefined });
    ctl.open(1, FRIEREN);
    await settle();
    expect(ctl.content.status).toBe('ready');
    expect(pending('RESOLVE_PAGE_MEDIA')).toHaveLength(0);
  });

  it('relecture silencieuse en échec : la fiche reste affichée, l’erreur passe en retour d’action', async () => {
    const ctl = createPageMediaController({ onChange: () => undefined });
    ctl.open(1, FRIEREN);
    await answerAll();
    void ctl.runAction({ kind: 'adjust', delta: 1 });
    await settle();
    answer(pending('ADJUST_PROGRESS')[0], SYNCED);
    await settle();
    answer(pending('RESOLVE_PAGE_MEDIA')[0], { ok: false, code: 'NETWORK', message: 'AniList injoignable' });
    await settle();
    expect(ctl.content).toMatchObject({ status: 'ready', refreshing: false });
    expect(ctl.actions.feedback).toMatchObject({ tone: 'error', text: 'AniList injoignable' });
  });
});

describe('choix de la saison', () => {
  it('saison choisie : renvoyée au service worker, et à chaque relecture de la même page', async () => {
    const ctl = createPageMediaController({ onChange: () => undefined });
    ctl.open(1, FRIEREN);
    await answerAll();
    ctl.pickSeason(999);
    await settle();
    expect(payloadOf(pending('RESOLVE_PAGE_MEDIA')[0]).mediaId).toBe(999);
    await answerAll();
    expect(ctl.content.status === 'ready' && ctl.content.view.media.mediaId).toBe(999);

    void ctl.runAction({ kind: 'adjust', delta: 1 });
    await settle();
    answer(pending('ADJUST_PROGRESS')[0], SYNCED);
    await settle();
    expect(payloadOf(pending('RESOLVE_PAGE_MEDIA')[0]).mediaId).toBe(999);
  });

  it('choix en échec (réseau) : la saison précédente reste affichée et n’est plus remplacée aux relectures', async () => {
    const ctl = createPageMediaController({ onChange: () => undefined });
    ctl.open(1, FRIEREN);
    await answerAll();
    ctl.pickSeason(999);
    await settle();
    answer(pending('RESOLVE_PAGE_MEDIA')[0], { ok: false, code: 'NETWORK', message: 'AniList injoignable' });
    await settle();
    expect(ctl.content.status === 'ready' && ctl.content.view.media.mediaId).toBe(MEDIA_IDS.FRIEREN);

    ctl.retry();
    await settle();
    expect(payloadOf(pending('RESOLVE_PAGE_MEDIA')[0]).mediaId).toBeNull();
  });

  it('saison choisie dans l’autre écran (fiche en cache `manual`) : reprise pour les relectures', async () => {
    fake.cached = toCachedPageMedia(FRIEREN, { ...view(FRIEREN, 777), source: 'manual' }, 'resolve', Date.now());
    const ctl = createPageMediaController({ onChange: () => undefined });
    ctl.open(1, FRIEREN);
    await settle();
    expect(ctl.content.status === 'ready' && ctl.content.view.media.mediaId).toBe(777);
    ctl.retry();
    await settle();
    expect(payloadOf(pending('RESOLVE_PAGE_MEDIA')[0]).mediaId).toBe(777);
  });
});

describe('anti-écho du cache de l’onglet', () => {
  it('sa propre écriture est ignorée ; une fiche réécrite ailleurs (synchro) fait relire la page', async () => {
    fake.writtenAt = 4_242;
    const ctl = await readyOnFrieren();
    await settle();
    const reads = fake.reads;

    emitCacheWrite(1, 4_242);
    await settle();
    expect(fake.reads).toBe(reads);

    emitCacheWrite(1, 9_999);
    await settle();
    expect(fake.reads).toBe(reads + 1);
    // Fiche réécrite : rechargée (cache d'abord) même si la page n'a pas changé
    expect(ctl.content.status === 'ready' && ctl.content.refreshing).toBe(true);
  });

  it('écriture pour un autre onglet : ignorée', async () => {
    await readyOnFrieren();
    const reads = fake.reads;
    emitCacheWrite(2, 9_999);
    await settle();
    expect(fake.reads).toBe(reads);
  });
});

describe('réponse tardive après un changement de page ou d’onglet', () => {
  it('fiche de la page quittée reçue après la nouvelle lecture : ignorée', async () => {
    fake.pages.set(1, FRIEREN);
    const ctl = panelController();
    ctl.setTab(1);
    await settle();
    const stale = pending('RESOLVE_PAGE_MEDIA')[0];

    fake.pages.set(1, DANDADAN);
    ctl.setTab(1);
    await settle();
    answer(stale, { ok: true, data: view(FRIEREN) });
    await settle();
    expect(ctl.content).toEqual({ status: 'loading', page: DANDADAN });

    await answerAll();
    expect(ctl.content.status === 'ready' && ctl.content.view.media.title).toBe('Dandadan');
  });

  it('fiche de l’onglet quitté reçue après le changement d’onglet : ignorée', async () => {
    fake.pages.set(1, FRIEREN);
    fake.pages.set(2, DANDADAN);
    const ctl = panelController();
    ctl.setTab(1);
    await settle();
    const stale = pending('RESOLVE_PAGE_MEDIA')[0];

    ctl.setTab(2);
    await settle();
    answer(stale, { ok: true, data: view(FRIEREN) });
    await answerAll();
    expect(ctl.content.status === 'ready' && ctl.content.page).toEqual(DANDADAN);
  });

  it('onglet hors cible pendant la résolution : la réponse ne remplace pas l’état vide', async () => {
    fake.pages.set(1, FRIEREN);
    const ctl = panelController();
    ctl.setTab(1);
    await settle();
    ctl.setTab(null);
    await answerAll();
    expect(ctl.content).toEqual({ status: 'idle' });
  });
});

describe('UI-01 : mise à jour de l’onglet pendant la résolution', () => {
  it('même page relue pendant le chargement : la résolution annulée est relancée et la fiche s’affiche', async () => {
    fake.pages.set(1, FRIEREN);
    const ctl = panelController();
    ctl.setTab(1);
    await settle();
    expect(ctl.content.status).toBe('loading');
    expect(pending('RESOLVE_PAGE_MEDIA')).toHaveLength(1);

    // tabs.onUpdated (status « complete ») : setTab(même onglet) → refresh(false) sur la même page
    ctl.setTab(1);
    await answerAll();

    expect(ctl.content.status).toBe('ready');
    expect(ctl.content.status === 'ready' && ctl.content.refreshing).toBe(false);
  });

  it('même page relue pendant l’actualisation après une action : la fiche n’est plus grisée indéfiniment', async () => {
    const ctl = await readyOnFrieren();
    void ctl.runAction({ kind: 'adjust', delta: 1 });
    await settle();
    answer(pending('ADJUST_PROGRESS')[0], SYNCED);
    await settle();
    expect(ctl.content.status === 'ready' && ctl.content.refreshing).toBe(true);

    ctl.setTab(1);
    await answerAll();

    expect(ctl.content.status === 'ready' && ctl.content.refreshing).toBe(false);
    expect(ctl.actions.busy).toBeNull();
  });

  it('même page déjà affichée et stable : aucune nouvelle résolution', async () => {
    const ctl = await readyOnFrieren();
    ctl.setTab(1);
    await settle();
    expect(pending('RESOLVE_PAGE_MEDIA')).toHaveLength(0);
    expect(ctl.content.status).toBe('ready');
  });
});

describe('UI-02 / CTRL-05 : retour d’une action après un changement de page ou d’onglet', () => {
  it('épisode suivant lancé pendant le +1 : la fiche de la nouvelle page reste affichée, actions intactes', async () => {
    const ctl = await readyOnFrieren();
    void ctl.runAction({ kind: 'adjust', delta: 1 });
    await settle();
    expect(ctl.actions.busy).toBe('plus');

    // Navigation dans l'onglet suivi : autre série
    fake.pages.set(1, DANDADAN);
    ctl.setTab(1);
    await settle();
    expect(pending('RESOLVE_PAGE_MEDIA').map(payloadPage)).toEqual([DANDADAN]);

    answer(pending('ADJUST_PROGRESS')[0], SYNCED);
    await settle();
    // Aucune résolution de la page quittée
    expect(pending('RESOLVE_PAGE_MEDIA').map(payloadPage)).toEqual([DANDADAN]);
    expect(ctl.actions).toEqual({ busy: null, confirm: null, feedback: null });

    await answerAll();
    expect(ctl.content.status === 'ready' && ctl.content.view.media.title).toBe('Dandadan');
    expect(ctl.actions.feedback).toBeNull();
  });

  it('autre onglet affiché pendant l’action : son retour ne touche ni la fiche ni les actions', async () => {
    const ctl = await readyOnFrieren();
    void ctl.runAction({ kind: 'adjust', delta: 1 });
    await settle();

    fake.pages.set(2, DANDADAN);
    ctl.setTab(2);
    expect(ctl.actions.busy).toBeNull();
    await settle();

    answer(pending('ADJUST_PROGRESS')[0], SYNCED);
    await answerAll();

    expect(ctl.content.status === 'ready' && ctl.content.page).toEqual(DANDADAN);
    expect(ctl.actions).toEqual({ busy: null, confirm: null, feedback: null });
  });

  it('action terminée pendant la relecture de la page : la relecture n’est pas annulée et charge la nouvelle page', async () => {
    const ctl = await readyOnFrieren();
    void ctl.runAction({ kind: 'adjust', delta: 1 });
    await settle();

    const release = holdDetection();
    fake.pages.set(1, DANDADAN);
    ctl.setTab(1);
    await settle();
    answer(pending('ADJUST_PROGRESS')[0], SYNCED);
    await settle();
    // La fiche quittée n'est pas rechargée
    expect(pending('RESOLVE_PAGE_MEDIA')).toHaveLength(0);

    release();
    await answerAll();
    expect(ctl.content.status === 'ready' && ctl.content.view.media.title).toBe('Dandadan');
  });

  it('action terminée pendant la relecture de la même page : la fiche est rechargée sans cache, retour affiché', async () => {
    const ctl = await readyOnFrieren();
    void ctl.runAction({ kind: 'adjust', delta: 1 });
    await settle();

    const release = holdDetection();
    ctl.setTab(1);
    await settle();
    answer(pending('ADJUST_PROGRESS')[0], SYNCED);
    await settle();
    release();
    await settle();

    expect(pending('RESOLVE_PAGE_MEDIA').map(payloadPage)).toEqual([FRIEREN]);
    await answerAll();
    expect(ctl.content.status === 'ready' && !ctl.content.refreshing).toBe(true);
    expect(ctl.actions.busy).toBeNull();
    expect(ctl.actions.feedback?.tone).toBe('success');
  });

  it('sans changement de page : la fiche est rechargée après l’action et le retour affiché', async () => {
    const ctl = await readyOnFrieren();
    void ctl.runAction({ kind: 'adjust', delta: 1 });
    await settle();
    answer(pending('ADJUST_PROGRESS')[0], SYNCED);
    await settle();
    expect(pending('RESOLVE_PAGE_MEDIA').map(payloadPage)).toEqual([FRIEREN]);
    expect(ctl.actions.feedback?.tone).toBe('success');
  });

  it('popup : « En cours » relu après chaque action (`onActionDone`)', async () => {
    const done = vi.fn();
    const ctl = createPageMediaController({ onChange: () => undefined, onActionDone: done });
    ctl.open(1, FRIEREN);
    await answerAll();
    void ctl.runAction({ kind: 'adjust', delta: 1 });
    await settle();
    answer(pending('ADJUST_PROGRESS')[0], SYNCED);
    await settle();
    expect(done).toHaveBeenCalledTimes(1);
  });
});
