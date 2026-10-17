// Activité › ligne « Écarts AniList ↔ MyAnimeList » (maquette PopupActivite) : ouvre Réglages › Mes données › Écarts,
// où se font l'analyse et l'alignement. Compteur des écarts restants après la première analyse ; affichée seulement si
// les deux comptes sont connectés.
import { t } from '../../i18n';
import { h } from '../../ui/dom';
import { icon } from '../../ui/icons';

interface CompareLinkProps {
  /** Écarts restants ; null : jamais analysé (pas de compteur) */
  count: number | null;
  onOpen: () => void;
}

export function renderCompareLink({ count, onOpen }: CompareLinkProps): HTMLElement {
  return h(
    'button',
    {
      class: 'flex w-full cursor-pointer items-center gap-3 rounded-card border border-line bg-surface px-3 py-2.5 text-left text-ink transition-colors hover:bg-raised',
      attrs: { type: 'button', 'data-focus': 'activity-compare' },
      on: { click: onOpen },
    },
    h(
      'span',
      { class: 'flex min-w-0 flex-1 flex-col' },
      h('span', { class: 'text-body font-bold' }, t('settings.compare.title')),
      h('span', { class: 'text-secondary text-muted' }, t('settings.compare.help')),
    ),
    count !== null && count > 0 && h('span', { class: 'shrink-0 rounded-pill bg-butter/16 px-2 text-secondary font-extrabold text-butter tabular-nums', attrs: { 'data-diff-count': '' } }, String(count)),
    h('span', { class: 'flex shrink-0 text-muted' }, icon('chevronRight', 'size-3.5', '2.4')),
  );
}
