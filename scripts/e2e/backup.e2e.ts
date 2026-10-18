// Bout en bout de la page Sauvegarde : vraie page (src/import/import.ts) sur l'API chrome simulée
// (scripts/e2e/backup-frame.ts) : export, fichier choisi (refusé ou lu), contenu, remplacement confirmé, import.
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Browser, Page } from 'puppeteer';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { tl, tpl, type MessageKey, type MessageParams } from '../../src/i18n';
import { buildBackup } from '../../src/shared/backup';
import { STORAGE_KEYS } from '../../src/protocol/storage-keys';
import { launchBrowser, startHarnessServer, type HarnessServer } from '../screenshots/harness';
import type { E2EState } from './protocol';

let server: HarnessServer;
let browser: Browser;
let dir: string;
const opened: { page: Page; errors: string[] }[] = [];

const MAPPING = { mediaId: 101280, numbering: 'season', offset: 0, episodes: 24, seriesLabel: 'Slime · S1' };

beforeAll(async () => {
  server = await startHarnessServer('e2e');
  browser = await launchBrowser();
  dir = await mkdtemp(path.join(os.tmpdir(), 'synckai-backup-e2e-'));
});

afterAll(async () => {
  await browser?.close();
  await server?.close();
  if (dir) await rm(dir, { recursive: true, force: true });
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
  await page.setViewport({ width: 720, height: 900 });
  await page.goto(`${server.base}scripts/e2e/backup.html?${new URLSearchParams({ locale: 'fr', ...params }).toString()}`, { waitUntil: 'load' });
  await page.waitForSelector(sel('export'));
  return page;
}

async function file(name: string, content: string): Promise<string> {
  const target = path.join(dir, name);
  await writeFile(target, content, 'utf8');
  return target;
}

async function choose(page: Page, target: string): Promise<void> {
  const input = await page.waitForSelector('input#sk-file');
  await input?.uploadFile(target);
}

const backupFile = (): Promise<string> =>
  file('synckai-backup.json', JSON.stringify(buildBackup({ settings: null, mediaMappings: { 'crunchyroll:GSLIME:s1': MAPPING }, rewatchDeclined: { 'anilist:1': 1 } }, '2.3.1', new Date('2026-10-12T19:40:00Z'))));

describe('page Sauvegarde (bout en bout)', () => {
  it('export : téléchargement lancé ; échec : alerte dans la carte', async () => {
    const page = await openPage();
    await page.locator(sel('export')).click();
    await page.waitForSelector('[data-export="exported"]');
    expect(await page.$eval('[data-export]', (el) => el.textContent ?? '')).toContain(fr('import.export.started'));

    const failing = await openPage({ export: 'fail' });
    await failing.locator(sel('export')).click();
    await failing.waitForSelector('[data-export="error"] [data-alert]');
    expect(await failing.$eval('[data-export] [data-alert]', (el) => el.getAttribute('data-alert'))).toBe(fr('settings.backup.exportFailed'));
  });

  it('fichier refusé (pas du JSON) : alerte, le choix d’un fichier reste possible', async () => {
    const page = await openPage();
    await choose(page, await file('notes.json', 'pas du json'));
    await page.waitForSelector('[data-import="idle"] [data-alert]');
    expect(await page.$eval('[data-alert]', (el) => el.getAttribute('data-alert'))).toBe(fr('backup.error.invalidJson'));
    expect(await page.$('input#sk-file')).not.toBeNull();
  });

  it('fichier lu : contenu, remplacement confirmé (focus sur « Annuler », Échap annule), import en fusion', async () => {
    const page = await openPage();
    await choose(page, await backupFile());
    await page.waitForSelector('[data-import="ready"]');
    // Contenu du fichier ; réglages inclus mais décochés en fusion
    expect(await page.$eval('[data-content="settings"]', (el) => el.textContent)).toBe(`${fr('import.summary.settings')}${fr('import.summary.included')}`);
    expect(await page.$eval('[data-content="mediaMappings"]', (el) => el.textContent)).toBe(`${tpl('fr', 'import.summary.mediaMappings', 1)}1`);
    const settingsBox = (): Promise<string> => page.$eval(sel('settings'), (el) => (el instanceof HTMLInputElement ? `${el.checked ? 'checked' : 'unchecked'} ${el.disabled ? 'disabled' : 'enabled'}` : ''));
    expect(await settingsBox()).toBe('unchecked enabled');

    // Remplacer : réglages cochés, confirmation, focus sur « Annuler », Échap revient au bouton « Importer »
    await page.locator('[data-choice="replace"]').click();
    await page.waitForFunction(() => {
      const box = document.querySelector('[data-focus="settings"]');
      return box instanceof HTMLInputElement && box.checked;
    });
    await page.locator(sel('import')).click();
    await page.waitForSelector('[data-replace-confirm]');
    await page.waitForFunction(() => document.activeElement?.getAttribute('data-focus') === 'cancel');
    await page.keyboard.press('Escape');
    await page.waitForSelector(sel('import'));
    expect(await page.$('[data-replace-confirm]')).toBeNull();

    // Fusion : importé tout de suite, correspondance écrite (à revérifier), service worker prévenu
    await page.locator('[data-choice="merge"]').click();
    await page.locator(sel('import')).click();
    await page.waitForSelector('[data-backup-done]');
    const stored = await page.evaluate(async (key: string) => (await chrome.storage.local.get(key))[key], STORAGE_KEYS.mediaMappings);
    expect(stored).toMatchObject({ 'crunchyroll:GSLIME:s1': { mediaId: 101280, unverified: true } });
    const trace = await page.evaluate((): E2EState | undefined => window.__e2e);
    expect(trace?.messages.map((m) => m.type)).toContain('MAPPINGS_CHANGED');
  });
});
