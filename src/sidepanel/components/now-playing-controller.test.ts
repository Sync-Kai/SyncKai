import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EpisodeInfo } from '../../shared/episode.types';
import type { PageMediaInfo, PageMediaView } from '../../shared/page-media.types';
import type { PageMediaResponse } from '../../shared/content-messages';

// Contrôleur « En lecture » avec un faux service worker (sendMessage) et un faux script de contenu
// (requestPageMedia) : chaque réponse est rendue à la main pour reproduire les courses de l'audit (UI-01, UI-02).

interface PendingCall {
  type: string;
  payload: unknown;
  resolve: (value: unknown) => void;
}

const fake = vi.hoisted(() => ({
  calls: [] as PendingCall[],
  /** Page lue dans chaque onglet */
  pages: new Map<number, PageMediaResponse>(),
  /** Lecture de page bloquée jusqu'à `release` (détection en cours) */
  gate: null as { release: () => void; wait: Promise<void> } | null,
}));

vi.mock('../../shared/messages', () => ({
  sendMessage: (type: string, payload: unknown) => new Promise((resolve) => fake.calls.push({ type, payload, resolve })),
}));

vi.mock('../presence', () => ({
  requestPageMedia: async (tabId: number) => {
    const gate = fake.gate;
    if (gate) await gate.wait;
    return fake.pages.has(tabId) ? fake.pages.get(tabId) : 'unreachable';
  },
}));

vi.mock('./live-progress', () => ({
  createLiveProgress: () => ({ element: null, follow: () => undefined }),
}));

vi.mock('../../shared/page-media-cache', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../shared/page-media-cache')>()),
  readCachedPageMedia: () => Promise.resolve(null),
  storeCachedPageMedia: () => Promise.resolve(null),
}));

vi.stubGlobal('chrome', {
  storage: {
    local: { get: () => Promise.resolve({}) },
    onChanged: { addListener: () => undefined },
  },
});

const { createNowPlayingController } = await import('./now-playing-controller');

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

function view(target: PageMediaInfo): PageMediaView {
  const mediaId = MEDIA_IDS[target.seriesId ?? ''] ?? 1;
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

function answer(call: PendingCall, value: unknown): void {
  fake.calls.splice(fake.calls.indexOf(call), 1);
  call.resolve(value);
}

const payloadPage = (call: PendingCall): PageMediaInfo => (call.payload as { page: PageMediaInfo }).page;

/** Répond à toutes les résolutions (fiche de la page demandée) puis aux détails AniList, jusqu'à épuisement */
async function answerAll(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await settle();
    const [call] = fake.calls.filter((c) => c.type === 'RESOLVE_PAGE_MEDIA' || c.type === 'GET_PANEL_MEDIA');
    if (!call) return;
    answer(call, call.type === 'RESOLVE_PAGE_MEDIA' ? { ok: true, data: view(payloadPage(call)) } : { ok: false, code: 'API_ERROR', message: 'détails indisponibles' });
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

/** Panneau prêt sur Frieren (onglet 1) */
async function readyOnFrieren(): Promise<ReturnType<typeof createNowPlayingController>> {
  fake.pages.set(1, FRIEREN);
  const ctl = createNowPlayingController(() => undefined);
  ctl.setTab(1);
  await answerAll();
  expect(ctl.content.status).toBe('ready');
  return ctl;
}

beforeEach(() => {
  fake.calls.length = 0;
  fake.pages.clear();
  fake.gate = null;
});

describe('UI-01 : mise à jour de l’onglet pendant la résolution', () => {
  it('même page relue pendant le chargement : la résolution annulée est relancée et la fiche s’affiche', async () => {
    fake.pages.set(1, FRIEREN);
    const ctl = createNowPlayingController(() => undefined);
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
});
