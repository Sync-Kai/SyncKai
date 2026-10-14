// Liste des langues de Réglages › Langue : noms tirés d'Intl.DisplayNames (ajouter une langue ne demande aucune
// traduction de noms), tri par endonyme, recherche. Logique pure, testée sans DOM ; pages de l'extension seulement
// (jamais atteint depuis un script de contenu).
import { LOCALES, type Locale } from './core';

/** Nombre de langues à partir duquel le champ de recherche s'affiche au-dessus de la liste */
export const LANGUAGE_SEARCH_MIN = 8;

/** Page de contribution aux traductions ; null : ligne « Aider à traduire SyncKai » masquée */
export const TRANSLATION_URL: string | null = null;

export interface LanguageEntry<C extends string = Locale> {
  code: C;
  /** Nom dans sa propre langue (« Deutsch ») : libellé principal */
  endonym: string;
  /** Nom dans la langue de l'interface (« Allemand ») */
  name: string;
  /** Sous-titre affiché : `name`, ou null s'il est identique à l'endonyme (Français en interface française) */
  subtitle: string | null;
}

/** Première lettre en majuscule selon les règles de `locale` (« français » → « Français ») */
function capitalize(text: string, locale: string): string {
  if (!text) return text;
  try {
    return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
  } catch {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
}

/**
 * Étiquette nommée à la place du code : chinois par l'écriture (« 简体中文 », « 繁體中文 » plutôt que « 中文（中国） »),
 * espagnol d'Espagne explicite face à celui d'Amérique latine (« Español de España » / « Español latinoamericano »,
 * deux noms distincts dans toutes les langues de l'interface)
 */
const DISPLAY_TAGS: ReadonlyMap<string, string> = new Map([
  ['es', 'es-ES'],
  ['zh-CN', 'zh-Hans'],
  ['zh-TW', 'zh-Hant'],
]);

/** Nom de la langue `code` dans la langue `display` ; repli sur le code si Intl ne sait pas le nommer */
export function languageName(code: string, display: string): string {
  try {
    const name = new Intl.DisplayNames([display], { type: 'language' }).of(DISPLAY_TAGS.get(code) ?? code);
    return name ? capitalize(name, display) : code;
  } catch {
    return code;
  }
}

/** Nom de la langue dans sa propre langue (« Deutsch », « English », « Français ») */
export function endonym(code: string): string {
  return languageName(code, code);
}

/** Collation fixe (l'anglais suit l'ordre racine de CLDR) : l'ordre ne dépend ni de l'interface ni du navigateur */
const COLLATION_LOCALE = 'en';

/**
 * Langues proposées, triées par endonyme (`localeCompare` de base, sans tenir compte des accents ni de la casse) :
 * même ordre quelle que soit la langue de l'interface.
 */
export function languageEntries<C extends string = Locale>(uiLocale: string, locales: readonly C[]): LanguageEntry<C>[] {
  return locales
    .map((code) => {
      const own = endonym(code);
      const name = languageName(code, uiLocale);
      return { code, endonym: own, name, subtitle: name === own ? null : name };
    })
    .sort((a, b) => a.endonym.localeCompare(b.endonym, COLLATION_LOCALE, { sensitivity: 'base' }) || a.code.localeCompare(b.code));
}

/** Langues de l'extension (`LOCALES`) dans l'ordre d'affichage */
export function supportedLanguages(uiLocale: Locale): LanguageEntry[] {
  return languageEntries(uiLocale, LOCALES);
}

/** Le champ de recherche n'apparaît qu'à partir de `LANGUAGE_SEARCH_MIN` langues */
export function showsLanguageSearch(count: number): boolean {
  return count >= LANGUAGE_SEARCH_MIN;
}

/** Texte comparable : minuscules, sans accents (NFD + retrait des diacritiques), espaces réduits */
export function foldSearchText(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Langues dont l'endonyme, le nom traduit ou le code contient la recherche (vide : toutes) */
export function filterLanguages<C extends string>(entries: readonly LanguageEntry<C>[], query: string): LanguageEntry<C>[] {
  const needle = foldSearchText(query);
  if (!needle) return [...entries];
  return entries.filter((entry) => [entry.endonym, entry.name, entry.code].some((text) => foldSearchText(text).includes(needle)));
}
