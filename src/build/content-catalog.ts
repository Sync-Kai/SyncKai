import { CONTENT_KEYS, type ContentCatalog, type ContentCatalogs, type ContentKey } from '../i18n/content-keys';
import type { Catalog } from '../i18n/core';

/** Textes des seules clés de contenu ; une clé absente fait échouer le build plutôt que d'afficher la clé brute */
function pick(catalog: Catalog): ContentCatalog {
  const missing = CONTENT_KEYS.filter((key) => typeof catalog[key] !== 'string');
  if (missing.length > 0) throw new Error(`Catalogue en : clés des scripts de contenu absentes (${missing.join(', ')})`);
  return Object.fromEntries(CONTENT_KEYS.map((key) => [key, catalog[key]])) as Record<ContentKey, string>;
}

/**
 * Sous-ensemble embarqué par les scripts de contenu (PERF-01) : les clés de contenu en anglais, dans l'ordre de
 * CONTENT_KEYS. Une autre langue est demandée au service worker (GET_CONTENT_CATALOG, i18n/content.ts).
 */
export function contentCatalogs(en: Catalog): ContentCatalogs {
  return { en: pick(en) };
}

/**
 * Valeur de `__SYNCKAI_CONTENT_CATALOGS__` (option `define` de vite.config.ts et vitest.config.ts). Un `define`, et
 * non un module virtuel : crxjs construit les scripts Netflix et Disney+ (`*.iife.ts`) dans un build séparé qui hérite
 * de `define` mais pas des plugins. Sortie déterministe (build reproductible).
 */
export function contentCatalogsDefine(en: Catalog): string {
  return JSON.stringify(contentCatalogs(en));
}
