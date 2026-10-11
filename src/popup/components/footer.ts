import { t, tp } from '../../i18n';
import { TRACKER_LABELS, type TrackerId } from '../../shared/tracker.types';
import { h } from '../../ui/dom';
import { icon, warnIcon } from '../../ui/icons';
import { serviceAvatar } from '../../ui/kit';

export type FooterStatus =
  | { kind: 'none' }
  | { kind: 'pending'; count: number }
  /** Synchros de la file : abandonnées (à traiter) ou en attente de relance automatique */
  | { kind: 'queue-failed'; count: number }
  | { kind: 'queue-pending'; count: number }
  | { kind: 'expired'; service: TrackerId }
  /** Séries terminées dont la note a été reportée (Activité › À noter) */
  | { kind: 'to-rate'; count: number }
  | { kind: 'ok'; relative: string | null };

interface FooterProps {
  version: string;
  /** Services affichés en pastille, avec leur état */
  chips: readonly { service: TrackerId; state: 'ok' | 'expired' }[];
  status: FooterStatus;
  onOpenSettings: () => void;
  onOpenActivity: () => void;
  onReconnect: (service: TrackerId) => void;
}

function renderStatus({ status, onOpenActivity, onReconnect }: FooterProps): HTMLElement {
  const box = 'flex min-w-0 flex-1 items-center justify-center gap-1 text-[12px] font-semibold whitespace-nowrap';
  switch (status.kind) {
    case 'none':
      return h(
        'div',
        { class: `${box} justify-start gap-2 text-muted`, attrs: { role: 'status' } },
        h('span', { class: 'h-2 w-2 shrink-0 rounded-full bg-muted opacity-60', attrs: { 'aria-hidden': 'true' } }),
        h('span', { class: 'truncate' }, t('feedback.notConnected.title')),
      );
    case 'pending': {
      const label = tp('footer.toReview', status.count);
      return h(
        'div',
        { class: box, attrs: { role: 'status' } },
        h(
          'button',
          {
            class: 'flex h-8 min-w-0 cursor-pointer items-center gap-1 rounded-full px-2 text-butter transition-colors hover:bg-raised',
            attrs: { type: 'button', 'data-focus': 'footer-pending' },
            on: { click: onOpenActivity },
          },
          warnIcon('h-3.5 w-3.5 text-butter'),
          h('span', { class: 'truncate' }, label),
        ),
      );
    }
    case 'queue-failed':
    case 'queue-pending': {
      const failed = status.kind === 'queue-failed';
      const label = tp(failed ? 'footer.queueFailed' : 'footer.queuePending', status.count);
      return h(
        'div',
        { class: box, attrs: { role: 'status' } },
        h(
          'button',
          {
            class: `flex h-8 min-w-0 cursor-pointer items-center gap-1 rounded-full px-2 transition-colors hover:bg-raised ${failed ? 'text-danger' : 'text-lavender'}`,
            attrs: { type: 'button', 'aria-label': t('footer.seeActivity', { label }), 'data-focus': 'footer-queue' },
            on: { click: onOpenActivity },
          },
          icon(failed ? 'alert' : 'clock', 'h-3.5 w-3.5'),
          h('span', { class: 'truncate' }, label),
        ),
      );
    }
    case 'to-rate': {
      const label = tp('footer.toRate', status.count);
      return h(
        'div',
        { class: box, attrs: { role: 'status' } },
        h(
          'button',
          {
            class: 'flex h-8 min-w-0 cursor-pointer items-center gap-1 rounded-full px-2 text-sakura transition-colors hover:bg-raised',
            attrs: { type: 'button', 'aria-label': t('footer.seeActivity', { label }), 'data-focus': 'footer-rate' },
            on: { click: onOpenActivity },
          },
          icon('star', 'h-3.5 w-3.5'),
          h('span', { class: 'truncate' }, label),
        ),
      );
    }
    case 'expired':
      return h(
        'div',
        { class: `${box} gap-2`, attrs: { role: 'status' } },
        h('span', { class: 'flex min-w-0 items-center gap-1 text-danger' }, icon('alert', 'h-3.5 w-3.5'), h('span', { class: 'truncate' }, t('common.sessionExpired'))),
        h(
          'button',
          {
            class: 'h-8 shrink-0 cursor-pointer rounded-full px-2 font-bold text-sakura transition-colors hover:bg-raised',
            attrs: { type: 'button', 'aria-label': t('common.reconnectService', { service: TRACKER_LABELS[status.service] }), 'data-focus': 'footer-reconnect' },
            on: { click: () => onReconnect(status.service) },
          },
          t('common.reconnect'),
        ),
      );
    case 'ok':
      return h(
        'div',
        { class: box, attrs: { role: 'status' } },
        icon('check', 'h-3.5 w-3.5 text-mint', '3'),
        h('span', { class: 'truncate' }, t('footer.allSynced'), status.relative && h('span', { class: 'text-muted' }, ` · ${status.relative}`)),
      );
  }
}

/** Barre d'état : comptes, état de synchronisation, version */
export function renderFooter(props: FooterProps): HTMLElement {
  return h(
    'footer',
    { class: 'flex h-[52px] shrink-0 items-center gap-2 border-t border-dotted border-line bg-surface px-4' },
    props.chips.length > 0 &&
      h(
        'div',
        { class: 'flex shrink-0 items-center gap-1' },
        ...props.chips.map(({ service, state }) =>
          h(
            'button',
            {
              class: 'cursor-pointer rounded-full transition hover:brightness-110',
              attrs: {
                type: 'button',
                'aria-label': t(state === 'ok' ? 'footer.chip.ok' : 'footer.chip.expired', { service: TRACKER_LABELS[service] }),
                'data-focus': `chip-${service}`,
              },
              on: { click: props.onOpenSettings },
            },
            serviceAvatar(service, state),
          ),
        ),
      ),
    renderStatus(props),
    h('span', { class: 'shrink-0 text-[10px] font-semibold text-muted' }, `v${props.version}`),
  );
}
