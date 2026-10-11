import { t, type MessageKey } from '../../i18n';
import { TRACKER_LABELS, type TrackerId } from '../../shared/tracker.types';
import { h, nodes } from '../../ui/dom';
import { icon, kai } from '../../ui/icons';
import type { AccountState } from '../../ui/state';
import { renderAlert } from '../../ui/alert';
import { kanaLabel, serviceAvatar } from '../../ui/kit';

interface OnboardingProps {
  anilist: AccountState<unknown>;
  mal: AccountState<unknown>;
  onLogin: (service: TrackerId) => void;
}

const HINTS: Record<TrackerId, MessageKey> = {
  anilist: 'onboarding.hint.anilist',
  mal: 'onboarding.hint.mal',
};

function renderConnect(service: TrackerId, state: AccountState<unknown>, onLogin: (service: TrackerId) => void): HTMLElement[] {
  const pending = state.status === 'logged-out' && state.pending;
  const expired = state.status === 'logged-out' && state.expired;
  const button = h(
    'button',
    {
      class:
        'flex h-14 w-full cursor-pointer items-center gap-3 rounded-card border border-line bg-surface px-3 text-left text-ink transition hover:bg-raised hover:shadow-pop motion-safe:hover:-translate-px disabled:cursor-wait disabled:opacity-70',
      attrs: { type: 'button', 'data-focus': `connect-${service}`, ...(pending ? { disabled: '', 'aria-busy': 'true' } : {}) },
      on: { click: () => onLogin(service) },
    },
    serviceAvatar(service, expired ? 'expired' : null),
    h(
      'span',
      { class: 'flex min-w-0 flex-1 flex-col' },
      h(
        'span',
        { class: 'text-[14px] leading-[18px] font-bold' },
        pending ? t('common.connecting') : t(expired ? 'common.reconnectService' : 'common.connectService', { service: TRACKER_LABELS[service] }),
      ),
      h('span', { class: `text-[11px] leading-[15px] font-semibold ${expired ? 'text-danger' : 'text-muted'}` }, expired ? t('common.sessionExpired') : t(HINTS[service])),
    ),
    pending ? icon('spinner', 'h-4 w-4 text-muted motion-safe:animate-spin') : icon('chevronRight', 'h-4 w-4 text-muted', '2.4'),
  );
  const error = state.status === 'logged-out' && state.error;
  return nodes([button, error && renderAlert({ message: error })]).filter((n): n is HTMLElement => n instanceof HTMLElement);
}

/** Écran d'accueil : aucun compte connecté */
export function renderOnboarding({ anilist, mal, onLogin }: OnboardingProps): HTMLElement {
  const step = (n: number, text: string): HTMLElement =>
    h(
      'li',
      { class: 'flex flex-1 flex-col items-center gap-1 text-center' },
      h('span', { class: 'flex h-5 w-5 items-center justify-center rounded-full bg-sakura text-[11px] font-bold text-on-fill', attrs: { 'aria-hidden': 'true' } }, String(n)),
      h('span', { class: 'text-[11px] leading-[14px] font-semibold text-muted' }, text),
    );

  return h(
    'div',
    { class: 'flex min-h-full flex-col gap-4 pt-1' },
    h(
      'section',
      { class: 'flex flex-col items-center gap-1 pt-2 text-center', attrs: { 'aria-labelledby': 'sk-welcome-title' } },
      kai('h-16 w-16', { expression: 'happy', size: 'large', squish: true }),
      h('span', { class: 'mt-2' }, kanaLabel('ヨウコソ', 'text-sakura')),
      h('h1', { class: 'm-0 font-display text-[20px] leading-[26px] font-extrabold', attrs: { id: 'sk-welcome-title' } }, t('onboarding.welcome')),
      h('p', { class: 'm-0 mt-1 max-w-[320px] text-[13px] leading-[19px] font-semibold text-muted' }, t('onboarding.intro')),
    ),
    h('div', { class: 'flex flex-col gap-2' }, ...renderConnect('anilist', anilist, onLogin), ...renderConnect('mal', mal, onLogin)),
    h(
      'ol',
      { class: 'm-0 mt-auto flex list-none gap-2 border-t border-dotted border-line px-2 py-3', attrs: { 'aria-label': t('onboarding.howItWorks') } },
      step(1, t('onboarding.step1')),
      step(2, t('onboarding.step2')),
      step(3, t('onboarding.step3')),
    ),
  );
}
