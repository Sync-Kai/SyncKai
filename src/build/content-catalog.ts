import { CONTENT_KEYS, type ContentCatalogs, type ContentKey } from '../i18n/content-keys';
import type { CatalogSet, Locale } from '../i18n/core';

/** Textes des seules clés de contenu ; une clé absente fait échouer le build plutôt que d'afficher la clé brute */
function pick(locale: Locale, catalog: Readonly<Record<string, string>>): Record<ContentKey, string> {
  const missing = CONTENT_KEYS.filter((key) => typeof catalog[key] !== 'string');
  if (missing.length > 0) throw new Error(`Catalogue ${locale} : clés des scripts de contenu absentes (${missing.join(', ')})`);
  return Object.fromEntries(CONTENT_KEYS.map((key) => [key, catalog[key]])) as Record<ContentKey, string>;
}

/** Sous-ensemble des catalogues complets embarqué par les scripts de contenu (PERF-01), clés dans l'ordre de CONTENT_KEYS */
export function contentCatalogs(catalogs: CatalogSet): ContentCatalogs {
  return { fr: pick('fr', catalogs.fr), en: pick('en', catalogs.en), de: pick('de', catalogs.de) };
}

/**
 * Valeur de `__SYNCKAI_CONTENT_CATALOGS__` (option `define` de vite.config.ts et vitest.config.ts). Un `define`, et
 * non un module virtuel : crxjs construit les scripts Netflix (`*.iife.ts`) dans un build séparé qui hérite de
 * `define` mais pas des plugins. Sortie déterministe (build reproductible).
 */
export function contentCatalogsDefine(catalogs: CatalogSet): string {
  return JSON.stringify(contentCatalogs(catalogs));
}
