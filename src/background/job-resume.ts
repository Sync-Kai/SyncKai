import { COMPARE_JOB_ALARM } from '../shared/compare-job';
import { CR_IMPORT_ALARM } from '../shared/cr-import';
import { resumeCompareJob } from './compare';
import { resumeCrImport } from './cr-import';

// Reprise des tâches de fond (alignement AniList ↔ MAL, import de l'historique Crunchyroll) : par leur alarme, au
// démarrage du navigateur ET à l'installation ou la mise à jour de l'extension. Une mise à jour redémarre le service
// worker (la boucle en mémoire meurt) et Chrome ne garantit pas les alarmes : sans reprise ici, la tâche restait
// « en cours » jusqu'au prochain démarrage du navigateur (ARCH-14). Aucun réveil supplémentaire.

/** `afterI18n` : exécute la reprise une fois la langue chargée (messages des tâches traduits) */
export function listenJobResume(afterI18n: (run: () => unknown) => void): void {
  chrome.alarms.onAlarm.addListener((alarm): void => {
    if (alarm.name === COMPARE_JOB_ALARM) afterI18n(resumeCompareJob);
    else if (alarm.name === CR_IMPORT_ALARM) afterI18n(resumeCrImport);
  });
  const resumeAll = (): void => {
    afterI18n(resumeCompareJob);
    afterI18n(resumeCrImport);
  };
  chrome.runtime.onStartup.addListener(resumeAll);
  chrome.runtime.onInstalled.addListener(resumeAll);
}
