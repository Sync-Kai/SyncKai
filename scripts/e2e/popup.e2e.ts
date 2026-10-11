// Tests de bout en bout du popup : le vrai popup.ts tourne dans Chrome headless sur l'API chrome simulée
// (scripts/e2e/popup-frame.ts). On vérifie le DOM et les messages envoyés au service worker, pas les pixels.
// Lancement : npm run test:e2e
import type { Browser, Page } from 'puppeteer';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import manifest from '../../manifest.json';
import { tl, type Locale, type MessageKey, type MessageParams } from '../../src/i18n';
import { launchBrowser, startHarnessServer, type HarnessServer } from '../screenshots/harness';
import type { SentMessage } from '../screenshots/mock-chrome';
import { PLATFORM_LINKS_KEY } from '../../src/shared/platform-links';
import { SETTINGS_STORAGE_KEY } from '../../src/shared/settings';
import { PLANTED_SECRETS, type E2EState, type FrameParams } from './protocol';

let server: HarnessServer;
let browser: Browser;
/** Pages ouvertes par le test en cours et erreurs JavaScript relevées (un test échoue sur toute erreur de page) */
const opened: { page: Page; errors: string[] }[] = [];

beforeAll(async () => {
  server = await startHarnessServer('e2e');
  browser = await launchBrowser();
});

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

afterEach(async () => {
  const pages = opened.splice(0);
  await Promise.all(pages.map(({ page }) => page.close()));
  expect(pages.flatMap(({ errors }) => errors)).toEqual([]);
});

const fr = (key: MessageKey, params?: MessageParams): string => tl('fr', key, params);

// ─── Outils ───────────────────────────────────────────────────────────────

async function openPopup(params: FrameParams = {}): Promise<Page> {
  const page = await browser.newPage();
  const errors: string[] = [];
  opened.push({ page, errors });
  page.on('pageerror', (error) => errors.push(String(error)));
  // Dimensions du popup (src/popup/popup.css)
  await page.setViewport({ width: 400, height: 580 });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const entries = Object.entries({ locale: 'fr', ...params }).filter((entry): entry is [string, string] => typeof entry[1] === 'string');
  await page.goto(`${server.base}scripts/e2e/popup.html?${new URLSearchParams(entries).toString()}`, { waitUntil: 'load' });
  await page.waitForSelector('footer');
  return page;
}

async function trace(page: Page): Promise<E2EState> {
  const state = await page.evaluate(() => window.__e2e);
  if (!state) throw new Error('Traces e2e absentes (popup-frame.ts non chargé ?)');
  return state;
}

async function sent(page: Page, type: string): Promise<SentMessage[]> {
  return (await trace(page)).messages.filter((m) => m.type === type);
}

/** Attend le n-ième message `type` envoyé au service worker et le renvoie */
async function waitForMessage(page: Page, type: string, count = 1): Promise<SentMessage> {
  await page.waitForFunction((t: string, n: number) => (window.__e2e?.messages.filter((m) => m.type === t).length ?? 0) >= n, {}, type, count);
  const messages = await sent(page, type);
  return messages[count - 1];
}

const sel = (focus: string): string => `[data-focus="${focus}"]`;

async function click(page: Page, focus: string): Promise<void> {
  await page.locator(sel(focus)).click();
}

async function text(page: Page, selector: string): Promise<string> {
  return page.$eval(selector, (el) => el.textContent?.trim() ?? '');
}

async function attr(page: Page, selector: string, name: string): Promise<string | null> {
  return page.$eval(selector, (el, n) => el.getAttribute(n), name);
}

/** Écran visible de la zone centrale : 0 En cours, 1 Activité, 2 Réglages, 3 accueil */
async function shownScreen(page: Page): Promise<number> {
  return page.$eval('main', (main) => [...main.children].findIndex((child) => child instanceof HTMLElement && !child.hidden));
}

async function focused(page: Page): Promise<string | null> {
  return page.evaluate(() => document.activeElement?.getAttribute('data-focus') ?? null);
}

interface RowInfo {
  title: string;
  badge: string;
  progress: string;
}

/** Lignes « Mes séries » : titre, pastille d'épisode et progression */
async function watchingRows(page: Page): Promise<RowInfo[]> {
  return page.$$eval('main ul[aria-label] > li', (items) =>
    items.map((li) => ({
      title: li.querySelector('span[title]')?.getAttribute('title') ?? '',
      // Deuxième ligne du bloc texte : pastille d'épisode (ou retour d'action)
      badge: li.querySelector(':scope > div > span:nth-of-type(2) > span')?.textContent?.trim() ?? '',
      progress: li.querySelector(':scope > span[aria-label]')?.textContent?.trim() ?? '',
    })),
  );
}

/** Titres des lignes de la section « Écarts AniList ↔ MAL » */
async function compareRows(page: Page): Promise<string[]> {
  return page.evaluate((label: string) => {
    const section = [...document.querySelectorAll('section')].find((s) => s.getAttribute('aria-label') === label);
    return [...(section?.querySelectorAll('ul > li span[title]') ?? [])].map((span) => span.getAttribute('title') ?? '');
  }, fr('compare.section'));
}

/** Ouvre une sous-page depuis l'accueil des Réglages */
async function openCategory(page: Page, category: string): Promise<void> {
  await click(page, `settings-cat-${category}`);
  await page.waitForSelector(sel('settings-home'));
}

/** Change la langue dans Réglages › Langue : le popup se recharge sur la même sous-page */
async function switchLanguage(page: Page, locale: Locale): Promise<void> {
  await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), click(page, `language-${locale}`)]);
  await page.waitForSelector(sel(`language-${locale}`));
}

// ─── Scénarios ────────────────────────────────────────────────────────────

const SOLO = '176496:58567';

describe('popup (bout en bout)', () => {
  it('s’ouvre sur « En cours » avec les séries, les pastilles d’épisode et la version du manifest', async () => {
    const page = await openPopup();
    await page.waitForSelector(sel(`more-${SOLO}`));

    expect(await attr(page, sel('nav-watching'), 'aria-pressed')).toBe('true');
    expect(await shownScreen(page)).toBe(0);
    // Carte « Reprendre » : la série mise à jour le plus récemment, hors de la liste
    expect(await page.$eval(`section[aria-label="${fr('watching.resume')}"] span[title]`, (el) => el.getAttribute('title'))).toBe('Dandadan');

    const rows = await watchingRows(page);
    expect(rows.map((r) => r.title).sort()).toEqual(['Frieren', 'Kaiju No. 8', 'One Piece', 'Solo Leveling', 'Spy x Family']);
    expect(rows.every((r) => r.badge.length > 0)).toBe(true);
    const badgeOf = (title: string): string => rows.find((r) => r.title === title)?.badge ?? '';
    // Épisode 3 sorti (le 4 est annoncé) alors que la progression est à 2
    expect(badgeOf('Solo Leveling')).toBe(fr('watching.badge.available', { episode: 3 }));
    // Prochain épisode dans moins d'un jour : compte à rebours
    expect(badgeOf('Kaiju No. 8').startsWith(fr('watching.badge.upcoming', { episode: 5, delay: '' }))).toBe(true);
    expect(rows.find((r) => r.title === 'Solo Leveling')?.progress).toBe('2 / 13');

    expect(await text(page, 'footer')).toContain(`v${manifest.version}`);
    // Accès aux sites accordé : pas de bandeau
    expect(await page.$(sel('host-access'))).toBeNull();
  });

  it('navigue entre En cours, Activité et Réglages, et change de langue', async () => {
    const page = await openPopup();
    await page.waitForSelector(sel('nav-activity'));

    await click(page, 'nav-activity');
    expect(await attr(page, sel('nav-activity'), 'aria-pressed')).toBe('true');
    expect(await shownScreen(page)).toBe(1);

    await click(page, 'gear');
    await page.waitForSelector(sel('back'));
    expect(await shownScreen(page)).toBe(2);
    expect(await text(page, 'h1')).toBe(fr('nav.settings'));

    // Retour : écran précédent (Activité)
    await click(page, 'back');
    await page.waitForSelector(sel('nav-activity'));
    expect(await shownScreen(page)).toBe(1);
    await click(page, 'nav-watching');
    expect(await shownScreen(page)).toBe(0);
    expect(await text(page, sel('nav-activity'))).toBe(fr('nav.activity'));

    // Langue : rechargement du popup, toujours sur Réglages › Langue, libellés traduits
    await click(page, 'gear');
    await openCategory(page, 'language');
    for (const locale of ['en', 'de', 'fr'] as const) {
      await switchLanguage(page, locale);
      expect(await page.evaluate(() => document.documentElement.lang)).toBe(locale);
      expect(await shownScreen(page)).toBe(2);
      expect(await text(page, 'h1')).toBe(tl(locale, 'settings.section.language'));
      expect(await text(page, sel('settings-home'))).toBe(tl(locale, 'nav.settings'));
      expect(await text(page, '#sk-language-label')).toBe(tl(locale, 'settings.section.language'));
    }
    // Retour à l'accueil des Réglages (résumés traduits), puis à l'écran principal
    await click(page, 'settings-home');
    await page.waitForSelector(sel('back'));
    expect(await text(page, sel('settings-cat-help'))).toContain(fr('settings.cat.help'));
    expect(await text(page, sel('settings-cat-language'))).toContain(fr('settings.section.language'));
    await click(page, 'back');
    await page.waitForSelector(sel('nav-watching'));
    expect(await text(page, sel('nav-watching'))).toBe(fr('nav.watching'));
  });

  it('menu « ⋯ » : Abandonner demande confirmation (focus sur « Non »), « Oui » envoie SET_LIST_STATUS et retire la série', async () => {
    const page = await openPopup();
    await click(page, `more-${SOLO}`);
    await page.waitForSelector('[role="menu"]');
    expect(await attr(page, sel(`more-${SOLO}`), 'aria-expanded')).toBe('true');

    await click(page, `DROPPED-${SOLO}`);
    await page.waitForSelector(sel(`confirm-no-${SOLO}`));
    expect(await focused(page)).toBe(`confirm-no-${SOLO}`);
    expect(await text(page, sel(`confirm-no-${SOLO}`))).toBe(fr('watching.confirm.no'));
    expect(await sent(page, 'SET_LIST_STATUS')).toEqual([]);

    await click(page, `confirm-yes-${SOLO}`);
    const message = await waitForMessage(page, 'SET_LIST_STATUS');
    // Affiche de démo en data: URL → coverUrl null (https uniquement)
    expect(message.payload).toEqual({ mediaId: 176496, malId: 58567, status: 'DROPPED', coverUrl: null });
    await page.waitForSelector(sel(`more-${SOLO}`), { hidden: true });
    await page.waitForSelector('[data-watching-notice]');

    // Revalidation de la liste (~1 s) : la série ne revient pas
    const revalidations = (await sent(page, 'GET_WATCHING')).length + 1;
    await waitForMessage(page, 'GET_WATCHING', revalidations);
    await page.waitForFunction(() => document.querySelector('main [aria-busy="false"]') !== null);
    expect((await watchingRows(page)).map((r) => r.title)).not.toContain('Solo Leveling');
  });

  it('« +1 » envoie ADJUST_PROGRESS (delta 1) et met la progression à jour', async () => {
    const page = await openPopup();
    await click(page, `plus-${SOLO}`);
    const message = await waitForMessage(page, 'ADJUST_PROGRESS');
    expect(message.payload).toEqual({ mediaId: 176496, malId: 58567, delta: 1 });
    await page.waitForFunction(
      (title: string) =>
        [...document.querySelectorAll('main ul[aria-label] > li')].some(
          (li) => li.querySelector('span[title]')?.getAttribute('title') === title && li.querySelector(':scope > span[aria-label]')?.textContent === '3 / 13',
        ),
      {},
      'Solo Leveling',
    );
  });

  it('« +1 » en échec partiel : « Réessayer » envoie la progression absolue au seul service en échec', async () => {
    const page = await openPopup({ adjust: 'partial' });
    await click(page, `plus-${SOLO}`);
    expect((await waitForMessage(page, 'ADJUST_PROGRESS')).payload).toEqual({ mediaId: 176496, malId: 58567, delta: 1 });
    await page.waitForSelector(sel('watching-retry'));
    expect(await attr(page, sel('watching-retry'), 'aria-label')).toBe(fr('inline.retryOn', { services: 'MyAnimeList' }));

    await click(page, 'watching-retry');
    const retry = await waitForMessage(page, 'ADJUST_PROGRESS', 2);
    // Pas de delta réappliqué : AniList (déjà à 3) n'est pas visé
    expect(retry.payload).toEqual({ mediaId: 176496, malId: 58567, delta: 1, retry: { services: ['mal'], progress: 3 } });
    await page.waitForSelector(sel('watching-retry'), { hidden: true });
  });

  it('lecteur ADN : « Ouvrir » reste sur Crunchyroll sans lien ADN, le menu propose « Chercher sur ADN », un lien appris bascule « Ouvrir »', async () => {
    const page = await openPopup();
    const openOn = (platform: string): string => `a[aria-label="${fr('watching.openOnAria', { title: 'Solo Leveling', platform })}"]`;
    await page.waitForSelector(openOn('Crunchyroll'));

    // Lecteur préféré ADN : aucun lien ADN connu → lien direct Crunchyroll conservé
    await page.evaluate(async (key: string) => {
      const stored = await chrome.storage.local.get(key);
      const current: unknown = stored[key];
      await chrome.storage.local.set({ [key]: { ...(typeof current === 'object' && current !== null ? current : {}), preferredPlayer: 'adn' } });
    }, SETTINGS_STORAGE_KEY);
    await click(page, `more-${SOLO}`);
    await page.waitForSelector(sel(`search-adn-${SOLO}`));
    expect(await attr(page, sel(`search-adn-${SOLO}`), 'href')).toBe('https://animationdigitalnetwork.com/video?search=Solo%20Leveling');
    expect(await text(page, sel(`search-adn-${SOLO}`))).toBe(fr('watching.searchOn', { platform: 'ADN' }));
    expect(await page.$(openOn('ADN'))).toBeNull();

    // Page de la série ADN visitée : lien appris → « Ouvrir » passe sur ADN, la recherche disparaît
    await page.evaluate(async (key: string) => {
      await chrome.storage.local.set({ [key]: { '176496': { links: { adn: 'https://animationdigitalnetwork.com/video/1234-solo-leveling' }, updatedAt: Date.now() } } });
    }, PLATFORM_LINKS_KEY);
    await page.waitForSelector(openOn('ADN'));
    expect(await attr(page, openOn('ADN'), 'href')).toBe('https://animationdigitalnetwork.com/video/1234-solo-leveling');
    await page.waitForSelector(sel(`search-adn-${SOLO}`), { hidden: true });
  });

  it('« Sur cette page » : fiche de l’onglet Crunchyroll, saison, et « Ajouter à À regarder » envoie ADD_TO_LIST PLANNING', async () => {
    const page = await openPopup({ scenario: 'page', pageList: 'missing' });
    await page.waitForSelector(sel('page-add-PLANNING'));
    const card = `section[aria-label="${fr('page.title')}"]`;
    const cardText = await text(page, card);
    expect(cardText).toContain('Mushoku Tensei: Jobless Reincarnation Season 2');
    expect(cardText).toContain(fr('page.seasonSlotPart', { season: 2, part: 1, parts: 2 }));
    expect(await text(page, sel('page-add-PLANNING'))).toBe(fr('page.addPlanning'));
    // Absente des listes : ni progression ni statut
    expect(await page.$(sel('page-plus'))).toBeNull();
    expect((await waitForMessage(page, 'RESOLVE_PAGE_MEDIA')).payload).toMatchObject({ page: { platform: 'crunchyroll', seriesId: 'DEMOMUSHOKU' } });

    await click(page, 'page-add-PLANNING');
    const message = await waitForMessage(page, 'ADD_TO_LIST');
    expect(message.payload).toEqual({ mediaId: 146065, malId: 51179, status: 'PLANNING' });
    await page.waitForSelector(`${card} [role="status"]`);
  });

  it('« Sur cette page » : série déjà en cours, contrôles de progression', async () => {
    const page = await openPopup({ scenario: 'page' });
    await page.waitForSelector(sel('page-plus'));
    expect(await page.$(sel('page-add-PLANNING'))).toBeNull();
    // La carte « Sur cette page » remplace « Reprendre »
    expect(await page.$(`section[aria-label="${fr('watching.resume')}"]`)).toBeNull();
  });

  it('« Sur cette page » : série ignorée (Netflix, pas un anime) → mention neutre, sans « Réessayer »', async () => {
    const page = await openPopup({ scenario: 'page', pageMedia: 'untracked' });
    const card = `section[aria-label="${fr('page.title')}"]`;
    await page.waitForSelector(`${card} [role="status"]`);
    expect(await text(page, `${card} [role="status"]`)).toBe(fr('page.notTracked'));
    expect(await page.$(`${card} button`)).toBeNull();
  });

  it('Écarts AniList ↔ MAL : analyse, filtres, « Garder AniList » envoie APPLY_DIFFS', async () => {
    const page = await openPopup();
    await click(page, 'nav-activity');
    await click(page, 'compare-analyze');
    await waitForMessage(page, 'COMPARE_LISTS');
    await page.waitForSelector(sel('compare-filter-all'));

    expect(await compareRows(page)).toHaveLength(7);
    expect(await text(page, sel('compare-filter-all'))).toBe(`${fr('compare.filter.all')} 7`);
    expect(await attr(page, sel('compare-filter-all'), 'aria-pressed')).toBe('true');
    const sectionText = await page.evaluate((label: string) => [...document.querySelectorAll('section')].find((s) => s.getAttribute('aria-label') === label)?.textContent ?? '', fr('compare.section'));
    expect(sectionText).toContain(fr('compare.summary.compared_other', { count: 412 }));

    await click(page, 'compare-filter-status');
    expect(await attr(page, sel('compare-filter-status'), 'aria-pressed')).toBe('true');
    expect(await compareRows(page)).toEqual(['Blue Lock', 'Oshi no Ko']);

    await click(page, 'compare-anilist-mal:49596');
    const message = await waitForMessage(page, 'APPLY_DIFFS');
    expect(message.payload).toEqual({ items: [{ mediaId: 137822, malId: 49596 }], source: 'anilist' });
    // Tâche acceptée : barre de progression
    await page.waitForSelector('[role="progressbar"]');
  });

  it('Réglages › Aide : « Copier le rapport » copie un rapport sans token ni nom de compte', async () => {
    const page = await openPopup();
    await click(page, 'gear');
    await openCategory(page, 'help');
    await click(page, 'help-copy');
    await page.waitForFunction(() => (window.__e2e?.clipboard.length ?? 0) > 0);
    const [report] = (await trace(page)).clipboard;

    expect(report).toContain('SyncKai diagnostic report');
    expect(report).toContain(`Version: ${manifest.version}`);
    expect(report).toContain('### Recent errors (1)');
    for (const secret of Object.values(PLANTED_SECRETS)) expect(report).not.toContain(secret);
    expect(report).not.toContain('Kai_fan');
    await page.waitForFunction((label: string) => document.body.textContent?.includes(label) ?? false, {}, fr('settings.help.copied'));
  });

  it('Réglages : sous-page Notifications & Agenda (focus sur le titre, retour sur la ligne d’origine), interrupteur rapide enregistré', async () => {
    const page = await openPopup();
    await click(page, 'gear');
    await page.waitForSelector(sel('settings-cat-notifications'));
    // Résumé de l'accueil : réglages de démo (notifications détaillées, alertes à l'heure)
    expect(await text(page, sel('settings-cat-notifications'))).toContain(`${fr('settings.notif.detailed.title')} · ${fr('settings.summary.airingOnTime')}`);

    await openCategory(page, 'notifications');
    expect(await text(page, 'h1')).toBe(fr('settings.cat.notifications'));
    expect(await focused(page)).toBe('settings-heading');
    expect(await page.$('#sk-airing')).not.toBeNull();

    // Échap : retour à l'accueil, focus rendu à la ligne de la catégorie
    await page.keyboard.press('Escape');
    await page.waitForSelector(sel('back'));
    expect(await focused(page)).toBe('settings-cat-notifications');
    // « ← Réglages » fait de même
    await openCategory(page, 'notifications');
    await click(page, 'settings-home');
    await page.waitForSelector(sel('back'));
    expect(await focused(page)).toBe('settings-cat-notifications');

    // Interrupteur rapide « Alertes de sortie » : réglage enregistré, résumé mis à jour
    expect(await page.$eval('#sk-quick-airing', (input) => input instanceof HTMLInputElement && input.checked)).toBe(true);
    await click(page, 'sk-quick-airing');
    await page.waitForFunction(
      async (key: string) => {
        const stored = await chrome.storage.local.get(key);
        const value: unknown = stored[key];
        return typeof value === 'object' && value !== null && 'airingAlerts' in value && value.airingAlerts === false;
      },
      {},
      SETTINGS_STORAGE_KEY,
    );
    expect(await text(page, sel('settings-cat-notifications'))).toContain(fr('settings.summary.airingOff'));
    expect(await page.$eval('#sk-quick-airing', (input) => input instanceof HTMLInputElement && input.checked)).toBe(false);
  });

  it('Réglages › Lecture & synchro : activer Netflix demande l’accès à netflix.com, puis le lecteur Netflix devient proposé', async () => {
    const page = await openPopup();
    await click(page, 'gear');
    await openCategory(page, 'sync');
    await page.waitForSelector('#sk-netflix');
    const checked = (): Promise<boolean> => page.$eval('#sk-netflix', (input) => input instanceof HTMLInputElement && input.checked);

    // Accès non accordé : interrupteur éteint, Netflix absent du lecteur préféré
    expect(await checked()).toBe(false);
    expect(await text(page, '#sk-netflix-help')).toBe(fr('settings.netflix.helpOff'));
    expect(await page.$(sel('player-netflix'))).toBeNull();
    expect(await page.$(sel('player-crunchyroll'))).not.toBeNull();

    await click(page, 'sk-netflix');
    await page.waitForFunction(() => (window.__e2e?.permissionRequests.length ?? 0) > 0);
    expect((await trace(page)).permissionRequests).toEqual([manifest.optional_host_permissions]);
    // Accès accordé (scripts aussi exécutés dans les onglets ouverts : aucune consigne de rechargement), option Netflix proposée
    await page.waitForSelector(sel('player-netflix'));
    expect(await checked()).toBe(true);
    expect(await text(page, '#sk-netflix-help')).toBe(fr('settings.netflix.helpOn'));
    // Aucun message au service worker : l'enregistrement des scripts suit la permission (permissions.onAdded)
    expect((await trace(page)).messages.filter((m) => m.type !== 'GET_WATCHING' && m.type !== 'GET_VIEWER' && m.type !== 'GET_MAL_VIEWER')).toEqual([]);

    // Retrait : permissions.remove, l'option disparaît
    await click(page, 'sk-netflix');
    await page.waitForFunction(() => (window.__e2e?.permissionRemovals.length ?? 0) > 0);
    expect((await trace(page)).permissionRemovals).toEqual([manifest.optional_host_permissions]);
    await page.waitForSelector(sel('player-netflix'), { hidden: true });
    expect(await checked()).toBe(false);
    // Le script d'un onglet déjà ouvert tourne jusqu'à son rechargement : consigne discrète
    const statuses = await page.$$eval('[role="status"]', (nodes) => nodes.map((node) => node.textContent ?? ''));
    expect(statuses).toContain(fr('settings.netflix.disabled'));
  });

  it('accès aux sites retiré : bandeau, « Autoriser l’accès » appelle permissions.request', async () => {
    const page = await openPopup({ hostAccess: 'missing' });
    await page.waitForSelector(sel('host-access'));
    expect(await text(page, '[role="alert"]')).toContain(fr('popup.hostAccessMissing'));
    expect(await text(page, sel('host-access'))).toBe(fr('popup.hostAccessAllow'));

    await click(page, 'host-access');
    await page.waitForFunction(() => (window.__e2e?.permissionRequests.length ?? 0) > 0);
    const expected = [...new Set([...manifest.host_permissions, ...manifest.content_scripts.flatMap((script) => script.matches)])];
    expect((await trace(page)).permissionRequests).toEqual([expected]);
    // Accès accordé : le bandeau disparaît
    await page.waitForSelector(sel('host-access'), { hidden: true });
  });

  it('service worker muet sur GET_WATCHING : erreur et « Réessayer » au bout du délai, puis la liste', async () => {
    const page = await openPopup({ watching: 'hang' });
    await page.waitForFunction((message: string) => document.querySelector('main [role="alert"]')?.textContent?.includes(message) ?? false, {}, fr('popup.swTimeout'));
    expect(await watchingRows(page)).toEqual([]);

    const retry = await page.waitForSelector(`::-p-xpath(//main//*[@role="alert"]//button[normalize-space()="${fr('common.retry')}"])`);
    await retry?.click();
    await waitForMessage(page, 'GET_WATCHING', 2);
    await page.waitForSelector(sel(`more-${SOLO}`));
    expect(await page.$('main [role="alert"]')).toBeNull();
  });

  it('service worker lent sur GET_WATCHING : erreur au bout du délai, puis la réponse tardive affiche la liste sans « Réessayer »', async () => {
    const page = await openPopup({ watching: 'slow' });
    await page.waitForFunction((message: string) => document.querySelector('main [role="alert"]')?.textContent?.includes(message) ?? false, {}, fr('popup.swTimeout'));
    expect(await watchingRows(page)).toEqual([]);

    await page.waitForSelector(sel(`more-${SOLO}`));
    expect(await page.$('main [role="alert"]')).toBeNull();
    expect(await sent(page, 'GET_WATCHING')).toHaveLength(1);
  });
});
