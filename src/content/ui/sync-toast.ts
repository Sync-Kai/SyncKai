import { lowerFirst, t } from '../../i18n';
import type { NotificationLevel } from '../../shared/settings';
import { describeOutcome, describeServiceOutcome } from '../../shared/sync-feedback';
import type { ServiceOutcome, ServiceResult, SyncOutcome } from '../../shared/sync.types';
import { TRACKER_LABELS } from '../../shared/tracker.types';
import { decideExcludedNotification, decideNotification, isAlertTone } from './notification-policy';
import type { ToastContent, ToastLine, ToastLineTone, ToastVariant } from './toast';

export const PILL_TOAST_MS = 3_000;
export const SUCCESS_TOAST_MS = 5_000;
export const ALERT_TOAST_MS = 9_000;
/** Toast d'erreur avec "Réessayer" : laissé plus longtemps pour avoir le temps de cliquer */
export const RETRY_TOAST_MS = 15_000;

export interface OutcomeToast {
  content: ToastContent;
  variant: ToastVariant;
  autoHideMs: number;
}

const LINE_TONES: Record<ServiceOutcome['status'], ToastLineTone> = {
  updated: 'ok',
  'up-to-date': 'neutral',
  skipped: 'warning',
  error: 'error',
};

/** Une ligne par service : "AniList · épisode 2 enregistré" */
function serviceLines(outcome: SyncOutcome): ToastLine[] | undefined {
  if (outcome.status !== 'synced') return undefined;
  return outcome.results.map((r) => ({
    label: TRACKER_LABELS[r.service],
    text: describeServiceOutcome(r.outcome),
    tone: LINE_TONES[r.outcome.status],
  }));
}

/** Pastille compacte : "Ép. 2 enregistré · Tougen Anki" (premier service réellement mis à jour) */
export function pillForOutcome(outcome: SyncOutcome): ToastContent {
  if (outcome.status !== 'synced') return { ...describeOutcome(outcome) };
  const updated = outcome.results.find((r) => r.outcome.status === 'updated')?.outcome;
  if (updated?.status === 'updated') {
    return { tone: 'success', title: t('toast.pill.saved', { episode: updated.progress }), message: outcome.mediaTitle };
  }
  // Aucun service modifié (tout déjà à jour) : on le dit sans inventer d'écriture
  const upToDate = outcome.results.find((r) => r.outcome.status === 'up-to-date')?.outcome;
  const title = upToDate?.status === 'up-to-date' ? t('toast.pill.upToDate', { episode: upToDate.progress }) : t('toast.pill.alreadyUpToDate');
  return { tone: 'success', title, message: outcome.mediaTitle };
}

/** Bulle complète : titre + détail par service (ou message pour les autres statuts) */
export function bubbleForOutcome(outcome: SyncOutcome): ToastContent {
  const feedback = describeOutcome(outcome);
  const lines = serviceLines(outcome);
  return lines ? { tone: feedback.tone, title: feedback.title, lines } : { ...feedback };
}

/**
 * Traduit le résultat d'une synchronisation en toast selon le niveau de notification.
 * `null` : rien à afficher (succès en mode "alertes seulement", discret en plein écran, ou série ignorée).
 */
export function toastForOutcome(outcome: SyncOutcome, level: NotificationLevel, isFullscreen: boolean): OutcomeToast | null {
  // Série hors périmètre (Netflix, pas un anime) : jamais signalée, quel que soit le niveau
  if (outcome.status === 'ignored') return null;
  const tone = describeOutcome(outcome).tone;
  const display = outcome.status === 'excluded' ? decideExcludedNotification(level) : decideNotification(level, tone, isFullscreen);
  switch (display) {
    case 'none':
      return null;
    case 'pill':
      return { content: pillForOutcome(outcome), variant: 'pill', autoHideMs: PILL_TOAST_MS };
    case 'bubble':
      return { content: bubbleForOutcome(outcome), variant: 'bubble', autoHideMs: isAlertTone(tone) ? ALERT_TOAST_MS : SUCCESS_TOAST_MS };
  }
}

// ─── Note de fin de série et revisionnage ───────────────────────────────────

/** Bulle de note : sans réponse au bout de 20 s, la note est reportée (carte « À noter ») */
export const RATING_PROMPT_MS = 20_000;
/** Bulle de revisionnage : sans réponse au bout de 15 s, rien n'est fait */
export const REWATCH_PROMPT_MS = 15_000;

export interface EngagementResultCopy {
  /** Pastille de succès : « Note 8,5/10 enregistrée » */
  success: string;
  /** Titre de la bulle d'échec : « Note non enregistrée » */
  failure: string;
  mediaTitle: string;
}

function engagementLine(result: ServiceResult): ToastLine {
  const { outcome } = result;
  const label = TRACKER_LABELS[result.service];
  switch (outcome.status) {
    case 'updated':
    case 'up-to-date':
      return { label, text: t('toast.line.saved'), tone: 'ok' };
    case 'skipped':
      return { label, text: lowerFirst(outcome.reason), tone: 'warning' };
    case 'error':
      return { label, text: t('feedback.service.error', { message: outcome.message }), tone: 'error' };
  }
}

/**
 * Résultat d'une note ou d'un revisionnage : pastille si tous les services ont réussi,
 * sinon bulle (détail par service) ; `ok` = rien à relancer.
 */
export function engagementResultToast(outcome: SyncOutcome, copy: EngagementResultCopy): OutcomeToast & { ok: boolean } {
  if (outcome.status === 'synced') {
    const written = outcome.results.filter((r) => r.outcome.status === 'updated' || r.outcome.status === 'up-to-date').length;
    if (written > 0 && written === outcome.results.length) {
      return { ok: true, content: { tone: 'success', title: copy.success, message: copy.mediaTitle }, variant: 'pill', autoHideMs: PILL_TOAST_MS };
    }
    const failed = outcome.results.some((r) => r.outcome.status === 'error');
    return {
      ok: !failed,
      content: { tone: written > 0 || !failed ? 'warning' : 'error', title: copy.failure, message: copy.mediaTitle, lines: outcome.results.map(engagementLine) },
      variant: 'bubble',
      autoHideMs: failed ? RETRY_TOAST_MS : ALERT_TOAST_MS,
    };
  }
  const message = outcome.status === 'error' ? outcome.message : (describeOutcome(outcome).message ?? copy.mediaTitle);
  return { ok: false, content: { tone: 'error', title: copy.failure, message }, variant: 'bubble', autoHideMs: RETRY_TOAST_MS };
}
