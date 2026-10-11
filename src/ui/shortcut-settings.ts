// Réglage du raccourci clavier « valider l'épisode » : page du navigateur, propre à chaque cible.

/** Page des raccourcis de Chrome, Edge et Brave (les pages chrome:// ne s'ouvrent pas par un lien) */
export const CHROME_SHORTCUTS_URL = 'chrome://extensions/shortcuts';

/** `commands.openShortcutSettings()` de Firefox (≥ 137), absent des types de l'API chrome */
interface ShortcutSettingsApi {
  openShortcutSettings(): Promise<void>;
}

function hasShortcutSettings(api: object): api is ShortcutSettingsApi {
  return 'openShortcutSettings' in api && typeof api.openShortcutSettings === 'function';
}

/**
 * Ouvre la page de réglage des raccourcis. Firefox refuse les URL chrome:// dans tabs.create : il passe par
 * `commands.openShortcutSettings()`. Rejet (API absente, onglet refusé) : l'appelant affiche la marche à suivre.
 */
export async function openShortcutSettings(target: 'chrome' | 'firefox' = __SYNCKAI_TARGET__): Promise<void> {
  if (target === 'firefox') {
    const commands: object | undefined = chrome.commands;
    if (!commands || !hasShortcutSettings(commands)) throw new Error('commands.openShortcutSettings indisponible');
    await commands.openShortcutSettings();
    return;
  }
  await chrome.tabs.create({ url: CHROME_SHORTCUTS_URL });
}
