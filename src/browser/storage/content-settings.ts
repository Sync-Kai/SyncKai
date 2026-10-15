import { normalizeContentSettings, SETTINGS_STORAGE_KEY, type ContentSettings } from '../../shared/content-settings';

// Lecture des seuls réglages des scripts de contenu et du moteur i18n : le code atteint par un script de contenu
// n'importe jamais getSettings / normalizeSettings (settings-access.ts, taille du bundle, vérifié par architecture.test.ts).
// Aucun écouteur `storage.onChanged` ici : le contenu relit les réglages à chaque usage (PERF-03).

export async function getContentSettings(): Promise<ContentSettings> {
  const stored = await chrome.storage.local.get(SETTINGS_STORAGE_KEY);
  return normalizeContentSettings(stored[SETTINGS_STORAGE_KEY]);
}
