// Tests de bout en bout du panneau latéral : le vrai sidepanel.ts tourne dans Chrome headless sur l'API chrome simulée
// (scripts/e2e/sidepanel-frame.ts). Réponses du service worker retenues et navigations de l'onglet simulées pour
// reproduire les courses de l'audit (UI-01, UI-02, UI-03). Lancement : npm run test:e2e
import type { Browser, Page } from 'puppeteer';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { tl, type MessageKey, type MessageParams } from '../../src/i18n';
import { SETTINGS_STORAGE_KEY } from '../../src/shared/settings';
import { launchBrowser, startHarnessServer, type HarnessServer } from '../screenshots/harness';
import type { SentMessage } from '../screenshots/mock-chrome';
import type { PanelFrameParams } from './protocol';

let server: HarnessServer;
let browser: Browser;
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

async function openPanel(params: PanelFrameParams): Promise<Page> {
  const page = await browser.newPage();
  const errors: string[] = [];
  opened.push({ page, errors });
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.setViewport({ width: 400, height: 800 });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const entries = Object.entries({ locale: 'fr', ...params }).filter((entry): entry is [string, string] => typeof entry[1] === 'string');
  await page.goto(`${server.base}scripts/e2e/sidepanel.html?${new URLSearchParams(entries).toString()}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__e2ePanel !== undefined);
  return page;
}

// Commandes du panneau de test (`window.__e2ePanel`, voir E2EPanelControls) : corps sérialisés et exécutés dans la page
const hold = {
  release: (page: Page, type: string): Promise<void> => page.evaluate((t: string) => window.__e2ePanel?.release(t), type),
};
const tab = {
  navigate: (page: Page, series: 'frieren' | 'dandadan'): Promise<void> => page.evaluate((s: 'frieren' | 'dandadan') => window.__e2ePanel?.navigate(s), series),
  updated: (page: Page, change: 'complete' | 'url'): Promise<void> => page.evaluate((c: 'complete' | 'url') => window.__e2ePanel?.emitUpdated(c), change),
};

async function messages(page: Page, type: string): Promise<SentMessage[]> {
  return page.evaluate((t: string) => (window.__e2e?.messages ?? []).filter((m) => m.type === t), type);
}

async function waitForMessages(page: Page, type: string, count: number): Promise<void> {
  await page.waitForFunction((t: string, n: number) => (window.__e2e?.messages.filter((m) => m.type === t).length ?? 0) >= n, {}, type, count);
}

async function pageReads(page: Page): Promise<number> {
  return page.evaluate(() => window.__e2ePanel?.pageReads() ?? 0);
}

/** Titre de la fiche affichée (null : squelette ou autre état) */
async function shownTitle(page: Page): Promise<string | null> {
  return page.evaluate(() => document.querySelector('[role="tabpanel"] h2')?.textContent?.trim() ?? null);
}

const pause = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const seriesOf = (message: SentMessage): unknown => {
  const payload = message.payload;
  return typeof payload === 'object' && payload !== null && 'page' in payload && typeof payload.page === 'object' && payload.page !== null && 'seriesTitle' in payload.page
    ? payload.page.seriesTitle
    : null;
};

// ─── Scénarios ────────────────────────────────────────────────────────────

describe('panneau latéral (bout en bout)', () => {
  it('UI-01 : l’onglet termine son chargement pendant la résolution de la fiche → la fiche s’affiche', async () => {
    const page = await openPanel({ cache: 'none', hold: 'RESOLVE_PAGE_MEDIA' });
    await waitForMessages(page, 'RESOLVE_PAGE_MEDIA', 1);
    const reads = await pageReads(page);
    expect(await page.$(`[aria-label="${fr('panel.nowPlaying.loading')}"]`)).not.toBeNull();

    // Fin de chargement de l'onglet suivi : presence.ts rappelle setTab(même onglet), la page est relue
    await tab.updated(page, 'complete');
    await page.waitForFunction((n: number) => (window.__e2ePanel?.pageReads() ?? 0) > n, {}, reads);
    await pause(100);

    await hold.release(page, 'RESOLVE_PAGE_MEDIA');
    await page.waitForSelector('[role="tabpanel"] h2', { timeout: 3_000 });
    expect(await shownTitle(page)).toBe('Frieren: Beyond Journey’s End');
    expect(await page.$(`[aria-label="${fr('panel.nowPlaying.loading')}"]`)).toBeNull();
  });

  it('« Ta progression » : commentaire replié, « Enregistrer » envoie SET_LIST_NOTES (rien à la frappe), aperçu du texte relu', async () => {
    const page = await openPanel({ hold: 'SET_LIST_NOTES' });
    const toggle = '[data-focus="panel-notes-toggle"]';
    await page.waitForSelector(toggle);
    expect(await page.$eval(toggle, (el) => el.textContent ?? '')).toContain(fr('notes.add'));

    await page.locator(toggle).click();
    await page.waitForSelector('[data-focus="panel-notes-input"]');
    expect(await page.evaluate(() => document.activeElement?.getAttribute('data-focus'))).toBe('panel-notes-input');
    await page.type('[data-focus="panel-notes-input"]', 'Superbe arc');
    expect(await messages(page, 'SET_LIST_NOTES')).toEqual([]);

    await page.locator('[data-focus="panel-notes-save"]').click();
    await waitForMessages(page, 'SET_LIST_NOTES', 1);
    const [message] = await messages(page, 'SET_LIST_NOTES');
    expect(message?.payload).toMatchObject({ media: { mediaId: 154587 }, notes: 'Superbe arc' });
    // Enregistrement en cours : bouton occupé, la saisie reste en place
    expect(await page.$eval('[data-focus="panel-notes-save"]', (el) => el.getAttribute('aria-busy'))).toBe('true');
    await hold.release(page, 'SET_LIST_NOTES');

    // Enregistré : éditeur replié, aperçu du commentaire relu (RESOLVE_PAGE_MEDIA sans cache), retour affiché
    await page.waitForFunction((s: string) => document.querySelector(s)?.textContent?.includes('Superbe arc') === true, {}, toggle);
    await page.waitForFunction((label: string) => document.body.textContent?.includes(label) === true, {}, fr('inline.notesSaved'));
  });

  it('« Ta progression » : menu « ⋯ » → « Retirer de la liste » confirmé → REMOVE_FROM_LIST, la carte propose l’ajout', async () => {
    const page = await openPanel({});
    await page.waitForSelector('[data-focus="more-panel"]');
    await page.locator('[data-focus="more-panel"]').click();
    await page.waitForSelector('[data-focus="REMOVE-panel"]');
    expect(await page.evaluate(() => document.activeElement?.getAttribute('data-focus'))).toBe('REMOVE-panel');

    await page.locator('[data-focus="REMOVE-panel"]').click();
    await page.waitForSelector('[data-focus="confirm-no-panel"]');
    expect(await page.evaluate(() => document.activeElement?.getAttribute('data-focus'))).toBe('confirm-no-panel');
    // Échap annule la confirmation, le menu reste ouvert
    await page.keyboard.press('Escape');
    await page.waitForSelector('[data-focus="REMOVE-panel"]');
    expect(await messages(page, 'REMOVE_FROM_LIST')).toEqual([]);

    await page.locator('[data-focus="REMOVE-panel"]').click();
    await page.locator('[data-focus="confirm-yes-panel"]').click();
    await waitForMessages(page, 'REMOVE_FROM_LIST', 1);
    const [message] = await messages(page, 'REMOVE_FROM_LIST');
    expect(message?.payload).toMatchObject({ media: { mediaId: 154587, title: 'Frieren: Beyond Journey’s End' } });

    // Fiche relue : absente des listes → boutons d'ajout, plus de menu « ⋯ », commentaire indisponible (expliqué)
    await page.waitForSelector('[data-focus="page-add-PLANNING"]');
    expect(await page.$('[data-focus="more-panel"]')).toBeNull();
    expect(await page.$eval('[data-focus="panel-notes-toggle"]', (el) => (el as HTMLButtonElement).disabled)).toBe(true);
    expect(await page.evaluate(() => document.body.textContent ?? '')).toContain(fr('notes.notInList'));
    await page.waitForFunction((label: string) => document.body.textContent?.includes(label) === true, {}, fr('inline.removed', { title: 'Frieren' }));
  });

  it('UI-02 : +1 puis épisode d’une autre série avant la réponse → la fiche de la nouvelle page reste affichée', async () => {
    const page = await openPanel({ hold: 'ADJUST_PROGRESS' });
    await page.waitForSelector('[data-focus="page-plus"]:not([disabled])');
    expect(await shownTitle(page)).toBe('Frieren: Beyond Journey’s End');

    await page.locator('[data-focus="page-plus"]').click();
    await waitForMessages(page, 'ADJUST_PROGRESS', 1);

    // Épisode suivant lancé dans le lecteur : autre série dans le même onglet
    await tab.navigate(page, 'dandadan');
    await tab.updated(page, 'url');
    await page.waitForFunction(() => document.querySelector('[role="tabpanel"] h2')?.textContent?.trim() === 'Dandadan', { timeout: 5_000 });
    const resolvedBefore = (await messages(page, 'RESOLVE_PAGE_MEDIA')).length;

    await hold.release(page, 'ADJUST_PROGRESS');
    await pause(600);

    // Aucune résolution de la page quittée, fiche et retour de l'action absents de la nouvelle page
    expect((await messages(page, 'RESOLVE_PAGE_MEDIA')).slice(resolvedBefore).map(seriesOf)).toEqual([]);
    expect(await shownTitle(page)).toBe('Dandadan');
    expect(await page.$('[data-focus="page-plus"][aria-busy="true"]')).toBeNull();
  });

  it('« En lecture » : titre, jaquette et relations ouvrent la fiche (AniList par défaut, MyAnimeList avec le réglage)', async () => {
    const page = await openPanel({});
    const title = '[role="tabpanel"] h2 a[data-focus="panel-entry"]';
    const href = (selector: string): Promise<string | null> => page.$eval(selector, (a) => a.getAttribute('href'));
    await page.waitForSelector(title);
    await page.waitForSelector('[data-focus="relation-entry-182255"]');
    expect(await href(title)).toBe('https://anilist.co/anime/154587');
    expect(await page.$eval(title, (a) => a.getAttribute('aria-label'))).toBe(fr('entry.openAria', { title: 'Frieren: Beyond Journey’s End', service: 'AniList' }));
    // Jaquette : même lien, hors tabulation
    expect(await page.$eval('[role="tabpanel"] a[aria-hidden="true"][tabindex="-1"]', (a) => a.getAttribute('href'))).toBe('https://anilist.co/anime/154587');
    expect(await href('[data-focus="relation-entry-182255"]')).toBe('https://anilist.co/anime/182255');

    await page.evaluate(async (key: string) => {
      const current: unknown = (await chrome.storage.local.get(key))[key];
      await chrome.storage.local.set({ [key]: { ...(typeof current === 'object' && current !== null ? current : {}), entryService: 'mal' } });
    }, SETTINGS_STORAGE_KEY);
    await page.waitForFunction((s: string) => document.querySelector(s)?.getAttribute('href') === 'https://myanimelist.net/anime/52991', {}, title);
    expect(await href('[data-focus="relation-entry-182255"]')).toBe('https://myanimelist.net/anime/59978');
    // Relation sans fiche MyAnimeList connue : repli sur AniList
    expect(await href('[data-focus="relation-entry-170068"]')).toBe('https://anilist.co/anime/170068');
    // Lien AniList de « Discussion » conservé
    expect(await page.$('[role="tabpanel"] a[href="https://anilist.co/anime/154587"]')).not.toBeNull();
  });

  it('UI-03 : GET_AGENDA en échec pendant un rendu du panneau → « données périmées » et Réessayer restent affichés', async () => {
    const page = await openPanel({ tab: 'agenda', agenda: 'error', hold: 'GET_AGENDA' });
    await waitForMessages(page, 'GET_AGENDA', 1);
    // Fiche « En lecture » chargée en arrière-plan (rendus du panneau pendant la requête)
    await page.waitForFunction(() => (window.__e2e?.messages.filter((m) => m.type === 'GET_PANEL_MEDIA').length ?? 0) >= 1);
    const reads = await pageReads(page);
    // Nouveau rendu pendant la requête : l'onglet suivi se recharge
    await tab.updated(page, 'complete');
    await page.waitForFunction((n: number) => (window.__e2ePanel?.pageReads() ?? 0) > n, {}, reads);
    await pause(100);

    await hold.release(page, 'GET_AGENDA');
    await page.waitForSelector('[data-focus="agenda-retry"]', { timeout: 3_000 });
    const alert = await page.$eval('[role="tabpanel"] [data-alert]', (el) => el.textContent ?? '');
    expect(alert).toContain(fr('agenda.stale', { error: 'AniList 429 (e2e)' }));
    expect(await messages(page, 'GET_AGENDA')).toHaveLength(1);
  });

  it('hors page de streaming : onglets affichés, Agenda par défaut, « En lecture » montre la ligne neutre et « Activer … »', async () => {
    const page = await openPanel({ site: 'other' });
    await page.waitForSelector('[role="tablist"]');
    await page.waitForSelector('#sk-tab-agenda[aria-selected="true"]');
    expect(await page.$eval('#sk-tab-nowPlaying', (el) => el.getAttribute('aria-selected'))).toBe('false');
    expect(await page.$eval('[role="tabpanel"]', (el) => el.id)).toBe('sk-tabpanel-agenda');
    expect(await page.$('[data-off-target]')).toBeNull();
    // Choix automatique, jamais mémorisé comme « dernier onglet » (« En lecture » revient sur une page de streaming)
    expect(await page.evaluate(async () => (await chrome.storage.local.get('panelLastTab')).panelLastTab)).toBe('nowPlaying');

    await page.locator('#sk-tab-nowPlaying').click();
    await page.waitForSelector('[role="tabpanel"] [data-off-target]');
    const notice = await page.$eval('[data-off-target]', (el) => el.textContent ?? '');
    expect(notice).toContain(fr('panel.offTargetPlatforms', { platforms: 'Crunchyroll et ADN' }));
    expect(await page.$$eval('[data-off-target] [data-enable-platform]', (buttons) => buttons.map((button) => button.getAttribute('data-enable-platform')))).toEqual([
      'netflix',
      'disney',
      'prime',
    ]);
    // Aucune fiche demandée hors page de streaming
    expect(await messages(page, 'RESOLVE_PAGE_MEDIA')).toEqual([]);
  });

  it('barre d’état (même composant que le popup) : en bas de chaque onglet ; sans chrome.action.openPopup, message en texte', async () => {
    const page = await openPanel({ tab: 'agenda' });
    await page.waitForSelector('[data-status-bar] footer [data-focus="chip-anilist"]');
    // Dernier élément du panneau, sous la zone défilante
    expect(await page.evaluate(() => document.querySelector('#app')?.lastElementChild?.firstElementChild?.matches('[data-status-bar]') ?? false)).toBe(true);
    // Synchro de démo d'il y a 3 min, non vue : série puis épisode, « J'ai vu, masquer »
    expect(await page.$eval('[data-status-series]', (el) => el.textContent)).toBe('Dandadan Season 2');
    expect(await page.$eval('[data-status-message]', (el) => el.tagName)).toBe('SPAN');
    await page.locator('#sk-tab-nowPlaying').click();
    expect(await page.$('[data-status-bar] footer')).not.toBeNull();
    // Logo de compte : Réglages › Comptes du panneau
    await page.locator('[data-focus="chip-mal"]').click();
    // Module des Réglages chargé à la première ouverture : les onglets cèdent la place aux Réglages
    await page.waitForFunction(() => document.querySelector('#sk-tab-nowPlaying') === null);
    expect(await page.$$eval('h1', (els) => els.map((el) => el.textContent))).toContain(fr('settings.section.accounts'));
    expect(await page.evaluate(() => document.querySelector('#app')?.lastElementChild?.firstElementChild?.matches('[data-status-bar]') ?? false)).toBe(true);
  });

  it('barre d’état : clic sur la synchro → popup ouvert sur Activité (demande dans storage.session), × marque la synchro vue', async () => {
    const page = await openPanel({ tab: 'agenda', popup: 'open' });
    await page.waitForSelector('button[data-focus="footer-synced"]');
    await page.locator('[data-focus="footer-synced"]').click();
    await page.waitForFunction(() => (window.__e2e?.popupOpens ?? 0) === 1);
    expect(await page.evaluate(async () => (await chrome.storage.session.get('popupScreen')).popupScreen)).toMatchObject({ screen: 'activity' });
    // Marque « vu » : synchro masquée, écrite dans storage.local
    await page.waitForFunction(() => document.querySelector('[data-status-series]') === null);
    expect(typeof (await page.evaluate(async () => (await chrome.storage.local.get('statusBar:syncsSeenAt'))['statusBar:syncsSeenAt']))).toBe('number');
  });

  it('UX-05 : hors page cible, la ligne neutre cite les plateformes suivies, puis celles à activer (et le vrai chemin des Réglages)', async () => {
    const path = `${fr('nav.settings')} › ${fr('settings.cat.sync')}`;
    const off = await openPanel({ site: 'other', tab: 'nowPlaying' });
    await off.locator('#sk-tab-nowPlaying').click();
    const offText = `${fr('panel.offTargetPlatforms', { platforms: 'Crunchyroll et ADN' })} ${fr('panel.offTargetEnable', { platforms: 'Netflix, Disney+ et Prime Video', path })}`;
    await off.waitForFunction((t: string) => document.body.textContent?.includes(t) ?? false, {}, offText);

    const granted = await openPanel({ site: 'other', netflix: 'granted' });
    // Agenda par défaut hors page de streaming : la ligne neutre est dans l'onglet « En lecture »
    await granted.locator('#sk-tab-nowPlaying').click();
    // Netflix accordé, Disney+ et Prime Video non : Netflix rejoint les plateformes suivies, les deux autres restent citées comme à activer
    const grantedText = `${fr('panel.offTargetPlatforms', { platforms: 'Crunchyroll, ADN et Netflix' })} ${fr('panel.offTargetEnable', { platforms: 'Disney+ et Prime Video', path })}`;
    await granted.waitForFunction((t: string) => document.body.textContent?.includes(t) ?? false, {}, grantedText);
    expect(await granted.evaluate(() => document.body.textContent ?? '')).not.toContain(offText);

    // Boutons « Activer Disney+ » puis « Activer Prime Video » : demande d'accès directe, la ligne cite ensuite les cinq plateformes, sans bouton
    const enableButtons = (): Promise<(string | null)[]> => granted.$$eval('[data-enable-platform]', (buttons) => buttons.map((button) => button.getAttribute('data-enable-platform')));
    expect(await enableButtons()).toEqual(['disney', 'prime']);
    await granted.locator('[data-enable-platform="disney"]').click();
    await granted.waitForFunction((t: string) => document.body.textContent?.includes(t) ?? false, {}, fr('panel.offTargetPlatforms', { platforms: 'Crunchyroll, ADN, Netflix et Disney+' }));
    expect(await enableButtons()).toEqual(['prime']);
    await granted.locator('[data-enable-platform="prime"]').click();
    await granted.waitForFunction((t: string) => document.body.textContent?.includes(t) ?? false, {}, fr('panel.offTargetPlatforms', { platforms: 'Crunchyroll, ADN, Netflix, Disney+ et Prime Video' }));
    expect(await granted.$$('[data-enable-platform]')).toHaveLength(0);
  });

  it('UI-05 : Entrée sur un délai vide ne l’enregistre pas (0 min) : champ signalé invalide, éditeur ouvert', async () => {
    const page = await openPanel({ tab: 'agenda' });
    await page.locator('[data-focus^="agenda-menu-"]').click();
    await page.locator('[data-focus^="agenda-adjust-"]').click();
    await page.waitForSelector('[data-focus^="agenda-offset-"]');
    const field = '[data-focus^="agenda-offset-"]';
    await page.focus(field);
    await page.$eval(field, (input) => {
      if (input instanceof HTMLInputElement) input.select();
    });
    await page.keyboard.press('Backspace');
    expect(await page.$eval(field, (input) => (input instanceof HTMLInputElement ? input.value : null))).toBe('');
    await page.keyboard.press('Enter');

    await page.waitForSelector(`${field}[aria-invalid="true"]`);
    const offsets = await page.evaluate(async () => {
      const stored = await chrome.storage.local.get('settings');
      const settings: unknown = stored.settings;
      return typeof settings === 'object' && settings !== null && 'seriesOffsets' in settings ? settings.seriesOffsets : null;
    });
    expect(offsets).toEqual({});
  });

  it('UI-05 : Échap et Annuler dans l’éditeur de délai rendent le focus au « ⋯ » de la même série (pas à la suivante)', async () => {
    const page = await openPanel({ tab: 'agenda' });
    const activeFocusKey = (): Promise<string | null> => page.evaluate(() => (document.activeElement instanceof HTMLElement ? (document.activeElement.dataset.focus ?? null) : null));
    for (const close of ['escape', 'cancel'] as const) {
      await page.locator('[data-focus^="agenda-menu-"]').click();
      await page.locator('[data-focus^="agenda-adjust-"]').click();
      await page.waitForSelector('[data-focus^="agenda-offset-"]');
      const scheduleId = await page.$eval('[data-focus^="agenda-offset-"]', (input) => (input instanceof HTMLElement ? (input.dataset.focus ?? '').replace('agenda-offset-', '') : ''));
      await page.focus('[data-focus^="agenda-offset-"]');
      if (close === 'escape') await page.keyboard.press('Escape');
      else await page.$eval('[data-focus^="agenda-cancel-"]', (button) => (button instanceof HTMLElement ? button.click() : undefined));
      await page.waitForFunction(() => document.querySelector('[data-focus^="agenda-offset-"]') === null);
      expect(await activeFocusKey(), close).toBe(`agenda-menu-${scheduleId}`);
    }
  });

  it('Réglages › Raccourcis (vue partagée avec le popup) : résumé de l’accueil et touches actuelles', async () => {
    const page = await openPanel({});
    await page.locator('[data-focus="gear"]').click();
    const row = '[data-focus="settings-cat-shortcuts"]';
    await page.waitForFunction((s: string) => document.querySelector(s)?.textContent?.includes('Alt+Maj+K · Alt+Maj+1 (touche &)') ?? false, {}, row);
    expect(await page.$eval(row, (el) => el.textContent ?? '')).toContain(fr('settings.cat.shortcuts'));

    await page.locator(row).click();
    await page.waitForSelector('kbd[data-shortcut-key="panel"]');
    expect(await page.$eval('kbd[data-shortcut-key="episode"]', (el) => el.textContent?.trim())).toBe('Alt+Maj+K');
    expect(await page.$eval('kbd[data-shortcut-key="panel"]', (el) => el.textContent?.trim())).toBe('Alt+Maj+1');
    expect(await page.$eval('#sk-shortcut-panel', (el) => el.textContent?.trim())).toBe(fr('settings.shortcuts.panel'));
    expect(await page.$('[data-focus="shortcut"]')).not.toBeNull();
    expect(await page.$('[data-focus="panel-shortcut"]')).not.toBeNull();
  });
});
