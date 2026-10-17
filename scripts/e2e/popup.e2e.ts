// Tests de bout en bout du popup : le vrai popup.ts tourne dans Chrome headless sur l'API chrome simulée
// (scripts/e2e/popup-frame.ts). On vérifie le DOM et les messages envoyés au service worker, pas les pixels.
// Lancement : npm run test:e2e
import type { Browser, Page } from 'puppeteer';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import manifest from '../../manifest.json';
import { LOCALES, tl, type Locale, type MessageKey, type MessageParams } from '../../src/i18n';
import { launchBrowser, startHarnessServer, type HarnessServer } from '../screenshots/harness';
import type { SentMessage } from '../screenshots/mock-chrome';
import { PLATFORM_LINKS_KEY } from '../../src/platforms/links';
import { SETTINGS_STORAGE_KEY } from '../../src/shared/settings';
import { STORAGE_KEYS } from '../../src/protocol/storage-keys';
import { COMPARE_JOB_KEY, type CompareJob } from '../../src/shared/compare-job';
import { SETTINGS_PAGE_PARENTS, type SettingsSubPage } from '../../src/ui/settings/navigation';
import { PLANTED_SECRETS, type E2EState, type FrameParams } from './protocol';

let server: HarnessServer;
let browser: Browser;
/**
 * Pages ouvertes par le test en cours, erreurs JavaScript relevées (un test échoue sur toute erreur de page) et langues
 * dont le catalogue a été demandé au serveur (chargement à la demande, src/i18n/index.ts)
 */
const opened: { page: Page; errors: string[]; catalogs: string[] }[] = [];

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
  const catalogs: string[] = [];
  opened.push({ page, errors, catalogs });
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('request', (request) => {
    // Lecture du fichier par le chargeur, sans requête de module de Vite (`?url` des adresses, `?import` de l'anglais)
    const url = new URL(request.url());
    const locale = url.search === '' ? /\/src\/i18n\/locales\/([\w-]+)\.json$/.exec(url.pathname)?.[1] : undefined;
    if (locale !== undefined) catalogs.push(locale);
  });
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

/** Interrupteur (role="switch") allumé */
async function switchOn(page: Page, focus: string): Promise<boolean> {
  return (await attr(page, sel(focus), 'aria-checked')) === 'true';
}

/** Description de la ligne des Réglages qui porte un interrupteur */
async function rowHelp(page: Page, focus: string): Promise<string> {
  return page.$eval(sel(focus), (el) => el.closest('[data-settings-row]')?.querySelector('[data-row-description]')?.textContent?.trim() ?? '');
}

/** Lecteur préféré (Réglages › Plateformes) : option proposée, grisée (« Activer d'abord ») ou absente de la liste */
async function playerOption(page: Page, platform: string): Promise<'offered' | 'disabled' | 'absent'> {
  await click(page, 'player');
  await page.waitForSelector('[role="listbox"]');
  const state = await page.evaluate((key: string) => {
    const option = document.querySelector(`[data-focus="${key}"]`);
    return option === null ? 'absent' : option.getAttribute('aria-disabled') === 'true' ? 'disabled' : 'offered';
  }, `player-${platform}`);
  await page.keyboard.press('Escape');
  await page.waitForSelector('[role="listbox"]', { hidden: true });
  return state;
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
/** Titres des lignes de Réglages › Mes données › Écarts, dans l'ordre affiché */
async function compareRows(page: Page): Promise<string[]> {
  return page.$$eval('[data-diff] [data-diff-title]', (titles) => titles.map((title) => title.getAttribute('title') ?? ''));
}

/** Réglages › Mes données › Écarts AniList ↔ MAL, par la ligne de Mes données */
async function openCompare(page: Page): Promise<void> {
  await click(page, 'gear');
  await openCategory(page, 'compare');
  expect(await text(page, 'h1')).toBe(fr('compare.section'));
}

/** Change un réglage directement dans le stockage (comme une autre vue ouverte) */
async function setSetting(page: Page, patch: Record<string, unknown>): Promise<void> {
  await page.evaluate(
    async (key: string, values: Record<string, unknown>) => {
      const stored = await chrome.storage.local.get(key);
      const current: unknown = stored[key];
      await chrome.storage.local.set({ [key]: { ...(typeof current === 'object' && current !== null ? current : {}), ...values } });
    },
    SETTINGS_STORAGE_KEY,
    patch,
  );
}

/** Attend que le lien `selector` pointe vers `href` */
async function waitForHref(page: Page, selector: string, href: string): Promise<void> {
  await page.waitForFunction((s: string, url: string) => document.querySelector(s)?.getAttribute('href') === url, {}, selector, href);
}

/** Ouvre une page depuis l'accueil des Réglages (page de second niveau : par sa page parente, comme à la main) */
async function openCategory(page: Page, category: SettingsSubPage): Promise<void> {
  const parent = SETTINGS_PAGE_PARENTS[category];
  if (parent !== 'home') await openCategory(page, parent);
  await click(page, `settings-cat-${category}`);
  await page.waitForSelector(sel('settings-home'));
}

/**
 * Change la langue dans Réglages › Langue (clic sur la ligne de la langue, bouton radio) : le popup est retraduit en
 * place, sans rechargement (un rechargement recrée la vue auto-dimensionnée de Chrome, qui s'affiche zoomée) ; un
 * marqueur posé sur `window` doit survivre
 */
async function switchLanguage(page: Page, locale: Locale): Promise<void> {
  await page.evaluate(() => Object.assign(window, { __e2eNoReload: true }));
  await page.locator(`[data-language-row="${locale}"]`).click();
  await page.waitForFunction((l: string) => document.documentElement.lang === l, {}, locale);
  await page.waitForSelector(`${sel(`language-${locale}`)}:checked`);
  expect(await page.evaluate(() => '__e2eNoReload' in window)).toBe(true);
}

interface LanguageRowInfo {
  value: string;
  label: string;
  checked: boolean;
}

/** Langues dont la page a demandé le catalogue au serveur, dans l'ordre */
function catalogRequests(page: Page): string[] {
  return [...(opened.find((entry) => entry.page === page)?.catalogs ?? [])];
}

/** Lignes de Réglages › Langue, dans l'ordre : valeur, libellé principal et état du bouton radio */
async function languageRows(page: Page): Promise<LanguageRowInfo[]> {
  return page.$$eval('[role="radiogroup"] [data-language-row]', (rows) =>
    rows.map((row) => {
      const input = row.querySelector('input[type="radio"]');
      return {
        value: row.getAttribute('data-language-row') ?? '',
        label: row.querySelector('[data-language-label]')?.textContent?.trim() ?? '',
        checked: input instanceof HTMLInputElement && input.checked,
      };
    }),
  );
}

// ─── Scénarios ────────────────────────────────────────────────────────────

const SOLO = '176496:58567';

describe('popup (bout en bout)', () => {
  it('s’ouvre sur « En cours » avec les séries, les pastilles d’épisode et la barre d’état (synchro non vue, sans la version)', async () => {
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

    // Barre d'état : synchro d'il y a 3 min non vue (série en 1re ligne, « J'ai vu, masquer ») ; version : Réglages › Aide seulement
    const footer = await text(page, 'footer');
    expect(footer).toContain('Dandadan Season 2');
    expect(footer).toContain(fr('footer.syncedEpisode', { episode: 7 }));
    expect(footer).not.toContain(`v${manifest.version}`);
    await click(page, 'footer-dismiss');
    await page.waitForFunction(() => document.querySelector('[data-focus="footer-dismiss"]') === null);
    expect(await text(page, 'footer')).not.toContain('Dandadan Season 2');
    // Accès aux sites accordé : pas de bandeau
    expect(await page.$(sel('host-access'))).toBeNull();
  });

  it('menu du compte : logo AniList → menu au-dessus de la barre (statistiques, synchros de la semaine), une relecture du profil au plus, Échap ferme', async () => {
    const page = await openPopup();
    await page.waitForSelector(sel('chip-anilist'));
    // Profil de démo sans date de lecture : relu au démarrage, puis une fois à l'ouverture du menu
    await waitForMessage(page, 'GET_VIEWER');
    const before = (await sent(page, 'GET_VIEWER')).length;
    expect(await attr(page, sel('chip-anilist'), 'aria-haspopup')).toBe('menu');
    await click(page, 'chip-anilist');
    await page.waitForSelector('[role="menu"] [data-stat]');
    expect(await attr(page, sel('chip-anilist'), 'aria-expanded')).toBe('true');
    expect(await attr(page, '[role="menu"]', 'aria-label')).toBe(fr('accountMenu.label', { service: 'AniList' }));
    expect(await text(page, '[data-account-status]')).toBe(fr('accountMenu.connectedAs', { name: 'Kai_fan' }));
    const tiles = await page.$$eval('[role="menu"] [data-stat]', (els) => els.map((el) => (el as HTMLElement).innerText.replace(/\n+/g, ' ').trim()));
    const n = new Intl.NumberFormat('fr');
    expect(tiles).toEqual([
      `${n.format(142)} ${tl('fr', 'accountMenu.stats.anime_other')}`,
      `${n.format(3210)} ${tl('fr', 'accountMenu.stats.episodes_other')}`,
      `${fr('accountMenu.stats.daysValue', { days: '54' })} ${tl('fr', 'accountMenu.stats.days_other')}`,
    ]);
    expect(await text(page, '[data-week-value]')).toBe(fr('accountMenu.week.value_other', { count: 9 }));
    expect(await attr(page, '[data-week] [title]', 'title')).toBe(fr('accountMenu.week.title'));
    // Menu au-dessus de la barre, dans le popup, entre 288 et 376 px
    const box = await page.$eval('[role="menu"]', (el) => {
      const rect = el.getBoundingClientRect();
      const footer = document.querySelector('footer')?.getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: rect.width, bottom: rect.bottom, footerTop: footer?.top ?? 0 };
    });
    expect(box.bottom).toBeLessThanOrEqual(box.footerTop);
    expect(box.width).toBeGreaterThanOrEqual(288);
    expect(box.width).toBeLessThanOrEqual(376);
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(400);
    // Focus sur « Voir mon profil » (lien vers le profil, nouvel onglet), flèche vers « Déconnecter »
    expect(await page.evaluate(() => document.activeElement?.getAttribute('href'))).toBe('https://anilist.co/user/Kai_fan');
    await page.keyboard.press('ArrowDown');
    expect(await page.evaluate(() => document.activeElement?.textContent)).toBe(fr('settings.account.logout'));
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.querySelector('[role="menu"]') === null);
    expect(await focused(page)).toBe('chip-anilist');
    // Échap n'a fermé que le menu : le popup reste sur « En cours »
    expect(await shownScreen(page)).toBe(0);
    expect((await sent(page, 'GET_VIEWER')).length).toBeLessThanOrEqual(before + 1);
  });

  it('menu du compte : session expirée (« Reconnecter » d’abord, profil en cache), statistiques illisibles (tuiles masquées)', async () => {
    const expired = await openPopup({ account: 'expired' });
    await click(expired, 'chip-anilist');
    await expired.waitForSelector('[data-account-status="expired"]');
    expect(await attr(expired, '[role="menu"]', 'aria-label')).toBe(fr('accountMenu.labelExpired', { service: 'AniList' }));
    // Profil en cache lu à l'ouverture : « Voir mon profil » apparaît
    await expired.waitForFunction(() => document.querySelectorAll('[role="menu"] [role="menuitem"]').length === 3);
    const items = await expired.$$eval('[role="menu"] [role="menuitem"]', (els) => els.map((el) => el.textContent));
    expect(items).toEqual([fr('common.reconnect'), fr('accountMenu.profile'), fr('settings.account.logout')]);
    expect(await expired.$('[role="menu"] [data-stats]')).toBeNull();
    await expired.locator('[role="menu"] [role="menuitem"]').click();
    await waitForMessage(expired, 'LOGIN_ANILIST');

    const failed = await openPopup({ account: 'no-stats' });
    await click(failed, 'chip-anilist');
    await failed.waitForSelector('[role="menu"] [data-week-value]');
    await failed.waitForFunction(() => document.querySelector('[role="menu"] [data-skeleton]') === null);
    expect(await failed.$('[role="menu"] [data-stats]')).toBeNull();
    expect(await text(failed, '[data-account-status]')).toBe(fr('accountMenu.connectedAs', { name: 'Kai_fan' }));
  });

  it('panneau latéral (Chrome) : bouton « Ouvrir le panneau » sur un site quelconque, ouvert dans la fenêtre de l’onglet', async () => {
    const page = await openPopup({ panel: 'chrome' });
    await page.waitForSelector(sel('panel'));
    expect(await attr(page, sel('panel'), 'aria-label')).toBe(fr('panel.open'));
    await click(page, 'panel');
    await page.waitForFunction(() => (window.__e2e?.sidePanelOpens?.length ?? 0) > 0);
    expect((await trace(page)).sidePanelOpens).toEqual([1]);
  });

  it('sans API de panneau latéral : pas de bouton « Ouvrir le panneau »', async () => {
    const page = await openPopup();
    await page.waitForSelector(sel(`more-${SOLO}`));
    expect(await page.$(sel('panel'))).toBeNull();
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

    // Langue : liste de boutons radio, « Automatique » en tête et coché par défaut, puis les 21 langues par endonyme ;
    // champ de recherche (au moins LANGUAGE_SEARCH_MIN langues), pas de ligne « Aider à traduire » (adresse absente).
    // Réglage par défaut (« auto ») remis en place : les données de démo choisissent la langue du popup ; navigateur en
    // français. Seul le catalogue français a été lu (anglais embarqué, autres langues à la demande)
    await setSetting(page, { language: 'auto' });
    await click(page, 'gear');
    await openCategory(page, 'language');
    expect(await attr(page, '[role="radiogroup"]', 'aria-label')).toBe(fr('settings.language.groupLabel'));
    const rows = await languageRows(page);
    expect(rows[0]).toEqual({ value: 'auto', label: fr('settings.language.auto'), checked: true });
    const order = rows.slice(1).map((row) => row.value);
    expect([...order].sort()).toEqual([...LOCALES].sort());
    expect(rows.filter((row) => row.checked).map((row) => row.value)).toEqual(['auto']);
    const labelOf = (value: string): string | undefined => rows.find((row) => row.value === value)?.label;
    expect(['de', 'en', 'fr', 'zh-CN', 'zh-TW'].map(labelOf)).toEqual(['Deutsch', 'English', 'Français', '简体中文', '繁體中文']);
    expect(labelOf('es')).not.toBe(labelOf('es-419'));
    // Endonymes triés selon la collation du navigateur (racine de CLDR, sans casse ni accents)
    const labels = rows.slice(1).map((row) => row.label);
    expect(await page.evaluate((list: string[]) => list.every((label, i) => i === 0 || (list[i - 1] ?? '').localeCompare(label, 'en', { sensitivity: 'base' }) <= 0), labels)).toBe(true);
    expect(await text(page, '[data-language-row="auto"]')).toContain(fr('settings.language.autoDetail', { language: 'Français' }));
    expect(await text(page, '[data-language-row="de"]')).toContain('Allemand');
    expect(await page.$(sel('language-translate'))).toBeNull();
    expect(catalogRequests(page)).toEqual(['fr']);
    // Champ de recherche : focus à l'ouverture de la page ; il filtre les langues (par endonyme, nom traduit ou code),
    // jamais « Automatique »
    expect(await focused(page)).toBe('language-search');
    const listed = async (): Promise<string[]> => (await languageRows(page)).map((row) => row.value);
    await page.type(sel('language-search'), 'zh');
    await page.waitForFunction(() => document.querySelectorAll('#sk-language-list [data-language-row]').length === 2);
    expect(await listed()).toEqual(['auto', 'zh-CN', 'zh-TW']);
    await page.type(sel('language-search'), 'xx');
    await page.waitForSelector('[data-language-empty]');
    expect(await text(page, '[data-language-empty]')).toBe(fr('settings.language.noResult'));
    for (let i = 0; i < 4; i++) await page.keyboard.press('Backspace');
    await page.waitForFunction((count: number) => document.querySelectorAll('#sk-language-list [data-language-row]').length === count, {}, LOCALES.length);
    // Popup retraduit en place, toujours sur Réglages › Langue ; allemand et japonais lus à la demande au premier
    // choix, une seule fois chacun
    for (const locale of ['en', 'de', 'ja', 'de', 'fr'] as const) {
      await switchLanguage(page, locale);
      expect(await page.evaluate(() => document.documentElement.lang)).toBe(locale);
      expect(await shownScreen(page)).toBe(2);
      expect(await text(page, 'h1')).toBe(tl(locale, 'settings.section.language'));
      expect(await text(page, sel('settings-home'))).toBe(tl(locale, 'settings.cat.display'));
      expect(await attr(page, '[role="radiogroup"]', 'aria-label')).toBe(tl(locale, 'settings.language.groupLabel'));
      // Même ordre (endonymes) dans toutes les langues ; une seule langue cochée
      expect((await languageRows(page)).map((row) => [row.value, row.checked])).toEqual(['auto', ...order].map((value) => [value, value === locale]));
    }
    expect(catalogRequests(page)).toEqual(['fr', 'de', 'ja']);
    // Clavier : un seul arrêt de tabulation (boutons radio d'un même nom), flèches pour choisir ; le focus suit, y compris
    // vers une langue dont le catalogue n'est pas encore chargé (celle qui précède le français dans l'ordre affiché)
    const previous = order[order.indexOf('fr') - 1] ?? '';
    await page.focus(sel('language-fr'));
    await page.keyboard.press('ArrowUp');
    await page.waitForFunction((l: string) => document.documentElement.lang === l, {}, previous);
    expect(await focused(page)).toBe(`language-${previous}`);
    await page.keyboard.press('ArrowDown');
    await page.waitForFunction(() => document.documentElement.lang === 'fr');
    expect(await focused(page)).toBe('language-fr');
    // Maj+Tab quitte le groupe d'un coup vers le champ de recherche (pas d'arrêt sur « Automatique » ni sur les langues)
    await page.keyboard.down('Shift');
    await page.keyboard.press('Tab');
    await page.keyboard.up('Shift');
    expect(await focused(page)).toBe('language-search');
    // Retour à Affichage (ligne Langue focalisée, résumé de la langue), puis à l'accueil des Réglages (résumés traduits)
    await click(page, 'settings-home');
    await page.waitForSelector(sel('settings-cat-language'));
    expect(await focused(page)).toBe('settings-cat-language');
    expect(await text(page, sel('settings-cat-language'))).toContain(fr('settings.language.groupLabel'));
    await click(page, 'settings-home');
    await page.waitForSelector(sel('back'));
    expect(await focused(page)).toBe('settings-cat-display');
    expect(await text(page, sel('settings-cat-help'))).toContain(fr('settings.cat.help'));
    expect(await text(page, sel('settings-cat-display'))).toContain(fr('settings.summary.display'));
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

  it('menu « ⋯ » : « Retirer de la liste » demande confirmation (focus sur « Annuler »), « Retirer » envoie REMOVE_FROM_LIST et retire la série', async () => {
    const page = await openPopup();
    await click(page, `more-${SOLO}`);
    await page.waitForSelector('[role="menu"]');
    expect(await text(page, sel(`REMOVE-${SOLO}`))).toBe(fr('list.remove'));

    await click(page, `REMOVE-${SOLO}`);
    await page.waitForSelector(sel(`confirm-no-${SOLO}`));
    expect(await focused(page)).toBe(`confirm-no-${SOLO}`);
    expect(await text(page, '[role="menu"] [role="group"]')).toContain(fr('list.remove.confirm'));
    // « Annuler » : rien n'est envoyé, le focus revient sur l'option
    await click(page, `confirm-no-${SOLO}`);
    await page.waitForSelector(sel(`REMOVE-${SOLO}`));
    expect(await focused(page)).toBe(`REMOVE-${SOLO}`);
    expect(await sent(page, 'REMOVE_FROM_LIST')).toEqual([]);

    await click(page, `REMOVE-${SOLO}`);
    await click(page, `confirm-yes-${SOLO}`);
    const message = await waitForMessage(page, 'REMOVE_FROM_LIST');
    expect(message.payload).toEqual({ media: { mediaId: 176496, malId: 58567, title: 'Solo Leveling' } });
    await page.waitForSelector(sel(`more-${SOLO}`), { hidden: true });
    await page.waitForSelector('[data-watching-notice]');
    expect(await text(page, '[data-watching-notice]')).toContain(fr('inline.removed', { title: 'Solo Leveling' }));

    // Revalidation de la liste (~1 s) : la série ne revient pas
    const revalidations = (await sent(page, 'GET_WATCHING')).length + 1;
    await waitForMessage(page, 'GET_WATCHING', revalidations);
    await page.waitForFunction(() => document.querySelector('main [aria-busy="false"]') !== null);
    expect((await watchingRows(page)).map((r) => r.title)).not.toContain('Solo Leveling');
  });

  it('menu « ⋯ » : « Commentaire… » ouvre l’éditeur sous la série, lit le commentaire, « Enregistrer » envoie SET_LIST_NOTES ; Échap annule', async () => {
    const page = await openPopup();
    const input = sel(`notes-${SOLO}-input`);
    await click(page, `more-${SOLO}`);
    await click(page, `notes-${SOLO}`);
    await waitForMessage(page, 'GET_LIST_NOTES');
    expect((await sent(page, 'GET_LIST_NOTES'))[0]?.payload).toEqual({ media: { mediaId: 176496, malId: 58567, title: 'Solo Leveling' } });
    // Commentaire relu dans la zone de texte, qui a le focus ; rien à enregistrer tant qu'il n'a pas changé
    await page.waitForFunction((s: string) => document.querySelector<HTMLTextAreaElement>(s)?.value === 'Combat final à revoir', {}, input);
    expect(await focused(page)).toBe(`notes-${SOLO}-input`);
    expect(await page.$eval(sel(`notes-${SOLO}-save`), (el) => (el as HTMLButtonElement).disabled)).toBe(true);
    expect(await page.$eval(`[data-notes-row="${SOLO}"]`, (el) => el.textContent ?? '')).toContain('21 / 6000');

    await page.type(input, ' (épisode 12)');
    expect(await page.$eval(sel(`notes-${SOLO}-save`), (el) => (el as HTMLButtonElement).disabled)).toBe(false);
    // Aucun envoi à la frappe
    expect(await sent(page, 'SET_LIST_NOTES')).toEqual([]);
    await click(page, `notes-${SOLO}-save`);
    const message = await waitForMessage(page, 'SET_LIST_NOTES');
    expect(message.payload).toEqual({ media: { mediaId: 176496, malId: 58567, title: 'Solo Leveling' }, notes: 'Combat final à revoir (épisode 12)' });
    // Enregistré : éditeur fermé, focus rendu au bouton « ⋯ », pastille de retour sur la ligne
    await page.waitForSelector(`[data-notes-row="${SOLO}"]`, { hidden: true });
    expect(await focused(page)).toBe(`more-${SOLO}`);
    await page.waitForFunction((label: string) => document.body.textContent?.includes(label) === true, {}, fr('inline.notesSaved'));

    // Rouvert : nouveau commentaire relu ; Échap ferme sans rien envoyer
    await click(page, `more-${SOLO}`);
    await click(page, `notes-${SOLO}`);
    await page.waitForFunction((s: string) => document.querySelector<HTMLTextAreaElement>(s)?.value === 'Combat final à revoir (épisode 12)', {}, input);
    await page.type(input, ' brouillon');
    await page.keyboard.press('Escape');
    await page.waitForSelector(`[data-notes-row="${SOLO}"]`, { hidden: true });
    expect(await sent(page, 'SET_LIST_NOTES')).toHaveLength(1);
    expect(await shownScreen(page)).toBe(0);
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

  it('« +1 » au clavier : le focus reste sur le bouton pendant l’envoi (aria-disabled) et après les nouveaux rendus', async () => {
    const page = await openPopup({ adjust: 'slow' });
    const plus = `plus-${SOLO}`;
    await page.waitForSelector(sel(plus));
    // Tabulation depuis le début du popup jusqu'au « +1 » de Solo Leveling
    for (let i = 0; i < 80 && (await focused(page)) !== plus; i++) await page.keyboard.press('Tab');
    expect(await focused(page)).toBe(plus);
    const revalidations = (await sent(page, 'GET_WATCHING')).length + 1;

    await page.keyboard.press('Enter');
    await waitForMessage(page, 'ADJUST_PROGRESS');
    // Envoi en cours : bouton recréé avec aria-disabled (pas disabled), toujours focalisé
    expect(await attr(page, sel(plus), 'aria-disabled')).toBe('true');
    expect(await attr(page, sel(plus), 'disabled')).toBeNull();
    expect(await focused(page)).toBe(plus);
    // Entrée pendant l'envoi : ignorée
    await page.keyboard.press('Enter');

    // Réponse, retour « Épisode 3 vu », puis revalidation de la liste : le focus n'a pas quitté le « +1 »
    await page.waitForFunction((key: string) => document.querySelector(`[data-focus="${key}"]`)?.hasAttribute('aria-disabled') === false, {}, plus);
    expect(await focused(page)).toBe(plus);
    await waitForMessage(page, 'GET_WATCHING', revalidations);
    await page.waitForFunction(() => document.querySelector('main [aria-busy="false"]') !== null);
    expect(await focused(page)).toBe(plus);
    expect(await sent(page, 'ADJUST_PROGRESS')).toHaveLength(1);
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

  it('« Sur cette page » : commentaire replié sous la note, « Enregistrer » envoie SET_LIST_NOTES (rien à la frappe)', async () => {
    const page = await openPopup({ scenario: 'page' });
    const card = `section[aria-label="${fr('page.title')}"]`;
    const toggle = `${card} [data-focus="page-notes-toggle"]`;
    await page.waitForSelector(toggle);
    await page.locator(toggle).click();
    await page.waitForSelector('[data-focus="page-notes-input"]');
    await page.type('[data-focus="page-notes-input"]', 'Superbe arc');
    expect(await sent(page, 'SET_LIST_NOTES')).toEqual([]);
    await page.locator('[data-focus="page-notes-save"]').click();
    const message = await waitForMessage(page, 'SET_LIST_NOTES');
    expect(message.payload).toMatchObject({ notes: 'Superbe arc' });
  });

  it('changement de langue : en-tête, onglets, carte « Sur cette page », commentaire et barre d’état retraduits sans rechargement', async () => {
    const page = await openPopup({ scenario: 'page' });
    const en = (key: MessageKey, params?: MessageParams): string => tl('en', key, params);
    const notesToggle = '[data-focus="page-notes-toggle"]';
    await page.waitForSelector(notesToggle);
    expect(await text(page, notesToggle)).toContain(fr('notes.title'));
    const footer = await text(page, 'footer');

    await click(page, 'gear');
    await openCategory(page, 'language');
    await switchLanguage(page, 'en');
    // Même sous-page des Réglages, retraduite
    expect(await text(page, 'h1')).toBe(en('settings.section.language'));
    expect(await attr(page, sel('gear'), 'aria-label')).toBe(en('nav.settings'));

    await click(page, 'settings-home');
    await click(page, 'settings-home');
    await click(page, 'back');
    await page.waitForSelector(sel('nav-watching'));
    expect(await shownScreen(page)).toBe(0);
    expect(await text(page, sel('nav-watching'))).toBe(en('nav.watching'));
    expect(await text(page, sel('nav-activity'))).toBe(en('nav.activity'));
    expect(await page.$(`section[aria-label="${en('page.title')}"]`)).not.toBeNull();
    // Éditeur persistant du commentaire : redessiné dans la nouvelle langue
    expect(await text(page, notesToggle)).toContain(en('notes.title'));
    expect(await text(page, 'footer')).not.toBe(footer);
    // Activité : section « À vérifier » (élément persistant) retraduite
    await click(page, 'nav-activity');
    const mainText = await page.$eval('main', (el) => el.textContent ?? '');
    expect(mainText).toContain(en('review.empty'));
    expect(mainText).not.toContain(fr('review.empty'));
    expect(await page.evaluate(() => '__e2eNoReload' in window)).toBe(true);
  });

  it('« Sur cette page » : série ignorée (Netflix, pas un anime) → mention neutre, sans « Réessayer »', async () => {
    const page = await openPopup({ scenario: 'page', pageMedia: 'untracked' });
    const card = `section[aria-label="${fr('page.title')}"]`;
    await page.waitForSelector(`${card} [role="status"]`);
    expect(await text(page, `${card} [role="status"]`)).toBe(fr('page.notTracked', { platform: 'Netflix' }));
    expect(await page.$(`${card} button`)).toBeNull();
  });

  it('Écarts AniList ↔ MAL (Réglages › Mes données) : jamais analysé, analyse, filtres, « Garder AniList » envoie APPLY_DIFFS', async () => {
    const page = await openPopup();
    // Activité : une ligne qui mène aux Réglages, sans compteur avant la première analyse
    await click(page, 'nav-activity');
    await page.waitForSelector(sel('activity-compare'));
    expect(await text(page, sel('activity-compare'))).toContain(fr('settings.compare.title'));
    expect(await page.$(`${sel('activity-compare')} [data-diff-count]`)).toBeNull();
    await click(page, 'activity-compare');
    await page.waitForSelector(sel('settings-home'));
    expect(await text(page, 'h1')).toBe(fr('compare.section'));
    // Retour : Mes données, focus sur la ligne des écarts
    await click(page, 'settings-home');
    expect(await text(page, 'h1')).toBe(fr('settings.cat.data'));
    expect(await focused(page)).toBe('settings-cat-compare');
    await click(page, 'settings-cat-compare');

    expect(await text(page, sel('compare-analyze'))).toBe(fr('compare.analyze'));
    await click(page, 'compare-analyze');
    await waitForMessage(page, 'COMPARE_LISTS');
    await page.waitForSelector(sel('compare-filter-all'));

    expect(await compareRows(page)).toHaveLength(7);
    expect(await text(page, sel('compare-filter-all'))).toBe(`${fr('compare.filter.all')} 7`);
    expect(await attr(page, sel('compare-filter-all'), 'aria-pressed')).toBe('true');
    expect(await text(page, '[data-compare-result]')).toContain(fr('compare.summary.compared_other', { count: 412 }));

    await click(page, 'compare-filter-status');
    expect(await attr(page, sel('compare-filter-status'), 'aria-pressed')).toBe('true');
    expect(await compareRows(page)).toEqual(['Blue Lock', 'Oshi no Ko']);
    // Filtre : boutons en lot « Aligner ce filtre sur … »
    expect(await text(page, sel('compare-bulk-anilist'))).toBe(fr('compare.bulk.filtered.anilist'));

    // Confirmation en lot : focus sur « Annuler », Échap ne quitte pas la page (Annuler la referme)
    await click(page, 'compare-bulk-anilist');
    await page.waitForSelector('[data-compare-confirm]');
    expect(await focused(page)).toBe('compare-bulk-cancel');
    await click(page, 'compare-bulk-cancel');
    await page.waitForSelector(sel('compare-bulk-anilist'));

    await click(page, 'compare-anilist-mal:49596');
    const message = await waitForMessage(page, 'APPLY_DIFFS');
    expect(message.payload).toEqual({ items: [{ mediaId: 137822, malId: 49596 }], source: 'anilist' });
    // Tâche acceptée : barre de progression à la place des boutons en lot, « Continue même si tu fermes cette page »
    await page.waitForSelector('[data-compare-running] [role="progressbar"]');
    expect(await text(page, '[data-compare-running]')).toContain(fr('compare.job.background'));
    expect(await page.$(sel('compare-bulk-anilist'))).toBeNull();
  });

  it('pause d’alignement : seul le compte à rebours change chaque seconde, sans recréer les nœuds de la page', async () => {
    const page = await openPopup({ scenario: 'compare' });
    // Analyse en mémoire : compteur des écarts sur la ligne de l'Activité
    await click(page, 'nav-activity');
    await page.waitForSelector(`${sel('activity-compare')} [data-diff-count]`);
    expect(await text(page, `${sel('activity-compare')} [data-diff-count]`)).toBe('7');
    await openCompare(page);
    await page.waitForSelector(sel('compare-filter-all'));
    const at = Date.now();
    const job: CompareJob = {
      kind: 'apply',
      source: 'anilist',
      status: 'running',
      total: 3,
      done: 1,
      updated: 1,
      skipped: 0,
      failed: 0,
      cursor: 1,
      itemCount: 3,
      current: { mediaId: 150672, malId: 52034 },
      cancelled: false,
      startedAt: at,
      updatedAt: at,
      message: null,
      messages: [],
      pausedUntil: at + 120_000,
      pauseReason: 'rate-limit',
      pauseService: 'anilist',
    };
    await page.evaluate(async (key: string, value: CompareJob) => chrome.storage.local.set({ [key]: value }), COMPARE_JOB_KEY, job);
    await page.waitForSelector('[data-job-pause]');

    // Nœuds de référence : une ligne d'écart, l'en-tête du popup et la ligne de pause
    const first = await page.evaluate(() => {
      const w = window as Window & { __nodes?: Element[] };
      w.__nodes = [document.querySelector('[data-diff]'), document.querySelector('header'), document.querySelector('[data-job-pause]')].filter((n): n is Element => n instanceof Element);
      return document.querySelector('[data-job-pause]')?.textContent ?? '';
    });
    expect(first).toContain('AniList');
    // Série en cours d'écriture : l'élément démarré de la tâche (`current`), seule ligne occupée
    expect(await page.$$eval('li[aria-busy="true"]', (rows) => rows.map((row) => row.textContent ?? ''))).toEqual([expect.stringContaining('Oshi no Ko')]);

    // Deux secondes plus tard : le compte à rebours a avancé, mais aucun nœud n'a été recréé
    await page.waitForFunction((text: string) => document.querySelector('[data-job-pause]')?.textContent !== text, { timeout: 3_000 }, first);
    await new Promise((resolve) => setTimeout(resolve, 1_100));
    const same = await page.evaluate(() => {
      const w = window as Window & { __nodes?: Element[] };
      const now = [document.querySelector('[data-diff]'), document.querySelector('header'), document.querySelector('[data-job-pause]')];
      return w.__nodes?.length === 3 && w.__nodes.every((node, i) => node === now[i] && node.isConnected);
    });
    expect(same).toBe(true);
    // Alignement en cours dans la barre d'état : mène à cette page (Réglages déjà ouverts : rien ne change)
    expect(await text(page, sel('footer-job'))).toContain(fr('compare.bulk.running', { done: 1, total: 3 }));
  });

  it('Réglages › Aide & à propos : version, liens, journal ; « Copier le rapport » copie un rapport sans token ni nom de compte', async () => {
    const page = await openPopup();
    await click(page, 'gear');
    await openCategory(page, 'help');
    // Version : seul endroit qui l'affiche ; liens externes en nouvel onglet
    expect(await text(page, '[data-about-version]')).toContain(fr('settings.summary.version', { version: manifest.version }));
    expect(await attr(page, sel('about-source'), 'href')).toBe('https://github.com/Sync-Kai/SyncKai');
    expect(await attr(page, sel('about-privacy'), 'target')).toBe('_blank');
    expect(await attr(page, sel('about-whats-new'), 'href')).toBe('https://synckai.app/fr/changelog');
    expect(await attr(page, sel('help-report'), 'href')).toContain('https://github.com/Sync-Kai/SyncKai/issues/new');
    // Journal de démo (1 erreur) : nombre, liste dépliable avec l'erreur, note sous la carte
    expect(await text(page, '[data-journal-count]')).toBe(fr('settings.help.errors_one', { count: 1 }));
    await click(page, 'help-journal-toggle');
    await page.waitForSelector('[data-journal-list] li');
    expect(await attr(page, sel('help-journal-toggle'), 'aria-expanded')).toBe('true');
    const helpText = await page.$eval('main', (el) => el.textContent ?? '');
    expect(helpText).toContain(fr('settings.help.journalNote'));
    // Entrée de démo avec un jeton en clair (« Bearer … ») : masquée à l'affichage aussi
    for (const secret of Object.values(PLANTED_SECRETS)) expect(helpText).not.toContain(secret);
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

  it('Réglages : sous-page Notifications (focus sur le titre, retour sur la ligne d’origine), interrupteur rapide enregistré', async () => {
    const page = await openPopup();
    await click(page, 'gear');
    await page.waitForSelector(sel('settings-cat-notifications'));
    // Résumé de l'accueil : réglages de démo (notifications détaillées, alertes à l'heure)
    expect(await text(page, sel('settings-cat-notifications'))).toContain(`${fr('settings.notif.detailed.title')} · ${fr('settings.summary.airingOnTime')}`);

    await openCategory(page, 'notifications');
    expect(await text(page, 'h1')).toBe(fr('settings.cat.notifications'));
    expect(await focused(page)).toBe('settings-heading');
    expect(await page.$(sel('sk-airing'))).not.toBeNull();

    // Style illustré choisi dans les cartes : enregistré
    expect(await page.$$eval('[data-notif-art]', (arts) => arts.map((art) => art.getAttribute('data-notif-art')))).toEqual(['pill', 'bubble', 'alert']);
    await page.$eval('[data-choice="alerts-only"]', (label) => (label as HTMLElement).click());
    await page.waitForFunction(
      async (key: string) => {
        const value: unknown = (await chrome.storage.local.get(key))[key];
        return typeof value === 'object' && value !== null && 'notificationLevel' in value && value.notificationLevel === 'alerts-only';
      },
      {},
      SETTINGS_STORAGE_KEY,
    );
    // « Vérifier maintenant » : CHECK_AIRING envoyé, ligne d'état du résultat (démo : 1 épisode notifié), bouton de nouveau actif
    await click(page, 'airing-check');
    await page.waitForFunction(() => window.__e2e?.messages.some((m) => m.type === 'CHECK_AIRING') ?? false);
    await page.waitForFunction(() => document.querySelector('[data-focus="airing-check"]')?.getAttribute('aria-busy') === null);
    expect(await attr(page, '[data-airing-status]', 'data-airing-status')).toBe('muted');
    expect(await text(page, '[data-airing-status]')).toContain(fr('airing.status.last', { relative: '' }).trim());

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
    expect(await attr(page, sel('sk-quick-airing'), 'aria-checked')).toBe('true');
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
    expect(await attr(page, sel('sk-quick-airing'), 'aria-checked')).toBe('false');
  });

  it('Réglages › Plateformes : activer Netflix demande l’accès à netflix.com, puis le lecteur Netflix devient proposé', async () => {
    const page = await openPopup();
    await click(page, 'gear');
    await openCategory(page, 'platforms');
    await page.waitForSelector(sel('sk-netflix'));

    // Crunchyroll et ADN inclus ; accès Netflix non accordé : interrupteur éteint, Netflix grisé dans le lecteur préféré
    expect(await page.$$eval('[data-platform-state]', (nodes) => nodes.map((node) => node.getAttribute('data-platform-state')))).toEqual(['included', 'included']);
    expect(await switchOn(page, 'sk-netflix')).toBe(false);
    expect(await rowHelp(page, 'sk-netflix')).toBe(fr('settings.netflix.helpOff'));
    expect(await playerOption(page, 'netflix')).toBe('disabled');
    expect(await playerOption(page, 'crunchyroll')).toBe('offered');
    expect(await playerOption(page, 'disney')).toBe('absent');

    await click(page, 'sk-netflix');
    await page.waitForFunction(() => (window.__e2e?.permissionRequests.length ?? 0) > 0);
    expect((await trace(page)).permissionRequests).toEqual([['https://*.netflix.com/*']]);
    // Accès accordé (scripts aussi exécutés dans les onglets ouverts : aucune consigne de rechargement), option Netflix proposée
    await page.waitForSelector(`${sel('sk-netflix')}[aria-checked="true"]`);
    expect(await rowHelp(page, 'sk-netflix')).toBe(fr('settings.netflix.helpOn'));
    expect(await playerOption(page, 'netflix')).toBe('offered');
    // Aucun message au service worker : l'enregistrement des scripts suit la permission (permissions.onAdded)
    expect((await trace(page)).messages.filter((m) => m.type !== 'GET_WATCHING' && m.type !== 'GET_VIEWER' && m.type !== 'GET_MAL_VIEWER')).toEqual([]);

    // Lecteur Netflix choisi dans la liste : enregistré, focus rendu au bouton
    await click(page, 'player');
    await click(page, 'player-netflix');
    await page.waitForFunction(
      async (key: string) => {
        const stored = await chrome.storage.local.get(key);
        const value: unknown = stored[key];
        return typeof value === 'object' && value !== null && 'preferredPlayer' in value && value.preferredPlayer === 'netflix';
      },
      {},
      SETTINGS_STORAGE_KEY,
    );
    expect(await text(page, `${sel('player')} [data-select-value]`)).toBe('Netflix');
    expect(await focused(page)).toBe('player');

    // Retrait : permissions.remove, l'option repasse grisée et le lecteur revient sur Crunchyroll
    await click(page, 'sk-netflix');
    await page.waitForFunction(() => (window.__e2e?.permissionRemovals.length ?? 0) > 0);
    expect((await trace(page)).permissionRemovals).toEqual([['https://*.netflix.com/*']]);
    await page.waitForSelector(`${sel('sk-netflix')}[aria-checked="false"]`);
    await page.waitForFunction((label: string) => document.querySelector('[data-focus="player"] [data-select-value]')?.textContent === label, {}, 'Crunchyroll');
    expect(await playerOption(page, 'netflix')).toBe('disabled');
    // Le script d'un onglet déjà ouvert tourne jusqu'à son rechargement : consigne discrète
    const statuses = await page.$$eval('[role="status"]', (nodes) => nodes.map((node) => node.textContent ?? ''));
    expect(statuses).toContain(fr('settings.netflix.disabled'));
  });

  it('Réglages › Plateformes : activer Disney+ demande l’accès à disneyplus.com, jamais proposé comme lecteur préféré', async () => {
    const page = await openPopup();
    await click(page, 'gear');
    await openCategory(page, 'platforms');
    await page.waitForSelector(sel('sk-disney'));
    expect(await switchOn(page, 'sk-disney')).toBe(false);
    expect(await rowHelp(page, 'sk-disney')).toBe(fr('settings.disney.helpOff'));

    await click(page, 'sk-disney');
    await page.waitForFunction(() => (window.__e2e?.permissionRequests.length ?? 0) > 0);
    expect((await trace(page)).permissionRequests).toEqual([['https://*.disneyplus.com/*']]);
    await page.waitForSelector(`${sel('sk-disney')}[aria-checked="true"]`);
    expect(await rowHelp(page, 'sk-disney')).toBe(fr('settings.disney.helpOn'));
    // Lecteur préféré inchangé : Disney+ n'y est jamais proposé, l'interrupteur Netflix reste éteint
    expect(await playerOption(page, 'disney')).toBe('absent');
    expect(await switchOn(page, 'sk-netflix')).toBe(false);

    await click(page, 'sk-disney');
    await page.waitForFunction(() => (window.__e2e?.permissionRemovals.length ?? 0) > 0);
    expect((await trace(page)).permissionRemovals).toEqual([['https://*.disneyplus.com/*']]);
    await page.waitForSelector(`${sel('sk-disney')}[aria-checked="false"]`);
    const statuses = await page.$$eval('[role="status"]', (nodes) => nodes.map((node) => node.textContent ?? ''));
    expect(statuses).toContain(fr('settings.disney.disabled'));
  });

  it('Réglages › Plateformes : activer Prime Video demande l’accès à primevideo.com, proposé comme lecteur préféré tant qu’il est activé', async () => {
    const page = await openPopup();
    await click(page, 'gear');
    await openCategory(page, 'platforms');
    await page.waitForSelector(sel('sk-prime'));
    expect(await switchOn(page, 'sk-prime')).toBe(false);
    expect(await rowHelp(page, 'sk-prime')).toBe(fr('settings.prime.helpOff'));
    expect(await playerOption(page, 'prime')).toBe('disabled');

    await click(page, 'sk-prime');
    await page.waitForFunction(() => (window.__e2e?.permissionRequests.length ?? 0) > 0);
    expect((await trace(page)).permissionRequests).toEqual([['https://*.primevideo.com/*']]);
    await page.waitForSelector(`${sel('sk-prime')}[aria-checked="true"]`);
    expect(await rowHelp(page, 'sk-prime')).toBe(fr('settings.prime.helpOn'));
    // Prime Video proposé comme lecteur préféré (comme Netflix), les interrupteurs Netflix et Disney+ restent éteints
    expect(await playerOption(page, 'prime')).toBe('offered');
    expect(await playerOption(page, 'netflix')).toBe('disabled');
    expect(await switchOn(page, 'sk-netflix')).toBe(false);
    expect(await switchOn(page, 'sk-disney')).toBe(false);

    await click(page, 'sk-prime');
    await page.waitForFunction(() => (window.__e2e?.permissionRemovals.length ?? 0) > 0);
    expect((await trace(page)).permissionRemovals).toEqual([['https://*.primevideo.com/*']]);
    await page.waitForSelector(`${sel('sk-prime')}[aria-checked="false"]`);
    const statuses = await page.$$eval('[role="status"]', (nodes) => nodes.map((node) => node.textContent ?? ''));
    expect(statuses).toContain(fr('settings.prime.disabled'));
    expect(await playerOption(page, 'prime')).toBe('disabled');
  });

  it('Réglages › Plateformes : heure de sortie estimée par plateforme, − / + par 15 min et saisie au clavier', async () => {
    const page = await openPopup();
    await click(page, 'gear');
    await openCategory(page, 'platforms');
    await page.waitForSelector(sel('offset-disney'));
    const stored = (platform: string, minutes: number): Promise<unknown> =>
      page.waitForFunction(
        async (key: string, p: string, m: number) => {
          const settings: unknown = (await chrome.storage.local.get(key))[key];
          if (typeof settings !== 'object' || settings === null || !('platformOffsets' in settings)) return false;
          const offsets: unknown = settings.platformOffsets;
          return typeof offsets === 'object' && offsets !== null && p in offsets && Object.entries(offsets).some(([name, value]) => name === p && value === m);
        },
        {},
        SETTINGS_STORAGE_KEY,
        platform,
        minutes,
      );
    // Les cinq plateformes, Disney+ compris
    expect(await page.$$eval('[data-offset-row]', (rows) => rows.length)).toBe(5);
    expect(await page.$eval(sel('offset-crunchyroll'), (input) => (input instanceof HTMLInputElement ? input.value : ''))).toBe('+60');

    await click(page, 'offset-crunchyroll-plus');
    await stored('crunchyroll', 75);
    await click(page, 'offset-crunchyroll-minus');
    await click(page, 'offset-crunchyroll-minus');
    await stored('crunchyroll', 45);

    // Saisie : enregistrée à Entrée ; hors bornes : signalée, rien d'enregistré, Échap rend la valeur
    await page.locator(sel('offset-disney')).click({ count: 3 });
    await page.keyboard.type('-30');
    await page.keyboard.press('Enter');
    await stored('disney', -30);
    await page.locator(sel('offset-disney')).click({ count: 3 });
    await page.keyboard.type('20000');
    await page.keyboard.press('Enter');
    expect(await attr(page, sel('offset-disney'), 'aria-invalid')).toBe('true');
    expect(await page.$('[data-offset-error]')).not.toBeNull();
    await page.keyboard.press('Escape');
    expect(await attr(page, sel('offset-disney'), 'aria-invalid')).toBe('false');
    // Échap consommé par le champ : toujours sur la page Plateformes
    expect(await text(page, 'h1')).toBe(fr('settings.cat.platforms'));
    await stored('disney', -30);
  });

  it('accès aux sites retiré : bandeau annoncé une seule fois, même nœud entre deux rendus', async () => {
    const page = await openPopup({ hostAccess: 'missing' });
    await page.waitForSelector(sel('host-access'));
    // Annonce par la région live unique de la page (role="alert"), le bandeau ne porte que data-alert
    await page.waitForFunction((message: string) => document.querySelector('[data-live-region][role="alert"]')?.textContent?.includes(message) ?? false, {}, fr('popup.hostAccessMissing'));
    await page.evaluate(() => {
      const w = window as Window & { __banner?: Element | null; __announces?: number };
      w.__banner = document.querySelector('[data-alert]');
      w.__announces = 0;
      const region = document.querySelector('[data-live-region]');
      if (region) new MutationObserver(() => (w.__announces = (w.__announces ?? 0) + 1)).observe(region, { childList: true, characterData: true, subtree: true });
    });

    // Nouveaux rendus : réglage modifié dans le stockage, changements d'écran
    await page.evaluate(async (key: string) => {
      const stored = await chrome.storage.local.get(key);
      const current: unknown = stored[key];
      await chrome.storage.local.set({ [key]: { ...(typeof current === 'object' && current !== null ? current : {}), preferredPlayer: 'adn' } });
    }, SETTINGS_STORAGE_KEY);
    await click(page, 'nav-activity');
    await click(page, 'nav-watching');
    await page.waitForFunction(() => document.querySelector('[data-focus="nav-watching"]')?.getAttribute('aria-pressed') === 'true');

    const result = await page.evaluate(() => {
      const w = window as Window & { __banner?: Element | null; __announces?: number };
      return { same: w.__banner !== null && w.__banner === document.querySelector('[data-alert]') && w.__banner?.isConnected === true, announces: w.__announces };
    });
    expect(result).toEqual({ same: true, announces: 0 });
  });

  it('accès aux sites retiré : bandeau, « Autoriser l’accès » appelle permissions.request', async () => {
    const page = await openPopup({ hostAccess: 'missing' });
    await page.waitForSelector(sel('host-access'));
    expect(await text(page, '[data-alert]')).toContain(fr('popup.hostAccessMissing'));
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
    await page.waitForFunction((message: string) => document.querySelector('main [data-alert]')?.textContent?.includes(message) ?? false, {}, fr('popup.swTimeout'));
    expect(await watchingRows(page)).toEqual([]);

    const retry = await page.waitForSelector(`::-p-xpath(//main//*[@data-alert]//button[normalize-space()="${fr('common.retry')}"])`);
    await retry?.click();
    await waitForMessage(page, 'GET_WATCHING', 2);
    await page.waitForSelector(sel(`more-${SOLO}`));
    expect(await page.$('main [data-alert]')).toBeNull();
  });

  it('service worker lent sur GET_WATCHING : erreur au bout du délai, puis la réponse tardive affiche la liste sans « Réessayer »', async () => {
    const page = await openPopup({ watching: 'slow' });
    await page.waitForFunction((message: string) => document.querySelector('main [data-alert]')?.textContent?.includes(message) ?? false, {}, fr('popup.swTimeout'));
    expect(await watchingRows(page)).toEqual([]);

    await page.waitForSelector(sel(`more-${SOLO}`));
    expect(await page.$('main [data-alert]')).toBeNull();
    expect(await sent(page, 'GET_WATCHING')).toHaveLength(1);
  });

  it('UI-04 : profil MAL jamais chargé et lecture en échec → erreur et « Réessayer » au lieu du squelette, puis le profil', async () => {
    const page = await openPopup({ viewer: 'missing' });
    await click(page, 'gear');
    await openCategory(page, 'accounts');
    const message = 'MyAnimeList injoignable (e2e)';
    await page.waitForFunction((m: string) => document.querySelector('main [data-alert]')?.getAttribute('data-alert') === m, {}, message);
    // Plus de squelette pour MAL ; déconnexion possible
    expect(await page.$(`[aria-label="${fr('settings.account.loading', { service: 'MyAnimeList' })}"]`)).toBeNull();
    expect(await page.$(sel('logout-mal'))).not.toBeNull();

    // « Réessayer » : nouvelle lecture du profil, qui s'affiche
    await page.locator('main [data-alert] button').click();
    await page.waitForSelector('main a[href^="https://myanimelist.net/profile/"]');
    expect(await page.$('main [data-alert]')).toBeNull();
    expect(await sent(page, 'GET_MAL_VIEWER')).toHaveLength(2);
  });

  it('Réglages › Affichage › Raccourcis : ligne décrite sans les touches, touches actuelles, « Modifier » ouvre chrome://extensions/shortcuts (BRW-02)', async () => {
    const page = await openPopup();
    await click(page, 'gear');
    await openCategory(page, 'display');
    // Affichage : la ligne décrit les raccourcis, sans les touches
    expect(await text(page, sel('settings-cat-shortcuts'))).toContain(fr('settings.display.shortcutsHelp'));
    expect(await text(page, sel('settings-cat-shortcuts'))).not.toContain('Alt+');
    await click(page, 'settings-cat-shortcuts');
    await page.waitForSelector(sel('settings-home'));
    expect(await text(page, 'h1')).toBe(fr('settings.cat.shortcuts'));
    await page.waitForSelector('[data-shortcut-key="episode"]');
    expect(await text(page, 'kbd[data-shortcut-key="episode"]')).toBe('Alt+Maj+K');
    expect(await text(page, 'kbd[data-shortcut-key="panel"]')).toBe('Alt+Maj+1');
    // Alt+Shift+1 se tape Alt+Maj+& en AZERTY : indication discrète, touche K sans indication
    expect(await text(page, '[data-shortcut-hint="panel"]')).toBe(fr('settings.shortcut.azertyKey', { char: '&' }));
    expect(await page.$('[data-shortcut-hint="episode"]')).toBeNull();
    expect(await text(page, '#sk-shortcut-episode')).toBe(fr('settings.shortcuts.episode'));
    expect(await text(page, '#sk-shortcut-panel')).toBe(fr('settings.shortcuts.panel'));
    expect(await text(page, '[data-shortcuts-help]')).toBe(fr('settings.shortcuts.help'));
    // Libellé neutre vis-à-vis du navigateur
    expect(await attr(page, sel('shortcut'), 'aria-label')).toBe(fr('settings.shortcut.editAria'));
    expect(await attr(page, sel('panel-shortcut'), 'aria-label')).toBe(fr('settings.shortcut.panelEditAria'));
    expect(await text(page, sel('shortcut'))).toBe(fr('settings.shortcut.edit'));

    await click(page, 'shortcut');
    await page.waitForFunction(() => (window.__e2e?.openedTabs.length ?? 0) > 0);
    await click(page, 'panel-shortcut');
    await page.waitForFunction(() => (window.__e2e?.openedTabs.length ?? 0) > 1);
    expect((await trace(page)).openedTabs).toEqual(['chrome://extensions/shortcuts', 'chrome://extensions/shortcuts']);
    expect(await page.$('[data-shortcut-manual]')).toBeNull();

    // Retour : Affichage, focus rendu à la ligne Raccourcis
    await click(page, 'settings-home');
    await page.waitForSelector(sel('settings-cat-shortcuts'));
    expect(await focused(page)).toBe('settings-cat-shortcuts');
  });

  it('Réglages › Raccourcis : touche du panneau non définie → « Non défini », « Définir »', async () => {
    const page = await openPopup({ shortcuts: 'panel-unset' });
    await click(page, 'gear');
    await openCategory(page, 'shortcuts');
    await page.waitForSelector('[data-shortcut-key="panel"]');
    expect(await page.$('kbd[data-shortcut-key="panel"]')).toBeNull();
    expect(await text(page, '[data-shortcut-key="panel"]')).toBe(fr('settings.shortcuts.unset'));
    expect(await text(page, sel('panel-shortcut'))).toBe(fr('settings.shortcut.set'));
    expect(await text(page, 'kbd[data-shortcut-key="episode"]')).toBe('Alt+Maj+K');
  });

  it('Affichage : panneau latéral (onglet à l’ouverture, progression en direct) enregistré ; Synchronisation n’en montre plus rien', async () => {
    const page = await openPopup();
    await click(page, 'gear');
    await openCategory(page, 'sync');
    await page.waitForSelector(sel('sk-auto'));
    expect(await page.$(sel('panel-tab-agenda'))).toBeNull();
    expect(await page.$(sel('shortcuts-link'))).toBeNull();
    await click(page, 'settings-home');

    await openCategory(page, 'display');
    expect(await text(page, 'h1')).toBe(fr('settings.cat.display'));
    expect(await text(page, sel('settings-cat-language'))).toContain(fr('settings.language.groupLabel'));
    // Onglet à l'ouverture : groupe radio, un seul arrêt de tabulation
    expect(await attr(page, sel('panel-tab-last'), 'aria-checked')).toBe('true');
    await click(page, 'panel-tab-agenda');
    await page.waitForFunction(
      async (key: string) => {
        const stored = await chrome.storage.local.get(key);
        const value: unknown = stored[key];
        return typeof value === 'object' && value !== null && 'panelDefaultTab' in value && value.panelDefaultTab === 'agenda';
      },
      {},
      SETTINGS_STORAGE_KEY,
    );
    expect(await attr(page, sel('panel-tab-agenda'), 'aria-checked')).toBe('true');
    expect(await attr(page, sel('panel-tab-last'), 'tabindex')).toBe('-1');
    expect(await attr(page, sel('sk-panel-live'), 'role')).toBe('switch');
  });

  it('Synchronisation : pause signalée, moment « vu » et pourcentage enregistrés ; lignes « Par série » avec leur nombre', async () => {
    const page = await openPopup();
    await click(page, 'gear');
    await openCategory(page, 'sync');
    await page.waitForSelector(sel('sk-auto'));
    expect(await attr(page, sel('sk-auto'), 'aria-checked')).toBe('true');
    // Lecteur préféré et accès : page Plateformes, plus ici
    expect(await page.$(sel('player-crunchyroll'))).toBeNull();
    expect(await page.$(sel('sk-netflix'))).toBeNull();
    expect(await page.$(sel('player'))).toBeNull();
    // Démo : 2 correspondances, aucune série exclue
    expect(await text(page, `${sel('settings-cat-mappings')} [data-row-summary]`)).toBe('2');
    expect(await text(page, `${sel('settings-cat-exclusions')} [data-row-summary]`)).toBe('0');

    await click(page, 'sk-auto');
    await page.waitForSelector('[data-row-description][data-tone="warn"]');
    expect(await text(page, '[data-row-description][data-tone="warn"]')).toBe(fr('settings.autoSync.helpOff'));

    expect(await page.$eval(sel('trigger-credits'), (input) => input instanceof HTMLInputElement && input.checked)).toBe(true);
    await page.$eval('[data-choice="percentage"]', (label) => (label as HTMLElement).click());
    await page.waitForFunction(
      async (key: string) => {
        const stored = await chrome.storage.local.get(key);
        const value: unknown = stored[key];
        return typeof value === 'object' && value !== null && 'completionTrigger' in value && value.completionTrigger === 'percentage' && 'autoSync' in value && value.autoSync === false;
      },
      {},
      SETTINGS_STORAGE_KEY,
    );
    const rangeId = await attr(page, sel('pct'), 'id');
    expect(await text(page, `label[for="${rangeId ?? ''}"]`)).toBe(fr('settings.percentage.label'));
    // Curseur au clavier : valeur enregistrée au relâchement (change)
    await page.focus(sel('pct'));
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(
      async (key: string) => {
        const stored = await chrome.storage.local.get(key);
        const value: unknown = stored[key];
        return typeof value === 'object' && value !== null && 'completionPercentage' in value && value.completionPercentage === 86;
      },
      {},
      SETTINGS_STORAGE_KEY,
    );
  });

  it('Synchronisation › Correspondances : groupes par plateforme, « Oublier » écrit et prévient le service worker, « Tout réinitialiser » confirmé sur place', async () => {
    const page = await openPopup();
    await click(page, 'gear');
    await openCategory(page, 'mappings');
    await page.waitForSelector('[data-mapping]');
    expect(await text(page, 'h1')).toBe(fr('settings.section.mappings'));
    // La carte la plus fournie (Crunchyroll, à égalité : ordre du registre) est ouverte, ADN repliée
    expect(await attr(page, sel('maps-group-crunchyroll'), 'aria-expanded')).toBe('true');
    expect(await attr(page, sel('maps-group-adn'), 'aria-expanded')).toBe('false');
    await click(page, 'maps-group-adn');
    await page.waitForFunction(() => document.querySelector('[data-focus="maps-group-adn"]')?.getAttribute('aria-expanded') === 'true');

    // Recherche sans résultat, puis effacée
    await page.type(sel('mappings-search'), 'zzz');
    await page.waitForSelector('[data-mappings-empty]');
    expect(await text(page, '[data-mappings-empty]')).toContain(fr('settings.mappings.noResult', { query: 'zzz' }));
    await page.$eval(sel('mappings-search'), (input) => {
      (input as HTMLInputElement).value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForSelector('[data-mapping]');

    await click(page, 'forget-adn:DEMO-OnePiece');
    await page.waitForFunction(
      async (key: string) => {
        const stored = await chrome.storage.local.get(key);
        const value: unknown = stored[key];
        return typeof value === 'object' && value !== null && !('adn:DEMO-OnePiece' in value) && 'crunchyroll:DEMO-Dandadan:S2' in value;
      },
      {},
      STORAGE_KEYS.mediaMappings,
    );
    await page.waitForFunction(() => document.querySelector('[data-mapping-group="adn"]') === null);
    expect((await trace(page)).messages.map((m) => m.type)).toContain('MAPPINGS_CHANGED');

    // Zone de danger : confirmation sur place, focus sur « Annuler », Échap annule sans quitter la page
    await click(page, 'reset');
    await page.waitForSelector(sel('reset-confirm'));
    expect(await focused(page)).toBe('reset-cancel');
    await page.keyboard.press('Escape');
    await page.waitForSelector(sel('reset'));
    expect(await focused(page)).toBe('reset');
    expect(await text(page, 'h1')).toBe(fr('settings.section.mappings'));
    await click(page, 'reset');
    await click(page, 'reset-confirm');
    await page.waitForSelector('[data-mappings-empty]');
    expect(await text(page, '[data-mappings-empty]')).toContain(fr('settings.mappings.empty'));
    expect(await page.$eval(sel('reset'), (button) => (button as HTMLButtonElement).disabled)).toBe(true);
  });

  it('Synchronisation › Séries exclues : plateforme, année et date ; « Réactiver » retire la série ; liste vide', async () => {
    const page = await openPopup();
    await page.evaluate(async () => {
      await chrome.storage.local.set({
        excludedSeries: [
          { id: 'netflix:81000', platformKey: 'netflix:81000', mediaId: null, label: 'Pokémon Horizons', excludedAt: new Date(new Date().getFullYear(), 0, 2).getTime() },
          { id: 'prime:title:berserk:y1997', platformKey: 'prime:title:berserk:y1997', mediaId: null, label: 'Berserk', excludedAt: Date.now() },
        ],
      });
    });
    await click(page, 'gear');
    await openCategory(page, 'exclusions');
    await page.waitForSelector('[data-exclusion]');
    expect(await page.evaluate(() => [...document.querySelectorAll('[data-exclusion]')].map((row) => row.getAttribute('data-exclusion')))).toEqual(['prime:title:berserk:y1997', 'netflix:81000']);
    expect(await text(page, '[data-exclusion="prime:title:berserk:y1997"]')).toContain(`Prime Video · ${fr('settings.exclusions.seriesYear', { year: 1997 })}`);
    expect(await attr(page, sel('include-netflix:81000'), 'aria-label')).toBe(fr('settings.exclusions.reactivateAria', { title: 'Pokémon Horizons' }));

    await click(page, 'include-prime:title:berserk:y1997');
    await page.waitForFunction(() => document.querySelectorAll('[data-exclusion]').length === 1);
    await click(page, 'include-netflix:81000');
    await page.waitForSelector('[data-exclusions-empty]');
    expect(await text(page, '[data-exclusions-empty]')).toContain(fr('settings.exclusions.empty'));
    expect(await text(page, '[data-exclusions-empty]')).toContain(fr('common.stopSyncSeries'));
  });

  it('BAK-05 : « Exporter » depuis le popup ouvre la page Sauvegarde, qui lance l’export (pas de téléchargement dans le popup)', async () => {
    const page = await openPopup();
    await click(page, 'gear');
    await openCategory(page, 'data');
    await click(page, 'backup-export');
    await page.waitForFunction(() => (window.__e2e?.openedTabs.length ?? 0) > 0);
    const [opened] = (await trace(page)).openedTabs;
    expect(new URL(opened ?? '').pathname).toBe('/src/import/import.html');
    expect(new URL(opened ?? '').searchParams.has('export')).toBe(true);
    // Aucun lien de téléchargement créé dans le popup
    expect(await page.$('a[download]')).toBeNull();
  });

  it('Mes données : « Importer un historique » ouvre la page d’import (plateforme choisie dans la page), ligne des écarts, note « Par série »', async () => {
    const page = await openPopup();
    await click(page, 'gear');
    await openCategory(page, 'data');
    const main = await page.$eval('main', (el) => el.textContent ?? '');
    expect(main).toContain(fr('settings.import.title'));
    expect(main).toContain(fr('settings.data.perSeries', { path: `${fr('settings.section.sync')} › ${fr('settings.section.perSeries')}` }));
    // Deux comptes connectés : ligne de navigation vers les écarts
    expect(await text(page, sel('settings-cat-compare'))).toContain(fr('settings.compare.title'));
    await click(page, 'history-import');
    await page.waitForFunction(() => (window.__e2e?.openedTabs.length ?? 0) > 0);
    const opened = (await trace(page)).openedTabs.map((url) => new URL(url));
    expect(opened.map((url) => [url.pathname, url.searchParams.get('platform')])).toEqual([['/src/import-cr/import-cr.html', null]]);
  });

  it('titre et jaquette de « En cours » : fiche AniList par défaut, MyAnimeList selon le réglage, seul compte MAL → MAL', async () => {
    const page = await openPopup();
    const title = sel(`title-${SOLO}`);
    await page.waitForSelector(title);
    const anilist = 'https://anilist.co/anime/176496';
    const mal = 'https://myanimelist.net/anime/58567';
    expect(await attr(page, title, 'href')).toBe(anilist);
    expect(await attr(page, title, 'target')).toBe('_blank');
    expect(await attr(page, title, 'rel')).toBe('noopener noreferrer');
    expect(await attr(page, title, 'aria-label')).toBe(fr('entry.openAria', { title: 'Solo Leveling', service: 'AniList' }));
    // Jaquette : même lien, hors tabulation (doublon du titre)
    const cover = await page.$eval(title, (a) => {
      const link = a.closest('li')?.querySelector('a[aria-hidden="true"]');
      return link ? { href: link.getAttribute('href'), tabindex: link.getAttribute('tabindex'), img: link.querySelector('div') !== null } : null;
    });
    expect(cover).toEqual({ href: anilist, tabindex: '-1', img: true });
    // « Ouvrir la fiche » du menu : même règle, service nommé
    await click(page, `more-${SOLO}`);
    await page.waitForSelector(sel(`site-${SOLO}`));
    expect(await attr(page, sel(`site-${SOLO}`), 'href')).toBe(anilist);
    expect(await text(page, sel(`site-${SOLO}`))).toBe(fr('page.openOn', { service: 'AniList' }));
    await page.keyboard.press('Escape');
    await page.waitForSelector(sel(`site-${SOLO}`), { hidden: true });

    // Réglages › Comptes : « Fiche ouverte par défaut » (deux comptes connectés) → MyAnimeList
    await click(page, 'gear');
    await openCategory(page, 'accounts');
    await page.waitForSelector(sel('entry-service-mal'));
    expect(await attr(page, sel('entry-service-anilist'), 'aria-checked')).toBe('true');
    expect(await page.$('[data-entry-unavailable]')).toBeNull();
    await click(page, 'entry-service-mal');
    await page.waitForSelector(`${sel('entry-service-mal')}[aria-checked="true"]`);
    // Enregistrement sous le verrou du stockage (lecture puis écriture) : terminé après l'affichage du choix
    await page.waitForFunction(
      async (key: string) => ((await chrome.storage.local.get(key))[key] as { entryService?: string } | undefined)?.entryService === 'mal',
      { timeout: 5_000 },
      SETTINGS_STORAGE_KEY,
    );
    const saved = await page.evaluate(async (key: string) => (await chrome.storage.local.get(key))[key] as { entryService?: string } | undefined, SETTINGS_STORAGE_KEY);
    expect(saved?.entryService).toBe('mal');
    await click(page, 'settings-home');
    await click(page, 'back');
    await waitForHref(page, title, mal);
    expect(await attr(page, title, 'aria-label')).toBe(fr('entry.openAria', { title: 'Solo Leveling', service: 'MyAnimeList' }));
    // Le lien n'est qu'un lien : aucun message au service worker, aucun menu ouvert
    const before = (await trace(page)).messages.length;
    await page.$eval(title, (a) => a.addEventListener('click', (event) => event.preventDefault(), { once: true }));
    await page.locator(title).click();
    expect((await trace(page)).messages.length).toBe(before);
    expect(await page.$('[role="menu"]')).toBeNull();

    // AniList déconnecté : MyAnimeList seul, quel que soit le réglage ; le choix reste visible, désactivé et expliqué
    await setSetting(page, { entryService: 'anilist' });
    await page.evaluate(async (key: string) => chrome.storage.local.remove(key), STORAGE_KEYS.anilistToken);
    await waitForHref(page, title, mal);
    await click(page, 'gear');
    await openCategory(page, 'accounts');
    await page.waitForSelector(sel('logout-mal'));
    await page.waitForSelector(`${sel('entry-service-mal')}:disabled`);
    expect(await text(page, '[data-entry-unavailable]')).toBe(fr('settings.entry.unavailable'));
  });

  it('« Sur cette page » : titre et jaquette ouvrent la fiche, MyAnimeList avec le réglage', async () => {
    const page = await openPopup({ scenario: 'page' });
    const title = sel('page-entry');
    await page.waitForSelector(title);
    expect(await attr(page, title, 'href')).toBe('https://anilist.co/anime/146065');
    expect(await page.$eval(title, (a) => a.closest('section')?.querySelector('a[aria-hidden="true"]')?.getAttribute('href') ?? null)).toBe('https://anilist.co/anime/146065');

    await setSetting(page, { entryService: 'mal' });
    await waitForHref(page, title, 'https://myanimelist.net/anime/51179');
    expect(await attr(page, title, 'aria-label')).toBe(fr('entry.openAria', { title: 'Mushoku Tensei: Jobless Reincarnation Season 2', service: 'MyAnimeList' }));
    // Liens AniList ↗ / MAL ↗ de la carte conservés
    expect(await page.$(`a[aria-label="${fr('page.openOn', { service: 'AniList' })}"]`)).not.toBeNull();
  });

  it('« Dernières synchros » : titre vers la fiche MyAnimeList quand elle est préférée et connue, AniList sinon', async () => {
    const page = await openPopup({ scenario: 'activity' });
    const dandadan = sel('recent-entry-cr:dandadan');
    const onePiece = sel('recent-entry-adn:op');
    await page.waitForSelector(dandadan);
    expect(await attr(page, dandadan, 'href')).toBe('https://anilist.co/anime/185660');

    await setSetting(page, { entryService: 'mal' });
    await waitForHref(page, dandadan, 'https://myanimelist.net/anime/60543');
    // Synchro enregistrée sans fiche MAL (version précédente) : repli sur AniList
    expect(await attr(page, onePiece, 'href')).toBe('https://anilist.co/anime/21');
  });

  it('UX-05 / UX-06 : état vide, astuce avec le vrai chemin « Réglages › Plateformes », cliquable', async () => {
    const page = await openPopup({ watching: 'empty' });
    await page.waitForSelector(sel('tip-settings'));
    expect(await text(page, '#sk-empty-title + p')).toBe(fr('watching.empty.text'));
    expect(await text(page, sel('tip-settings'))).toBe(`${fr('nav.settings')} › ${fr('settings.cat.platforms')}`);
    expect(await text(page, 'main aside p')).toContain('Netflix');

    await click(page, 'tip-settings');
    await page.waitForFunction((title: string) => document.querySelector('h1')?.textContent?.trim() === title, {}, fr('settings.cat.platforms'));
    expect(await shownScreen(page)).toBe(2);
  });
});
