/**
 * Contrôle des catalogues de traduction (src/i18n/locales/<langue>.json) par rapport à l'anglais, pour les traducteurs :
 * clés manquantes ou en trop, variantes de pluriel de la langue (Intl.PluralRules : `_one`, `_few`, `_many`, `_other`…),
 * placeholders `{nom}`, textes vides. Toute erreur → code de sortie 1 (mêmes règles que src/i18n/locales.test.ts).
 * Avertissements informatifs : texte anglais court (≤ 24 caractères) traduit plus de 1,6 fois plus long (bouton,
 * onglet : risque de débordement). Sortie en anglais : elle s'adresse aux traducteurs.
 *
 * Usage : npm run i18n:check                 (toutes les langues)
 *         npm run i18n:check -- ja pt-BR     (langues choisies ; `all` = toutes)
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { checkCatalog, isCatalog, pluralVariants, SHORT_TEXT_MAX, LENGTH_RATIO_WARNING, type Catalog, type CatalogIssue } from '../src/i18n/catalog-check.ts';
import { isLocale, LOCALES, type Locale } from '../src/i18n/locale-codes.ts';

const LOCALES_DIR = fileURLToPath(new URL('../src/i18n/locales/', import.meta.url));

/** Contenu JSON d'un catalogue, ou message d'erreur s'il est absent ou illisible */
function readCatalog(locale: string): unknown {
  const file = join(LOCALES_DIR, `${locale}.json`);
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (error: unknown) {
    return error instanceof Error ? error : new Error(String(error));
  }
}

function report(locale: Locale, issues: readonly CatalogIssue[]): void {
  const errors = issues.filter((issue) => issue.level === 'error');
  const warnings = issues.filter((issue) => issue.level === 'warning');
  const { required, allowed } = pluralVariants(locale);
  const optional = allowed.filter((category) => !required.includes(category));
  const plural = `${required.map((category) => `_${category}`).join(' ')}${optional.length > 0 ? ` (optional: ${optional.map((category) => `_${category}`).join(' ')})` : ''}`;
  const status = errors.length === 0 ? '✔' : '✖';
  console.log(`${status} ${locale} (plural forms: ${plural}) — ${errors.length} error(s), ${warnings.length} warning(s)`);
  for (const issue of errors) console.log(`    ✖ ${issue.key ?? '(file)'}: ${issue.message}`);
  for (const issue of warnings) console.log(`    ⚠ ${issue.key ?? '(file)'}: ${issue.message}`);
}

const { positionals } = parseArgs({ allowPositionals: true, strict: true });
const wanted = positionals.length === 0 || positionals.includes('all') ? [...LOCALES] : positionals;
const unknown = wanted.filter((code) => !isLocale(code));
if (unknown.length > 0) {
  console.error(`✖ Unknown locale(s): ${unknown.join(', ')}. Available: ${LOCALES.join(', ')}`);
  process.exit(1);
}

const english = readCatalog('en');
if (!isCatalog(english)) {
  console.error(`✖ src/i18n/locales/en.json is unreadable: ${english instanceof Error ? english.message : 'not an object of strings'}`);
  process.exit(1);
}
const reference: Catalog = english;

let failed = false;
for (const locale of wanted.filter(isLocale)) {
  const catalog = readCatalog(locale);
  const issues: CatalogIssue[] =
    catalog instanceof Error ? [{ level: 'error', key: null, message: `cannot read src/i18n/locales/${locale}.json: ${catalog.message}` }] : checkCatalog(locale, catalog, reference);
  report(locale, issues);
  failed ||= issues.some((issue) => issue.level === 'error');
}
console.log(`\nWarnings flag English texts of ${SHORT_TEXT_MAX} characters or fewer translated more than ${LENGTH_RATIO_WARNING}× longer: check them in the UI.`);
process.exit(failed ? 1 : 0);
