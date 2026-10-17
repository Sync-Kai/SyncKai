// Lien vers la fiche, retrait de la liste et commentaire, sur l'extension construite (docs/audit/MANUAL-TESTS.md §8 et
// §9). Tout passe par les faux services (fake-anilist.ts, fake-mal.ts) : jamais de vraie liste. Popup et panneau sont
// leurs vraies pages ouvertes dans des onglets (scenario.ts) ; les liens ouvrent un nouvel onglet dont l'URL est relevée,
// puis refermé (sa navigation vers anilist.co / myanimelist.net échoue sans bruit : DNS coupé, onglet hors surveillance).
// Non automatisé : §4 « série Netflix hors anime ». L'accès Netflix (permission d'hôte optionnelle) ne s'accorde que par
// chrome.permissions.request : même avec un vrai clic (geste de l'utilisateur), Chromium ouvre sa boîte de dialogue native,
// injoignable par CDP, et la promesse reste en attente ; aucun commutateur ne l'accepte. Déclarer netflix.com dans le
// manifeste de la copie testée changerait l'extension testée (onAdded jamais émis).
// Lancement : npm run test:ext
import type { Page } from 'puppeteer';
import { describe, expect, it } from 'vitest';
import { entryUrl } from '../../src/shared/entry-link';
import type { TrackerId } from '../../src/shared/tracker.types';
import { FakeSites, crunchyrollWatchHtml, play, seek } from './fake-sites';
import { waitFor, type ExtensionHarness } from './harness';
import { ANILIST_A, DUNGEON_MESHI, FRIEREN, MAL_A, crunchyrollEpisode, expectCleanRun, seedMapping, seedSettings, type SeriesFixture } from './seed';
import {
  CREDITS_START,
  FRIEREN_E3,
  FRIEREN_S1,
  FRIEREN_S2,
  clickOn,
  en,
  launch,
  nowPlayingText,
  openPanel,
  openPopup,
  sel,
  stays,
  storedMappings,
  waitForEntry,
  type Scenario,
  type SeriesSeed,
} from './scenario';

// ─── Séries des scénarios ─────────────────────────────────────────────────

/** Série de seed.ts (Crunchyroll) au format des scénarios de l'interface, avec ses entrées de liste */
function seriesOf(fixture: SeriesFixture, entries: Pick<SeriesSeed, 'anilistEntry' | 'malEntry'> = {}): SeriesSeed {
  return {
    anilist: { id: fixture.mediaId, idMal: fixture.malId, title: fixture.title, episodes: fixture.episodes, externalLinks: [`https://www.crunchyroll.com/series/${fixture.seriesId}`] },
    mal: { id: fixture.malId, title: fixture.title, numEpisodes: fixture.episodes },
    ...entries,
  };
}

/** Delicious in Dungeon à l'épisode 7 sur les deux listes */
const DUNGEON = seriesOf(DUNGEON_MESHI, { anilistEntry: { status: 'CURRENT', progress: 7 }, malEntry: { status: 'watching', num_episodes_watched: 7 } });

/** Clé d'une série dans « En cours » du popup (shared/watching.ts › entryKey) */
const keyOf = (series: SeriesSeed): string => `${series.anilist.id}:${series.mal.id}`;

const anilistUrl = (series: SeriesSeed): string => entryUrl('anilist', series.anilist.id);
const malUrl = (series: SeriesSeed): string => entryUrl('mal', series.mal.id);
const urlOn = (service: TrackerId, series: SeriesSeed): string => (service === 'anilist' ? anilistUrl(series) : malUrl(series));

// ─── Outils ───────────────────────────────────────────────────────────────

/**
 * Le lien `selector` ouvre `url` dans un nouvel onglet : href et target vérifiés, clic, onglet créé à cette URL, puis
 * refermé. `front` : onglet remis au premier plan ensuite (la page de streaming que le panneau suit)
 */
async function expectOpensEntry(h: ExtensionHarness, page: Page, selector: string, url: string, front?: Page): Promise<void> {
  await page.waitForSelector(selector);
  const attributes = await page.$eval(selector, (a) => [(a as HTMLAnchorElement).href, a.getAttribute('target'), a.getAttribute('rel')]);
  expect(attributes, selector).toEqual([url, '_blank', 'noopener noreferrer']);
  const opened = h.browser.waitForTarget((t) => t.type() === 'page' && t.url() === url, { timeout: 5_000 });
  await page.$eval(selector, (el) => (el as HTMLElement).click());
  await (await (await opened).page())?.close();
  if (front) await front.bringToFront();
}

/** Jaquette cliquable (lien hors tabulation, masqué aux lecteurs d'écran) vers `url`, dans `scope` */
const coverLink = (scope: string, url: string): string => `${scope} a[aria-hidden="true"][tabindex="-1"][href="${url}"]`;

/** Texte visible de la page (sans les indices masqués) */
async function pageText(page: Page): Promise<string> {
  return page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
}

/** `data-focus` de l'élément qui a le focus */
async function focused(page: Page): Promise<string | null> {
  return page.evaluate(() => document.activeElement?.getAttribute('data-focus') ?? null);
}

/** Retraits envoyés aux faux services (AniList DeleteMediaListEntry, MAL DELETE) */
function removals({ anilist, mal }: Scenario): { anilist: unknown[]; mal: string[] } {
  return {
    anilist: anilist.requests.filter((r) => r.operation === 'DeleteEntry').map((r) => r.variables.id),
    mal: mal.requests.filter((r) => r.method === 'DELETE').map((r) => `${r.path} ${r.status}`),
  };
}

/** Écritures de commentaire envoyées (AniList SaveNotes, MAL PATCH avec `comments`) */
function notesWrites({ anilist, mal }: Scenario): { anilist: unknown[]; mal: (string | undefined)[] } {
  return {
    anilist: anilist.requests.filter((r) => r.operation === 'SaveNotes').map((r) => r.variables.notes),
    mal: mal.requests.filter((r) => r.method === 'PATCH' && r.body?.comments !== undefined).map((r) => r.body?.comments),
  };
}

/** Bandeau du popup (« En cours ») */
/**
 * Liste MyAnimeList dans « Mes séries » : Réglages › Comptes › « Fiche ouverte par défaut » (le sélecteur AniList / MAL
 * au-dessus de la liste a été retiré), puis retour à « En cours »
 */
async function showMalList(popup: Page): Promise<void> {
  await clickOn(popup, sel('gear'));
  await clickOn(popup, sel('settings-cat-accounts'));
  await clickOn(popup, sel('entry-service-mal'));
  await popup.waitForSelector(`${sel('entry-service-mal')}[aria-checked="true"]`);
  await clickOn(popup, sel('settings-home'));
  await clickOn(popup, sel('back'));
  await popup.waitForSelector(`${sel('nav-watching')}[aria-selected="true"]`);
}

async function watchingNotice(popup: Page): Promise<string> {
  return popup.$eval('[data-watching-notice]', (el) => (el as HTMLElement).innerText.replace(/\s+/g, ' '));
}

// ─── §8 Lien vers la fiche ────────────────────────────────────────────────

describe('Lien vers la fiche', () => {
  it('popup : titres et jaquettes de « Sur cette page », « En cours », « Synchros récentes », « À noter », « Différences » ouvrent la fiche AniList, puis MAL (réglage), puis le seul compte restant', async (context) => {
    const sites = new FakeSites().page(FRIEREN_E3.url, crunchyrollWatchHtml(FRIEREN_E3, { lang: 'en' }));
    // Frieren : 2 sur AniList, 1 sur MAL (une différence à analyser)
    const frieren: SeriesSeed = { ...FRIEREN_S1, malEntry: { status: 'watching', num_episodes_watched: 1 } };
    const run = await launch(context, [frieren, FRIEREN_S2, DUNGEON], sites);
    const { h } = run;
    // Synchro récente (Delicious in Dungeon, épisode 8) et carte « À noter » (Frieren saison 2, « Plus tard »)
    await seedMapping(h, DUNGEON_MESHI);
    expect(await h.sendFromContent('EPISODE_COMPLETED', { episode: crunchyrollEpisode(DUNGEON_MESHI, 8), services: null })).toMatchObject({ status: 'synced' });
    const season2 = { mediaId: FRIEREN_S2.anilist.id, malId: FRIEREN_S2.mal.id, title: FRIEREN_S2.anilist.title };
    expect(await h.sendFromContent('DEFER_RATING', { media: season2, coverUrl: null })).toEqual({ ok: true, data: null });
    // Épisode de Frieren au premier plan : la carte « Sur cette page » le décrit
    const tab = await h.openTab(FRIEREN_E3.url);

    const checkLinks = async (service: TrackerId): Promise<void> => {
      await tab.bringToFront();
      const popup = await openPopup(h, { behind: true });
      // Sur cette page : titre et jaquette
      await popup.waitForSelector(sel('page-entry'), { timeout: 15_000 });
      await expectOpensEntry(h, popup, sel('page-entry'), urlOn(service, frieren));
      await expectOpensEntry(h, popup, coverLink('', urlOn(service, frieren)), urlOn(service, frieren));
      // En cours : titres (carte « Reprendre » et ligne) et jaquette
      await expectOpensEntry(h, popup, sel(`title-${keyOf(DUNGEON)}`), urlOn(service, DUNGEON));
      await expectOpensEntry(h, popup, sel(`title-${keyOf(frieren)}`), urlOn(service, frieren));
      await expectOpensEntry(h, popup, coverLink('', urlOn(service, DUNGEON)), urlOn(service, DUNGEON));
      // Activité : synchro récente, carte « À noter »
      await clickOn(popup, sel('nav-activity'));
      await expectOpensEntry(h, popup, '[data-focus^="recent-entry-"]', urlOn(service, DUNGEON));
      await expectOpensEntry(h, popup, sel(`rate-entry-anilist:${FRIEREN_S2.anilist.id}`), urlOn(service, FRIEREN_S2));
      // Différences : ligne de l'Activité → Réglages › Mes données › Écarts, analyse des deux listes (Frieren 2 / 1),
      // la ligne de la différence
      await clickOn(popup, sel('activity-compare'));
      await clickOn(popup, sel('compare-analyze'));
      await expectOpensEntry(h, popup, '[data-focus^="compare-entry-"]', urlOn(service, frieren));
      await popup.close();
    };

    await checkLinks('anilist');

    // Réglages › Comptes › « Fiche ouverte par défaut » : MAL
    await tab.bringToFront();
    const settings = await openPopup(h);
    await clickOn(settings, sel('gear'));
    await clickOn(settings, sel('settings-cat-accounts'));
    await clickOn(settings, sel('entry-service-mal'));
    await waitFor('réglage enregistré', async () => ((await h.storage()).settings as { entryService?: string } | undefined)?.entryService === 'mal');
    await settings.close();
    await checkLinks('mal');

    // MAL déconnecté : le choix reste visible mais désactivé, les liens suivent le seul compte connecté (AniList) malgré le réglage
    const logout = await openPopup(h);
    await clickOn(logout, sel('gear'));
    await clickOn(logout, sel('settings-cat-accounts'));
    await logout.waitForSelector(sel('entry-service-mal'));
    await clickOn(logout, sel('logout-mal'));
    await logout.waitForSelector(`${sel('entry-service-mal')}:disabled`);
    await logout.close();
    await tab.bringToFront();
    const popup = await openPopup(h, { behind: true });
    await expectOpensEntry(h, popup, sel('page-entry'), anilistUrl(frieren));
    await expectOpensEntry(h, popup, sel(`title-${keyOf(DUNGEON)}`), anilistUrl(DUNGEON));
    expectCleanRun(h, run.anilist, run.mal);
  }, 90_000);

  it('panneau : titre et jaquette de « En lecture », suite, Agenda ouvrent la fiche AniList, puis MAL avec le réglage', async (context) => {
    const sites = new FakeSites().page(FRIEREN_E3.url, crunchyrollWatchHtml(FRIEREN_E3, { lang: 'en' }));
    const run = await launch(context, [FRIEREN_S1, FRIEREN_S2], sites);
    const { h } = run;
    run.anilist.airing = [{ id: 9301, mediaId: FRIEREN_S1.anilist.id, episode: 3, airingAt: Math.floor(Date.now() / 1000) + 3_600 }];
    const panel = await openPanel(h);
    const line = en('panel.nowPlaying.episode', { episode: 3, total: 28 });

    const checkLinks = async (service: TrackerId): Promise<Page> => {
      // Agenda (panneau seul au premier plan) : la sortie de Frieren
      await panel.bringToFront();
      await panel.waitForSelector('#sk-tab-agenda[aria-selected="true"]');
      await expectOpensEntry(h, panel, sel('agenda-entry-9301'), urlOn(service, FRIEREN_S1));
      await expectOpensEntry(h, panel, coverLink('#sk-tabpanel-agenda', urlOn(service, FRIEREN_S1)), urlOn(service, FRIEREN_S1));
      // En lecture : titre, jaquette et suite (saison 2), l'épisode remis au premier plan après chaque onglet ouvert
      const tab = (await h.browser.pages()).find((p) => p.url() === FRIEREN_E3.url) ?? (await h.openTab(FRIEREN_E3.url));
      await tab.bringToFront();
      await waitForEntry(panel, FRIEREN_S1.anilist.title, line);
      await expectOpensEntry(h, panel, sel('panel-entry'), urlOn(service, FRIEREN_S1), tab);
      await waitForEntry(panel, FRIEREN_S1.anilist.title, line);
      await expectOpensEntry(h, panel, coverLink('#sk-tabpanel-nowPlaying', urlOn(service, FRIEREN_S1)), urlOn(service, FRIEREN_S1), tab);
      await waitForEntry(panel, FRIEREN_S1.anilist.title, line);
      await expectOpensEntry(h, panel, sel(`relation-entry-${FRIEREN_S2.anilist.id}`), urlOn(service, FRIEREN_S2), tab);
      return tab;
    };

    await checkLinks('anilist');
    // Réglage « Fiche ouverte par défaut » = MAL (relu par le panneau ouvert)
    await seedSettings(h, { entryService: 'mal' });
    await checkLinks('mal');
    expectCleanRun(h, run.anilist, run.mal);
  }, 60_000);
});

// ─── §9 Retrait de la liste ───────────────────────────────────────────────

describe('Retrait de la liste', () => {
  it('popup : « Retirer de la liste » confirmé en ligne (focus sur « Annuler », Annuler et Échap n’envoient rien), puis retiré des deux listes ; popup rouvert : la série ne revient pas', async (context) => {
    const run = await launch(context, [FRIEREN_S1, DUNGEON]);
    const { h } = run;
    const key = keyOf(FRIEREN_S1);
    const popup = await openPopup(h);
    await popup.waitForSelector(sel(`title-${key}`));

    // ⋯ › Retirer de la liste : confirmation dans le menu, focus sur « Annuler »
    await popup.locator(sel(`more-${key}`)).click();
    await popup.locator(sel(`REMOVE-${key}`)).click();
    await popup.waitForSelector(sel(`confirm-yes-${key}`));
    expect(await focused(popup)).toBe(`confirm-no-${key}`);
    expect(await pageText(popup)).toContain(en('list.remove.confirm'));
    // Annuler : plus de confirmation, rien d'envoyé
    await popup.locator(sel(`confirm-no-${key}`)).click();
    await popup.waitForSelector(sel(`REMOVE-${key}`));
    expect(await popup.$(sel(`confirm-yes-${key}`))).toBeNull();
    // Échap : la confirmation se ferme, le menu reste ouvert, rien d'envoyé
    await popup.locator(sel(`REMOVE-${key}`)).click();
    await popup.waitForSelector(sel(`confirm-no-${key}`));
    await popup.keyboard.press('Escape');
    await popup.waitForSelector(sel(`REMOVE-${key}`));
    expect(await popup.$(sel(`confirm-yes-${key}`))).toBeNull();
    expect(removals(run)).toEqual({ anilist: [], mal: [] });

    // Retirer : la ligne disparaît, bandeau « {titre}: removed from your list », retiré des deux faux services
    const entryId = run.anilist.entry(ANILIST_A.token, FRIEREN_S1.anilist.id)?.id;
    await popup.locator(sel(`REMOVE-${key}`)).click();
    await popup.locator(sel(`confirm-yes-${key}`)).click();
    await popup.waitForSelector(sel(`title-${key}`), { hidden: true });
    await popup.waitForSelector('[data-watching-notice]');
    expect(await watchingNotice(popup)).toContain(en('inline.removed', { title: FRIEREN_S1.anilist.title }));
    expect(run.anilist.entry(ANILIST_A.token, FRIEREN_S1.anilist.id)).toBeNull();
    expect(run.mal.entry(MAL_A.token, FRIEREN_S1.mal.id)).toBeNull();
    expect(removals(run)).toEqual({ anilist: [entryId], mal: [`/anime/${FRIEREN_S1.mal.id}/my_list_status 200`] });
    // L'autre série reste
    expect(run.anilist.entry(ANILIST_A.token, DUNGEON.anilist.id)).toMatchObject({ progress: 7 });

    // Popup rouvert dans les 90 s (liste « En cours » du service worker encore en cache) : la série ne revient pas
    await popup.close();
    const again = await openPopup(h);
    await again.waitForSelector(sel(`title-${keyOf(DUNGEON)}`));
    await stays('série retirée absente', async () => (await again.$(sel(`title-${key}`))) === null, 1_500);
    expectCleanRun(h, run.anilist, run.mal);
  });

  it('popup : série absente de MAL (retirée d’AniList seulement, MAL sauté sans erreur) ; MAL en panne (500) : « échec sur MyAnimeList », puis MAL rétabli : retirée de MAL', async (context) => {
    const aniListOnly: SeriesSeed = { ...FRIEREN_S1, malEntry: undefined };
    const run = await launch(context, [aniListOnly, DUNGEON]);
    const { h } = run;
    const popup = await openPopup(h);
    const remove = async (key: string): Promise<string> => {
      await popup.locator(sel(`more-${key}`)).click();
      await popup.locator(sel(`REMOVE-${key}`)).click();
      await popup.locator(sel(`confirm-yes-${key}`)).click();
      return waitFor('bandeau du retrait', async () => ((await popup.$('[data-watching-notice]')) ? watchingNotice(popup) : null));
    };

    // Absente de MAL : retirée d'AniList, aucune requête DELETE vers MAL, aucun échec annoncé
    const removed = en('inline.removed', { title: aniListOnly.anilist.title });
    expect(await remove(keyOf(aniListOnly))).toContain(removed);
    expect(await watchingNotice(popup)).not.toContain(en('inline.partial', { text: removed, services: 'MyAnimeList' }));
    expect(run.anilist.entry(ANILIST_A.token, aniListOnly.anilist.id)).toBeNull();
    expect(removals(run).mal).toEqual([]);
    await popup.waitForSelector('[data-watching-notice]', { hidden: true, timeout: 10_000 });

    // MAL en panne sur DELETE : retirée d'AniList, gardée sur MAL, échec annoncé
    run.mal.failure = { status: 500, methods: ['DELETE'] };
    const dungeonRemoved = en('inline.removed', { title: DUNGEON.anilist.title });
    expect(await remove(keyOf(DUNGEON))).toContain(en('inline.partial', { text: dungeonRemoved, services: 'MyAnimeList' }));
    expect(run.anilist.entry(ANILIST_A.token, DUNGEON.anilist.id)).toBeNull();
    expect(run.mal.entry(MAL_A.token, DUNGEON.mal.id)).toMatchObject({ num_episodes_watched: 7 });

    // MAL rétabli : liste MAL affichée (« Fiche ouverte par défaut »), nouveau retrait, retirée de MAL
    run.mal.failure = null;
    await showMalList(popup);
    await popup.waitForSelector(sel(`title-${keyOf(DUNGEON)}`), { timeout: 10_000 });
    await popup.waitForSelector('[data-watching-notice]', { hidden: true, timeout: 10_000 });
    const notice = await remove(keyOf(DUNGEON));
    expect(notice).toContain(dungeonRemoved);
    expect(notice).not.toContain('MyAnimeList');
    expect(run.mal.entry(MAL_A.token, DUNGEON.mal.id)).toBeNull();
    expect(removals(run).mal).toEqual([`/anime/${DUNGEON.mal.id}/my_list_status 500`, `/anime/${DUNGEON.mal.id}/my_list_status 200`]);
    expectCleanRun(h, run.anilist, run.mal);
  });
});

// ─── §9 Commentaire, retrait depuis le panneau, série revue ensuite ───────

describe('Commentaire et retrait dans le panneau', () => {
  it('panneau : commentaire enregistré (rien à la frappe) puis effacé (Ctrl+Entrée), série retirée (ajout proposé, commentaire indisponible), puis épisode terminé : rajoutée sur les deux listes, même fiche', async (context) => {
    const sites = new FakeSites().page(FRIEREN_E3.url, crunchyrollWatchHtml(FRIEREN_E3, { lang: 'en' })).creditsStart(FRIEREN_E3.episodeId, CREDITS_START);
    const run = await launch(context, [FRIEREN_S1, FRIEREN_S2], sites);
    const { h } = run;
    await seedMapping(h, FRIEREN);
    const panel = await openPanel(h);
    const tab = await h.openTab(FRIEREN_E3.url);
    const line = en('panel.nowPlaying.episode', { episode: 3, total: 28 });
    await waitForEntry(panel, FRIEREN_S1.anilist.title, line);

    // Commentaire : ouvert, saisi au clavier (deux lignes), rien d'envoyé avant « Save »
    await clickOn(panel, sel('panel-notes-toggle'));
    await waitFor('focus dans la zone de texte', async () => (await focused(panel)) === 'panel-notes-input');
    await panel.keyboard.type('Great episode\nSecond line');
    expect(await panel.$eval(sel('panel-notes-input'), (el) => (el as HTMLTextAreaElement).value)).toBe('Great episode\nSecond line');
    expect(notesWrites(run)).toEqual({ anilist: [], mal: [] });
    await clickOn(panel, sel('panel-notes-save'));
    await waitFor('« Comment saved »', async () => (await nowPlayingText(panel)).includes(en('inline.notesSaved')));
    expect(notesWrites(run)).toEqual({ anilist: ['Great episode\nSecond line'], mal: ['Great episode\nSecond line'] });
    expect(run.anilist.entry(ANILIST_A.token, FRIEREN_S1.anilist.id)?.notes).toBe('Great episode\nSecond line');
    expect(run.mal.entry(MAL_A.token, FRIEREN_S1.mal.id)?.comments).toBe('Great episode\nSecond line');
    // Replié : aperçu de la première ligne seulement
    await panel.waitForSelector(sel('panel-notes-toggle'));
    const preview = await panel.$eval(sel('panel-notes-toggle'), (el) => (el as HTMLElement).innerText);
    expect(preview).toContain('Great episode');
    expect(preview).not.toContain('Second line');

    // Effacé puis Ctrl+Entrée : « Comment cleared » sur les deux services
    await clickOn(panel, sel('panel-notes-toggle'));
    await waitFor('focus dans la zone de texte', async () => (await focused(panel)) === 'panel-notes-input');
    await panel.keyboard.down('Control');
    await panel.keyboard.press('KeyA');
    await panel.keyboard.up('Control');
    await panel.keyboard.press('Backspace');
    await panel.keyboard.down('Control');
    await panel.keyboard.press('Enter');
    await panel.keyboard.up('Control');
    await waitFor('« Comment cleared »', async () => (await nowPlayingText(panel)).includes(en('inline.notesCleared')));
    expect(notesWrites(run)).toEqual({ anilist: ['Great episode\nSecond line', ''], mal: ['Great episode\nSecond line', ''] });
    expect(run.anilist.entry(ANILIST_A.token, FRIEREN_S1.anilist.id)?.notes).toBeNull();
    expect(run.mal.entry(MAL_A.token, FRIEREN_S1.mal.id)?.comments).toBe('');

    // Ta progression › ⋯ › Retirer de la liste › Retirer
    const mappingBefore = await storedMappings(h);
    await clickOn(panel, sel('more-panel'));
    await clickOn(panel, sel('REMOVE-panel'));
    await waitFor('focus sur « Annuler »', async () => (await focused(panel)) === 'confirm-no-panel');
    await clickOn(panel, sel('confirm-yes-panel'));
    // Carte : ajout proposé, plus de ⋯, commentaire indisponible avec son explication (série dans aucune liste)
    await panel.waitForSelector(sel('page-add-PLANNING'), { timeout: 10_000 });
    await panel.waitForSelector(sel('page-add-CURRENT'));
    expect(await panel.$(sel('more-panel'))).toBeNull();
    expect(await panel.$eval(sel('panel-notes-toggle'), (el) => (el as HTMLButtonElement).disabled)).toBe(true);
    expect(await nowPlayingText(panel)).toContain(en('notes.notInList'));
    expect(run.anilist.entry(ANILIST_A.token, FRIEREN_S1.anilist.id)).toBeNull();
    expect(run.mal.entry(MAL_A.token, FRIEREN_S1.mal.id)).toBeNull();
    // Correspondance gardée
    expect(await storedMappings(h)).toEqual(mappingBefore);

    // L'épisode est terminé ensuite : la synchro rajoute la série sur les deux listes, sur la même fiche AniList
    await play(tab);
    await seek(tab, CREDITS_START + 1);
    await waitFor('série rajoutée', () => run.anilist.entry(ANILIST_A.token, FRIEREN_S1.anilist.id) !== null && run.mal.entry(MAL_A.token, FRIEREN_S1.mal.id) !== null);
    const progressWrites = run.anilist.mutations().filter((m) => m.operation === 'SaveProgress');
    expect(progressWrites.map((m) => m.variables)).toEqual([{ mediaId: FRIEREN_S1.anilist.id, progress: 3, status: 'CURRENT' }]);
    expect(run.anilist.entry(ANILIST_A.token, FRIEREN_S1.anilist.id)).toMatchObject({ status: 'CURRENT', progress: 3 });
    expect(run.mal.entry(MAL_A.token, FRIEREN_S1.mal.id)).toMatchObject({ status: 'watching', num_episodes_watched: 3 });
    expect(run.anilist.entry(ANILIST_A.token, FRIEREN_S2.anilist.id)).toBeNull();
    // La carte retrouve la série dans la liste (⋯ de nouveau proposé)
    await panel.waitForSelector(sel('more-panel'), { timeout: 10_000 });
    expectCleanRun(h, run.anilist, run.mal);
  }, 60_000);
});

// ─── §9 Commentaire dans le popup ─────────────────────────────────────────

describe('Commentaire dans le popup', () => {
  it('⋯ › « Comment… » : éditeur sous la ligne, commentaire d’AniList chargé, Échap sans enregistrer, compteur à 6000 ; série sur MAL seul : écrit sur MAL seul ; retirée entre-temps : « Add the series… », rien ajouté', async (context) => {
    const frieren: SeriesSeed = {
      ...FRIEREN_S1,
      anilistEntry: { status: 'CURRENT', progress: 2, notes: 'AniList note' },
      malEntry: { status: 'watching', num_episodes_watched: 2, comments: 'MAL note' },
    };
    const season2MalOnly: SeriesSeed = { ...FRIEREN_S2, malEntry: { status: 'watching', num_episodes_watched: 1, comments: 'Season 2 on MAL' } };
    const run = await launch(context, [frieren, season2MalOnly, DUNGEON]);
    const { h } = run;
    const popup = await openPopup(h);
    const openEditor = async (series: SeriesSeed): Promise<string> => {
      const key = keyOf(series);
      await popup.locator(sel(`more-${key}`)).click();
      await popup.locator(sel(`notes-${key}`)).click();
      await popup.waitForSelector(`[data-notes-row="${key}"] ${sel(`notes-${key}-input`)}:not([aria-busy="true"])`);
      return key;
    };
    const draft = (key: string): Promise<string> => popup.$eval(sel(`notes-${key}-input`), (el) => (el as HTMLTextAreaElement).value);

    // Éditeur sous la ligne, focus dans la zone de texte, commentaire d'AniList (la série y est) chargé
    const key = await openEditor(frieren);
    await waitFor('focus dans la zone de texte', async () => (await focused(popup)) === `notes-${key}-input`);
    expect(await draft(key)).toBe('AniList note');
    // Juste sous la ligne de la série
    const rowAbove = await popup.$eval(`[data-notes-row="${key}"]`, (row) => row.previousElementSibling?.querySelector('[data-focus^="title-"]')?.getAttribute('data-focus'));
    expect(rowAbove).toBe(`title-${key}`);
    // Saisie puis Échap : fermé sans rien enregistrer, focus rendu au bouton ⋯
    await popup.keyboard.type(' edited');
    await popup.keyboard.press('Escape');
    await popup.waitForSelector(`[data-notes-row="${key}"]`, { hidden: true });
    await waitFor('focus sur ⋯', async () => (await focused(popup)) === `more-${key}`);
    expect(notesWrites(run)).toEqual({ anilist: [], mal: [] });

    // Compteur : la saisie s'arrête à 6000 caractères (maxlength), compteur « 6000 / 6000 »
    await openEditor(frieren);
    await popup.$eval(sel(`notes-${key}-input`), (el) => {
      const area = el as HTMLTextAreaElement;
      area.value = 'x'.repeat(5_998);
      area.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await popup.focus(sel(`notes-${key}-input`));
    await popup.keyboard.press('End');
    await popup.keyboard.type('abcd');
    expect((await draft(key)).length).toBe(6_000);
    expect(await popup.$eval(`[data-notes-row="${key}"]`, (row) => (row as HTMLElement).innerText)).toContain('6000 / 6000');
    await popup.locator(sel(`notes-${key}-cancel`)).click();
    await popup.waitForSelector(`[data-notes-row="${key}"]`, { hidden: true });
    expect(notesWrites(run)).toEqual({ anilist: [], mal: [] });

    // Liste MAL : la saison 2, dans la liste MAL seulement, montre le commentaire de MAL ; l'enregistrer n'écrit que sur MAL
    await showMalList(popup);
    const s2 = await openEditor(season2MalOnly);
    expect(await draft(s2)).toBe('Season 2 on MAL');
    await popup.keyboard.type(' (rewatch)');
    await popup.locator(sel(`notes-${s2}-save`)).click();
    await popup.waitForSelector(`[data-notes-row="${s2}"]`, { hidden: true });
    expect(notesWrites(run)).toEqual({ anilist: [], mal: ['Season 2 on MAL (rewatch)'] });
    expect(run.anilist.entry(ANILIST_A.token, season2MalOnly.anilist.id)).toBeNull();

    // Retirée des deux listes sur les sites pendant que l'éditeur est ouvert : « Add the series… », rien n'est ajouté
    const dungeon = await openEditor(DUNGEON);
    run.anilist.removeEntry(ANILIST_A.token, DUNGEON.anilist.id);
    run.mal.removeEntry(MAL_A.token, DUNGEON.mal.id);
    await popup.keyboard.type('Too late');
    await popup.locator(sel(`notes-${dungeon}-save`)).click();
    await waitFor('bandeau « Add the series… »', async () => (await popup.$('[data-watching-notice]')) !== null && (await watchingNotice(popup)).includes(en('notes.notInList')));
    expect(await watchingNotice(popup)).toContain(`${DUNGEON.anilist.title} · ${en('notes.notInList')}`);
    expect(notesWrites(run)).toEqual({ anilist: [], mal: ['Season 2 on MAL (rewatch)'] });
    expect(run.anilist.entry(ANILIST_A.token, DUNGEON.anilist.id)).toBeNull();
    expect(run.mal.entry(MAL_A.token, DUNGEON.mal.id)).toBeNull();
    // Éditeur resté ouvert (nouvel essai possible), brouillon gardé
    expect(await draft(dungeon)).toBe('Too late');
    expectCleanRun(h, run.anilist, run.mal);
  });
});
