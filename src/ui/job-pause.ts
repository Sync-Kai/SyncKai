import { t, type MessageKey } from '../i18n';
import { pauseSecondsLeft, type AnyJob } from '../shared/job';
import { TRACKER_LABELS } from '../shared/tracker.types';
import { h } from './dom';
import { icon } from './icons';

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

/**
 * Ligne de pause (horloge + texte). Le texte est mis à jour en place chaque seconde par `tickJobPause`, sans nouveau
 * rendu de la page ; pas de région live : un compte à rebours ne doit pas être relu à chaque seconde.
 */
export function renderJobPause(text: string, className: string, withIcon = true): HTMLElement {
  return h('p', { class: className }, withIcon && icon('clock', 'h-3 w-3 shrink-0'), h('span', { attrs: { 'data-job-pause': '' } }, text));
}

/** Met à jour le compte à rebours des lignes de pause de `root` (texte modifié seulement s'il change) */
export function tickJobPause(root: ParentNode, job: AnyJob, now: number, fallbackService = ''): void {
  const text = jobPauseText(job, now, fallbackService);
  if (text === null) return;
  for (const el of root.querySelectorAll('[data-job-pause]')) {
    if (el.textContent !== text) el.textContent = text;
  }
}
