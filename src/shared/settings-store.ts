import { getSettings, saveSettings, type SyncSettings } from './settings';
import { withStorageLock } from './storage-lock';

// Écriture des réglages par champs, sous le verrou du stockage (hors du module settings, lu par les scripts de page).

/**
 * Lecture-modification-écriture verrouillée : seuls les champs de `patch` changent, une écriture concurrente d'un autre
 * champ (délai d'une série depuis l'Agenda, lecteur préféré remis par défaut après un retrait d'accès) est conservée.
 * Retourne les réglages enregistrés.
 */
export function updateSettings(patch: Partial<SyncSettings>): Promise<SyncSettings> {
  return withStorageLock(async () => {
    const next = { ...(await getSettings()), ...patch };
    await saveSettings(next);
    return next;
  });
}
