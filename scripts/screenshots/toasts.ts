// Captures des bulles de la page (toasts.html : le vrai module de src/content/ui monté dans un lecteur simulé), chaque état
// sur une image sombre et une image claire, en fr / de / ja, à 1280×720 et 900×560 (moins de 600 px de haut : bulle à
// 56 px du haut). Développement seulement, jamais dans le paquet ; à comparer aux maquettes.
// Usage : node scripts/screenshots/toasts.ts [--out <dossier>] [--states a,b] [--locales fr,de]
//         (défaut : <tmp>/synckai-toasts, jamais le dépôt)
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { launchBrowser, startHarnessServer } from './harness.ts';

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}

const OUT = path.resolve(arg('out') ?? path.join(os.tmpdir(), 'synckai-toasts'));
const STATES = (
  arg('states') ??
  'sync-progress,pill-saved,pill-up-to-date,pill-up-to-date-no-number,bubble-saved,bubble-up-to-date,bubble-completed,excluded,review,not-connected,partial-skipped,partial-no-equivalent,beyond-entry,finale-jump,failed-one-service,failed-one-service-hover,failed-global,unreachable,unidentified,orphan,shortcut-no-playback,shortcut-paused,shortcut-excluded,rating-prompt,rating-hover,rating-saving,rating-saved,rating-partial,rewatch-prompt,rewatch-saving,rewatch-saved,rewatch-failed'
).split(',');
const LOCALES = (arg('locales') ?? 'fr,de,ja').split(',');
const SIZES = [
  [1280, 720],
  [900, 560],
] as const;
const BACKGROUNDS = ['dark', 'light'] as const;

const server = await startHarnessServer('toasts');
const browser = await launchBrowser();
let failures = 0;
try {
  const page = await browser.newPage();
  page.on('pageerror', (error) => {
    failures++;
    console.error('  [page]', error);
  });
  page.on('console', (msg) => msg.type() === 'error' && console.error('  [console]', msg.text()));
  for (const [width, height] of SIZES) {
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    const dir = path.join(OUT, `${width}x${height}`);
    await mkdir(dir, { recursive: true });
    for (const locale of LOCALES) {
      for (const bg of BACKGROUNDS) {
        for (const state of STATES) {
          await page.goto(`${server.base}scripts/screenshots/toasts.html?state=${state}&locale=${locale}&bg=${bg}`, { waitUntil: 'load' });
          await page.waitForFunction(() => document.documentElement.dataset.ready === '1', { timeout: 30_000 });
          const file = path.join(dir, `${locale}-${bg}-${state}.png`);
          await writeFile(file, await page.screenshot({ type: 'png' }));
        }
        console.log(`✓ ${dir} ${locale} ${bg} (${STATES.length} états)`);
      }
    }
  }
} finally {
  await browser.close();
  await server.close();
}
process.exit(failures > 0 ? 1 : 0);
