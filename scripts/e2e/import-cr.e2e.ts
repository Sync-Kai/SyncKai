// Bout en bout de la page « Importer un historique » : vraie page (src/import-cr/import-cr.ts) sur l'API chrome
// simulée (scripts/e2e/import-cr-frame.ts) : onglets Crunchyroll et ADN, ports des scripts de contenu, service worker.
import type { Browser, Page } from 'puppeteer';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { tl, type MessageKey, type MessageParams } from '../../src/i18n';
import { launchBrowser, startHarnessServer, type HarnessServer } from '../screenshots/harness';
import type { E2EState } from './protocol';

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
const sel = (focus: string): string => `[data-focus="${focus}"]`;

async function openPage(params: Record<string, string> = {}): Promise<Page> {
  const page = await browser.newPage();
  const errors: string[] = [];
  opened.push({ page, errors });
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.setViewport({ width: 640, height: 900 });
  await page.goto(`${server.base}scripts/e2e/import-cr.html?${new URLSearchParams({ locale: 'fr', ...params }).toString()}`, { waitUntil: 'load' });
  return page;
}

async function trace(page: Page): Promise<E2EState> {
  const state = await page.evaluate(() => window.__e2e);
  if (!state) throw new Error('Traces e2e absentes');
  return state;
}

describe('page d’import Crunchyroll (bout en bout)', () => {
  it('lit l’historique dans l’onglet, lance l’analyse, affiche l’aperçu et n’importe que les séries cochées', async () => {
    const page = await openPage();
    await page.locator(sel('cr-read')).click();

    // Aperçu : séries à mettre à jour cochées, « déjà à jour » repliée, une saison à vérifier
    await page.waitForSelector(sel('cr-apply'));
    const analyze = (await trace(page)).messages.find((m) => m.type === 'CR_IMPORT_ANALYZE');
    expect(analyze?.payload).toMatchObject({ history: { seasons: [{ seriesId: 'GRBB' }, { seriesId: 'GRSL' }] } });
    expect(await page.$eval(sel('cr-item-100'), (el) => (el instanceof HTMLInputElement ? el.checked : null))).toBe(true);
    expect(await page.$eval(sel('cr-item-300'), (el) => (el instanceof HTMLInputElement ? el.checked : null))).toBe(true);
    expect(await page.$(sel('cr-item-21'))).toBeNull();
    const body = await page.$eval('main', (el) => el.textContent ?? '');
    expect(body).toContain('Black Butler');
    expect(body).toContain('7 → 9');
    expect(body).toContain(tl('fr', 'crImport.review.title_one', { count: 1 }));
    expect(body).toContain(tl('fr', 'crImport.preview.upToDateTitle_one', { count: 1 }));

    // Slime décochée : seule Black Butler part à l'import
    await page.locator(sel('cr-item-300')).click();
    expect(await page.$eval(sel('cr-apply'), (el) => el.textContent?.trim())).toBe(tl('fr', 'crImport.preview.apply_one', { count: 1 }));
    await page.locator(sel('cr-apply')).click();
    await page.waitForFunction(() => window.__e2e?.messages.some((m) => m.type === 'CR_IMPORT_APPLY'));
    const apply = (await trace(page)).messages.find((m) => m.type === 'CR_IMPORT_APPLY');
    expect(apply?.payload).toEqual({ ids: ['m:100'] });
    await page.waitForSelector(sel('cr-job-stop'));
    expect(await page.$eval('main', (el) => el.textContent ?? '')).toContain(fr('crImport.apply.running', { done: 0, total: 1 }));
  });

  it('UI-06 : « Déjà à jour » ouvert et « À vérifier » replié restent ainsi après un nouveau rendu', async () => {
    const page = await openPage();
    await page.locator(sel('cr-read')).click();
    await page.waitForSelector(sel('cr-apply'));
    const titles = [tl('fr', 'crImport.preview.upToDateTitle_one', { count: 1 }), tl('fr', 'crImport.review.title_one', { count: 1 })];
    /** Ouverture des blocs « Déjà à jour » puis « À vérifier » (null : bloc absent) */
    const openState = (): Promise<(boolean | null)[]> =>
      page.evaluate(
        (wanted: string[]) =>
          wanted.map((title) => [...document.querySelectorAll('details')].find((el) => el.querySelector('summary')?.textContent?.includes(title))?.open ?? null),
        titles,
      );
    expect(await openState()).toEqual([false, true]);

    // L'utilisateur ouvre « Déjà à jour » et replie « À vérifier »
    for (const summary of await page.$$('summary')) await summary.click();
    expect(await openState()).toEqual([true, false]);

    // Nouveau rendu de la page (case décochée) : les choix sont gardés
    await page.locator(sel('cr-item-300')).click();
    await page.waitForFunction(() => {
      const box = document.querySelector('[data-focus="cr-item-300"]');
      return box instanceof HTMLInputElement && !box.checked;
    });
    expect(await openState()).toEqual([true, false]);
  });

  it('« Créer 1 vérification » envoie la saison incertaine', async () => {
    const page = await openPage();
    await page.locator(sel('cr-read')).click();
    await page.locator(sel('cr-create-reviews')).click();
    await page.waitForFunction(() => window.__e2e?.messages.some((m) => m.type === 'CR_IMPORT_REVIEWS'));
    expect((await trace(page)).messages.find((m) => m.type === 'CR_IMPORT_REVIEWS')?.payload).toEqual({ keys: ['crunchyroll:GRX:s2'] });
  });

  it('session Crunchyroll absente : message clair, aucune analyse lancée', async () => {
    const page = await openPage({ history: 'logged-out' });
    await page.locator(sel('cr-read')).click();
    await page.waitForSelector('[data-alert]');
    expect(await page.$eval('[data-alert]', (el) => el.textContent ?? '')).toContain(fr('crImport.read.error.logged-out', { platform: 'Crunchyroll' }));
    // Annoncé par la région live unique de la page (role="alert", créée une fois)
    await page.waitForFunction((message: string) => document.querySelector('[data-live-region][role="alert"]')?.textContent?.includes(message) ?? false, {}, fr('crImport.read.error.logged-out', { platform: 'Crunchyroll' }));
    expect((await trace(page)).messages.some((m) => m.type === 'CR_IMPORT_ANALYZE')).toBe(false);
  });

  it('UX-07 : en anglais, « Crunchyroll: » et « AniList: » sans l’espace français avant les deux-points', async () => {
    const page = await openPage({ locale: 'en' });
    await page.locator(sel('cr-read')).click();
    await page.waitForSelector(sel('cr-apply'));
    const body = await page.$eval('main', (el) => el.textContent ?? '');
    expect(body).toContain('Crunchyroll: ');
    expect(body).toContain('AniList: ');
    expect(body).not.toMatch(/(Crunchyroll|AniList|MyAnimeList) :/);
  });
});

describe('page d’import, historique ADN (bout en bout)', () => {
  it('?platform=adn : lit l’historique ADN, le réduit par saison (épisodes terminés seulement) et lance l’analyse ADN', async () => {
    const page = await openPage({ platform: 'adn' });
    await page.waitForSelector(sel('cr-read'));
    expect(await page.$eval(sel('platform-adn'), (el) => el.getAttribute('aria-pressed'))).toBe('true');
    expect(await page.$eval('main', (el) => el.textContent ?? '')).toContain(fr('crImport.connect.foundTitled', { platform: 'ADN', title: 'ADN' }));
    await page.locator(sel('cr-read')).click();

    await page.waitForSelector(sel('cr-apply'));
    const analyze = (await trace(page)).messages.find((m) => m.type === 'CR_IMPORT_ANALYZE');
    expect(analyze?.payload).toMatchObject({
      platform: 'adn',
      history: {
        // E2 commencé (16 s) et E2 à 84 % jamais importés ; manhwa gardé, spécial « OAV » ignoré
        seasons: [
          { seriesId: '1428', seriesSlug: 'even-the-student-council-has-its-holes', seasonNumber: 1, episodeNumber: 1, watchedCount: 1 },
          { seriesId: '1331', episodeNumber: 1 },
          { seriesId: '1290', episodeNumber: 3 },
        ],
        stats: { items: 6, pages: 1, partial: false },
      },
    });
    const body = await page.$eval('main', (el) => el.textContent ?? '');
    expect(body).toContain(`ADN : Even the Student Council Has Its Holes! · S1`);
    expect(body).toContain(fr('crImport.subtitle', { platform: 'ADN' }));
    expect(body).toContain(tl('fr', 'crImport.review.title_one', { count: 1 }));
    // Aperçu affiché : plus de choix de plateforme (« Recommencer » pour changer)
    expect(await page.$(sel('platform-crunchyroll'))).toBeNull();

    await page.locator(sel('cr-create-reviews')).click();
    await page.waitForFunction(() => window.__e2e?.messages.some((m) => m.type === 'CR_IMPORT_REVIEWS'));
    expect((await trace(page)).messages.find((m) => m.type === 'CR_IMPORT_REVIEWS')?.payload).toEqual({ keys: ['adn:1290:s1'] });
  });

  it('choix de la plateforme sur la page : Crunchyroll → ADN, onglet ADN retrouvé, choix gardé dans l’URL', async () => {
    const page = await openPage();
    await page.waitForSelector(sel('cr-read'));
    expect(await page.$eval(sel('platform-crunchyroll'), (el) => el.getAttribute('aria-pressed'))).toBe('true');
    await page.locator(sel('platform-adn')).click();
    await page.waitForFunction((want: string) => document.querySelector('main')?.textContent?.includes(want) ?? false, {}, fr('crImport.connect.foundTitled', { platform: 'ADN', title: 'ADN' }));
    expect(await page.$eval(sel('platform-adn'), (el) => el.getAttribute('aria-pressed'))).toBe('true');
    expect(new URL(page.url()).searchParams.get('platform')).toBe('adn');
    await page.locator(sel('cr-read')).click();
    await page.waitForSelector(sel('cr-apply'));
    expect((await trace(page)).messages.find((m) => m.type === 'CR_IMPORT_ANALYZE')?.payload).toMatchObject({ platform: 'adn' });
  });

  it('jeton ADN absent ou refusé : se connecter à ADN puis recharger la page, aucune analyse lancée', async () => {
    const page = await openPage({ platform: 'adn', history: 'logged-out' });
    await page.locator(sel('cr-read')).click();
    await page.waitForSelector('[data-alert]');
    expect(await page.$eval('[data-alert]', (el) => el.textContent ?? '')).toContain(fr('crImport.read.error.adnLoggedOut'));
    expect((await trace(page)).messages.some((m) => m.type === 'CR_IMPORT_ANALYZE')).toBe(false);
  });
});
