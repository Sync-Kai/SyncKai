import { t, type MessageKey } from '../i18n';
import { pauseSecondsLeft, type AnyJob } from '../shared/job';
import { TRACKER_LABELS } from '../shared/tracker.types';

/**
 * Texte de la pause en cours d'une tâche de fond (comparaison des listes, import Crunchyroll), compte à rebours
 * recalculé par la page chaque seconde. Quota AniList sans fin estimée (requête interactive en cours) : « … ».
 */
export function jobPauseText(job: AnyJob, now: number, fallbackService = ''): string | null {
  if (job.pausedUntil === null || job.pauseReason === null) return null;
  if (job.pauseReason === 'resume') return t('compare.pause.resume');
  const seconds = pauseSecondsLeft(job, now);
  if (job.pauseReason === 'budget') return seconds > 0 ? t('compare.pause.budget', { seconds }) : t('compare.pause.budgetUnknown');
  const service = job.pauseService ? TRACKER_LABELS[job.pauseService] : fallbackService;
  return t(`compare.pause.${job.pauseReason}` satisfies MessageKey, { service, seconds });
}
