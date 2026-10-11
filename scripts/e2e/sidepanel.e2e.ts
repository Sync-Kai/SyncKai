// Tests de bout en bout du panneau latéral : le vrai sidepanel.ts tourne dans Chrome headless sur l'API chrome simulée
// (scripts/e2e/sidepanel-frame.ts). Réponses du service worker retenues et navigations de l'onglet simulées pour
// reproduire les courses de l'audit (UI-01, UI-02, UI-03). Lancement : npm run test:e2e
import type { Browser, Page } from 'puppeteer';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { tl, type MessageKey, type MessageParams } from '../../src/i18n';
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
});
