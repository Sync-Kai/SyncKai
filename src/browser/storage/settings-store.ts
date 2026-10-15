import { ensureAiringAlarm } from '../airing-alarm';
import { getSettings, saveSettings } from './settings-access';
import { type SyncSettings } from '../../shared/settings';
import { withStorageLock } from './lock';

// Écriture des réglages par champs, sous le verrou du stockage (hors du module settings, lu par les scripts de page).

/**
 * Lecture-modification-écriture verrouillée : seuls les champs de `patch` changent, une écriture concurrente d'un autre
 * champ (délai d'une série depuis l'Agenda, lecteur préféré remis par défaut après un retrait d'accès) est conservée.
 * Retourne les réglages enregistrés.
 */
export async function updateSettings(patch: Partial<SyncSettings>): Promise<SyncSettings> {
  const saved = await withStorageLock(async () => {
    const next = { ...(await getSettings()), ...patch };
    await saveSettings(next);
    return next;
  });
  // Alertes de sortie activées ou coupées : l'alarme suit tout de suite, depuis la page (PERF-17)
  await ensureAiringAlarm();
  return saved;
}
