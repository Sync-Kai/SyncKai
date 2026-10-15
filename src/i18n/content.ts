// Traductions des scripts de contenu : seules les clés de `content-keys.ts`, en anglais, extraites du catalogue au build
// (`define` de vite.config.ts, voir src/build/content-catalog.ts) au lieu des catalogues complets (PERF-01). Une autre
// langue est demandée au service worker au premier usage (GET_CONTENT_CATALOG : les mêmes clés, dans cette langue).
// Importé par les modules de `content/` ; les modules partagés qu'ils utilisent importent `./core`.
import { sendMessage } from '../protocol/messages';
import {
  applyLanguageSetting as applyCore,
  hasCatalogLoader,
  initI18n as initCore,
  registerCatalogs,
  setCatalogLoader,
  t as translate,
  tl as translateIn,
  tp as translatePlural,
  type InitI18nOptions,
  type LanguageSetting,
  type Locale,
  type MessageKey,
  type MessageParams,
  type PluralKey,
} from './core';

/** Attente maximale de la réponse du service worker : au-delà, les textes restent en anglais (nouvel essai au suivant) */
export const CONTENT_CATALOG_TIMEOUT_MS = 5_000;

/** Textes des clés de contenu dans `locale`, demandés au service worker ; rejet : langue indisponible (anglais conservé) */
async function requestContentCatalog(locale: Locale): Promise<unknown> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('service worker sans réponse')), CONTENT_CATALOG_TIMEOUT_MS);
  });
  try {
    const catalog = await Promise.race([sendMessage('GET_CONTENT_CATALOG', { locale }), timeout]);
    if (catalog === null) throw new Error('catalogue introuvable');
    return catalog;
  } finally {
    clearTimeout(timer);
  }
}

let loaderSet = false;
let registered = false;

/**
 * Enregistre l'anglais et le chargeur des autres langues au premier usage, jamais à l'import. En build, la constante
 * est remplacée par sa valeur ; sous `npm run dev`, Vite la crée comme variable globale au chargement de son client,
 * qui peut s'exécuter après l'évaluation de ce module : une lecture à l'import lèverait `ReferenceError` et tuerait le
 * script de contenu.
 */
export function ensureContentCatalogs(): void {
  if (!loaderSet) {
    loaderSet = true;
    // Chargeur des catalogues complets déjà en place (harnais des captures : bulle du contenu dans une page qui charge
    // i18n/index) : gardé ; un script de contenu n'en a jamais d'autre
    if (!hasCatalogLoader()) setCatalogLoader(requestContentCatalog);
  }
  if (registered || typeof __SYNCKAI_CONTENT_CATALOGS__ === 'undefined') return;
  registerCatalogs(__SYNCKAI_CONTENT_CATALOGS__);
  registered = true;
}

/** Lit la langue des réglages (textes de la langue demandés au service worker), sans écouteur (voir InitI18nOptions) */
export async function initI18n(options?: InitI18nOptions): Promise<Locale> {
  ensureContentCatalogs();
  return initCore(options);
}

/** Applique la langue des réglages, relue à chaque lecture : textes demandés au service worker si besoin, anglais sinon */
export function applyLanguageSetting(setting: LanguageSetting): Promise<Locale> {
  ensureContentCatalogs();
  return applyCore(setting);
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

export { getLocale, lowerFirst, onLocaleChange, setLocale } from './core';
export type { LanguageSetting, Locale, MessageKey, MessageParams, PluralKey } from './core';
