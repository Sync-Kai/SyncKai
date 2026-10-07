// Socle commun des captures du Store (capture.ts) et des tests de bout en bout (scripts/e2e) :
// serveur Vite qui sert les vraies vues depuis src/ et navigateur headless piloté par Puppeteer.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import puppeteer, { type Browser } from 'puppeteer';
import { createServer } from 'vite';

export const ROOT: string = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export interface HarnessServer {
  /** URL de base (avec « / » final), ex. http://127.0.0.1:5199/ */
  base: string;
  close: () => Promise<void>;
}

/** Démarre Vite à la racine du dépôt ; `build` est l'horodatage affiché par les scripts (__SYNCKAI_BUILD__) */
export async function startHarnessServer(build: string): Promise<HarnessServer> {
  const server = await createServer({
    configFile: false,
    root: ROOT,
    logLevel: 'warn',
    plugins: [tailwindcss()],
    // Mêmes constantes que vite.config.ts (build de production : logs info/debug coupés)
    define: { __SYNCKAI_BUILD__: JSON.stringify(build), __SYNCKAI_DEBUG__: JSON.stringify(false), __SYNCKAI_TARGET__: JSON.stringify('chrome') },
    server: { port: 5199, strictPort: false, host: '127.0.0.1' },
  });
  await server.listen();
  return { base: server.resolvedUrls?.local[0] ?? 'http://127.0.0.1:5199/', close: () => server.close() };
}

/** Chrome headless (shell) ; bac à sable désactivé en CI (espaces de noms utilisateur restreints sur les runners Ubuntu) */
export function launchBrowser(): Promise<Browser> {
  const args = ['--force-color-profile=srgb', '--font-render-hinting=none'];
  if (process.env.CI) args.push('--no-sandbox');
  return puppeteer.launch({ headless: 'shell', args });
}
