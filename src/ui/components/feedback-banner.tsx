// Retour d'une action dans une carte (maquette PopupPageRetours) : bandeau teinté du ton (mint réussi, lavande info,
// beurre rien de fait, danger échec) avec son icône, texte complet, détail par service en infobulle et « Réessayer »
// facultatif (échec partiel d'un + / −). Annoncé (role="status", role="alert" pour un échec). Carte « Sur cette page »
// du popup, prévu pour le panneau.
import type { FeedbackTone } from '../../shared/sync-feedback';
import type { IconName } from '../icons';
import { Button } from './button';
import { Icon } from './icon';

export interface FeedbackBannerProps {
  tone: FeedbackTone;
  text: string;
  /** Détail par service (infobulle) */
  detail?: string;
  /** « Réessayer » ; `ariaLabel` nomme les services en échec */
  retry?: { label: string; ariaLabel: string; onClick: () => void; disabled?: boolean } | null;
  /** data-focus du bouton « Réessayer » */
  focusKey?: string;
}

const TONES: Readonly<Record<FeedbackTone, string>> = {
  success: 'border-mint/40 bg-mint/10 text-mint',
  info: 'border-lavender/40 bg-lavender/10 text-lavender',
  warning: 'border-butter/40 bg-butter/10 text-butter',
  error: 'border-danger/40 bg-danger/10 text-danger',
};

const ICONS: Readonly<Record<FeedbackTone, IconName>> = { success: 'check', info: 'info', warning: 'alert', error: 'alert' };

export function FeedbackBanner({ tone, text, detail, retry, focusKey }: FeedbackBannerProps) {
  return (
    <div class={`flex min-w-0 items-center gap-2 rounded-panel border px-2.5 py-2 ${TONES[tone]}`} role={tone === 'error' ? 'alert' : 'status'} title={detail} data-feedback={tone}>
      <span class="flex min-w-0 flex-1 items-start gap-1.5 text-secondary font-bold">
        <span class="flex shrink-0 pt-0.5">
          <Icon name={ICONS[tone]} class="size-3.5" strokeWidth={tone === 'success' ? '3' : '2.4'} />
        </span>
        <span class="min-w-0 break-words">{text}</span>
      </span>
      {retry && (
        <Button size="sm" disabled={retry.disabled} ariaLabel={retry.ariaLabel} focusKey={focusKey} onClick={retry.onClick}>
          {retry.label}
        </Button>
      )}
    </div>
  );
}
