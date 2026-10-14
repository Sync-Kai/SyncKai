// Catalogues de traduction lus d'emblée pour les tests (unitaires, et côté Node des tests de bout en bout) : dans
// l'extension, seul l'anglais est embarqué, les autres langues sont chargées à la demande (i18n/index.ts). Fichier de
// test : jamais importé par le code de l'extension.
import { registerCatalogs, setCatalogLoader, type Catalog, type Locale } from '../i18n';
import { LOCALES } from '../i18n/locale-codes';
import { jsonResponse, type FakeFetch } from './fake-chrome';

/** Fichiers `src/i18n/locales/*.json`, par nom de fichier (« pt-BR ») */
export const CATALOG_FILES: ReadonlyMap<string, Catalog> = new Map(
  Object.entries(import.meta.glob<Catalog>('../i18n/locales/*.json', { eager: true, import: 'default' })).map(([path, catalog]) => [
    path.replace(/^.*\/|\.json$/g, ''),
    catalog,
  ]),
);

/** Catalogue complet d'une langue proposée */
export function catalogOf(locale: Locale): Catalog {
  const catalog = CATALOG_FILES.get(locale);
  if (!catalog) throw new Error(`src/i18n/locales/${locale}.json absent`);
  return catalog;
}

/** Chargeur des tests : catalogues lus d'emblée, aucune requête */
export function installCatalogLoader(): void {
  setCatalogLoader((locale) => Promise.resolve(catalogOf(locale)));
}

/** Toutes les langues enregistrées (`setLocale` utilisable directement) et chargeur des tests */
export function registerAllCatalogs(): void {
  registerCatalogs(Object.fromEntries(LOCALES.map((locale) => [locale, catalogOf(locale)])));
  installCatalogLoader();
}

/**
 * fetch simulé : sert les catalogues que le chargeur de i18n/index.ts demande (moteur neuf après `vi.resetModules`,
 * sans le chargeur des tests) ; `requested` reçoit chaque langue demandée
 */
export function routeCatalogs(fetch: FakeFetch, requested: string[] = []): void {
  fetch.on(/\/locales\/[\w-]+\.json$/, ({ url }) => {
    const locale = /\/([\w-]+)\.json$/.exec(url)?.[1] ?? '';
    requested.push(locale);
    const catalog = CATALOG_FILES.get(locale);
    return catalog ? jsonResponse(200, catalog) : jsonResponse(404, {});
  });
}
