// Détecteur de débordements (layout-probe.ts) : page témoin (layout-fixture.html), un cas par élément `data-focus`,
// puis le vrai popup avec un libellé rallongé à la volée (aucun catalogue modifié). Lancement : npm run test:e2e
import { mkdtemp, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Browser, Page } from 'puppeteer';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { launchBrowser, startHarnessServer, type HarnessServer } from '../screenshots/harness';
import { demoDataStrings, readCatalog } from './layout-demo';
import { attachProbe, captureLayout, scanLayout } from './layout-page';
import type { LayoutIssue } from './layout-probe';

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

async function open(file: string, width: number, height: number): Promise<Page> {
  const page = await browser.newPage();
  const errors: string[] = [];
  opened.push({ page, errors });
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.setViewport({ width, height });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.goto(`${server.base}${file}`, { waitUntil: 'load' });
  return page;
}

/** Catalogue témoin : textes de layout-fixture.html (clés fictives) */
const FIXTURE_CATALOG = {
  'fixture.autoSync': 'Automatically sync every episode when the credits start',
  'fixture.recent': '{title} · Ep. {progress}',
  'fixture.syncing': 'Synchronising {title} on every connected service right now',
  'fixture.remove': 'Remove from list permanently',
  'fixture.saved': 'Your progress is saved on AniList and MyAnimeList as soon as the ending credits begin to roll',
  'fixture.plan': 'Add to plan to watch list now',
  'fixture.removeAll': 'Remove this series from all your lists',
  'fixture.completed': 'Mark as completed',
  'fixture.stop': 'Stop syncing this series',
  'fixture.open': 'Open on {platform}',
  'fixture.search': 'Search a title on AniList and MyAnimeList',
  'fixture.settings': 'Settings',
  'fixture.stopShort': 'Stop syncing',
  'fixture.shown': 'Shown',
};
/** Données de démo de la page témoin (titres d'anime) */
const FIXTURE_DATA = ['Mushoku Tensei: Jobless Reincarnation Season 2 Part 2', 'Mushoku Tensei: Jobless Reincarnation', 'Frieren', 'Dandadan', 'Solo Leveling', 'Kaiju No. 8', 'One Piece'];

const byFocus = (issues: readonly LayoutIssue[], focus: string): LayoutIssue[] => issues.filter((issue) => issue.focus === focus);

describe('détecteur de débordements (bout en bout)', () => {
  it('page témoin : relève chaque cas attendu avec sa clé, ignore les titres tronqués, aucun faux positif', async () => {
    const page = await open('scripts/e2e/layout-fixture.html', 400, 700);
    await attachProbe(page, FIXTURE_CATALOG, FIXTURE_DATA);
    const issues = await scanLayout(page);

    // Signalés : un seul relevé par cas, avec sa clé du catalogue
    const flagged = issues.filter((issue) => issue.flagged);
    expect(flagged.map((issue) => issue.focus).sort()).toEqual(
      ['case-button', 'case-clamp', 'case-label', 'case-menu', 'case-mixed-long', 'case-placeholder', 'case-row', 'case-tall', 'case-tall-child'].sort(),
    );
    const expectIssue = (focus: string, kind: LayoutIssue['kind'], key: string): void => {
      const [issue] = byFocus(flagged, focus);
      expect(issue, focus).toMatchObject({ kind });
      expect(issue?.keys, focus).toContain(key);
      expect(Math.max(issue?.dx ?? 0, issue?.dy ?? 0), focus).toBeGreaterThan(1);
    };
    expectIssue('case-label', 'truncated', 'fixture.autoSync');
    expectIssue('case-mixed-long', 'truncated', 'fixture.syncing');
    expectIssue('case-button', 'clipped', 'fixture.remove');
    expectIssue('case-clamp', 'truncated', 'fixture.saved');
    expectIssue('case-tall', 'spill', 'fixture.plan');
    expectIssue('case-tall-child', 'overflow', 'fixture.removeAll');
    // Rangée : seul le dernier bouton sort, son modèle est retrouvé (« Open on {platform} », plateforme gardée)
    expectIssue('case-row', 'overflow', 'fixture.open');
    expectIssue('case-menu', 'offscreen', 'fixture.stopShort');
    expectIssue('case-placeholder', 'placeholder', 'fixture.search');
    // Modèle + titre court : c'est la partie traduite qui ne tient pas (mesure refaite avec « X » à la place du titre)
    expect(byFocus(flagged, 'case-mixed-long')[0]).toMatchObject({ source: 'mixed' });
    expect(byFocus(flagged, 'case-mixed-long')[0]?.catalogDx).toBeGreaterThan(1);

    // Ignorés (troncature voulue) : titre seul, modèle dont seule la donnée ne tient pas
    expect(byFocus(issues, 'case-title')).toEqual([expect.objectContaining({ kind: 'truncated', flagged: false, source: 'data' })]);
    expect(byFocus(issues, 'case-mixed-data')).toEqual([expect.objectContaining({ kind: 'truncated', flagged: false, source: 'mixed', keys: ['fixture.recent'] })]);

    // Rien sur les cas sans anomalie (texte qui tient, lecteurs d'écran seuls, masqué, défilement horizontal voulu, décor)
    for (const focus of ['case-fits', 'case-sr', 'case-hidden', 'case-scroller', 'case-decor']) expect(byFocus(issues, focus), focus).toEqual([]);
    expect(issues.filter((issue) => issue.kind === 'scroll')).toEqual([]);

    // Capture (dossier temporaire du système) : zones dépliées puis repliées, superposition retirée
    const dir = await mkdtemp(path.join(os.tmpdir(), 'synckai-layout-probe-'));
    try {
      const file = path.join(dir, 'fixture.png');
      await captureLayout(page, file, flagged.map((issue) => issue.id));
      expect((await stat(file)).size).toBeGreaterThan(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
    expect(await page.evaluate(() => [document.getElementById('sk-layout-overlay'), document.getElementById('sk-layout-expand')])).toEqual([null, null]);
  });

  it('vrai popup : un libellé rallongé à la volée est signalé avec sa clé, les titres d’anime tronqués ne le sont pas', async () => {
    const page = await open('scripts/e2e/popup.html?locale=en&scenario=page', 400, 580);
    await page.waitForSelector('[data-focus="page-plus"]');
    await page.waitForSelector('[data-focus="more-176496:58567"]');
    const long = 'Activity, reviews, ratings and every pending sync';
    const catalog = { ...(await readCatalog('en')), 'nav.activity': long };
    await attachProbe(page, catalog, demoDataStrings('en', catalog));
    // Remplacement local du texte affiché (le catalogue n'est pas modifié)
    await page.$eval('[data-focus="nav-activity"] > span', (span, text) => {
      span.textContent = text;
    }, long);

    const issues = await scanLayout(page);
    const activity = issues.filter((issue) => issue.flagged && issue.keys.includes('nav.activity'));
    expect(activity.length, JSON.stringify(issues, null, 1)).toBeGreaterThan(0);
    // Titres d'anime tronqués par une ellipse (carte « Sur cette page », lignes) : jamais signalés
    const titles = issues.filter((issue) => issue.source === 'data');
    expect(titles.every((issue) => !issue.flagged || ['overflow', 'offscreen', 'scroll'].includes(issue.kind))).toBe(true);
    expect(issues.filter((issue) => issue.flagged && issue.kind === 'truncated' && issue.source === 'data')).toEqual([]);
  });
});
