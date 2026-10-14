// Contrôle d'un catalogue de traduction par rapport à l'anglais (référence) : clés, variantes de pluriel selon
// Intl.PluralRules de la langue, placeholders `{nom}`, textes vides ; avertissements de longueur. Logique pure, sans
// import de valeur : partagée par le test des catalogues (locales.test.ts), le script des traducteurs
// (scripts/i18n-check.ts, exécuté par Node sans bundler) et la validation des catalogues chargés à la demande (core.ts).
// Messages en anglais : ils s'adressent aux traducteurs.

/** Textes d'une langue, par clé (`{nom}` : placeholder) */
export type Catalog = Readonly<Record<string, string>>;

/** Catégories de pluriel de CLDR, dans l'ordre (suffixes des variantes : `clé_one`, `clé_few`…) */
export const PLURAL_CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'] as const;
export type PluralCategory = (typeof PLURAL_CATEGORIES)[number];

/** Au-delà de ce rapport, un texte court traduit risque de déborder (bouton, onglet, pastille) */
export const LENGTH_RATIO_WARNING = 1.6;
/** Textes anglais concernés par l'avertissement de longueur (caractères) */
export const SHORT_TEXT_MAX = 24;

export interface CatalogIssue {
  /** `error` : catalogue refusé (test, code de sortie du script) ; `warning` : informatif */
  level: 'error' | 'warning';
  /** Clé concernée ; null : catalogue entier */
  key: string | null;
  message: string;
}

/** Objet dont toutes les valeurs sont des textes */
export function isCatalog(value: unknown): value is Catalog {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && Object.values(value).every((text) => typeof text === 'string');
}

export interface PluralVariants {
  /** Catégories choisies par Intl.PluralRules pour au moins un entier de 0 à 1000, plus `other` */
  required: PluralCategory[];
  /** Catégories de la langue (décimaux compris), plus `other` */
  allowed: PluralCategory[];
}

const pluralCache = new Map<string, PluralVariants>();

/**
 * Variantes de pluriel d'une langue. Exemples : `ja` → other ; `fr` → one, other (many permise : « 1 million ») ;
 * `ru` → one, few, many, other ; `cs` → one, few, other (many permise : décimaux seulement).
 */
export function pluralVariants(locale: string): PluralVariants {
  const cached = pluralCache.get(locale);
  if (cached) return cached;
  const rules = new Intl.PluralRules(locale);
  const selected = new Set<string>(['other']);
  for (let count = 0; count <= 1000; count++) selected.add(rules.select(count));
  const allowed = new Set<string>([...rules.resolvedOptions().pluralCategories, 'other']);
  const variants: PluralVariants = {
    required: PLURAL_CATEGORIES.filter((category) => selected.has(category)),
    allowed: PLURAL_CATEGORIES.filter((category) => allowed.has(category)),
  };
  pluralCache.set(locale, variants);
  return variants;
}

/** Clés plurielles de la référence : base des paires `base_one` / `base_other` */
export function pluralBases(reference: Catalog): Set<string> {
  return new Set(
    Object.keys(reference)
      .map((key) => /^(.+)_one$/.exec(key)?.[1])
      .filter((base): base is string => base !== undefined && Object.hasOwn(reference, `${base}_other`)),
  );
}

/** Base et catégorie d'une variante `base_catégorie` (catégorie de CLDR, base plurielle), sinon null */
function splitVariant(key: string, bases: ReadonlySet<string>): { base: string; category: PluralCategory } | null {
  const match = /^(.+)_([a-z]+)$/.exec(key);
  const category = PLURAL_CATEGORIES.find((name) => name === match?.[2]);
  return match?.[1] !== undefined && category !== undefined && bases.has(match[1]) ? { base: match[1], category } : null;
}

/** Placeholders `{nom}` d'un texte, sans doublon, triés */
export function placeholders(text: string): string[] {
  return [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1] ?? ''))].sort();
}

const sameList = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((item, index) => item === b[index]);
const format = (list: readonly string[]): string => (list.length > 0 ? list.map((name) => `{${name}}`).join(' ') : 'none');
const length = (text: string): number => [...text].length;

/**
 * Problèmes d'un catalogue `locale` par rapport à `reference` (anglais) :
 * - clés non plurielles : exactement celles de la référence ;
 * - clés plurielles (`base_one` + `base_other` en anglais) : variantes requises par la langue présentes, aucune
 *   catégorie étrangère à la langue ;
 * - placeholders : ceux du texte anglais (de `base_other` pour une variante) ; `{count}` peut manquer à une variante
 *   seulement si `base_one` anglais l'omet aussi ;
 * - aucun texte vide ; avertissement si un texte anglais court (≤ SHORT_TEXT_MAX) est traduit plus de
 *   LENGTH_RATIO_WARNING fois plus long.
 */
export function checkCatalog(locale: string, catalog: unknown, reference: Catalog): CatalogIssue[] {
  if (!isCatalog(catalog)) return [{ level: 'error', key: null, message: 'not a JSON object of strings' }];
  const issues: CatalogIssue[] = [];
  const error = (key: string, message: string): void => void issues.push({ level: 'error', key, message });
  const bases = pluralBases(reference);
  const { required, allowed } = pluralVariants(locale);

  // Clés attendues : clés simples de la référence, variantes requises des clés plurielles
  for (const key of Object.keys(reference)) {
    if (splitVariant(key, bases) === null && !Object.hasOwn(catalog, key)) error(key, 'missing key');
  }
  for (const base of bases) {
    for (const category of required) {
      if (!Object.hasOwn(catalog, `${base}_${category}`)) error(`${base}_${category}`, `missing plural variant (${locale} needs ${required.map((c) => `_${c}`).join(', ')})`);
    }
  }

  for (const [key, text] of Object.entries(catalog)) {
    const variant = splitVariant(key, bases);
    if (variant !== null && !allowed.includes(variant.category)) {
      error(key, `plural variant not used in ${locale} (allowed: ${allowed.map((c) => `_${c}`).join(', ')})`);
      continue;
    }
    const englishKey = variant === null ? key : `${variant.base}_other`;
    const english = reference[englishKey];
    if (english === undefined) {
      error(key, 'unknown key (not in en.json)');
      continue;
    }
    if (text.trim() === '') {
      error(key, 'empty text');
      continue;
    }

    const expected = placeholders(english);
    const actual = placeholders(text);
    const countOptional = variant !== null && !placeholders(reference[`${variant.base}_one`] ?? '').includes('count');
    const withoutCount = expected.filter((name) => name !== 'count');
    if (!sameList(actual, expected) && !(countOptional && sameList(actual, withoutCount))) {
      error(key, `placeholders ${format(actual)} instead of ${format(expected)}`);
    }

    // Texte anglais de même catégorie s'il existe (`_one`), sinon `_other`
    const shortReference = variant === null ? english : (reference[key] ?? english);
    if (length(shortReference) <= SHORT_TEXT_MAX && length(text) > LENGTH_RATIO_WARNING * length(shortReference)) {
      issues.push({ level: 'warning', key, message: `${length(text)} characters for ${length(shortReference)} in English: may overflow a button or tab` });
    }
  }
  return issues;
}
