import { t } from '../i18n';
import { h, nodes } from './dom';
import { icon } from './icons';
import { onMenuKeyDown } from './menu';

// « Retirer de la liste » : confirmation en ligne (menu « ⋯ » de « En cours » dans le popup, menu de « Ta progression »
// dans le panneau) et menu « ⋯ » de la carte du panneau.

const CONFIRM_BTN = 'inline-flex h-7 shrink-0 cursor-pointer items-center rounded-full px-2.5 text-[11px] font-bold transition hover:brightness-110 focus-visible:outline-2';

/** Icône de l'action (rouge : retrait de la liste de chaque compte connecté) */
export const removeIcon = (): SVGSVGElement => icon('trash', 'h-3.5 w-3.5 text-danger');

interface RemoveConfirmProps {
  /** Suffixe des clés de focus : `confirm-yes-${focusKey}` / `confirm-no-${focusKey}` (comme la confirmation de statut) */
  focusKey: string;
  title: string;
  /** Dans un menu : Retirer / Annuler restent des `menuitem` (navigation aux flèches du menu) */
  inMenu: boolean;
  onYes: () => void;
  onNo: () => void;
}

/** Confirmation en ligne : « Retirer de ta liste ? Retirer / Annuler » (infobulle : retirée de chaque compte connecté) */
export function renderRemoveConfirm({ focusKey, title, inMenu, onYes, onNo }: RemoveConfirmProps): HTMLElement {
  const menuAttrs: Record<string, string> = inMenu ? { role: 'menuitem', tabindex: '-1' } : {};
  return h(
    'div',
    {
      class: 'flex min-w-0 flex-col gap-1.5 rounded-lg bg-raised px-2 py-1.5',
      attrs: { role: 'group', 'aria-label': t('list.remove'), title: t('list.remove.detail') },
      // Hors menu : Échap annule la confirmation sans fermer le popup ni le panneau
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
    h('span', { class: 'flex min-w-0 items-center gap-1.5 text-[12px] font-bold text-ink' }, removeIcon(), h('span', { class: 'min-w-0 truncate' }, t('list.remove.confirm'))),
    h(
      'span',
      { class: 'flex justify-end gap-1.5' },
      h(
        'button',
        {
          class: `${CONFIRM_BTN} bg-danger text-on-fill`,
          attrs: { type: 'button', ...menuAttrs, 'data-focus': `confirm-yes-${focusKey}`, 'aria-label': t('list.remove.yesAria', { title }) },
          on: { click: onYes },
        },
        t('list.remove.yes'),
      ),
      h(
        'button',
        {
          class: `${CONFIRM_BTN} border border-line text-ink`,
          attrs: { type: 'button', ...menuAttrs, 'data-focus': `confirm-no-${focusKey}`, 'aria-label': t('list.remove.noAria', { title }) },
          on: { click: onNo },
        },
        t('common.cancel'),
      ),
    ),
  );
}

export interface CardMenuProps {
  open: boolean;
  /** Confirmation du retrait affichée dans le menu */
  confirming: boolean;
  /** Autre action en cours sur la fiche : retrait indisponible */
  busy: boolean;
  /** Retrait en cours : spinner sur le bouton « ⋯ » */
  removing: boolean;
  title: string;
  /** Suffixe des clés de focus et de l'identifiant du menu */
  focusKey: string;
  onToggle: (open: boolean) => void;
  onConfirm: (confirming: boolean) => void;
  onRemove: () => void;
}

/** Bouton « ⋯ » et menu d'une carte (« Ta progression » du panneau) : « Retirer de la liste », confirmé en ligne */
export function renderCardMenu(props: CardMenuProps): HTMLElement {
  const { open, focusKey, title } = props;
  const menuId = `sk-card-menu-${focusKey}`;
  const close = (): void => props.onToggle(false);
  const trigger = h(
    'button',
    {
      class: `flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full bg-raised transition hover:brightness-125 ${open ? 'text-ink' : 'text-muted'}`,
      attrs: {
        type: 'button',
        'aria-haspopup': 'menu',
        'aria-expanded': String(open),
        'aria-controls': menuId,
        'aria-label': t('watching.moreActions', { title }),
        'data-focus': `more-${focusKey}`,
        ...(props.removing ? { 'aria-busy': 'true' } : {}),
      },
      on: {
        click: () => props.onToggle(!open),
        keydown: (event) => {
          if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
            event.preventDefault();
            props.onToggle(true);
          }
        },
      },
    },
    props.removing ? icon('spinner', 'h-3.5 w-3.5 motion-safe:animate-spin') : icon('more', 'h-4 w-4', '3.2'),
  );
  const menu = (): HTMLElement => {
    const el: HTMLElement = h(
      'div',
      {
        class: 'absolute top-full right-0 z-30 mt-1 flex w-max max-w-[240px] min-w-[200px] flex-col gap-0.5 rounded-card border border-line bg-surface p-1 shadow-pop',
        attrs: { id: menuId, role: 'menu', 'aria-label': t('watching.menuAria', { title }) },
        on: { keydown: (event) => onMenuKeyDown(el, event, close) },
      },
      props.confirming
        ? renderRemoveConfirm({ focusKey, title, inMenu: true, onYes: props.onRemove, onNo: () => props.onConfirm(false) })
        : h(
            'button',
            {
              class:
                'flex min-h-8 w-full cursor-pointer items-center gap-2 rounded-lg px-2 text-left text-[12px] font-semibold text-danger transition-colors hover:bg-raised focus-visible:bg-raised disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent',
              attrs: { type: 'button', role: 'menuitem', tabindex: '-1', 'data-focus': `REMOVE-${focusKey}`, ...(props.busy ? { disabled: '' } : {}) },
              on: { click: () => props.onConfirm(true) },
            },
            removeIcon(),
            t('list.remove'),
          ),
    );
    return el;
  };
  return h('div', { class: 'relative shrink-0', attrs: { 'data-menu-root': focusKey } }, ...nodes([trigger, open && menu()]));
}
