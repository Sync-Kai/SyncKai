// Génère les visuels du Chrome Web Store, PNG RGB 24 bits sans alpha :
// - 5 captures × 3 langues, 1280×800 (docs/store/screenshots/<langue>/) ;
// - la tuile promo « marquee » 1400×560, en anglais (docs/store/promo-1400x560.png).
// Usage : npm run screenshots [-- --locale fr --shot 2 | --shot marquee]
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { MARQUEE, SHOT_FILES, SHOT_IDS } from './captions.ts';
import { launchBrowser, ROOT, startHarnessServer } from './harness.ts';
import { pngInfo, toRgbPng } from './png.ts';

const OUT = path.join(ROOT, 'docs/store/screenshots');
const LOCALES = ['fr', 'en', 'de'] as const;

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}

const onlyLocale = arg('locale');
const onlyShot = arg('shot');

const server = await startHarnessServer('screenshots');
const { base } = server;

const browser = await launchBrowser();
let failures = 0;
try {
  const page = await browser.newPage();
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  page.on('pageerror', (error) => console.error('  [page]', error));
  page.on('console', (msg) => msg.type() === 'error' && console.error('  [console]', msg.text()));

  /** Rend banner.html, capture le viewport et l'écrit en PNG RGB 24 bits vérifié */
  const render = async (query: string, file: string, width: number, height: number): Promise<void> => {
    try {
      await page.setViewport({ width, height, deviceScaleFactor: 1 });
      await page.goto(`${base}scripts/screenshots/banner.html?${query}`, { waitUntil: 'load' });
      await page.waitForFunction(() => document.documentElement.dataset.ready === '1', { timeout: 30_000 });
      const shotPng = Buffer.from(await page.screenshot({ type: 'png', omitBackground: false, clip: { x: 0, y: 0, width, height } }));
      const png = toRgbPng(shotPng);
      const info = pngInfo(png);
      if (info.width !== width || info.height !== height || info.colorType !== 2 || info.bitDepth !== 8) throw new Error(`PNG invalide : ${JSON.stringify(info)}`);
      await writeFile(file, png);
      console.log(`✓ ${path.relative(ROOT, file)} (${Math.round(png.length / 1024)} Ko)`);
    } catch (error: unknown) {
      failures++;
      console.error(`✗ ${path.relative(ROOT, file)} :`, error);
    }
  };

  const current = new Set(SHOT_IDS.map((shot) => `${SHOT_FILES[shot]}.png`));
  for (const locale of LOCALES) {
    if (onlyLocale && onlyLocale !== locale) continue;
    const dir = path.join(OUT, locale);
    await mkdir(dir, { recursive: true });
    // Génération complète : les captures d'une ancienne série (fichiers renommés) sont supprimées
    if (!onlyShot) {
      for (const name of await readdir(dir)) {
        if (!name.endsWith('.png') || current.has(name)) continue;
        await rm(path.join(dir, name));
        console.log(`– ${path.relative(ROOT, path.join(dir, name))} (obsolète, supprimée)`);
      }
    }
    for (const shot of SHOT_IDS) {
      if (onlyShot && onlyShot !== String(shot)) continue;
      await render(`shot=${shot}&locale=${locale}`, path.join(dir, `${SHOT_FILES[shot]}.png`), 1280, 800);
    }
  }

  // Tuile promo : non localisable sur le Store, rendue une seule fois (en anglais)
  if (!onlyShot || onlyShot === 'marquee') {
    await render('shot=marquee', path.join(ROOT, 'docs/store', `${MARQUEE.file}.png`), MARQUEE.width, MARQUEE.height);
  }
} finally {
  await browser.close();
  await server.close();
}
process.exit(failures > 0 ? 1 : 0);
