// Données du contrôle de mise en page des langues (i18n-layout.e2e.ts), côté Node : catalogue affiché par langue et
// chaînes affichables des données de démo (titres, pseudos, libellés de saison…), qui ne sont pas des traductions.
import fs from 'node:fs';
import path from 'node:path';
import { tl, type Locale } from '../../src/i18n';
import type { PendingRating } from '../../src/shared/engagement.types';
import { PLATFORMS, STREAMING_PLATFORMS } from '../../src/platforms/registry';
import type { SyncQueueItem } from '../../src/shared/queue.types';
import { TRACKER_IDS, TRACKER_LABELS } from '../../src/shared/tracker.types';
import { demoChrome, episode } from '../screenshots/demo-data';
import { importPlan, PANEL_PAGE, panelMedia, panelView } from '../screenshots/demo-panel';
import { ROOT } from '../screenshots/harness';
import { collectDataStrings, normalizeText, type CatalogEntries } from './layout-text';

const MIN = 60_000;
const HOUR = 60 * MIN;

/** Catalogue JSON lu sur le disque ; relu si un relecteur est en train de l'écrire (JSON incomplet) */
async function readJson(file: string): Promise<Record<string, string>> {
  for (let attempt = 1; ; attempt++) {
    try {
      const raw: unknown = JSON.parse(await fs.promises.readFile(file, 'utf8'));
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new Error(`${file} : objet attendu`);
      return Object.fromEntries(Object.entries(raw).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
    } catch (error: unknown) {
      if (attempt >= 5) throw error;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
}

/**
 * Textes affichés dans `locale` : son catalogue, relu sur le disque à chaque appel (les relecteurs le modifient pendant
 * que le contrôle tourne), complété par l'anglais pour les clés absentes (repli de l'interface)
 */
export async function readCatalog(locale: Locale): Promise<CatalogEntries> {
  const dir = path.join(ROOT, 'src/i18n/locales');
  const english = await readJson(path.join(dir, 'en.json'));
  return locale === 'en' ? english : { ...english, ...(await readJson(path.join(dir, `${locale}.json`))) };
}

/** Noms de marque affichés tels quels dans toutes les langues : jamais des données à remplacer */
const BRAND_NAMES: readonly string[] = ['SyncKai', ...STREAMING_PLATFORMS.map((platform) => PLATFORMS[platform].label), ...TRACKER_IDS.map((id) => TRACKER_LABELS[id])];

/** Cartes « À noter » ajoutées à l'écran Activité du popup (absentes des données de démo) */
export function ratingSeed(now: number): PendingRating[] {
  return [{ id: 'anilist:154587', mediaId: 154587, malId: 52991, title: 'Frieren', coverUrl: null, completedAt: now - 2 * HOUR }];
}

/** « Synchros en attente » de l'écran Activité : une relance prévue, une synchro abandonnée (erreurs dans la langue) */
export function queueSeed(locale: Locale, now: number): SyncQueueItem[] {
  return [
    {
      id: 'crunchyroll:DEMOKAIJUNO85',
      episode: episode('Kaiju No. 8', 2, 5),
      services: null,
      attempts: 2,
      status: 'pending',
      nextAttemptAt: now + 12 * MIN,
      firstFailedAt: now - 40 * MIN,
      lastError: tl(locale, 'api.rateLimited', { service: 'AniList' }),
    },
    {
      id: 'adn:DEMOONEPIECE1122',
      episode: episode('One Piece', null, 1122, 'adn'),
      services: ['mal'],
      attempts: 6,
      status: 'failed',
      nextAttemptAt: now,
      firstFailedAt: now - 26 * HOUR,
      lastError: tl(locale, 'api.network', { service: 'MyAnimeList' }),
    },
  ];
}

/**
 * Chaînes des données de démo de toutes les vues (popup, panneau, page d'import) et des cartes ajoutées par le
 * contrôle : ni adresses, ni identifiants, ni textes du catalogue de la langue (ou de l'anglais), ni noms de marque
 */
export function demoDataStrings(locale: Locale, catalog: CatalogEntries): string[] {
  const now = Date.now();
  const popup = demoChrome(locale, 'activity', now);
  // Réponses du service worker simulé (fiches candidates, profils, écarts AniList ↔ MAL…)
  const responses = Object.values(popup.handlers).map((handler) => {
    try {
      return handler({ service: 'anilist', query: '' });
    } catch {
      return null;
    }
  });
  return dataStringsOf([popup.storage, responses, panelView(), panelMedia(), PANEL_PAGE, importPlan(locale, now), ratingSeed(now), queueSeed(locale, now)], catalog);
}

/** Chaînes affichables d'un contenu quelconque (stockage d'une page de test), mêmes exclusions */
export function dataStringsOf(values: readonly unknown[], catalog: CatalogEntries): string[] {
  const known = new Set([...Object.values(catalog), ...BRAND_NAMES].map((text) => normalizeText(text).toLowerCase()));
  return collectDataStrings(values, (text) => known.has(text.toLowerCase()));
}
