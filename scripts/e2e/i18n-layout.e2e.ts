// Contrôle de mise en page des langues : les écrans principaux rendus dans chacune des 21 langues (vrai popup, vrai
// panneau latéral à 360 et 320 px, vraie page d'import, vraie page Sauvegarde, sur l'API chrome simulée des tests de
// bout en bout), puis relevé des textes coupés ou qui débordent par le détecteur (règles en tête de layout-probe.ts).
//
// Lancement : npm run test:i18n-layout (≈ 40 s ; hors de npm run test:e2e, que release.yml exige avant toute
// publication : un libellé traduit trop long ne doit pas bloquer une version) ; quelques langues seulement :
// SYNCKAI_I18N_LAYOUT_LOCALES=de,ja npm run test:i18n-layout. Une langue = un test, plusieurs
// langues en parallèle dans le même navigateur (maxConcurrency de Vitest), chaque écran sur une page neuve par langue
// (données de démo traduites dans la langue, comme les captures du Store).
//
// Sortie, jamais dans le dépôt : dossier SYNCKAI_I18N_LAYOUT_DIR (défaut ci-dessous) avec report.json, report.md et
// une capture PNG par langue et par écran (`<langue>/<écran>.png`, contenu entier, anomalies encadrées et numérotées).
//
// Échec : toute anomalie signalée absente de scripts/e2e/i18n-layout.allowlist.json, ou toute erreur d'exécution.
// Format des exceptions (`$comment` du fichier) : { "allow": [{ "locale": "de" | "*", "screen": "popup/settings-sync" |
// "panel-320/*", "kind": "truncated", "key": "settings.x", "text": "…", "reason": "…" }] } ; une entrée accepte les
// anomalies qui correspondent à tous ses champs renseignés, `reason` obligatoire.
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Browser, Page } from 'puppeteer';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { isLocale, LOCALES, type Locale } from '../../src/i18n';
import { buildBackup } from '../../src/shared/backup';
import { CR_IMPORT_KEYS, startAnalyzeJob } from '../../src/shared/cr-import';
import { DEFAULT_SETTINGS } from '../../src/shared/settings';
import { PENDING_RATINGS_KEY, STORAGE_KEYS, SYNC_QUEUE_KEY } from '../../src/protocol/storage-keys';
import { SETTINGS_PAGE_PARENTS, SETTINGS_SUBPAGES, type SettingsSubPage } from '../../src/ui/settings/navigation';
import { demoChrome } from '../screenshots/demo-data';
import { importPlan } from '../screenshots/demo-panel';
import { launchBrowser, ROOT, startHarnessServer, type HarnessServer } from '../screenshots/harness';
import { dataStringsOf, demoDataStrings, LAYOUT_MAPPINGS, layoutExclusions, queueSeed, ratingSeed, readCatalog } from './layout-demo';
import { attachProbe, captureLayout, scanLayout } from './layout-page';
import { buildReport, describeFinding, parseAllowlist, type AllowEntry, type ScreenResult } from './layout-report';
import type { CatalogEntries } from './layout-text';

/** Dossier du rapport et des captures (hors du dépôt) : SYNCKAI_I18N_LAYOUT_DIR, sinon le dossier temporaire du système */
const OUT_DIR = path.resolve(process.env.SYNCKAI_I18N_LAYOUT_DIR ?? path.join(os.tmpdir(), 'synckai-i18n-layout'));
const ALLOWLIST_FILE = path.join(ROOT, 'scripts/e2e/i18n-layout.allowlist.json');
/** Langues contrôlées : toutes, ou celles de SYNCKAI_I18N_LAYOUT_LOCALES (« de,ja,zh-TW ») pour un passage ciblé */
const CHECKED_LOCALES: readonly Locale[] = process.env.SYNCKAI_I18N_LAYOUT_LOCALES
  ? process.env.SYNCKAI_I18N_LAYOUT_LOCALES.split(',')
      .map((code) => code.trim())
      .filter(isLocale)
  : LOCALES;

/** Largeurs du panneau latéral contrôlées (le navigateur l'impose entre ≈ 320 et 500 px) */
const PANEL_WIDTHS = [360, 320] as const;
const PANEL_HEIGHT = 900;
/** Popup : dimensions fixées par src/popup/popup.css */
const POPUP_VIEWPORT = { width: 400, height: 580 };
/** Page d'import : colonne de 576 px (src/import-cr/components/import-app.tsx) dans un onglet étroit */
const IMPORT_VIEWPORT = { width: 640, height: 900 };
/** Une langue entière (≈ 25 écrans), avec plusieurs langues en parallèle */
const LOCALE_TIMEOUT_MS = 300_000;

/** Série de démo des lignes « Mes séries » (menu « ⋯ », confirmation du retrait) */
const SOLO = '176496:58567';

let server: HarnessServer;
let browser: Browser;
let allowlist: AllowEntry[] = [];
const startedAt = new Date();
const screens: ScreenResult[] = [];
const errors: { locale: string; message: string }[] = [];

interface LocaleContext {
  locale: Locale;
  catalog: CatalogEntries;
  data: string[];
  dir: string;
  /** Écran en préparation : préfixe des erreurs (sélecteur jamais affiché, page qui plante) */
  step: string;
}

const sel = (focus: string): string => `[data-focus="${focus}"]`;

async function click(page: Page, focus: string): Promise<void> {
  await page.locator(sel(focus)).click();
}

/**
 * Page de test neuve (scripts/e2e/<fichier>.html) dans la langue : attend que le catalogue soit appliqué (`<html lang>`),
 * une fois relancée si la langue n'a pas pris (catalogue en cours d'écriture par un relecteur)
 */
async function openPage(ctx: LocaleContext, file: string, params: Record<string, string>, viewport: { width: number; height: number }): Promise<Page> {
  for (let attempt = 1; ; attempt++) {
    const page = await browser.newPage();
    page.on('pageerror', (error) => errors.push({ locale: ctx.locale, message: `${file}: ${String(error)}` }));
    await page.setViewport(viewport);
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.goto(`${server.base}scripts/e2e/${file}?${new URLSearchParams({ locale: ctx.locale, ...params }).toString()}`, { waitUntil: 'load' });
    try {
      await page.waitForFunction((locale: string) => document.documentElement.lang === locale, { timeout: 10_000 }, ctx.locale);
      return page;
    } catch (error: unknown) {
      await page.close();
      if (attempt >= 2) throw new Error(`${file} : langue ${ctx.locale} jamais appliquée (${String(error)})`);
    }
  }
}

/** Détecteur chargé dans la page : catalogue de la langue, données de démo et chaînes du stockage simulé de la page */
async function attach(ctx: LocaleContext, page: Page): Promise<void> {
  const stored = await page.evaluate(async () => [await chrome.storage.local.get(null), await chrome.storage.session.get(null)]);
  await attachProbe(page, ctx.catalog, [...new Set([...ctx.data, ...dataStringsOf(stored, ctx.catalog)])]);
}

/**
 * Relevé de l'écran affiché et capture annotée (toute la page) ; `scope` limite le relevé à une zone (menu ouvert
 * sur un écran déjà relevé)
 */
async function shot(ctx: LocaleContext, page: Page, screen: string, scope?: string): Promise<void> {
  ctx.step = screen;
  const issues = await scanLayout(page, scope);
  const file = path.join(ctx.dir, `${screen.replace(/\//g, '-')}.png`);
  await captureLayout(page, file, issues.filter((issue) => issue.flagged).map((issue) => issue.id));
  screens.push({ locale: ctx.locale, screen, screenshot: path.relative(OUT_DIR, file), issues });
}

async function storageSet(page: Page, items: Record<string, unknown>): Promise<void> {
  await page.evaluate(async (values: Record<string, unknown>) => chrome.storage.local.set(values), items);
}

/** Réglages affichés : comptes chargés (résumé de la carte Comptes) et interrupteurs rapides présents */
async function waitForSettingsHome(page: Page): Promise<void> {
  await page.waitForFunction(() => document.querySelector('[data-account-summary]:not([data-account-summary="loading"])') !== null && document.querySelector('[data-focus="sk-quick-auto"]') !== null);
}

/** Page des Réglages ouverte depuis l'accueil par les vraies lignes (page de second niveau : par sa page parente) */
async function openSettingsPage(page: Page, id: SettingsSubPage): Promise<void> {
  const parent = SETTINGS_PAGE_PARENTS[id];
  if (parent !== 'home') await openSettingsPage(page, parent);
  await click(page, `settings-cat-${id}`);
  await page.waitForSelector(sel('settings-home'));
  if (id === 'accounts') await page.waitForFunction(() => [...document.querySelectorAll('[data-account-status]')].some((status) => status.textContent?.includes('Kai_fan')));
  // Écarts : analyse de démo lue (lignes, filtres)
  if (id === 'compare') await page.waitForSelector('[data-diff]');
}

/** Retour à l'accueil des Réglages (« ← parent » jusqu'à la ligne de la catégorie) */
async function backToSettingsHome(page: Page, id: SettingsSubPage): Promise<void> {
  for (let current: SettingsSubPage | 'home' = id; current !== 'home'; current = SETTINGS_PAGE_PARENTS[current]) await click(page, 'settings-home');
  await page.waitForSelector(sel('back'));
}

// ─── Popup ────────────────────────────────────────────────────────────────

async function popupScreens(ctx: LocaleContext): Promise<void> {
  // Onglet actif sur une page série Crunchyroll : carte « Sur cette page » au-dessus de « Mes séries »
  ctx.step = 'popup/watching';
  const page = await openPage(ctx, 'popup.html', { scenario: 'page' }, POPUP_VIEWPORT);
  try {
    await page.waitForSelector(sel('page-plus'));
    await page.waitForSelector(sel(`more-${SOLO}`));
    await page.waitForSelector('main [aria-busy="false"]');
    await attach(ctx, page);
    await shot(ctx, page, 'popup/watching');

    // Carte « Sur cette page » : détails dépliés (saison, note, commentaire), puis son menu « ⋯ » (statut actuel, fiches)
    ctx.step = 'popup/page-details';
    await click(page, 'page-details');
    await page.waitForSelector(sel('page-notes-input'));
    await shot(ctx, page, 'popup/page-details', '[data-page-card]');
    await click(page, 'page-details');
    await page.waitForSelector(sel('page-notes-input'), { hidden: true });
    ctx.step = 'popup/page-menu';
    await click(page, 'more-page');
    await page.waitForSelector('[role="menu"]');
    await shot(ctx, page, 'popup/page-menu', '[role="menu"]');
    await page.keyboard.press('Escape');
    await page.waitForSelector('[role="menu"]', { hidden: true });

    // Menu du compte (logo AniList de la barre d'état) : largeur du contenu entre 288 et 376 px
    ctx.step = 'popup/account-menu';
    await click(page, 'chip-anilist');
    await page.waitForSelector('[role="menu"] [data-stat]');
    await page.waitForSelector('[role="menu"] [data-week-value]:not(:has([data-skeleton]))');
    await shot(ctx, page, 'popup/account-menu', '[role="menu"]');
    await page.keyboard.press('Escape');
    await page.waitForSelector('[role="menu"]', { hidden: true });

    ctx.step = 'popup/row-menu';
    await click(page, `more-${SOLO}`);
    await page.waitForSelector('[role="menu"]');
    // Menu seul : le reste de l'écran vient d'être relevé
    await shot(ctx, page, 'popup/row-menu', '[role="menu"]');
    // « Ouvrir la fiche › » : sous-menu (deux comptes) ; Échap le referme seul
    ctx.step = 'popup/row-submenu';
    await click(page, `site-${SOLO}`);
    await page.waitForSelector(sel(`site-mal-${SOLO}`));
    await shot(ctx, page, 'popup/row-submenu', '[role="menu"]');
    await page.keyboard.press('Escape');
    await page.waitForSelector(sel(`site-mal-${SOLO}`), { hidden: true });
    // « Abandonner ? Oui / Non » sur la ligne du menu
    ctx.step = 'popup/drop-confirm';
    await click(page, `DROPPED-${SOLO}`);
    await page.waitForSelector(sel(`confirm-no-${SOLO}`));
    await shot(ctx, page, 'popup/drop-confirm', '[role="menu"]');
    await page.keyboard.press('Escape');
    await page.waitForSelector(sel(`DROPPED-${SOLO}`));
    ctx.step = 'popup/remove-confirm';
    await click(page, `REMOVE-${SOLO}`);
    await page.waitForSelector(sel(`confirm-no-${SOLO}`));
    await shot(ctx, page, 'popup/remove-confirm', '[role="menu"]');
    // Échap : la confirmation (le menu reste ouvert), puis « Commentaire… » : éditeur sous la série, commentaire relu
    await page.keyboard.press('Escape');
    await page.waitForSelector(sel(`REMOVE-${SOLO}`));
    ctx.step = 'popup/notes-editor';
    await click(page, `notes-${SOLO}`);
    await page.waitForFunction((input: string) => (document.querySelector<HTMLTextAreaElement>(input)?.value ?? '') !== '', {}, sel(`notes-${SOLO}-input`));
    await shot(ctx, page, 'popup/notes-editor', `[data-notes-row="${SOLO}"]`);
    // Échap : l'éditeur se ferme
    await page.keyboard.press('Escape');
    await page.waitForSelector(`[data-notes-row="${SOLO}"]`, { hidden: true });

    ctx.step = 'popup/settings';
    // Correspondances aux quatre origines (pastilles longues) et séries exclues : pages Synchronisation remplies
    await storageSet(page, {
      [STORAGE_KEYS.mediaMappings]: LAYOUT_MAPPINGS,
      excludedSeries: layoutExclusions(Date.now()),
      // Écarts AniList ↔ MAL analysés : page Mes données › Écarts remplie (compteur, filtres, lignes)
      [STORAGE_KEYS.compareLast]: demoChrome(ctx.locale, 'compare', Date.now()).storage[STORAGE_KEYS.compareLast],
    });
    await click(page, 'gear');
    await waitForSettingsHome(page);
    await shot(ctx, page, 'popup/settings');
    for (const id of SETTINGS_SUBPAGES) {
      ctx.step = `popup/settings-${id}`;
      await openSettingsPage(page, id);
      await shot(ctx, page, `popup/settings-${id}`);
      await backToSettingsHome(page, id);
    }

    // Activité : carte « À vérifier » de la démo (raison traduite), « À noter », « Synchros en attente » et ligne des écarts
    // AniList ↔ MAL analysés ajoutés
    ctx.step = 'popup/activity';
    const now = Date.now();
    await storageSet(page, {
      [STORAGE_KEYS.pendingReviews]: demoChrome(ctx.locale, 'activity', now).storage[STORAGE_KEYS.pendingReviews],
      [STORAGE_KEYS.compareLast]: demoChrome(ctx.locale, 'compare', now).storage[STORAGE_KEYS.compareLast],
      [PENDING_RATINGS_KEY]: ratingSeed(now),
      [SYNC_QUEUE_KEY]: queueSeed(ctx.locale, now),
    });
    await click(page, 'back');
    await click(page, 'nav-activity');
    await page.waitForSelector('main article [data-focus^="cand-"]');
    await page.waitForSelector('[data-focus^="rate-ignore-"]');
    await page.waitForSelector('[data-focus^="queue-retry-"]');
    await page.waitForSelector('[data-focus="activity-compare"] [data-diff-count]');
    await shot(ctx, page, 'popup/activity');
  } finally {
    await page.close();
  }

  // Carte « Sur cette page » : saison devinée (encadré beurre), absente d'une liste (lignes par service, boutons d'ajout)
  ctx.step = 'popup/page-guessed';
  const guessed = await openPage(ctx, 'popup.html', { scenario: 'page', pageView: 'uncertain', pageList: 'partial' }, POPUP_VIEWPORT);
  try {
    await guessed.waitForSelector(sel('page-add-CURRENT'));
    await guessed.waitForSelector(sel('page-season'));
    await attach(ctx, guessed);
    await shot(ctx, guessed, 'popup/page-guessed', '[data-page-card]');
  } finally {
    await guessed.close();
  }
  // Plateforme désactivée : phrase et lien « Réglages › Plateformes »
  ctx.step = 'popup/page-off';
  const off = await openPage(ctx, 'popup.html', { scenario: 'page', pageMedia: 'off' }, POPUP_VIEWPORT);
  try {
    await off.waitForSelector(sel('page-platforms-settings'));
    await attach(ctx, off);
    await shot(ctx, off, 'popup/page-off', '[data-page-card]');
  } finally {
    await off.close();
  }

  // Menu du compte d'une session expirée : « Session expirée », « Reconnecter », profil en cache
  ctx.step = 'popup/account-menu-expired';
  const expired = await openPage(ctx, 'popup.html', { account: 'expired' }, POPUP_VIEWPORT);
  try {
    await click(expired, 'chip-anilist');
    await expired.waitForFunction(() => document.querySelectorAll('[role="menu"] [role="menuitem"]').length === 3);
    await attach(ctx, expired);
    await shot(ctx, expired, 'popup/account-menu-expired', '[role="menu"]');
  } finally {
    await expired.close();
  }

  // Hors page de streaming : carte « Reprendre » (surtitre, statut, plateforme et dernière synchro, « Ouvrir sur … », − / +)
  ctx.step = 'popup/resume';
  const resume = await openPage(ctx, 'popup.html', {}, POPUP_VIEWPORT);
  try {
    await resume.waitForSelector('[data-resume-card]');
    await resume.waitForSelector('main [aria-busy="false"]');
    await attach(ctx, resume);
    await shot(ctx, resume, 'popup/resume');
  } finally {
    await resume.close();
  }

  // Listes vides : « Rien en cours », astuce avec le chemin des Réglages, plateformes à activer
  ctx.step = 'popup/watching-empty';
  const empty = await openPage(ctx, 'popup.html', { watching: 'empty' }, POPUP_VIEWPORT);
  try {
    await empty.waitForSelector(sel('tip-settings'));
    await attach(ctx, empty);
    await shot(ctx, empty, 'popup/watching-empty');
  } finally {
    await empty.close();
  }
}

// ─── Panneau latéral ──────────────────────────────────────────────────────

/** Même écran relevé à chaque largeur du panneau ; `scope` : zone relevée (menu ouvert) */
async function panelShots(ctx: LocaleContext, page: Page, screen: string, scope?: string): Promise<void> {
  for (const width of PANEL_WIDTHS) {
    await page.setViewport({ width, height: PANEL_HEIGHT });
    await shot(ctx, page, `panel-${width}/${screen}`, scope);
  }
}

async function panelScreens(ctx: LocaleContext): Promise<void> {
  // Onglet Crunchyroll en lecture (Frieren) : fiche, progression en direct, actions, suites
  ctx.step = 'panel/now-playing';
  const page = await openPage(ctx, 'sidepanel.html', {}, { width: PANEL_WIDTHS[0], height: PANEL_HEIGHT });
  try {
    await page.waitForSelector('[data-focus^="relation-watch-"]');
    await page.waitForSelector(sel('page-plus'));
    await page.waitForFunction(() => [...document.querySelectorAll('[role="progressbar"]')].some((bar) => bar.getAttribute('aria-valuenow') !== null && !bar.closest('[hidden]')));
    await attach(ctx, page);
    await panelShots(ctx, page, 'now-playing');

    // Sections de la fiche dépliées (note et commentaire, suites, discussions), éditeur du commentaire ouvert
    ctx.step = 'panel/now-playing-details';
    for (const section of ['notes', 'relations', 'discussion']) await click(page, `panel-section-${section}`);
    await click(page, 'panel-notes-toggle');
    await page.waitForSelector(sel('panel-notes-input'));
    await panelShots(ctx, page, 'now-playing-details');
    await page.keyboard.press('Escape');

    // Menu du compte (logo MyAnimeList) : à 320 px, jamais plus large que le panneau
    ctx.step = 'panel/account-menu';
    await click(page, 'chip-mal');
    await page.waitForSelector('[role="menu"] [data-stat]');
    await page.waitForSelector('[role="menu"] [data-week-value]:not(:has([data-skeleton]))');
    await panelShots(ctx, page, 'account-menu', '[role="menu"]');
    await page.keyboard.press('Escape');
    await page.waitForSelector('[role="menu"]', { hidden: true });

    ctx.step = 'panel/schedule';
    await page.locator('#sk-tab-agenda').click();
    await page.waitForSelector('[data-focus^="agenda-open-"]');
    await panelShots(ctx, page, 'schedule');

    // Menu « ⋯ » d'une sortie (« Ajuster l'heure » et sa seconde ligne, sous-menus), puis l'éditeur de délai
    ctx.step = 'panel/schedule-menu';
    await page.locator('[data-focus^="agenda-menu-"]').click();
    await page.waitForSelector('[role="menu"] [data-menu-description]');
    await panelShots(ctx, page, 'schedule-menu', '[role="menu"]');
    await page.locator('[role="menu"] [data-focus^="agenda-adjust-"]').click();
    ctx.step = 'panel/schedule-editor';
    await page.waitForSelector('[data-agenda-editor]');
    await panelShots(ctx, page, 'schedule-editor');
    await page.keyboard.press('Escape');

    // Calendrier du mois (bouton de la semaine), puis une autre semaine (bouton « Aujourd'hui »)
    ctx.step = 'panel/schedule-calendar';
    await click(page, 'agenda-week');
    await page.waitForSelector('[data-week-calendar]');
    await panelShots(ctx, page, 'schedule-calendar', '[data-week-picker]');
    await page.keyboard.press('Escape');
    ctx.step = 'panel/schedule-other-week';
    await click(page, 'agenda-prev');
    await page.waitForSelector(sel('agenda-today'));
    await page.waitForSelector('[data-focus^="agenda-open-"]');
    await panelShots(ctx, page, 'schedule-other-week');
    await click(page, 'agenda-today');

    ctx.step = 'panel/settings';
    await storageSet(page, {
      [STORAGE_KEYS.mediaMappings]: LAYOUT_MAPPINGS,
      excludedSeries: layoutExclusions(Date.now()),
      // Écarts AniList ↔ MAL analysés : page Mes données › Écarts remplie (compteur, filtres, lignes)
      [STORAGE_KEYS.compareLast]: demoChrome(ctx.locale, 'compare', Date.now()).storage[STORAGE_KEYS.compareLast],
    });
    await click(page, 'gear');
    await waitForSettingsHome(page);
    await panelShots(ctx, page, 'settings');
    // Pages des Réglages refaites (comptes, affichage et ses pages) : règle des 320 px
    for (const id of ['accounts', 'sync', 'mappings', 'exclusions', 'platforms', 'notifications', 'display', 'language', 'shortcuts', 'data', 'compare', 'help'] as const) {
      ctx.step = `panel/settings-${id}`;
      await page.setViewport({ width: PANEL_WIDTHS[0], height: PANEL_HEIGHT });
      await openSettingsPage(page, id);
      await panelShots(ctx, page, `settings-${id}`);
      await backToSettingsHome(page, id);
    }
  } finally {
    await page.close();
  }

  // Saison devinée (avertissement), série absente de MyAnimeList (boutons d'ajout), générique inconnu (légende et compte à
  // rebours les plus longs de la lecture en direct)
  ctx.step = 'panel/now-playing-states';
  const states = await openPage(ctx, 'sidepanel.html', { pageView: 'uncertain', pageList: 'partial', live: 'ratio' }, { width: PANEL_WIDTHS[0], height: PANEL_HEIGHT });
  try {
    await states.waitForSelector('[data-season-card] [role="note"]');
    await states.waitForSelector(sel('page-add-PLANNING'));
    await states.waitForSelector('[data-live-legend]');
    await attach(ctx, states);
    await panelShots(ctx, states, 'now-playing-states');
  } finally {
    await states.close();
  }

  // Onglet hors plateformes : « En lecture » montre la ligne neutre et les boutons « Activer Netflix / Disney+ »
  ctx.step = 'panel/off-target';
  const off = await openPage(ctx, 'sidepanel.html', { site: 'other' }, { width: PANEL_WIDTHS[0], height: PANEL_HEIGHT });
  try {
    await off.waitForSelector('#sk-tab-agenda[aria-selected="true"]');
    await off.locator('#sk-tab-nowPlaying').click();
    await off.waitForSelector('[data-off-target] [data-enable-platform]');
    await attach(ctx, off);
    await panelShots(ctx, off, 'off-target');
  } finally {
    await off.close();
  }
}

// ─── Page d'import ────────────────────────────────────────────────────────

async function importScreens(ctx: LocaleContext): Promise<void> {
  ctx.step = 'import/connect';
  const page = await openPage(ctx, 'import-cr.html', {}, IMPORT_VIEWPORT);
  try {
    // Onglet Crunchyroll trouvé, règles, « Lire mon historique »
    await page.waitForSelector(sel('cr-read'));
    await attach(ctx, page);
    await shot(ctx, page, 'import/connect');

    // Aperçu : celui des captures du Store (15 séries, saisons à vérifier traduites) à la place du petit aperçu du cadre
    ctx.step = 'import/preview';
    await click(page, 'cr-read');
    await page.waitForSelector(sel('cr-apply'));
    await storageSet(page, { [CR_IMPORT_KEYS.plan]: importPlan(ctx.locale, Date.now()) });
    await page.waitForSelector(sel('cr-item-163270'));
    // « Déjà à jour » déplié : ses lignes sont relevées aussi
    await click(page, 'cr-uptodate-toggle');
    await page.waitForSelector('[data-focus="cr-uptodate-toggle"][aria-expanded="true"]');
    await attach(ctx, page);
    await shot(ctx, page, 'import/preview');

    ctx.step = 'import/applying';
    await click(page, 'cr-apply');
    await page.waitForSelector(sel('cr-job-stop'));
    await shot(ctx, page, 'import/applying');
  } finally {
    await page.close();
  }

  // Étape 5 finie : bilan avec un échec (raison sous le bilan), ligne écrite, ligne en échec toujours cochée
  ctx.step = 'import/apply-done';
  const applied = await openPage(ctx, 'import-cr.html', { apply: 'done' }, IMPORT_VIEWPORT);
  try {
    await click(applied, 'cr-read');
    await click(applied, 'cr-apply');
    await applied.waitForSelector('[data-apply-end]');
    await attach(ctx, applied);
    await shot(ctx, applied, 'import/apply-done');
  } finally {
    await applied.close();
  }

  // Étape 1 : Netflix choisi sans accès (tuile « accès à autoriser », barre « Autoriser l'accès »)
  const access = await openPage(ctx, 'import-cr.html', { platform: 'netflix', netflix: 'denied' }, IMPORT_VIEWPORT);
  try {
    await access.waitForSelector(sel('cr-access'));
    await attach(ctx, access);
    await shot(ctx, access, 'import/access');
  } finally {
    await access.close();
  }

  // Étape 2 : lecture Netflix en trois temps, figée sur le filtre AniList
  const reading = await openPage(ctx, 'import-cr.html', { platform: 'netflix', history: 'hold' }, IMPORT_VIEWPORT);
  try {
    await click(reading, 'cr-read');
    await reading.waitForSelector('[data-phase="titles"] [role="progressbar"][aria-valuenow="40"]', { timeout: 20_000 });
    await attach(ctx, reading);
    await shot(ctx, reading, 'import/reading');
  } finally {
    await reading.close();
  }

  // Étape 3 : analyse en pause (quota AniList), puis arrêtée (« Recommencer »)
  const analysis = await openPage(ctx, 'import-cr.html', { analyze: 'hold' }, IMPORT_VIEWPORT);
  try {
    await click(analysis, 'cr-read');
    await analysis.waitForSelector('[data-job]');
    const now = Date.now();
    const job = { ...startAnalyzeJob(120, now).job, done: 42, cursor: 42, current: 's:42', pausedUntil: now + 600_000, pauseReason: 'rate-limit' as const, pauseService: 'anilist' as const };
    await storageSet(analysis, { [CR_IMPORT_KEYS.job]: job });
    await analysis.waitForSelector('[data-job-pause]');
    await attach(ctx, analysis);
    await shot(ctx, analysis, 'import/analysis');
    await storageSet(analysis, { [CR_IMPORT_KEYS.job]: { ...job, status: 'cancelled', pausedUntil: null, pauseReason: null, pauseService: null } });
    await analysis.waitForSelector('[data-analyze-ended]');
    await attach(ctx, analysis);
    await shot(ctx, analysis, 'import/analysis-ended');
  } finally {
    await analysis.close();
  }
}

// ─── Page Sauvegarde ──────────────────────────────────────────────────────

/** Sauvegarde choisie sur la page (écrite une fois, hors du dépôt) */
let backupFile = '';

async function backupScreens(ctx: LocaleContext): Promise<void> {
  ctx.step = 'backup/idle';
  const page = await openPage(ctx, 'backup.html', {}, IMPORT_VIEWPORT);
  try {
    // Export (inclus, jamais inclus), import avant le choix d'un fichier
    await page.waitForSelector(sel('export'));
    await attach(ctx, page);
    await shot(ctx, page, 'backup/idle');

    // Fichier lu : contenu, mode « Remplacer » et sa confirmation
    ctx.step = 'backup/ready';
    const input = await page.waitForSelector('input#sk-file');
    await input?.uploadFile(backupFile);
    await page.waitForSelector('[data-import="ready"]');
    await page.locator('[data-choice="replace"]').click();
    await click(page, 'import');
    await page.waitForSelector('[data-replace-confirm]');
    await attach(ctx, page);
    await shot(ctx, page, 'backup/ready');
  } finally {
    await page.close();
  }
}

// ─── Déroulement ──────────────────────────────────────────────────────────

beforeAll(async () => {
  if (CHECKED_LOCALES.length === 0) throw new Error(`SYNCKAI_I18N_LAYOUT_LOCALES : aucune langue connue (${LOCALES.join(', ')})`);
  const fromRoot = path.relative(ROOT, OUT_DIR);
  if (!fromRoot.startsWith('..') && !path.isAbsolute(fromRoot)) throw new Error(`SYNCKAI_I18N_LAYOUT_DIR doit être hors du dépôt : ${OUT_DIR}`);
  allowlist = parseAllowlist(JSON.parse(await readFile(ALLOWLIST_FILE, 'utf8')));
  // Résultats d'un passage précédent : seuls les fichiers de ce contrôle sont retirés
  await mkdir(OUT_DIR, { recursive: true });
  await Promise.all([...LOCALES.map((locale) => rm(path.join(OUT_DIR, locale), { recursive: true, force: true })), rm(path.join(OUT_DIR, 'report.json'), { force: true }), rm(path.join(OUT_DIR, 'report.md'), { force: true })]);
  // Sauvegarde choisie sur la page Sauvegarde : réglages, deux correspondances, un revisionnage refusé
  backupFile = path.join(OUT_DIR, 'synckai-backup.json');
  const mapping = (mediaId: number, seriesLabel: string) => ({ mediaId, numbering: 'season', offset: 0, episodes: 12, seriesLabel });
  const sections = { settings: DEFAULT_SETTINGS, mediaMappings: { 'crunchyroll:GFRIEREN:s1': mapping(154587, 'Frieren · S1'), 'adn:1311:s1': mapping(178680, 'Tougen Anki · S1') }, rewatchDeclined: { 'anilist:1': 1 } };
  await writeFile(backupFile, JSON.stringify(buildBackup(sections, '2.3.1', new Date('2026-10-12T19:40:00Z'))));
  server = await startHarnessServer('e2e');
  browser = await launchBrowser();
});

afterAll(async () => {
  await browser?.close();
  await server?.close();
  const order = (locale: string): number => LOCALES.findIndex((l) => l === locale);
  screens.sort((a, b) => order(a.locale) - order(b.locale));
  const report = buildReport({ generatedAt: startedAt, durationMs: Date.now() - startedAt.getTime(), outDir: OUT_DIR, locales: CHECKED_LOCALES, screens, errors, allowlist });
  await writeFile(path.join(OUT_DIR, 'report.json'), report.json);
  await writeFile(path.join(OUT_DIR, 'report.md'), report.markdown);
  console.info(`Rapport de mise en page : ${path.join(OUT_DIR, 'report.md')} (${report.failures.length} anomalies)`);
});

describe('mise en page des langues', () => {
  it.concurrent.for(CHECKED_LOCALES)(
    '%s',
    { timeout: LOCALE_TIMEOUT_MS },
    async (locale, { expect }) => {
      const catalog = await readCatalog(locale);
      const ctx: LocaleContext = { locale, catalog, data: demoDataStrings(locale, catalog), dir: path.join(OUT_DIR, locale), step: 'start' };
      await mkdir(ctx.dir, { recursive: true });
      try {
        await popupScreens(ctx);
        await panelScreens(ctx);
        await importScreens(ctx);
        await backupScreens(ctx);
      } catch (error: unknown) {
        errors.push({ locale, message: `${ctx.step}: ${error instanceof Error ? error.message : String(error)}` });
      }
      // Anomalies de cette langue hors exceptions, et erreurs d'exécution (page qui plante, écran jamais affiché)
      const mine = buildReport({ generatedAt: startedAt, durationMs: 0, outDir: OUT_DIR, locales: [locale], screens: screens.filter((s) => s.locale === locale), errors: [], allowlist });
      expect([...errors.filter((error) => error.locale === locale).map((error) => error.message), ...mine.failures.map(describeFinding)]).toEqual([]);
    },
  );
});
