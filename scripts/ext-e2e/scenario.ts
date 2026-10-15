// Séries, pages et mise en place partagées par les scénarios de l'interface (panel.ext.ts, lists.ext.ts) : faux services
// avec les comptes AniList A et MAL connectés, panneau latéral et popup ouverts dans des onglets.
import type { Page } from 'puppeteer';
import type { TestContext } from 'vitest';
import type { CrunchyrollWatchFixture } from '../../src/content/crunchyroll/__fixtures__/crunchyroll-watch';
import { tl, type MessageKey, type MessageParams } from '../../src/i18n';
import { STORAGE_KEYS } from '../../src/shared/storage-keys';
import { SIDE_PANEL_PATH } from '../../src/shared/target-pages';
import type { MediaMapping } from '../../src/shared/sync.types';
import { FakeAniList, type AniListEntrySeed, type AniListMediaSeed } from './fake-anilist';
import { FakeMal, type MalAnimeSeed, type MalListStatusSeed } from './fake-mal';
import { FakeSites } from './fake-sites';
import { EXTENSION_ORIGIN, sleep, startExtension, waitFor, type ExtensionHarness } from './harness';
import { ANILIST_A, anilistAccount, malAccount, seedSettings, signIn } from './seed';

export const en = (key: MessageKey, params?: MessageParams): string => tl('en', key, params);
export const sel = (focus: string): string => `[data-focus="${focus}"]`;

// ─── Séries des scénarios ─────────────────────────────────────────────────

export interface SeriesSeed {
  anilist: AniListMediaSeed;
  mal: MalAnimeSeed;
  anilistEntry?: AniListEntrySeed;
  malEntry?: MalListStatusSeed;
}

/** One Piece : fiche unique en cours de diffusion, numérotation absolue */
export const ONE_PIECE: SeriesSeed = {
  anilist: { id: 21, idMal: 21, title: 'ONE PIECE', episodes: null, status: 'RELEASING', externalLinks: ['https://www.crunchyroll.com/series/GRMG8ZQZR'] },
  mal: { id: 21, title: 'One Piece', numEpisodes: 0 },
  anilistEntry: { status: 'CURRENT', progress: 1179 },
  malEntry: { status: 'watching', num_episodes_watched: 1179 },
};

/**
 * Frieren en deux saisons (fixture de src/background/sync/resolver.test.ts) : la saison 1 liée à la série Crunchyroll,
 * la saison 2 trouvée par sa relation SEQUEL (absente de la recherche, lue par AnimeByIds)
 */
export const FRIEREN_S1: SeriesSeed = {
  anilist: {
    id: 154587,
    idMal: 52991,
    title: 'Frieren: Beyond Journey’s End',
    episodes: 28,
    externalLinks: ['https://www.crunchyroll.com/series/GG5H5XQX4/frieren'],
    relations: [{ relationType: 'SEQUEL', id: 182255 }],
  },
  mal: { id: 52991, title: 'Sousou no Frieren', numEpisodes: 28 },
  anilistEntry: { status: 'CURRENT', progress: 2 },
  malEntry: { status: 'watching', num_episodes_watched: 2 },
};
export const FRIEREN_S2: SeriesSeed = {
  anilist: { id: 182255, idMal: 59978, title: 'Frieren Season 2', episodes: 10, startYear: 2026, relations: [{ relationType: 'PREQUEL', id: 154587 }] },
  mal: { id: 59978, title: 'Sousou no Frieren 2nd Season', numEpisodes: 10 },
};

/** Page de lecture Frieren S1 E3 (même structure que les fixtures One Piece) */
export const FRIEREN_E3: CrunchyrollWatchFixture = {
  episodeId: 'GG1U2Q5VK',
  url: 'https://www.crunchyroll.com/watch/GG1U2Q5VK/killing-magic',
  jsonLd: JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', name: 'Crunchyroll' },
      {
        '@context': 'https://schema.org',
        '@type': 'TVEpisode',
        name: 'Frieren: Beyond Journey’s End | E3 - Killing Magic',
        episodeNumber: 3,
        partOfSeason: { '@type': 'TVSeason', name: 'Frieren: Beyond Journey’s End', seasonNumber: 1 },
        partOfSeries: { '@type': 'TVSeries', name: 'Frieren: Beyond Journey’s End', '@id': 'https://www.crunchyroll.com/series/GG5H5XQX4/frieren' },
      },
    ],
  }),
  heading: 'E3 - Killing Magic',
  seriesLink: { text: 'Frieren: Beyond Journey’s End', href: 'https://www.crunchyroll.com/series/GG5H5XQX4/frieren' },
};

/** Générique de fin annoncé par static.crunchyroll.com (vidéo de 600 s) */
export const CREDITS_START = 540;

// ─── Mise en place ────────────────────────────────────────────────────────

export interface Scenario {
  h: ExtensionHarness;
  anilist: FakeAniList;
  mal: FakeMal;
}

/** Navigateur neuf, faux services, comptes AniList et MAL connectés, interface en anglais */
export async function launch(context: TestContext, series: readonly SeriesSeed[], sites: FakeSites = new FakeSites()): Promise<Scenario> {
  const anilistEntries = Object.fromEntries(series.flatMap((s) => (s.anilistEntry ? [[s.anilist.id, s.anilistEntry]] : [])));
  const malEntries = Object.fromEntries(series.flatMap((s) => (s.malEntry ? [[s.mal.id, s.malEntry]] : [])));
  const anilist = new FakeAniList({ media: series.map((s) => s.anilist), accounts: [anilistAccount(ANILIST_A, anilistEntries)] });
  const mal = new FakeMal({ anime: series.map((s) => s.mal), accounts: [malAccount(malEntries)] });
  const h = await startExtension(context, { routes: [anilist.handler, mal.handler], pageRoutes: [sites.handler] });
  await seedSettings(h);
  // Le pont (onglet manifest.json) est ouvert ici, avant le panneau : il ne lui volera plus l'onglet actif
  await signIn(h, { anilist: ANILIST_A, mal: true });
  return { h, anilist, mal };
}

/**
 * Page du panneau ouverte dans un onglet (largeur du panneau de Chrome). Seule au premier plan, elle se suit elle-même :
 * hors page de streaming, elle affiche l'Agenda
 */
export async function openPanel(h: ExtensionHarness): Promise<Page> {
  const page = await h.openPage(SIDE_PANEL_PATH, { width: 360, height: 900 });
  await page.waitForSelector('[role="tablist"]');
  return page;
}

export const POPUP_PATH = 'src/popup/popup.html';

/**
 * Popup ouvert dans un onglet. `behind` : onglet ouvert en arrière-plan par l'extension (chrome.tabs.create, active:
 * false) pour que l'onglet actif de la fenêtre reste la page de streaming : sa carte « Sur cette page » la décrit, comme
 * la bulle ouverte au-dessus de cet onglet
 */
export async function openPopup(h: ExtensionHarness, options: { behind?: boolean } = {}): Promise<Page> {
  if (!options.behind) {
    const page = await h.openPage(POPUP_PATH, { width: 400, height: 580 });
    await page.waitForSelector('footer');
    return page;
  }
  const url = `${EXTENSION_ORIGIN}/${POPUP_PATH}`;
  await (await h.bridge()).evaluate((popupUrl: string) => chrome.tabs.create({ url: popupUrl, active: false }).then(() => undefined), url);
  const page = await h.waitForPage(url);
  await page.setViewport({ width: 400, height: 580 });
  await page.waitForSelector('footer');
  return page;
}

/** Textes de l'onglet « En lecture » du panneau (vide s'il n'est pas affiché) */
export async function nowPlayingText(panel: Page): Promise<string> {
  return panel.evaluate(() => (document.getElementById('sk-tabpanel-nowPlaying') as HTMLElement | null)?.innerText.replace(/\s+/g, ' ') ?? '');
}

/** Squelette de chargement de la fiche affiché */
export async function hasSkeleton(panel: Page): Promise<boolean> {
  return panel.evaluate(() => document.querySelector('#sk-tabpanel-nowPlaying [aria-busy="true"][role="status"]') !== null);
}

/** Fiche prête dans « En lecture » : titre de la série et ligne d'épisode attendus */
export async function waitForEntry(panel: Page, title: string, episodeLine: string, timeout = 15_000): Promise<string> {
  return waitFor(
    `fiche « ${title} », « ${episodeLine} » dans le panneau`,
    async () => {
      const text = await nowPlayingText(panel);
      return text.includes(title) && text.includes(episodeLine) && !(await hasSkeleton(panel)) ? text : null;
    },
    timeout,
  );
}

/** `check` reste vrai pendant `duration` ms (relevé toutes les 100 ms) */
export async function stays(label: string, check: () => Promise<boolean>, duration: number): Promise<void> {
  const end = Date.now() + duration;
  while (Date.now() < end) {
    if (!(await check())) throw new Error(`Plus vrai : ${label}`);
    await sleep(100);
  }
}

export async function storedMappings(h: ExtensionHarness): Promise<Record<string, MediaMapping>> {
  const value = (await h.storage())[STORAGE_KEYS.mediaMappings];
  return typeof value === 'object' && value !== null ? (value as Record<string, MediaMapping>) : {};
}

/** Clic sur l'élément (onglet en arrière-plan compris : pas de souris, l'événement est envoyé à l'élément) */
export async function clickOn(page: Page, selector: string): Promise<void> {
  await page.waitForSelector(selector);
  await page.$eval(selector, (el) => (el as HTMLElement).click());
}
