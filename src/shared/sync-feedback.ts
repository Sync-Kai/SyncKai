import { lowerFirst, t } from '../i18n';
import type { ServiceOutcome, ServiceResult, SyncOutcome } from './sync.types';
import { TRACKER_LABELS } from './tracker.types';

export type FeedbackTone = 'info' | 'success' | 'warning' | 'error';

export interface SyncFeedback {
  tone: FeedbackTone;
  title: string;
  message?: string;
}

/** "AniList : épisode 5 enregistré" */
export function describeServiceOutcome(outcome: ServiceOutcome): string {
  switch (outcome.status) {
    case 'updated':
      return t(outcome.completed ? 'feedback.service.completed' : 'feedback.service.updated', { progress: outcome.progress });
    case 'up-to-date':
      return t('feedback.service.upToDate', { progress: outcome.progress });
    case 'skipped':
      return lowerFirst(outcome.reason);
    case 'error':
      return t('feedback.service.error', { message: outcome.message });
  }
}

/** Ton global : une erreur l'emporte, puis un service ignoré, sinon succès */
function toneOf(results: ServiceResult[]): FeedbackTone {
  if (results.some((r) => r.outcome.status === 'error')) return 'error';
  if (results.some((r) => r.outcome.status === 'skipped')) return 'warning';
  return 'success';
}

/** Texte affiché pour un résultat de synchronisation (toast de la page et popup). */
export function describeOutcome(outcome: SyncOutcome): SyncFeedback {
  switch (outcome.status) {
    case 'synced': {
      const isCompleted = outcome.results.some((r) => r.outcome.status === 'updated' && r.outcome.completed);
      return {
        tone: toneOf(outcome.results),
        title: isCompleted ? t('feedback.completedTitle', { title: outcome.mediaTitle }) : outcome.mediaTitle,
        message:
          outcome.results
            .map((r) => t('common.serviceMessage', { service: TRACKER_LABELS[r.service], message: describeServiceOutcome(r.outcome) }))
            .join(' · ') + (outcome.queued ? t('feedback.queuedSuffix') : ''),
      };
    }
    case 'needs-review':
      return { tone: 'warning', title: t('feedback.review.title'), message: t('feedback.review.message', { reason: outcome.reason }) };
    case 'not-connected':
      return { tone: 'warning', title: t('feedback.notConnected.title'), message: t('feedback.notConnected.message') };
    case 'excluded':
      return { tone: 'info', title: outcome.mediaTitle, message: t('feedback.excluded') };
    case 'ignored':
      return { tone: 'info', title: t('feedback.ignored.title'), message: t('feedback.ignored.message') };
    case 'error':
      return {
        tone: 'error',
        title: t('feedback.error.title'),
        message: outcome.queued ? t('feedback.error.queued', { message: outcome.message }) : outcome.message,
      };
  }
}
