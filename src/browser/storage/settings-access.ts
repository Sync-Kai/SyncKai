import { normalizeSettings, SETTINGS_STORAGE_KEY as SETTINGS_KEY, type SyncSettings } from '../../shared/settings';

// Lecture et écriture des réglages. Module volontairement séparé de settings-store.ts (qui prend le verrou du stockage) :
// il est aussi chargé par le script de contenu.

export async function getSettings(): Promise<SyncSettings> {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  return normalizeSettings(stored[SETTINGS_KEY]);
}

export async function saveSettings(settings: SyncSettings): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: normalizeSettings(settings) });
}
