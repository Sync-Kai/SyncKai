// Briques communes des Réglages (popup et panneau latéral) : interrupteur, ligne à bascule, ligne de choix,
// ligne de navigation vers une sous-page, ligne de lien et zone de danger. Un seul rendu pour toutes les pages.
import { t } from '../../i18n';
import { CARD, LINK, sectionLabel } from '../kit';
import { h, type Child } from '../dom';
import { icon, type IconName } from '../icons';

export const DIVIDER = 'border-t border-dotted border-line';
export const HELP_TEXT = 'text-[11px] font-semibold text-muted';

/** Interrupteur accessible (case à cocher role="switch") */
export function renderSwitch(id: string, checked: boolean, describedBy: string | null, onChange: (checked: boolean) => void): HTMLElement {
  const input = h('input', {
    class: 'peer absolute inset-0 z-10 m-0 h-full w-full cursor-pointer opacity-0',
    attrs: { id, type: 'checkbox', role: 'switch', 'data-focus': id, ...(describedBy ? { 'aria-describedby': describedBy } : {}) },
    on: { change: () => onChange(input.checked) },
  });
  input.checked = checked;
  return h(
    'span',
    { class: 'relative inline-block h-8 w-11 shrink-0' },
    input,
    h('span', {
      class:
        "pointer-events-none absolute inset-x-0.5 inset-y-1 rounded-full bg-line transition-colors peer-checked:bg-sakura peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-lavender after:absolute after:top-[3px] after:left-[3px] after:h-[18px] after:w-[18px] after:rounded-full after:bg-white after:transition-transform after:content-[''] peer-checked:after:translate-x-4",
    }),
  );
}

export function renderRadio(name: string, checked: boolean, label: string, onSelect: () => void): HTMLElement {
  const input = h('input', {
    class: 'm-0 h-4 w-4 shrink-0 cursor-pointer',
    attrs: { type: 'radio', name, 'data-focus': `${name}-${label}` },
    on: { change: () => input.checked && onSelect() },
  });
  input.checked = checked;
  return h('label', { class: 'flex min-h-8 cursor-pointer items-center gap-2 text-[12px]' }, input, label);
}

/** Section titrée (titre en capitales discrètes) */
export function settingsSection(label: string, ...children: Child[]): HTMLElement {
  return h('section', { class: 'flex flex-col gap-2' }, sectionLabel(label), ...children);
}

/** Carte de lignes séparées par des pointillés */
export function rowsCard(...rows: Child[]): HTMLElement {
  return h('div', { class: `${CARD} flex flex-col overflow-hidden` }, ...rows);
}

interface ToggleRowProps {
  id: string;
  label: string;
  help?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  divider?: boolean;
}

/** Ligne libellé (+ aide) avec interrupteur à droite */
export function toggleRow({ id, label, help, checked, onChange, divider = false }: ToggleRowProps): HTMLElement {
  const helpId = help ? `${id}-help` : null;
  return h(
    'div',
    { class: `flex items-center gap-3 px-3 py-2 ${divider ? DIVIDER : ''}` },
    h(
      'div',
      { class: 'flex min-w-0 flex-1 flex-col gap-0.5' },
      h('label', { class: 'cursor-pointer text-[13px] font-bold', attrs: { for: id } }, label),
      help && helpId && h('span', { class: HELP_TEXT, attrs: { id: helpId } }, help),
    ),
    renderSwitch(id, checked, helpId, onChange),
  );
}

interface ChoiceRowProps {
  /** id du libellé (référencé par aria-labelledby du contrôle) */
  labelId: string;
  label: string;
  help?: string;
  /** Contrôle segmenté ou liste de choix */
  control: HTMLElement;
  divider?: boolean;
  muted?: boolean;
}

/** Ligne libellé + contrôle de choix ; le contrôle passe sous le libellé si la largeur manque (allemand, panneau étroit) */
export function choiceRow({ labelId, label, help, control, divider = false, muted = false }: ChoiceRowProps): HTMLElement {
  return h(
    'div',
    { class: `flex flex-col gap-1 px-3 py-2 ${divider ? DIVIDER : ''}` },
    h(
      'div',
      { class: 'flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5' },
      h('span', { class: `text-[13px] font-bold ${muted ? 'text-muted' : ''}`, attrs: { id: labelId } }, label),
      control,
    ),
    help && h('span', { class: HELP_TEXT }, help),
  );
}

/** Teinte de la pastille d'icône d'une catégorie (classes complètes pour Tailwind) */
export type RowTint = 'anilist' | 'sakura' | 'butter' | 'lavender' | 'mint' | 'muted';

const TINTS: Record<RowTint, string> = {
  anilist: 'bg-anilist/15 text-anilist',
  sakura: 'bg-sakura/15 text-sakura',
  butter: 'bg-butter/15 text-butter',
  lavender: 'bg-lavender/15 text-lavender',
  mint: 'bg-mint/15 text-mint',
  muted: 'bg-muted/15 text-muted',
};

interface NavRowProps {
  focusKey: string;
  iconName: IconName;
  tint: RowTint;
  title: string;
  summary: string;
  summaryTone?: 'muted' | 'danger';
  onClick: () => void;
  divider?: boolean;
}

/** Ligne de catégorie de l'accueil : icône, titre, résumé des valeurs actuelles, chevron */
export function navRow({ focusKey, iconName, tint, title, summary, summaryTone = 'muted', onClick, divider = false }: NavRowProps): HTMLElement {
  return h(
    'button',
    {
      class: `flex min-h-[52px] w-full cursor-pointer items-center gap-3 bg-transparent px-3 py-1.5 text-left text-ink transition-colors hover:bg-raised ${divider ? DIVIDER : ''}`,
      attrs: { type: 'button', 'data-focus': focusKey },
      on: { click: onClick },
    },
    h('span', { class: `flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] ${TINTS[tint]}`, attrs: { 'aria-hidden': 'true' } }, icon(iconName, 'h-4 w-4', '2.2')),
    h(
      'span',
      { class: 'flex min-w-0 flex-1 flex-col gap-px' },
      h('span', { class: 'truncate text-[13px] font-bold' }, title),
      h('span', { class: `truncate text-[11px] font-semibold ${summaryTone === 'danger' ? 'text-danger' : 'text-muted'}` }, summary),
    ),
    icon('chevronRight', 'h-3.5 w-3.5 text-muted', '2.6'),
  );
}

interface LinkRowProps {
  label: string;
  href: string;
  /** Texte secondaire à droite (version…) */
  trailing?: string;
  divider?: boolean;
}

/** Ligne de lien externe (nouvel onglet) */
export function linkRow({ label, href, trailing, divider = false }: LinkRowProps): HTMLElement {
  return h(
    'div',
    { class: `flex min-h-10 items-center justify-between gap-2 px-3 ${divider ? DIVIDER : ''}` },
    h(
      'a',
      { class: `${LINK} inline-flex min-h-8 items-center gap-1 text-[12px] font-bold`, attrs: { href, target: '_blank', rel: 'noopener noreferrer' } },
      label,
      icon('external', 'h-3 w-3'),
    ),
    trailing && h('span', { class: 'text-[11px] font-semibold text-muted tabular-nums' }, trailing),
  );
}

/** Bouton d'action destructive (contour rouge) */
export const BTN_DANGER =
  'inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-full border border-danger px-3.5 text-[12px] font-bold text-danger transition-colors hover:bg-raised disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent';
/** Confirmation d'une action destructive (fond rouge) */
export const BTN_DANGER_FILL =
  'inline-flex h-8 shrink-0 cursor-pointer items-center rounded-full bg-danger px-3.5 text-[12px] font-bold text-on-fill transition hover:brightness-105';

interface DangerRowProps {
  title: string;
  help: string;
  /** Bouton (ou confirmation) à droite / dessous */
  action: HTMLElement;
  divider?: boolean;
}

export function dangerRow({ title, help, action, divider = false }: DangerRowProps): HTMLElement {
  return h(
    'div',
    { class: `flex flex-col gap-2 px-3 py-2.5 ${divider ? DIVIDER : ''}` },
    h('div', { class: 'flex flex-col gap-0.5' }, h('span', { class: 'text-[13px] font-bold' }, title), h('span', { class: HELP_TEXT }, help)),
    action,
  );
}

/** Zone de danger en bas de page : actions irréversibles, isolées et signalées */
export function dangerZone(...rows: Child[]): HTMLElement {
  return h(
    'section',
    { class: 'flex flex-col gap-2' },
    h('h2', { class: 'm-0 text-[11px] font-bold tracking-[0.06em] text-danger uppercase' }, t('settings.section.danger')),
    h('div', { class: 'flex flex-col overflow-hidden rounded-card border border-danger/40 bg-surface' }, ...rows),
  );
}
