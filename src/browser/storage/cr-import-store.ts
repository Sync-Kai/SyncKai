import { CR_IMPORT_KEYS, isCrImportJob, type CrImportJob } from '../../shared/cr-import';
import { isJobActive } from '../../shared/job';
import { withStorageLock } from './lock';

// Écritures de la page d'import Crunchyroll (ARCH-18) : sous le verrou du stockage, tâche relue sous ce verrou. L'état
// en mémoire de la page peut être en retard sur le service worker (analyse lancée depuis un autre onglet, reprise).

async function readJob(): Promise<CrImportJob | null> {
  const value: unknown = (await chrome.storage.local.get(CR_IMPORT_KEYS.job))[CR_IMPORT_KEYS.job];
  return isCrImportJob(value) ? value : null;
}

/** « Recommencer » : efface l'aperçu, la dernière tâche et ses données, jamais une tâche active. false si refusé. */
export function resetCrImport(now: number = Date.now()): Promise<boolean> {
  return withStorageLock(async () => {
    if (isJobActive(await readJob(), now)) return false;
    await chrome.storage.local.remove([CR_IMPORT_KEYS.job, CR_IMPORT_KEYS.jobItems, CR_IMPORT_KEYS.plan, CR_IMPORT_KEYS.input, CR_IMPORT_KEYS.resolutions]);
    return true;
  });
}

/** Ferme le bilan de la dernière tâche (jamais une tâche en cours). false si refusé. */
export function dismissCrImportJob(): Promise<boolean> {
  return withStorageLock(async () => {
    const job = await readJob();
    if (job?.status === 'running') return false;
    await chrome.storage.local.remove([CR_IMPORT_KEYS.job, CR_IMPORT_KEYS.jobItems]);
    return true;
  });
}
