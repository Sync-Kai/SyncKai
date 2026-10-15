// Réglages › Raccourcis : touches actuelles des commandes de l'extension (lues par commands.getAll() dans la vue) et
// bouton qui ouvre la page des raccourcis du navigateur. Seul endroit des Réglages qui affiche ces touches.
import { t, type MessageKey } from '../../i18n';
import { createLogger } from '../../browser/logger';
import { LINK } from '../kit';
import { openShortcutSettings } from '../shortcut-settings';
import { h } from '../dom';
import type { SettingsContext, SettingsData, SettingsPageView } from './context';
import { DIVIDER, HELP_TEXT, rowsCard } from './rows';
import { azertyKeyHint, formatShortcut } from './summary';

const log = createLogger('settings');

type BuildTarget = 'chrome' | 'firefox';

/** Commandes affichées : « valider l'épisode » et « ouvrir le panneau » (Firefox : afficher ou masquer la barre latérale) */
export type ShortcutKind = 'episode' | 'panel';

const SHORTCUT_KINDS: readonly ShortcutKind[] = ['episode', 'panel'];

/** Libellé, nom accessible du bouton et repère de focus de chaque commande */
const SHORTCUT_COPY: Readonly<Record<ShortcutKind, { label: Readonly<Record<BuildTarget, MessageKey>>; editAria: MessageKey; focus: string }>> = {
  episode: { label: { chrome: 'settings.shortcuts.episode', firefox: 'settings.shortcuts.episode' }, editAria: 'settings.shortcut.editAria', focus: 'shortcut' },
  panel: { label: { chrome: 'settings.shortcuts.panel', firefox: 'settings.shortcuts.panelFirefox' }, editAria: 'settings.shortcut.panelEditAria', focus: 'panel-shortcut' },
};

/** Ligne d'une commande, sans DOM (testée en fr, en et de, pour Chrome et Firefox) */
export interface ShortcutRowModel {
  kind: ShortcutKind;
  label: string;
  /** Touche mise en forme (« Alt+Maj+1 ») ; null : en lecture ou non définie (voir `value`) */
  key: string | null;
  /** Français, touche chiffre : « touche & » (même touche en AZERTY) */
  keyHint: string | null;
  /** Texte affiché à la place de la touche : « Chargement… » ou « Non défini » */
  value: string | null;
  /** « Modifier » (touche définie) ou « Définir » */
  action: string;
  editAria: string;
  focus: string;
}

export function shortcutRows(data: Pick<SettingsData, 'shortcut' | 'panelShortcut'>, target: BuildTarget = __SYNCKAI_TARGET__): ShortcutRowModel[] {
  return SHORTCUT_KINDS.map((kind) => {
    const copy = SHORTCUT_COPY[kind];
    const shortcut = kind === 'episode' ? data.shortcut : data.panelShortcut;
    return {
      kind,
      label: t(copy.label[target]),
      key: shortcut ? formatShortcut(shortcut) : null,
      keyHint: shortcut ? azertyKeyHint(shortcut) : null,
      value: shortcut === undefined ? t('settings.summary.loading') : shortcut ? null : t('settings.shortcuts.unset'),
      action: shortcut ? t('settings.shortcut.edit') : t('settings.shortcut.set'),
      editAria: t(copy.editAria),
      focus: copy.focus,
    };
  });
}

export function createShortcutsPage(ctx: SettingsContext): SettingsPageView {
  /** Ouverture de la page des raccourcis en échec : la marche à suivre reste affichée sous le bouton utilisé */
  let manual: ShortcutKind | null = null;

  /** Chrome : onglet chrome://extensions/shortcuts ; Firefox : commands.openShortcutSettings() (BRW-02) */
  function onEdit(kind: ShortcutKind): void {
    openShortcutSettings().catch((error: unknown) => {
      log.warn('Page des raccourcis impossible à ouvrir :', error);
      manual = kind;
      ctx.redraw(['shortcuts']);
    });
  }

  function renderRow(row: ShortcutRowModel, index: number): HTMLElement {
    const labelId = `sk-shortcut-${row.kind}`;
    return h(
      'div',
      { class: index > 0 ? DIVIDER : '' },
      h(
        'div',
        { class: 'flex items-center gap-3 px-3 py-2' },
        h(
          'div',
          { class: 'flex min-w-0 flex-1 flex-col gap-0.5' },
          h('span', { class: 'text-[13px] font-bold', attrs: { id: labelId } }, row.label),
          row.key
            ? h(
                'span',
                { class: 'flex flex-wrap items-center gap-x-1.5' },
                h('kbd', { class: 'rounded-md border border-line bg-ground px-1.5 py-px font-body text-[11px] font-bold text-ink', attrs: { 'data-shortcut-key': row.kind } }, row.key),
                row.keyHint && h('span', { class: HELP_TEXT, attrs: { 'data-shortcut-hint': row.kind } }, row.keyHint),
              )
            : h('span', { class: HELP_TEXT, attrs: { 'data-shortcut-key': row.kind } }, row.value),
        ),
        h(
          'button',
          {
            class: `${LINK} inline-flex min-h-8 shrink-0 cursor-pointer items-center bg-transparent px-1 text-[12px] font-bold`,
            attrs: { type: 'button', 'aria-label': row.editAria, 'aria-describedby': labelId, 'data-focus': row.focus },
            on: { click: () => onEdit(row.kind) },
          },
          row.action,
        ),
      ),
      // Page des raccourcis impossible à ouvrir : marche à suivre (au lieu d'un clic sans effet)
      manual === row.kind &&
        h(
          'p',
          { class: `m-0 px-3 pb-2 ${HELP_TEXT}`, attrs: { role: 'status', 'data-shortcut-manual': row.kind } },
          t(__SYNCKAI_TARGET__ === 'firefox' ? 'settings.shortcut.manualFirefox' : 'settings.shortcut.manual'),
        ),
    );
  }

  return {
    render(): Node[] {
      return [
        h(
          'div',
          { class: 'flex flex-col gap-2' },
          rowsCard(...shortcutRows(ctx.data).map(renderRow)),
          h('p', { class: `m-0 px-1 ${HELP_TEXT}`, attrs: { 'data-shortcuts-help': '' } }, t('settings.shortcuts.help')),
        ),
      ];
    },
  };
}
