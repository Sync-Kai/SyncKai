import { t, type MessageKey } from '../i18n';
import type { ListStatusChange } from '../shared/sync.types';
import { h } from './dom';
import { icon } from './icons';

// Statut depuis le popup (En pause, Abandonner, Terminé) : libellés, icônes et confirmation en ligne,
// partagés par le menu « … » de « En cours » et la carte « Sur cette page ».

export const STATUS_LABELS: Record<ListStatusChange, MessageKey> = {
  PAUSED: 'watching.status.PAUSED',
  DROPPED: 'watching.status.DROPPED',
  COMPLETED: 'watching.status.COMPLETED',
};

export const STATUS_ICONS: Record<ListStatusChange, () => SVGSVGElement> = {
  PAUSED: () => icon('pause', 'h-3.5 w-3.5 text-butter', '2.6'),
  DROPPED: () => icon('xCircle', 'h-3.5 w-3.5 text-danger'),
  COMPLETED: () => icon('checkCircle', 'h-3.5 w-3.5 text-mint'),
};

/** Statuts confirmés avant l'envoi (Abandonner retire la série, Terminé avance la progression) */
export type ConfirmedStatus = Exclude<ListStatusChange, 'PAUSED'>;

export function needsConfirm(status: ListStatusChange): status is ConfirmedStatus {
  return status !== 'PAUSED';
}

const CONFIRM_LABELS: Record<ConfirmedStatus, MessageKey> = {
  DROPPED: 'watching.confirm.DROPPED',
  COMPLETED: 'watching.confirm.COMPLETED',
};

const CONFIRM_BTN = 'inline-flex h-7 shrink-0 cursor-pointer items-center rounded-full px-2.5 text-[11px] font-bold transition hover:brightness-110 focus-visible:outline-2';

interface StatusConfirmProps {
  status: ConfirmedStatus;
  /** Suffixe des clés de focus : `confirm-yes-${focusKey}` / `confirm-no-${focusKey}` */
  focusKey: string;
  /** Dans un menu : Oui / Non restent des `menuitem` (navigation aux flèches du menu) */
  inMenu: boolean;
  onYes: () => void;
  onNo: () => void;
}

/** Confirmation en ligne : « Abandonner ? Oui / Non » */
export function renderStatusConfirm({ status, focusKey, inMenu, onYes, onNo }: StatusConfirmProps): HTMLElement {
  const action = t(STATUS_LABELS[status]);
  const menuAttrs: Record<string, string> = inMenu ? { role: 'menuitem', tabindex: '-1' } : {};
  return h(
    'div',
    {
      class: 'flex min-h-8 min-w-0 items-center gap-1.5 rounded-lg bg-raised px-2 py-0.5',
      attrs: { role: 'group', 'aria-label': action },
      // Hors menu (carte de la page) : Échap annule la confirmation sans fermer le popup
      on: inMenu
        ? {}
        : {
            keydown: (event) => {
              if (event.key !== 'Escape') return;
              event.preventDefault();
              event.stopPropagation();
              onNo();
            },
          },
    },
    STATUS_ICONS[status](),
    h('span', { class: 'min-w-0 flex-1 truncate text-[12px] font-bold text-ink' }, t(CONFIRM_LABELS[status])),
    h(
      'button',
      {
        class: `${CONFIRM_BTN} ${status === 'DROPPED' ? 'bg-danger' : 'bg-mint'} text-on-fill`,
        attrs: { type: 'button', ...menuAttrs, 'data-focus': `confirm-yes-${focusKey}`, 'aria-label': t('watching.confirm.yesAria', { action }) },
        on: { click: onYes },
      },
      t('watching.confirm.yes'),
    ),
    h(
      'button',
      {
        class: `${CONFIRM_BTN} border border-line text-ink`,
        attrs: { type: 'button', ...menuAttrs, 'data-focus': `confirm-no-${focusKey}`, 'aria-label': t('watching.confirm.noAria', { action }) },
        on: { click: onNo },
      },
      t('watching.confirm.no'),
    ),
  );
}
