import { t } from '../../i18n';
import { h } from '../../ui/dom';
import { warnIcon } from '../../ui/icons';
import { alertAttrs } from '../../ui/live-region';
import type { HostAccessState } from '../state';

interface HostAccessBannerProps {
  state: HostAccessState;
  onAllow: () => void;
}

/** Bandeau compact « pas d'accès à Crunchyroll / ADN » (Firefox : accès aux sites retiré) ; null si l'accès est accordé */
export function renderHostAccessBanner({ state, onAllow }: HostAccessBannerProps): HTMLElement | null {
  if (state.status !== 'missing') return null;
  const message = state.denied ? `${t('popup.hostAccessMissing')} ${t('popup.hostAccessDenied')}` : t('popup.hostAccessMissing');
  return h(
    'div',
    {
      class: 'mx-4 mt-1 flex items-start gap-2 rounded-lg border border-butter/40 bg-butter/10 px-3 py-2 text-[12px] text-butter',
      // Bandeau mémoïsé par le popup : annoncé une fois, puis à nouveau seulement si son texte change
      attrs: alertAttrs(message),
    },
    warnIcon('mt-px h-3.5 w-3.5 text-butter'),
    h(
      'div',
      { class: 'min-w-0 flex-1' },
      h('p', { class: 'break-words font-bold' }, t('popup.hostAccessMissing')),
      state.denied && h('p', { class: 'mt-0.5 break-words text-muted' }, t('popup.hostAccessDenied')),
    ),
    h(
      'button',
      {
        class: 'shrink-0 cursor-pointer rounded-full bg-butter px-2.5 py-0.5 font-bold text-on-fill transition-opacity hover:opacity-90',
        attrs: { type: 'button', 'data-focus': 'host-access' },
        on: { click: onAllow },
      },
      t('popup.hostAccessAllow'),
    ),
  );
}
