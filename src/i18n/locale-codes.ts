// Langues de l'interface : module feuille (aucun import), partagé par le moteur i18n (core.ts), les réglages
// (shared/settings.ts) sans cycle d'import, et les scripts Node (empaquetage, contrôle des catalogues).
// Ajouter une langue : voir CLAUDE.md › « i18n » (code ici, catalogue, dossier `public/_locales`, notes des traducteurs).

/**
 * Langues proposées : étiquettes BCP 47, valeur enregistrée dans le réglage `language` et nom du catalogue
 * (`src/i18n/locales/<code>.json`). Ordre sans effet sur l'interface (le sélecteur trie par endonyme).
 */
export const LOCALES = [
  'en',
  'fr',
  'de',
  'es',
  'es-419',
  'pt-BR',
  'it',
  'nl',
  'ru',
  'id',
  'pl',
  'sv',
  'tr',
  'zh-CN',
  'uk',
  'cs',
  'vi',
  'ro',
  'zh-TW',
  'ko',
  'ja',
] as const;

export type Locale = (typeof LOCALES)[number];

/** Langue de l'interface : 'auto' suit la langue du navigateur (matchLocale ; anglais si elle n'est pas proposée) */
export type LanguageSetting = 'auto' | Locale;
export const LANGUAGE_SETTINGS: readonly LanguageSetting[] = ['auto', ...LOCALES];

export function isLocale(value: unknown): value is Locale {
  return LOCALES.some((locale) => locale === value);
}

/** Dossier `_locales` de Chrome et Firefox : « - » remplacé par « _ » (`es_419`, `pt_BR`, `zh_CN`) */
export function chromeLocaleFolder(locale: Locale): string {
  return locale.replace(/-/g, '_');
}

/** Régions du chinois traditionnel (Taïwan, Hong Kong, Macao) */
const TRADITIONAL_CHINESE_REGIONS: readonly string[] = ['tw', 'hk', 'mo'];

/** Forme canonique d'une étiquette (`in` → `id`, `mo` → `ro`, casse), inchangée si Intl la refuse */
function canonicalTag(tag: string): string {
  try {
    return Intl.getCanonicalLocales(tag)[0] ?? tag;
  } catch {
    return tag;
  }
}

/**
 * Langue de l'extension pour une étiquette du navigateur (`chrome.i18n.getUILanguage()`, `navigator.language`),
 * « - » ou « _ », casse indifférente :
 * - code proposé tel quel (`pt-BR`, `es-419`, `zh-TW`…) ;
 * - chinois : écriture `Hant` ou région TW / HK / MO → `zh-TW` (une écriture `Hans` explicite l'emporte sur la
 *   région) ; tout autre chinois (CN, SG, Hans, sans région) → `zh-CN` ;
 * - espagnol : sans région ou région ES → `es` ; toute autre région (419, MX, AR, US…) → `es-419` ;
 * - portugais, quelle que soit la région (PT compris) → `pt-BR` ;
 * - sinon la langue de base si elle est proposée (`fr-CA` → `fr`, `nl-BE` → `nl`), à défaut l'anglais.
 */
export function matchLocale(tag: string): Locale {
  const canonical = canonicalTag(tag.trim().replace(/_/g, '-')).toLowerCase();
  const exact = LOCALES.find((locale) => locale.toLowerCase() === canonical);
  if (exact) return exact;
  const [language = '', ...rest] = canonical.split('-');
  // Sous-étiquettes avant la première extension (`-u-…`, `-x-…`) : écriture (4 lettres), région (2 lettres ou 3 chiffres)
  const extension = rest.findIndex((subtag) => subtag.length === 1);
  const subtags = extension === -1 ? rest : rest.slice(0, extension);
  const script = subtags.find((subtag) => /^[a-z]{4}$/.test(subtag));
  const region = subtags.find((subtag) => /^(?:[a-z]{2}|\d{3})$/.test(subtag));
  switch (language) {
    case 'zh':
      if (script === 'hant') return 'zh-TW';
      return script !== 'hans' && region !== undefined && TRADITIONAL_CHINESE_REGIONS.includes(region) ? 'zh-TW' : 'zh-CN';
    case 'es':
      return region === undefined || region === 'es' ? 'es' : 'es-419';
    case 'pt':
      return 'pt-BR';
    default:
      return LOCALES.find((locale) => locale === language) ?? 'en';
  }
}
