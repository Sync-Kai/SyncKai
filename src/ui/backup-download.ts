// Export de la sauvegarde : fichier .json téléchargé par un lien temporaire (aucune permission « downloads »).
import { backupFileName } from '../shared/backup';
import { exportBackup } from '../shared/backup-store';
import { h } from './dom';

/** Page Sauvegarde (onglet) : import, et export depuis le popup (`?export`) */
export const BACKUP_PAGE = 'src/import/import.html';
/** Paramètre d'URL de la page Sauvegarde : export lancé dès l'ouverture */
export const BACKUP_EXPORT_PARAM = 'export';

/** URL du blob gardée assez longtemps pour une boîte « Enregistrer sous » restée ouverte */
const BLOB_URL_TTL_MS = 60_000;

/** Télécharge la sauvegarde courante ; la page doit rester ouverte (onglet, panneau), pas le popup */
export async function downloadBackup(): Promise<void> {
  const backup = await exportBackup();
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
  const link = h('a', { attrs: { href: url, download: backupFileName(new Date()) } });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), BLOB_URL_TTL_MS);
}
