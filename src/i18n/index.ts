import { getSettings, normalizeSettings, SETTINGS_STORAGE_KEY, type LanguageSetting } from '../shared/settings';
import de from './locales/de.json';
import en from './locales/en.json';
import fr from './locales/fr.json';

// Traductions de l'interface : l'anglais est la référence (types des clés) et la langue de repli.

export type Locale = 'fr' | 'en' | 'de';
export const LOCALES: readonly Locale[] = ['fr', 'en', 'de'];

export type MessageKey = keyof typeof en;
/** Clés plurielles : base commune des variantes `_one` / `_other` */
export type PluralKey = MessageKey extends infer K ? (K extends `${infer Base}_one` ? Base : never) : never;
export type MessageParams = Readonly<Record<string, string | number>>;

const CATALOGS: Record<Locale, Readonly<Record<string, string>>> = { en, fr, de };

let current: Locale = detectUiLocale();
const listeners = new Set<(locale: Locale) => void>();

/** Langue du navigateur : fr*, de*, en* ; toute autre langue → anglais */
export function detectUiLocale(): Locale {
  let ui = '';
  try {
    ui = typeof chrome !== 'undefined' && chrome.i18n?.getUILanguage ? chrome.i18n.getUILanguage() : '';
  } catch {
    ui = '';
  }
  if (!ui && typeof navigator !== 'undefined') ui = navigator.language;
  const base = ui.toLowerCase().split(/[-_]/)[0];
  return LOCALES.find((locale) => locale === base) ?? 'en';
}

export function resolveLocale(setting: LanguageSetting): Locale {
  return setting === 'auto' ? detectUiLocale() : setting;
}

export function getLocale(): Locale {
  return current;
}

/** Change la langue active (synchrone) et prévient les abonnés si elle a changé */
export function setLocale(locale: Locale): void {
  if (locale === current) return;
  current = locale;
  if (typeof document !== 'undefined') document.documentElement.lang = locale;
  for (const listener of listeners) listener(locale);
}

/** Abonnement aux changements de langue ; retourne la fonction de désabonnement */
export function onLocaleChange(listener: (locale: Locale) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function format(template: string, params?: MessageParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (Object.hasOwn(params, name) ? String(params[name]) : match));
}

/** Texte traduit dans une langue donnée (repli sur l'anglais, puis sur la clé) */
export function tl(locale: Locale, key: MessageKey, params?: MessageParams): string {
  return format(CATALOGS[locale][key] ?? CATALOGS.en[key] ?? key, params);
}

/** Texte traduit ; `{nom}` est remplacé par `params.nom` */
export function t(key: MessageKey, params?: MessageParams): string {
  return tl(current, key, params);
}

/** Première lettre en minuscule pour insérer une phrase en milieu de ligne (sauf en allemand : noms communs en majuscule) */
export function lowerFirst(text: string, locale: Locale = current): string {
  return locale === 'de' ? text : text.charAt(0).toLowerCase() + text.slice(1);
}

/** Texte pluriel (`key_one` / `key_other`) selon Intl.PluralRules ; `{count}` est fourni automatiquement */
export function tp(key: PluralKey, count: number, params?: MessageParams): string {
  const rule = new Intl.PluralRules(current).select(count);
  const catalog = CATALOGS[current];
  const template = catalog[`${key}_${rule}`] ?? catalog[`${key}_other`] ?? CATALOGS.en[`${key}_${rule === 'one' ? 'one' : 'other'}`] ?? key;
  return format(template, { count, ...params });
}

let ready: Promise<Locale> | null = null;

/**
 * Lit la langue choisie dans les réglages puis suit ses changements (storage.onChanged).
 * Mémoïsé : popup, page d'import, content script et service worker peuvent l'attendre plusieurs fois.
 */
export function initI18n(): Promise<Locale> {
  ready ??= (async () => {
    if (typeof document !== 'undefined') document.documentElement.lang = current;
    try {
      setLocale(resolveLocale((await getSettings()).language));
    } catch {
      // Stockage illisible : la langue du navigateur reste active
    }
    // Zone locale seule : une écriture dans `storage.session` ne réveille pas le service worker (ARCH-18)
    chrome.storage.local.onChanged.addListener((changes) => {
      const change = changes[SETTINGS_STORAGE_KEY];
      if (change) setLocale(resolveLocale(normalizeSettings(change.newValue).language));
    });
    return current;
  })();
  return ready;
}
