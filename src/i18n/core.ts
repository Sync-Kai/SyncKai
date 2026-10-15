import { createLogger } from '../browser/logger';
import { getSettings, normalizeSettings, SETTINGS_STORAGE_KEY } from '../shared/settings';
import { isCatalog, type Catalog } from './catalog-check';
import { LOCALES, matchLocale, type LanguageSetting, type Locale } from './locale-codes';
import type en from './locales/en.json';

// Traductions de l'interface : l'anglais est la référence (types des clés) et la langue de repli.
// Moteur sans catalogue (PERF-01) : `./index` enregistre l'anglais complet et charge les autres langues à la demande
// (pages de l'extension, service worker), `./content` embarque les seules clés des scripts de contenu en anglais et
// demande celles d'une autre langue au service worker. Le code atteignable depuis un script de contenu importe ce
// module (ou `./content`), jamais `./index` (vérifié par content.test.ts).
// Invariant : la langue active a toujours son catalogue enregistré (l'anglais tant que rien d'autre n'est chargé).

export { isLocale, LANGUAGE_SETTINGS, LOCALES, matchLocale, type LanguageSetting, type Locale } from './locale-codes';
export type { Catalog } from './catalog-check';

export type MessageKey = keyof typeof en;
/** Clés plurielles : base commune des variantes `_one` / `_few` / … / `_other` */
export type PluralKey = MessageKey extends infer K ? (K extends `${infer Base}_one` ? Base : never) : never;
export type MessageParams = Readonly<Record<string, string | number>>;
/** Textes par langue (catalogues complets ou sous-ensemble), langues absentes permises */
export type CatalogSet = Readonly<Partial<Record<Locale, Catalog>>>;
/**
 * Lecture du catalogue d'une langue : fichier du paquet (pages, service worker) ou sous-ensemble demandé au service
 * worker (scripts de contenu). Résultat validé par `loadLocale` ; rejet : langue indisponible.
 */
export type CatalogLoader = (locale: Locale) => Promise<unknown>;

const CATALOGS: Partial<Record<Locale, Record<string, string>>> = {};

/** Ajoute des textes aux catalogues (fusion : enregistrer deux fois, ou un sous-ensemble après le tout, est sans effet) */
export function registerCatalogs(catalogs: CatalogSet): void {
  for (const locale of LOCALES) {
    const catalog = catalogs[locale];
    if (catalog) CATALOGS[locale] = Object.assign(CATALOGS[locale] ?? {}, catalog);
  }
}

/** Catalogue de `locale` enregistré (complet, ou sous-ensemble dans un script de contenu) */
export function hasCatalog(locale: Locale): boolean {
  return CATALOGS[locale] !== undefined;
}

/** Texte brut d'une clé (placeholders laissés tels quels) dans le catalogue enregistré de `locale`, sans repli */
export function catalogText(locale: Locale, key: string): string | undefined {
  return CATALOGS[locale]?.[key];
}

let loader: CatalogLoader | null = null;
/** Chargements en cours, un par langue : appels simultanés regroupés */
const loading = new Map<Locale, Promise<boolean>>();

/** Source des catalogues des langues non enregistrées (null : aucune, seules les langues enregistrées sont utilisables) */
export function setCatalogLoader(next: CatalogLoader | null): void {
  loader = next;
}

export function hasCatalogLoader(): boolean {
  return loader !== null;
}

/**
 * Charge le catalogue de `locale` s'il n'est pas déjà enregistré : true s'il est disponible. Échec (fichier ou service
 * worker injoignable, contenu invalide) : false, consigné ; l'anglais reste le repli et un appel ultérieur réessaie.
 */
export function loadLocale(locale: Locale): Promise<boolean> {
  if (hasCatalog(locale)) return Promise.resolve(true);
  const pending = loading.get(locale);
  if (pending) return pending;
  const read = loader;
  if (!read) return Promise.resolve(false);
  const request = Promise.resolve()
    .then(() => read(locale))
    .then((catalog) => {
      if (!isCatalog(catalog)) throw new Error('catalogue invalide');
      registerCatalogs({ [locale]: catalog });
      return true;
    })
    .catch((error: unknown) => {
      // Logger créé au premier échec seulement : aucune lecture des constantes de build à l'import (content.test.ts)
      createLogger('i18n').warn(`Catalogue « ${locale} » indisponible, anglais conservé :`, error);
      return false;
    })
    .finally(() => loading.delete(locale));
  loading.set(locale, request);
  return request;
}

/** Langue active : l'anglais jusqu'à la lecture des réglages (initI18n / applyLanguageSetting) */
let current: Locale = 'en';
const listeners = new Set<(locale: Locale) => void>();
/** `<html lang>` suit la langue active : pages de l'extension seulement, jamais la page d'un site (ARCH-01) */
let ownsDocumentLang = false;

/** Étiquette de langue du navigateur (`chrome.i18n`, sinon `navigator`), vide si indisponible */
function browserLanguageTag(): string {
  let tag = '';
  try {
    tag = typeof chrome !== 'undefined' && chrome.i18n?.getUILanguage ? chrome.i18n.getUILanguage() : '';
  } catch {
    tag = '';
  }
  if (!tag && typeof navigator !== 'undefined') tag = navigator.language;
  return tag;
}

/** Langue du navigateur ramenée à une langue de l'extension (matchLocale ; anglais si elle n'est pas proposée) */
export function detectUiLocale(): Locale {
  return matchLocale(browserLanguageTag());
}

export function resolveLocale(setting: LanguageSetting): Locale {
  return setting === 'auto' ? detectUiLocale() : setting;
}

/** Numéro de la dernière demande de langue : une réponse arrivée après une demande plus récente est ignorée */
let languageRequest = 0;
/** Dernière demande de langue en cours (applyLanguageSetting) */
let lastApplying: Promise<Locale> | null = null;

/**
 * Applique la langue des réglages une fois son catalogue chargé (catalogue indisponible : anglais). Changements rapides :
 * la dernière demande l'emporte, quel que soit l'ordre d'arrivée des catalogues. Sert aussi aux scripts de contenu, qui
 * relisent les réglages au lieu de les suivre.
 */
export function applyLanguageSetting(setting: LanguageSetting): Promise<Locale> {
  const request = ++languageRequest;
  const locale = resolveLocale(setting);
  const applying = loadLocale(locale).then((available) => {
    if (request === languageRequest) setLocale(available ? locale : 'en');
    return current;
  });
  lastApplying = applying;
  return applying;
}

/**
 * Langue active une fois la dernière demande appliquée, y compris une demande arrivée pendant l'attente. Service worker :
 * une réponse traduite pendant un changement de langue serait encore dans l'ancienne (l'écran qui relance sa requête
 * dès sa propre bascule l'afficherait).
 */
export async function languageSettled(): Promise<Locale> {
  let seen: Promise<Locale> | null;
  do {
    seen = lastApplying;
    await seen;
  } while (seen !== lastApplying);
  return current;
}

export function getLocale(): Locale {
  return current;
}

/**
 * Change la langue active (synchrone) et prévient les abonnés si elle a changé. Le catalogue doit être enregistré
 * (`loadLocale` d'abord, ou applyLanguageSetting) : sinon chaque texte retombe sur l'anglais.
 */
export function setLocale(locale: Locale): void {
  if (locale === current) return;
  current = locale;
  if (ownsDocumentLang && typeof document !== 'undefined') document.documentElement.lang = locale;
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
  return format(CATALOGS[locale]?.[key] ?? CATALOGS.en?.[key] ?? key, params);
}

/** Texte traduit ; `{nom}` est remplacé par `params.nom` */
export function t(key: MessageKey, params?: MessageParams): string {
  return tl(current, key, params);
}

/**
 * Première lettre en minuscule pour insérer une phrase en milieu de ligne, selon les règles de la langue (turc :
 * « I » → « ı », « İ » → « i ») ; sauf en allemand (noms communs en majuscule)
 */
export function lowerFirst(text: string, locale: Locale = current): string {
  return locale === 'de' ? text : text.charAt(0).toLocaleLowerCase(locale) + text.slice(1);
}

// ─── Assemblage de textes traduits ────────────────────────────────────────

/** Langues sans espace entre deux phrases : la ponctuation pleine chasse (« 。 ») les sépare déjà */
const NO_SPACE_BETWEEN_SENTENCES: readonly Locale[] = ['ja', 'zh-CN', 'zh-TW'];
/** Fin de phrase : ponctuation latine ou pleine chasse, points de suspension */
const SENTENCE_END = /[.!?。！？…]$/u;
/** Fin sans ponctuation (lettre, chiffre, guillemet ou parenthèse fermants) : un point est ajouté avant la phrase suivante */
const OPEN_END = /[\p{L}\p{N}\p{Pe}\p{Pf}"'’]$/u;

/**
 * Phrases traduites à la suite (bandeau, annonce aux lecteurs d'écran) : une espace entre elles, aucune en japonais et en
 * chinois ; une phrase sans ponctuation finale (« SyncKai n'a pas accès à Crunchyroll / ADN ») reçoit le point de la
 * langue (« . », « 。 ») pour ne pas se fondre dans la suivante.
 */
export function joinSentences(sentences: readonly string[], locale: Locale = current): string {
  const fullWidth = NO_SPACE_BETWEEN_SENTENCES.includes(locale);
  const parts = sentences.map((sentence) => sentence.trim()).filter((sentence) => sentence !== '');
  return parts
    .map((sentence, index) => (index < parts.length - 1 && !SENTENCE_END.test(sentence) && OPEN_END.test(sentence) ? `${sentence}${fullWidth ? '。' : '.'}` : sentence))
    .join(fullWidth ? '' : ' ');
}

/**
 * Complément qui commence par sa propre ponctuation (« . Nouvel essai automatique bientôt. », « 。稍後會自動重試。 »)
 * collé à un texte : sa ponctuation de tête est retirée si le texte finit déjà une phrase (jamais « .. » ni « 。。 »)
 */
export function appendSuffix(text: string, suffix: string): string {
  const head = text.trimEnd();
  return SENTENCE_END.test(head) && /^[.。]/u.test(suffix) ? `${head}${suffix.slice(1)}` : `${text}${suffix}`;
}

/**
 * Quantités suivies de leur unité (« 1 h » et « 30 min » → « 1 h 30 min ») : une espace entre elles, sauf en japonais,
 * qui n'en met ni entre les mots ni autour des chiffres (« 1時間30分 ») ; le chinois en met une entre caractères chinois
 * et chiffres (« 1 小时 30 分钟 »).
 */
export function joinQuantities(quantities: readonly string[], locale: Locale = current): string {
  return quantities.join(locale === 'ja' ? '' : ' ');
}

/** Langues qui séparent d'une espace les caractères chinois des mots latins et des chiffres (glossaires zh-CN, zh-TW) */
const SPACED_HAN: readonly Locale[] = ['zh-CN', 'zh-TW'];
const HAN = /\p{Script=Han}/u;
const LATIN_OR_DIGIT = /[\p{Script=Latin}\p{N}]/u;

/**
 * Noms cités dans une phrase (« AniList et MyAnimeList », « Crunchyroll, ADN ou Netflix ») : séparateurs et conjonction
 * de la langue (Intl.ListFormat ; « 、 » en japonais et en chinois). En chinois, une espace entre « 和 » / « 或 » et un
 * nom latin (« Crunchyroll、ADN 和 Netflix »), comme dans le reste des catalogues.
 */
export function formatList(items: readonly string[], type: 'conjunction' | 'disjunction' = 'conjunction', locale: Locale = current): string {
  let parts: { type: string; value: string }[];
  try {
    parts = new Intl.ListFormat(locale, { style: 'long', type }).formatToParts(items);
  } catch {
    return items.join(', ');
  }
  if (!SPACED_HAN.includes(locale)) return parts.map((part) => part.value).join('');
  return parts
    .map((part, index) => {
      if (part.type !== 'literal') return part.value;
      const before = parts[index - 1]?.value.slice(-1) ?? '';
      const after = parts[index + 1]?.value.charAt(0) ?? '';
      const lead = HAN.test(part.value.charAt(0)) && LATIN_OR_DIGIT.test(before) ? ' ' : '';
      const trail = HAN.test(part.value.slice(-1)) && LATIN_OR_DIGIT.test(after) ? ' ' : '';
      return `${lead}${part.value}${trail}`;
    })
    .join('');
}

const pluralRules = new Map<Locale, Intl.PluralRules>();

/** Catégorie de pluriel de `count` dans `locale` (one, few, many, other…) */
function pluralCategory(locale: Locale, count: number): Intl.LDMLPluralRule {
  let rules = pluralRules.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(locale);
    pluralRules.set(locale, rules);
  }
  return rules.select(count);
}

/**
 * Texte pluriel dans une langue donnée : variante `key_<catégorie>` selon Intl.PluralRules de cette langue (one, few,
 * many…), variante absente → `key_other`, puis l'anglais ; `{count}` est fourni automatiquement
 */
export function tpl(locale: Locale, key: PluralKey, count: number, params?: MessageParams): string {
  const catalog = CATALOGS[locale];
  const english = CATALOGS.en;
  const template =
    catalog?.[`${key}_${pluralCategory(locale, count)}`] ??
    catalog?.[`${key}_other`] ??
    english?.[`${key}_${pluralCategory('en', count)}`] ??
    english?.[`${key}_other`] ??
    key;
  return format(template, { count, ...params });
}

/**
 * Texte pluriel dans la langue active : variante selon Intl.PluralRules (`_one`, `_few`, `_many`…), variante absente →
 * `_other`, puis l'anglais (voir tpl) ; `{count}` est fourni automatiquement
 */
export function tp(key: PluralKey, count: number, params?: MessageParams): string {
  return tpl(current, key, count, params);
}

let ready: Promise<Locale> | null = null;

export interface InitI18nOptions {
  /** Écrit la langue dans `<html lang>` (défaut). Faux dans un script de contenu : la page appartient au site (ARCH-01) */
  setDocumentLang?: boolean;
  /**
   * Suit les changements de langue des réglages (défaut). Faux dans un script de contenu : un écouteur de
   * `storage.local.onChanged` y recevrait chaque écriture du stockage, imports compris (PERF-03)
   */
  follow?: boolean;
}

/**
 * Lit la langue choisie dans les réglages, charge son catalogue puis, sauf `follow: false`, suit ses changements.
 * Mémoïsé : popup, page d'import, content script et service worker peuvent l'attendre plusieurs fois
 * (les options du premier appel s'appliquent).
 */
export function initI18n({ setDocumentLang = true, follow = true }: InitI18nOptions = {}): Promise<Locale> {
  ready ??= (async () => {
    ownsDocumentLang = setDocumentLang;
    if (ownsDocumentLang && typeof document !== 'undefined') document.documentElement.lang = current;
    let setting: LanguageSetting = 'auto';
    try {
      setting = (await getSettings()).language;
    } catch {
      // Stockage illisible : langue du navigateur
    }
    const applied = applyLanguageSetting(setting);
    // Écouteur posé avant la fin du chargement : un changement pendant celui-ci l'emporte (dernière demande)
    if (follow) {
      // Zone locale seule : une écriture dans `storage.session` ne réveille pas le service worker (ARCH-18)
      chrome.storage.local.onChanged.addListener((changes) => {
        const change = changes[SETTINGS_STORAGE_KEY];
        if (change) void applyLanguageSetting(normalizeSettings(change.newValue).language);
      });
    }
    return applied;
  })();
  return ready;
}
