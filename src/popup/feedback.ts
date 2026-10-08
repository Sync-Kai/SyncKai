import { t, type MessageKey } from '../i18n';
import { describeOutcome, type FeedbackTone } from '../shared/sync-feedback';
import type { AddListStatus, ListStatusChange, SyncOutcome } from '../shared/sync.types';
import { TRACKER_LABELS } from '../shared/tracker.types';
import type { InlineFeedback } from './state';

/** Pastilles de retour (bordure + fond teinté), partagées par « En cours » et « Activité » */
export const TONE_CHIP: Record<FeedbackTone, string> = {
  success: 'border-mint/40 bg-mint/10 text-mint',
  info: 'border-lavender/40 bg-lavender/10 text-lavender',
  warning: 'border-butter/40 bg-butter/10 text-butter',
  error: 'border-danger/40 bg-danger/10 text-danger',
};

function detailOf(outcome: SyncOutcome): string {
  const { title, message } = describeOutcome(outcome);
  return message ? `${title} — ${message}` : title;
}

/** Texte court d'un résultat de +1 / −1 (« Ép. 5 vu »), le détail complet passant en infobulle */
export function adjustFeedback(outcome: SyncOutcome, delta: 1 | -1): InlineFeedback {
  const detail = detailOf(outcome);
  switch (outcome.status) {
    case 'synced': {
      const written = outcome.results.flatMap((r) => (r.outcome.status === 'updated' || r.outcome.status === 'up-to-date' ? [r.outcome.progress] : []));
      const failed = outcome.results.filter((r) => r.outcome.status === 'error').map((r) => TRACKER_LABELS[r.service]);
      const progress = written[0];
      if (progress === undefined) {
        return { tone: failed.length > 0 ? 'error' : 'warning', text: failed.length > 0 ? t('inline.updateFailed') : t('inline.nothingChanged'), detail };
      }
      const text = t(delta === 1 ? 'inline.watched' : 'inline.backTo', { progress });
      // Succès partiel : le service en échec est nommé (relance automatique éventuelle dans le détail)
      if (failed.length > 0) return { tone: 'warning', text: t('inline.partial', { text, services: failed.join(', ') }), detail };
      return { tone: 'success', text, detail };
    }
    case 'excluded':
      return { tone: 'info', text: t('inline.excluded'), detail };
    case 'ignored':
      return { tone: 'info', text: t('feedback.ignored.title'), detail };
    case 'not-connected':
      return { tone: 'warning', text: t('feedback.notConnected.title'), detail };
    case 'needs-review':
      return { tone: 'warning', text: t('inline.toCheck'), detail };
    case 'error':
      return { tone: 'error', text: outcome.message, detail };
  }
}

const STATUS_DONE: Record<ListStatusChange, MessageKey> = {
  PAUSED: 'inline.status.PAUSED',
  DROPPED: 'inline.status.DROPPED',
  COMPLETED: 'inline.status.COMPLETED',
};

/**
 * Résultat d'un changement de statut (En pause, Abandonné, Terminé) : phrase affichée en bandeau,
 * la série quittant « En cours ». Mentionne la carte « À noter » créée après « Terminé ».
 */
export function statusFeedback(outcome: SyncOutcome, status: ListStatusChange): InlineFeedback {
  const detail = detailOf(outcome);
  // Hors « synced », mêmes textes que +1 / −1 (le sens de l'ajustement n'y intervient pas)
  if (outcome.status !== 'synced') return adjustFeedback(outcome, 1);
  const written = outcome.results.some((r) => r.outcome.status === 'updated' || r.outcome.status === 'up-to-date');
  const failed = outcome.results.filter((r) => r.outcome.status === 'error').map((r) => TRACKER_LABELS[r.service]);
  if (!written) {
    return { tone: failed.length > 0 ? 'error' : 'warning', text: failed.length > 0 ? t('inline.updateFailed') : t('inline.nothingChanged'), detail };
  }
  const done = t(STATUS_DONE[status], { title: outcome.mediaTitle });
  const text = outcome.prompts?.rate ? `${done} · ${t('inline.rateInActivity')}` : done;
  if (failed.length > 0) return { tone: 'warning', text: t('inline.partial', { text, services: failed.join(', ') }), detail };
  return { tone: 'success', text, detail };
}

/** Résultat d'un « Réessayer » de la file : phrase complète (affichée en bandeau) */
export function retryFeedback(outcome: SyncOutcome): InlineFeedback {
  const { tone, title, message } = describeOutcome(outcome);
  return { tone, text: message ? t('common.serviceMessage', { service: title, message }) : title, detail: detailOf(outcome) };
}

export function errorFeedback(text: string): InlineFeedback {
  return { tone: 'error', text, detail: text };
}

/**
 * Résultat d'une note depuis « À noter » : `ok` = la note est écrite partout (la carte part),
 * sinon `text` décrit l'échec affiché sous la carte.
 */
export function ratingFeedback(outcome: SyncOutcome, stars: string, title: string): InlineFeedback & { ok: boolean } {
  const detail = detailOf(outcome);
  if (outcome.status === 'synced') {
    const failed = outcome.results.filter((r) => r.outcome.status === 'error').map((r) => TRACKER_LABELS[r.service]);
    const written = outcome.results.some((r) => r.outcome.status === 'updated' || r.outcome.status === 'up-to-date');
    if (failed.length === 0 && written) return { ok: true, tone: 'success', text: t('inline.ratingSaved', { stars, title }), detail };
    if (failed.length > 0) return { ok: false, tone: 'error', text: t('inline.ratingFailedOn', { services: failed.join(', ') }), detail };
    return { ok: false, tone: 'warning', text: t('inline.nothingSaved'), detail };
  }
  if (outcome.status === 'error') return { ok: false, tone: 'error', text: outcome.message, detail };
  return { ok: false, tone: 'warning', text: describeOutcome(outcome).title, detail };
}

const ADDED: Record<AddListStatus, MessageKey> = {
  PLANNING: 'page.added.PLANNING',
  CURRENT: 'page.added.CURRENT',
};

/**
 * Résultat d'un ajout depuis la carte « Sur cette page » : « Ajoutée à À regarder », ou
 * « Déjà dans ta liste » si chaque service l'avait déjà (rien n'est écrasé).
 */
export function addFeedback(outcome: SyncOutcome, status: AddListStatus): InlineFeedback {
  const detail = detailOf(outcome);
  if (outcome.status !== 'synced') return adjustFeedback(outcome, 1);
  const added = outcome.results.some((r) => r.outcome.status === 'updated');
  const failed = outcome.results.filter((r) => r.outcome.status === 'error').map((r) => TRACKER_LABELS[r.service]);
  if (!added) {
    return failed.length > 0 ? { tone: 'error', text: t('inline.updateFailed'), detail } : { tone: 'info', text: t('page.alreadyInList'), detail };
  }
  const text = t(ADDED[status]);
  if (failed.length > 0) return { tone: 'warning', text: t('inline.partial', { text, services: failed.join(', ') }), detail };
  return { tone: 'success', text, detail };
}
