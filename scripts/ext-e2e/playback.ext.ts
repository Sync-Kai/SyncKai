// Détection de la lecture, sur l'extension construite (docs/audit/MANUAL-TESTS.md §3) : le vrai script de contenu suit
// une vraie <video> sur de fausses pages Crunchyroll / ADN et envoie lui-même la fin d'épisode. La lecture est pilotée
// comme le ferait l'utilisateur (lecture, clic sur la barre de progression : API de la <video>), jamais par l'extension.
// Lancement : npm run test:ext
import type { Page } from 'puppeteer';
import { describe, expect, it, type TestContext } from 'vitest';
import { ONE_PIECE_E1180, ONE_PIECE_E1181, type CrunchyrollWatchFixture } from '../../src/content/crunchyroll/__fixtures__/crunchyroll-watch';
import { TOUGEN_ANKI_E1 } from '../../src/content/adn/__fixtures__/adn-watch';
import type { ContentMessage } from '../../src/protocol/content-messages';
import { registerCatalogs, tl, type Locale, type MessageKey, type MessageParams } from '../../src/i18n';
import { isLiveContentMessage, LIVE_PORT_NAME, type LiveContentMessage, type LiveState } from '../../src/protocol/live';
import type { RecentSync } from '../../src/shared/review.types';
import { STORAGE_KEYS } from '../../src/protocol/storage-keys';
import { catalogOf } from '../../src/test/catalogs';
import { FakeAniList, type AniListEntrySeed, type AniListMediaSeed } from './fake-anilist';
import { FakeMal, type MalAnimeSeed, type MalListStatusSeed } from './fake-mal';
import { FakeSites, adnWatchHtml, autoplayNextCrunchyroll, closedShadowTexts, crunchyrollWatchHtml, pause, play, seek } from './fake-sites';
import { startExtension, waitFor, type ExtensionHarness } from './harness';
import { ANILIST_A, MAL_A, anilistAccount, expectCleanRun, malAccount, seedSettings, signIn } from './seed';

registerCatalogs({ fr: catalogOf('fr') });

const text = (locale: Locale, key: MessageKey, params?: MessageParams): string => tl(locale, key, params);

// ─── Séries des scénarios ─────────────────────────────────────────────────

/** One Piece : une seule fiche AniList en cours de diffusion, numérotation absolue (E1180 = épisode 25 de la saison 24) */
const ONE_PIECE: { anilist: AniListMediaSeed; mal: MalAnimeSeed } = {
  anilist: { id: 21, idMal: 21, title: 'ONE PIECE', episodes: null, status: 'RELEASING', externalLinks: ['https://www.crunchyroll.com/series/GRMG8ZQZR'] },
  mal: { id: 21, title: 'One Piece', numEpisodes: 0 },
};

const TOUGEN_ANKI: { anilist: AniListMediaSeed; mal: MalAnimeSeed } = {
  anilist: { id: 178680, idMal: 59135, title: 'TOUGEN ANKI', episodes: 24, externalLinks: ['https://animationdigitalnetwork.com/video/1311-tougen-anki'] },
  mal: { id: 59135, title: 'Tougen Anki', numEpisodes: 24 },
};

/** Fiche 101280 : le titre français n'est qu'un synonyme, trouvé par AniList seulement sans accents */
const SLIME: { anilist: AniListMediaSeed; mal: MalAnimeSeed } = {
  anilist: {
    id: 101280,
    idMal: 37430,
    title: 'Tensei shitara Slime Datta Ken',
    synonyms: ['Moi, quand je me réincarne en Slime'],
    episodes: 24,
    externalLinks: ['https://www.crunchyroll.com/series/GYZJ43JMR'],
  },
  mal: { id: 37430, title: 'Tensei shitara Slime Datta Ken', numEpisodes: 24 },
};

/** Page /fr/ de Slime : titre localisé accentué dans le JSON-LD (même structure que les fixtures One Piece) */
const SLIME_E3: CrunchyrollWatchFixture = {
  episodeId: 'GRP5E2X3R',
  url: 'https://www.crunchyroll.com/fr/watch/GRP5E2X3R/battle-at-the-goblin-village',
  jsonLd: JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', name: 'Crunchyroll' },
      {
        '@context': 'https://schema.org',
        '@type': 'TVEpisode',
        name: 'Moi, quand je me réincarne en Slime | E3 - Bataille au village des gobelins',
        episodeNumber: 3,
        partOfSeason: { '@type': 'TVSeason', name: 'Moi, quand je me réincarne en Slime', seasonNumber: 1 },
        partOfSeries: { '@type': 'TVSeries', name: 'Moi, quand je me réincarne en Slime', '@id': 'https://www.crunchyroll.com/fr/series/GYZJ43JMR/that-time-i-got-reincarnated-as-a-slime' },
      },
    ],
  }),
  heading: 'E3 - Bataille au village des gobelins',
  seriesLink: { text: 'Moi, quand je me réincarne en Slime', href: 'https://www.crunchyroll.com/fr/series/GYZJ43JMR/that-time-i-got-reincarnated-as-a-slime' },
};

/** Générique de fin annoncé par static.crunchyroll.com (vidéo de 600 s, repli à 85 % = 510 s) */
const CREDITS_START = 540;

// ─── Mise en place ────────────────────────────────────────────────────────

interface Series {
  anilist: AniListMediaSeed;
  mal: MalAnimeSeed;
  /** Entrées de liste de départ (aucune : série absente des listes) */
  anilistEntry?: AniListEntrySeed;
  malEntry?: MalListStatusSeed;
}

interface Scenario {
  h: ExtensionHarness;
  anilist: FakeAniList;
  mal: FakeMal;
  sites: FakeSites;
}

/** Navigateur neuf, faux services, comptes AniList et MAL connectés, interface dans `language` */
async function launch(context: TestContext, series: Series, sites: FakeSites, language: Locale = 'en'): Promise<Scenario> {
  const anilist = new FakeAniList({
    media: [series.anilist],
    accounts: [anilistAccount(ANILIST_A, series.anilistEntry ? { [series.anilist.id]: series.anilistEntry } : {})],
  });
  const mal = new FakeMal({ anime: [series.mal], accounts: [malAccount(series.malEntry ? { [series.mal.id]: series.malEntry } : {})] });
  const h = await startExtension(context, { routes: [anilist.handler, mal.handler], pageRoutes: [sites.handler] });
  await seedSettings(h, { language });
  await signIn(h, { anilist: ANILIST_A, mal: true });
  return { h, anilist, mal, sites };
}

/** Progressions écrites (AniList, MAL) */
function writtenProgress({ anilist, mal }: Scenario): { anilist: unknown[]; mal: (string | undefined)[] } {
  return { anilist: anilist.mutations(ANILIST_A.token).map((m) => m.variables.progress), mal: mal.writes(MAL_A.token).map((w) => w.body?.num_watched_episodes) };
}

async function recentSyncs(h: ExtensionHarness): Promise<RecentSync[]> {
  const value = (await h.storage())[STORAGE_KEYS.recentSyncs];
  return Array.isArray(value) ? (value as RecentSync[]) : [];
}

/** Toast de SyncKai contenant `expected` (Shadow DOM fermé), avant sa fermeture automatique */
async function waitForToast(page: Page, expected: string): Promise<string> {
  return waitFor(`toast « ${expected} »`, async () => (await closedShadowTexts(page)).find((t) => t.includes(expected)), 8_000);
}

/**
 * Progression en direct, comme le panneau latéral : port ouvert par une page de l'extension vers le script de contenu
 * de l'onglet (`urlPattern`), rouvert tant que le script n'est pas encore injecté (document_idle). Renvoie la lecture des
 * messages reçus.
 */
async function observeLive(h: ExtensionHarness, urlPattern: string): Promise<() => Promise<LiveContentMessage[]>> {
  const bridge = await h.bridge();
  await bridge.evaluate(
    async (pattern: string, name: string) => {
      const [tab] = await chrome.tabs.query({ url: pattern });
      const tabId = tab?.id;
      if (tabId === undefined) throw new Error(`Onglet ${pattern} introuvable`);
      const received: unknown[] = [];
      const deadline = Date.now() + 10_000;
      for (;;) {
        const port = chrome.tabs.connect(tabId, { name });
        const connected = await new Promise<boolean>((resolve) => {
          port.onMessage.addListener((message: unknown) => {
            received.push(message);
            resolve(true);
          });
          port.onDisconnect.addListener(() => resolve(false));
        });
        if (connected) {
          // Port gardé sur la page (jamais collecté pendant le test)
          Object.assign(window, { __live: received, __livePort: port });
          return;
        }
        if (Date.now() > deadline) throw new Error('Script de contenu injoignable');
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    },
    urlPattern,
    LIVE_PORT_NAME,
  );
  return async () => (await bridge.evaluate(() => (window as unknown as { __live: unknown[] }).__live)).filter(isLiveContentMessage);
}

const stateOf = (message: LiveContentMessage): LiveState | null => (message.type === 'tick' || message.type === 'sync' ? message.state : null);

/** Position de lecture (s) vue par le suivi au moins une fois, d'après la progression en direct */
async function waitForPosition(live: () => Promise<LiveContentMessage[]>, atLeast: number): Promise<void> {
  await waitFor(`position ≥ ${atLeast} s vue par le suivi`, async () => (await live()).some((m) => m.type === 'tick' && m.t !== null && m.t >= atLeast));
}

const CRUNCHYROLL_TABS = 'https://www.crunchyroll.com/*';

/**
 * Raccourci « valider l'épisode » (Alt+Shift+K) : Puppeteer ne peut pas déclencher un raccourci global du navigateur
 * (les touches envoyées par CDP n'atteignent pas chrome.commands). Envoie donc à l'onglet `url` le message même de
 * background/controls.ts › handleCommand (FORCE_COMPLETE), depuis une page de l'extension ; renvoyé tant que le script
 * de contenu n'est pas encore injecté.
 */
async function pressCompleteShortcut(h: ExtensionHarness, url: string): Promise<void> {
  const message: ContentMessage = { type: 'FORCE_COMPLETE' };
  await (await h.bridge()).evaluate(
    async (tabUrl: string, raw: string) => {
      const [tab] = await chrome.tabs.query({ url: tabUrl });
      if (tab?.id === undefined) throw new Error(`Onglet ${tabUrl} introuvable`);
      const deadline = Date.now() + 10_000;
      for (;;) {
        try {
          await chrome.tabs.sendMessage(tab.id, JSON.parse(raw));
          return;
        } catch (error: unknown) {
          if (Date.now() > deadline) throw error;
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
    },
    url,
    JSON.stringify(message),
  );
}

// ─── Scénarios ────────────────────────────────────────────────────────────

describe('Détection de la lecture', () => {
  it('Crunchyroll : épisode suivi jusqu’au générique de fin, numéro absolu écrit (1180, pas 25), toast, langue de la page intacte', async (context) => {
    const sites = new FakeSites().page(ONE_PIECE_E1180.url, crunchyrollWatchHtml(ONE_PIECE_E1180, { lang: 'fr' })).creditsStart(ONE_PIECE_E1180.episodeId, CREDITS_START);
    const run = await launch(context, { ...ONE_PIECE, anilistEntry: { status: 'CURRENT', progress: 1179 }, malEntry: { status: 'watching', num_episodes_watched: 1179 } }, sites);
    const { h } = run;
    const page = await h.openTab(ONE_PIECE_E1180.url);
    const live = await observeLive(h, CRUNCHYROLL_TABS);
    // Point de fin : générique annoncé par Crunchyroll (540 s), pas le repli à 85 % (510 s)
    await waitFor('point de fin au générique', async () => (await live()).some((m) => m.type === 'tick' && m.point?.source === 'credits' && m.point.seconds === CREDITS_START));
    expect(sites.skipEventsRequests(ONE_PIECE_E1180.episodeId)).toBe(1);

    await play(page);
    // Passé le repli de 85 % mais avant le générique : rien n'est envoyé
    await seek(page, 530);
    await waitForPosition(live, 530);
    expect(writtenProgress(run)).toEqual({ anilist: [], mal: [] });

    await seek(page, CREDITS_START + 1);
    await waitFor('progression écrite sur AniList et MAL', () => run.anilist.mutations().length === 1 && run.mal.writes().length === 1);
    expect(run.anilist.mutations().map((m) => m.variables)).toEqual([{ mediaId: ONE_PIECE.anilist.id, progress: 1180, status: 'CURRENT' }]);
    expect(run.mal.writes().map((w) => w.body)).toEqual([{ status: 'watching', num_watched_episodes: '1180', is_rewatching: 'false' }]);
    expect(run.anilist.entry(ANILIST_A.token, ONE_PIECE.anilist.id)).toMatchObject({ progress: 1180 });

    // Pastille de succès (niveau « discret » par défaut), en anglais comme l'interface
    await waitForToast(page, text('en', 'toast.pill.saved', { episode: 1180 }));
    const synced = await waitFor('synchro récente enregistrée', async () => (await recentSyncs(h)).find((s) => s.mediaId === ONE_PIECE.anilist.id));
    expect(synced).toMatchObject({ progress: 1180, episode: { platform: 'crunchyroll', episodeId: ONE_PIECE_E1180.episodeId, seasonEpisodeNumber: 25, displayedEpisodeNumber: 1180 } });
    // Le script de contenu ne réécrit jamais <html lang> du site (interface en anglais, site en français)
    expect(await page.evaluate(() => document.documentElement.lang)).toBe('fr');
    expect(await live()).toContainEqual(expect.objectContaining({ type: 'sync', state: 'synced' }));
    expectCleanRun(h, run.anilist, run.mal);
  });

  it('ADN : épisode suivi jusqu’au seuil de 85 % (pas de données de générique), ajouté aux listes AniList et MAL', async (context) => {
    const sites = new FakeSites().page(TOUGEN_ANKI_E1.url, adnWatchHtml(TOUGEN_ANKI_E1, { lang: 'fr' }));
    const run = await launch(context, TOUGEN_ANKI, sites);
    const page = await run.h.openTab(TOUGEN_ANKI_E1.url);
    const live = await observeLive(run.h, 'https://animationdigitalnetwork.com/*');
    await waitFor('point de fin au seuil', async () => (await live()).some((m) => m.type === 'tick' && m.point?.source === 'ratio' && m.point.seconds === 510));

    await play(page);
    await seek(page, 505);
    await waitForPosition(live, 505);
    expect(writtenProgress(run)).toEqual({ anilist: [], mal: [] });
    await seek(page, 515);
    await waitFor('progression écrite sur AniList et MAL', () => run.anilist.mutations().length === 1 && run.mal.writes().length === 1);
    expect(run.anilist.mutations().map((m) => m.variables)).toEqual([expect.objectContaining({ mediaId: TOUGEN_ANKI.anilist.id, progress: 1 })]);
    expect(run.anilist.entry(ANILIST_A.token, TOUGEN_ANKI.anilist.id)).toMatchObject({ status: 'CURRENT', progress: 1 });
    expect(run.mal.entry(MAL_A.token, TOUGEN_ANKI.mal.id)).toMatchObject({ status: 'watching', num_episodes_watched: 1 });
    await waitForToast(page, text('en', 'toast.pill.saved', { episode: 1 }));
    const synced = await waitFor('synchro récente enregistrée', async () => (await recentSyncs(run.h)).find((s) => s.mediaId === TOUGEN_ANKI.anilist.id));
    expect(synced).toMatchObject({ progress: 1, episode: { platform: 'adn', episodeId: TOUGEN_ANKI_E1.episodeId, seriesId: '1311', displayedEpisodeNumber: 1 } });
    expectCleanRun(run.h, run.anilist, run.mal);
  });

  it('lecture automatique : épisode suivant chargé dans le même onglet (SPA), 1180 puis 1181, aucune écriture en double', async (context) => {
    const sites = new FakeSites()
      .page(ONE_PIECE_E1180.url, crunchyrollWatchHtml(ONE_PIECE_E1180, { lang: 'fr' }))
      .creditsStart(ONE_PIECE_E1180.episodeId, CREDITS_START)
      .creditsStart(ONE_PIECE_E1181.episodeId, CREDITS_START);
    const run = await launch(context, { ...ONE_PIECE, anilistEntry: { status: 'CURRENT', progress: 1179 }, malEntry: { status: 'watching', num_episodes_watched: 1179 } }, sites);
    const page = await run.h.openTab(ONE_PIECE_E1180.url);
    const live = await observeLive(run.h, CRUNCHYROLL_TABS);

    await play(page);
    await seek(page, CREDITS_START + 1);
    await waitFor('E1180 écrit', () => run.anilist.mutations().length === 1 && run.mal.writes().length === 1);

    // Fin du générique : le lecteur passe à l'épisode suivant sans recharger la page
    await autoplayNextCrunchyroll(page, ONE_PIECE_E1181);
    await waitFor('nouvel épisode suivi', async () => (await live()).some((m) => m.type === 'page' && m.episodeId === ONE_PIECE_E1181.episodeId));
    await play(page);
    await seek(page, CREDITS_START + 1);
    await waitFor('E1181 écrit', () => run.anilist.mutations().length === 2 && run.mal.writes().length === 2);
    expect(writtenProgress(run)).toEqual({ anilist: [1180, 1181], mal: ['1180', '1181'] });
    expect(sites.skipEventsRequests(ONE_PIECE_E1181.episodeId)).toBe(1);

    // Retour en arrière puis de nouveau au générique : un seul envoi automatique par épisode
    await seek(page, 100);
    await waitFor('retour en arrière vu', async () => (await live()).some((m) => m.type === 'tick' && m.t !== null && m.t < 200));
    await seek(page, CREDITS_START + 5);
    await waitForPosition(live, CREDITS_START + 5);
    expect(writtenProgress(run)).toEqual({ anilist: [1180, 1181], mal: ['1180', '1181'] });
    // Synchros récentes : une ligne par série, celle du dernier épisode (numéro affiché par le popup)
    const syncs = await waitFor('synchro récente de E1181', async () => {
      const list = await recentSyncs(run.h);
      return list[0]?.episode.episodeId === ONE_PIECE_E1181.episodeId ? list : null;
    });
    expect(syncs).toEqual([expect.objectContaining({ mediaId: ONE_PIECE.anilist.id, progress: 1181 })]);
    expectCleanRun(run.h, run.anilist, run.mal);
  });

  // Compromis : le seuil réel du code est l'attente du lecteur (VIDEO_WAIT_TIMEOUT_MS, 30 s, au-delà l'état « pas de
  // vidéo »), pas une minute ; il est attendu pour de vrai (≈ 30 s), le ralentissement intensif des onglets cachés de
  // Chrome (après 5 min) n'est pas reproduit
  it('onglet en arrière-plan : lecteur créé seulement à l’affichage, plus de 30 s après l’ouverture, épisode quand même synchronisé', async (context) => {
    const sites = new FakeSites().page(ONE_PIECE_E1180.url, crunchyrollWatchHtml(ONE_PIECE_E1180, { lang: 'fr', deferPlayer: true })).creditsStart(ONE_PIECE_E1180.episodeId, CREDITS_START);
    const run = await launch(context, { ...ONE_PIECE, anilistEntry: { status: 'CURRENT', progress: 1179 }, malEntry: { status: 'watching', num_episodes_watched: 1179 } }, sites);
    const page = await run.h.openTab(ONE_PIECE_E1180.url, { background: true });
    expect(await page.evaluate(() => [document.visibilityState, document.querySelector('video') === null])).toEqual(['hidden', true]);
    const live = await observeLive(run.h, CRUNCHYROLL_TABS);
    await waitFor('état « pas de vidéo » après 30 s', async () => (await live()).some((m) => stateOf(m) === 'no-video'), 40_000);

    // L'utilisateur affiche l'onglet : le lecteur apparaît, il lance la lecture
    await page.bringToFront();
    await play(page);
    await waitFor('suivi rattaché au lecteur', async () => (await live()).some((m) => m.type === 'tick' && m.state === 'watching' && m.duration !== null));
    await seek(page, CREDITS_START + 1);
    await waitFor('progression écrite', () => run.anilist.mutations().length === 1 && run.mal.writes().length === 1);
    expect(writtenProgress(run)).toEqual({ anilist: [1180], mal: ['1180'] });
    expectCleanRun(run.h, run.anilist, run.mal);
  }, 90_000);

  it('langue de la page intacte : site en anglais, SyncKai en français, toast en français, <html lang="en"> conservé', async (context) => {
    const english: CrunchyrollWatchFixture = { ...ONE_PIECE_E1180, url: 'https://www.crunchyroll.com/watch/GE00376431JAJP/despair-engulfs-elbaph' };
    const sites = new FakeSites().page(english.url, crunchyrollWatchHtml(english, { lang: 'en' })).creditsStart(english.episodeId, CREDITS_START);
    const run = await launch(context, { ...ONE_PIECE, anilistEntry: { status: 'CURRENT', progress: 1179 }, malEntry: { status: 'watching', num_episodes_watched: 1179 } }, sites, 'fr');
    const page = await run.h.openTab(english.url);
    await play(page);
    expect(await page.evaluate(() => document.documentElement.lang)).toBe('en');
    await seek(page, CREDITS_START + 1);
    await waitFor('progression écrite', () => run.anilist.mutations().length === 1);
    await waitForToast(page, text('fr', 'toast.pill.saved', { episode: 1180 }));
    expect(await page.evaluate(() => document.documentElement.lang)).toBe('en');
    expectCleanRun(run.h, run.anilist, run.mal);
  });

  it('titre localisé accentué (Crunchyroll /fr/) : AniList ne trouve que la version sans accents, épisode synchronisé sur cette fiche', async (context) => {
    const sites = new FakeSites().page(SLIME_E3.url, crunchyrollWatchHtml(SLIME_E3, { lang: 'fr' }));
    const run = await launch(context, { ...SLIME, anilistEntry: { status: 'CURRENT', progress: 2 }, malEntry: { status: 'watching', num_episodes_watched: 2 } }, sites);
    const page = await run.h.openTab(SLIME_E3.url);
    await play(page);
    await seek(page, 515);
    await waitFor('progression écrite', () => run.anilist.mutations().length === 1 && run.mal.writes().length === 1);
    expect(run.anilist.mutations().map((m) => m.variables)).toEqual([{ mediaId: SLIME.anilist.id, progress: 3, status: 'CURRENT' }]);
    expect(run.mal.entry(MAL_A.token, SLIME.mal.id)).toMatchObject({ num_episodes_watched: 3 });
    // Titre accentué (aucun résultat), puis sans accents (trouvé) : le slug anglais n'a pas servi
    expect(run.anilist.requests.filter((r) => r.operation === 'SearchAnime').map((r) => r.variables.search)).toEqual([
      'Moi, quand je me réincarne en Slime',
      'Moi, quand je me reincarne en Slime',
    ]);
    expectCleanRun(run.h, run.anilist, run.mal);
  });

  it('épisode regardé brièvement puis arrêté bien avant le seuil : aucune écriture, aucune recherche', async (context) => {
    const sites = new FakeSites().page(ONE_PIECE_E1180.url, crunchyrollWatchHtml(ONE_PIECE_E1180, { lang: 'fr' })).creditsStart(ONE_PIECE_E1180.episodeId, CREDITS_START);
    const run = await launch(context, { ...ONE_PIECE, anilistEntry: { status: 'CURRENT', progress: 1179 }, malEntry: { status: 'watching', num_episodes_watched: 1179 } }, sites);
    const page = await run.h.openTab(ONE_PIECE_E1180.url);
    const live = await observeLive(run.h, CRUNCHYROLL_TABS);
    await play(page);
    await seek(page, 240);
    await waitForPosition(live, 240);
    await pause(page);
    await waitFor('pause vue par le suivi', async () => (await live()).some((m) => m.type === 'tick' && m.paused && m.t !== null && m.t >= 240));
    await page.close();
    expect(writtenProgress(run)).toEqual({ anilist: [], mal: [] });
    // Rien n'a été envoyé au service worker : ni recherche ni lecture de fiche
    expect(run.anilist.requests.map((r) => r.operation)).toEqual(['Viewer']);
    expect(await recentSyncs(run.h)).toEqual([]);
    expectCleanRun(run.h, run.anilist, run.mal);
  });

  it('raccourci « valider l’épisode » (message de la commande) : « aucune lecture » sur une page de série, « à jour », renvoi après « −1 », « synchro en pause »', async (context) => {
    const seriesUrl = 'https://www.crunchyroll.com/fr/series/GRMG8ZQZR/one-piece';
    const sites = new FakeSites()
      .page(seriesUrl, '<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>One Piece</title></head><body><h1>One Piece</h1></body></html>')
      .page(ONE_PIECE_E1180.url, crunchyrollWatchHtml(ONE_PIECE_E1180, { lang: 'fr' }))
      .page(ONE_PIECE_E1181.url, crunchyrollWatchHtml(ONE_PIECE_E1181, { lang: 'fr' }))
      .creditsStart(ONE_PIECE_E1180.episodeId, CREDITS_START);
    const run = await launch(context, { ...ONE_PIECE, anilistEntry: { status: 'CURRENT', progress: 1179 }, malEntry: { status: 'watching', num_episodes_watched: 1179 } }, sites);

    // Page de série : aucune lecture en cours
    const series = await run.h.openTab(seriesUrl);
    await pressCompleteShortcut(run.h, seriesUrl);
    await waitForToast(series, text('en', 'content.shortcut.noPlayback.title'));
    await series.close();

    // Épisode synchronisé à la fin de la lecture, puis raccourci : renvoyé, la liste est relue, rien de plus n'est écrit
    const episode = await run.h.openTab(ONE_PIECE_E1180.url);
    await play(episode);
    await seek(episode, CREDITS_START + 1);
    await waitFor('E1180 écrit', () => run.anilist.mutations().length === 1 && run.mal.writes().length === 1);
    await waitForToast(episode, text('en', 'toast.pill.saved', { episode: 1180 }));
    await pressCompleteShortcut(run.h, ONE_PIECE_E1180.url);
    await waitForToast(episode, text('en', 'toast.pill.upToDate', { episode: 1180 }));
    expect(writtenProgress(run)).toEqual({ anilist: [1180], mal: ['1180'] });

    // « −1 » fait ailleurs (panneau, popup, site) : l'onglet l'ignore, le raccourci réécrit quand même l'épisode
    const anilistEntry = run.anilist.entry(ANILIST_A.token, ONE_PIECE.anilist.id);
    const malEntry = run.mal.entry(MAL_A.token, ONE_PIECE.mal.id);
    if (!anilistEntry || !malEntry) throw new Error('fiches absentes des faux services');
    anilistEntry.progress = 1179;
    malEntry.num_episodes_watched = 1179;
    await pressCompleteShortcut(run.h, ONE_PIECE_E1180.url);
    await waitFor('E1180 réécrit', () => run.anilist.mutations().length === 2 && run.mal.writes().length === 2);
    expect(writtenProgress(run)).toEqual({ anilist: [1180, 1180], mal: ['1180', '1180'] });
    await episode.close();

    // Synchro en pause (Réglages) : le raccourci explique pourquoi rien n'est envoyé
    await seedSettings(run.h, { autoSync: false });
    const paused = await run.h.openTab(ONE_PIECE_E1181.url);
    await play(paused);
    await pressCompleteShortcut(run.h, ONE_PIECE_E1181.url);
    await waitForToast(paused, text('en', 'content.shortcut.paused.title'));
    expect(writtenProgress(run)).toEqual({ anilist: [1180, 1180], mal: ['1180', '1180'] });
    expectCleanRun(run.h, run.anilist, run.mal);
  });

  it('Crunchyroll : pont du monde MAIN (manifeste), données de saison lues sur les réponses de la page, jamais son jeton', async (context) => {
    const cms = 'https://www.crunchyroll.com/content/v2/cms';
    const elbaph = 'GYELBAPH24';
    // L'application Crunchyroll demande elle-même la série, ses saisons et les épisodes de la saison, jeton en en-tête
    const siteRequests = `<script>
  const headers = { authorization: 'Bearer E2E-SECRET-TOKEN' };
  fetch('${cms}/series/GRMG8ZQZR/seasons?locale=fr-FR', { headers });
  const xhr = new XMLHttpRequest();
  xhr.open('GET', '${cms}/seasons/${elbaph}/episodes?locale=fr-FR');
  xhr.setRequestHeader('authorization', headers.authorization);
  xhr.send();
</script>`;
    const sites = new FakeSites()
      .page(ONE_PIECE_E1180.url, crunchyrollWatchHtml(ONE_PIECE_E1180, { lang: 'fr' }).replace('</body>', `${siteRequests}</body>`))
      .api(`${cms}/series/GRMG8ZQZR/seasons`, {
        data: [
          { id: elbaph, title: 'Elbaph', season_number: 24, season_sequence_number: 24, number_of_episodes: 26, audio_locale: 'ja-JP', is_dubbed: false },
          { id: 'GYELBAPH24FR', title: 'Elbaph (VF)', season_number: 24, season_sequence_number: 24, number_of_episodes: 10, audio_locale: 'fr-FR', is_dubbed: true },
        ],
      })
      .api(`${cms}/seasons/${elbaph}/episodes`, {
        data: [ONE_PIECE_E1180.episodeId, ONE_PIECE_E1181.episodeId].map((id, i) => ({ id, duration_ms: 1_420_000, episode_air_date: `2025-10-0${5 + i}T00:00:00Z`, media_type: 'episode' })),
      });
    const run = await launch(context, ONE_PIECE, sites);
    await run.h.openTab(ONE_PIECE_E1180.url);
    const signals = await waitFor('signaux de la saison dans la fiche de la page', async () => {
      const media: unknown = await (await run.h.bridge()).evaluate(async (pattern: string) => {
        const [tab] = await chrome.tabs.query({ url: pattern });
        if (tab?.id === undefined) return null;
        try {
          return (await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_MEDIA' })) as unknown;
        } catch {
          return null;
        }
      }, CRUNCHYROLL_TABS);
      const episode = (media as { episode?: { signals?: unknown } } | null)?.episode;
      return episode?.signals;
    });
    // Saison originale (26 épisodes, 2025), jamais le doublage (10 épisodes)
    expect(signals).toEqual({ seasonYear: 2025, seasonEpisodeCount: 26, episodeMinutes: 23.7, format: 'series', country: 'JP' });
    expect(sites.requests.filter((r) => r.url.startsWith(cms)).map((r) => r.headers.authorization)).toEqual(['Bearer E2E-SECRET-TOKEN', 'Bearer E2E-SECRET-TOKEN']);
    expect(run.h.consoleMessages.join('\n')).not.toContain('E2E-SECRET');
    expectCleanRun(run.h, run.anilist, run.mal);
  });
});
