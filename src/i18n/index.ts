// Traductions des pages de l'extension et du service worker : l'anglais (référence, langue de repli) est embarqué ; les
// autres langues sont des fichiers du paquet lus à la demande (en pratique une seule : celle des réglages), jamais
// toutes dans le code (PERF-01 : ~60 Ko par langue, à analyser à chaque ouverture du popup ou réveil du service
// worker). Les scripts de contenu passent par `./content`.
import { registerCatalogs, setCatalogLoader, type Locale } from './core';
import en from './locales/en.json';

/**
 * Adresse de chaque catalogue hors anglais : Vite émet les fichiers dans le paquet (`assets/locales/<code>.json`, voir
 * src/build/output-names.ts ; deux catalogues identiques partagent un fichier) et ne laisse dans le code que leur
 * chemin ; l'anglais, déjà embarqué, n'est pas émis.
 */
const CATALOG_URLS = import.meta.glob<string>(['./locales/*.json', '!./locales/en.json'], { query: '?url', import: 'default', eager: true });

/**
 * Catalogue d'une langue lu dans le paquet : `fetch`, et non `import()` dynamique, interdit dans le service worker de
 * Chrome (module) ; même code dans les pages, la page de fond de Firefox et le serveur Vite des tests de bout en bout
 */
async function fetchCatalog(locale: Locale): Promise<unknown> {
  const url: string | undefined = CATALOG_URLS[`./locales/${locale}.json`];
  if (url === undefined) throw new Error(`catalogue ${locale} absent du paquet`);
  const response = await fetch(new URL(url, import.meta.url));
  if (!response.ok) throw new Error(`catalogue ${locale} : HTTP ${response.status}`);
  const catalog: unknown = await response.json();
  return catalog;
}

registerCatalogs({ en });
setCatalogLoader(fetchCatalog);

export * from './core';
