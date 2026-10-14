import { catalogText, loadLocale, type Locale } from '../i18n';
import { CONTENT_KEYS, type ContentCatalog, type ContentKey } from '../i18n/content-keys';

/**
 * GET_CONTENT_CATALOG : textes des scripts de contenu (CONTENT_KEYS) dans `locale`, tirés du catalogue complet chargé à
 * la demande ; une clé absente de la langue garde son texte anglais. null si le catalogue est introuvable : le script
 * de contenu reste en anglais (il n'embarque que cette langue, PERF-01).
 */
export async function getContentCatalog(locale: Locale): Promise<ContentCatalog | null> {
  if (!(await loadLocale(locale))) return null;
  const entries = CONTENT_KEYS.map((key): [ContentKey, string] => [key, catalogText(locale, key) ?? catalogText('en', key) ?? key]);
  return Object.fromEntries(entries) as Record<ContentKey, string>;
}
