import { t, tp, type MessageKey } from '../i18n';
import { isRecord } from './guards';
import { formatRelativeTime } from './watching';

/** Clé de stockage du dernier résumé de vérification des sorties (définie dans airing-keys.ts) */
export { AIRING_RESULT_KEY } from './airing-keys';

export type AiringSkipReason = 'disabled' | 'not-connected' | 'no-series';

/** Résumé d'une vérification des nouveaux épisodes (alarme horaire ou « Vérifier maintenant ») */
export interface AiringCheckResult {
  /** Horodatage de la vérification (ms) */
  checkedAt: number;
  notified: number;
  skipped: AiringSkipReason | null;
  error: string | null;
}

const SKIP_REASONS: readonly AiringSkipReason[] = ['disabled', 'not-connected', 'no-series'];

export function isAiringCheckResult(value: unknown): value is AiringCheckResult {
  return (
    isRecord(value) &&
    typeof value.checkedAt === 'number' &&
    Number.isFinite(value.checkedAt) &&
    typeof value.notified === 'number' &&
    Number.isInteger(value.notified) &&
    value.notified >= 0 &&
    (value.skipped === null || SKIP_REASONS.some((reason) => reason === value.skipped)) &&
    (value.error === null || typeof value.error === 'string')
  );
}

const SKIP_LABELS: Record<AiringSkipReason, MessageKey> = {
  disabled: 'airing.skip.disabled',
  'not-connected': 'airing.skip.notConnected',
  'no-series': 'airing.skip.noSeries',
};

export interface AiringStatusLine {
  text: string;
  tone: 'muted' | 'danger';
}

/** Ligne d'état affichée dans Réglages › Nouveaux épisodes */
export function formatAiringStatus(result: AiringCheckResult | null, now: number): AiringStatusLine {
  if (!result) return { text: t('airing.status.never'), tone: 'muted' };
  const prefix = t('airing.status.last', { relative: formatRelativeTime(result.checkedAt, now) });
  if (result.error !== null) return { text: `${prefix} · ${t('airing.status.failed', { error: result.error })}`, tone: 'danger' };
  if (result.skipped !== null) return { text: `${prefix} · ${t(SKIP_LABELS[result.skipped])}`, tone: 'muted' };
  if (result.notified === 0) return { text: `${prefix} · ${t('airing.status.none')}`, tone: 'muted' };
  return { text: `${prefix} · ${tp('airing.status.notified', result.notified)}`, tone: 'muted' };
}
