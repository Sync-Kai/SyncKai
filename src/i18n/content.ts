// Traductions des scripts de contenu : seules les clés de `content-keys.ts`, dans les trois langues, extraites des
// catalogues au build (`define` de vite.config.ts, voir src/build/content-catalog.ts) au lieu des catalogues complets
// (PERF-01). Importé par les modules de `content/` ; les modules partagés qu'ils utilisent importent `./core`.
import {
  initI18n as initCore,
  registerCatalogs,
  t as translate,
  tl as translateIn,
  tp as translatePlural,
  type InitI18nOptions,
  type Locale,
  type MessageKey,
  type MessageParams,
  type PluralKey,
} from './core';

let registered = false;

/**
 * Enregistre le sous-ensemble au premier usage, jamais à l'import. En build, la constante est remplacée par sa valeur ;
 * sous `npm run dev`, Vite la crée comme variable globale au chargement de son client, qui peut s'exécuter après
 * l'évaluation de ce module : une lecture à l'import lèverait `ReferenceError` et tuerait le script de contenu.
 */
export function ensureContentCatalogs(): void {
  if (registered || typeof __SYNCKAI_CONTENT_CATALOGS__ === 'undefined') return;
  registerCatalogs(__SYNCKAI_CONTENT_CATALOGS__);
  registered = true;
}

export async function initI18n(options?: InitI18nOptions): Promise<Locale> {
  ensureContentCatalogs();
  return initCore(options);
}

export function t(key: MessageKey, params?: MessageParams): string {
  ensureContentCatalogs();
  return translate(key, params);
}

export function tl(locale: Locale, key: MessageKey, params?: MessageParams): string {
  ensureContentCatalogs();
  return translateIn(locale, key, params);
}

export function tp(key: PluralKey, count: number, params?: MessageParams): string {
  ensureContentCatalogs();
  return translatePlural(key, count, params);
}

export { applyLanguageSetting, getLocale, lowerFirst, onLocaleChange, setLocale } from './core';
export type { Locale, MessageKey, MessageParams, PluralKey } from './core';
