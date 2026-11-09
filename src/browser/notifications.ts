// Autorisation des notifications, partagée par les alertes de sortie et de suite (airing.ts et sequels/check.ts ne s'importent pas).

/**
 * Notifications de SyncKai désactivées dans Chrome : chaque création serait refusée avec un message vide. Firefox n'a pas
 * getPermissionLevel (blocage par le système non détectable, comme sur Chrome).
 */
export async function notificationsBlocked(): Promise<boolean> {
  if (typeof chrome.notifications.getPermissionLevel !== 'function') return false;
  return (await chrome.notifications.getPermissionLevel()) === 'denied';
}
