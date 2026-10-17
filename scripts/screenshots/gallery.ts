// Captures de la galerie des composants de base (gallery.html), thème sombre, à 400 px (popup, Réglages) et 360 px
// (panneau latéral) : une page entière par largeur, à comparer aux maquettes. Développement seulement.
// Usage : node scripts/screenshots/gallery.ts [--out <dossier>]   (défaut : <tmp>/synckai-gallery, jamais le dépôt)
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Plugin } from 'vite';
import { launchBrowser, ROOT, startHarnessServer } from './harness.ts';

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}

const OUT = path.resolve(arg('out') ?? path.join(os.tmpdir(), 'synckai-gallery'));
const WIDTHS = [400, 360] as const;

const THEME = path.join(ROOT, 'src/ui/theme.css');
const THEME_IMPORT = '@import "../../src/ui/theme.css";';

/**
 * Feuille de la galerie : ui/theme.css exclut les composants du scan tant qu'aucun écran ne les monte, et une
 * exclusion `@source not` l'emporte sur tout `@source` positif. La galerie reçoit donc le thème recopié en ligne, sans
 * cette exclusion, chemins relatifs recalés depuis scripts/screenshots/ (avant le greffon Tailwind, qui le compile).
 */
const galleryTheme: Plugin = {
  name: 'synckai:gallery-theme',
  enforce: 'pre',
  async transform(code, id) {
    if (!id.split('?')[0]?.endsWith('scripts/screenshots/gallery.css') || !code.includes(THEME_IMPORT)) return null;
    const theme = (await readFile(THEME, 'utf8')).replace(/^@source not "\.\/components";\r?\n/m, '').replace(/(@source not ")\.\//g, '$1../../src/ui/');
    return { code: code.replace(THEME_IMPORT, theme), map: null };
  },
};

const server = await startHarnessServer('gallery', [galleryTheme]);
const browser = await launchBrowser();
let failures = 0;
try {
  await mkdir(OUT, { recursive: true });
  const page = await browser.newPage();
  await page.emulateMediaFeatures([
    { name: 'prefers-reduced-motion', value: 'reduce' },
    { name: 'prefers-color-scheme', value: 'dark' },
  ]);
  page.on('pageerror', (error) => {
    failures++;
    console.error('  [page]', error);
  });
  page.on('console', (msg) => msg.type() === 'error' && console.error('  [console]', msg.text()));
  for (const width of WIDTHS) {
    // Échelle 2 : détails des bordures et des pastilles lisibles à la comparaison
    await page.setViewport({ width, height: 800, deviceScaleFactor: 2 });
    await page.goto(`${server.base}scripts/screenshots/gallery.html?width=${width}`, { waitUntil: 'load' });
    await page.waitForFunction(() => document.documentElement.dataset.ready === '1', { timeout: 30_000 });
    const file = path.join(OUT, `gallery-${width}.png`);
    await writeFile(file, await page.screenshot({ type: 'png', fullPage: true }));
    console.log(`✓ ${file}`);
    // Un fichier par composant aussi (gallery-<largeur>-<bloc>.png) : plus lisible que la page entière
    for (const block of await page.$$('[data-block]')) {
      const name = await block.evaluate((el) => (el instanceof HTMLElement ? (el.dataset.block ?? '') : ''));
      const slug = name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      await writeFile(path.join(OUT, `gallery-${width}-${slug}.png`), await block.screenshot({ type: 'png' }));
    }
  }
} finally {
  await browser.close();
  await server.close();
}
process.exit(failures > 0 ? 1 : 0);
