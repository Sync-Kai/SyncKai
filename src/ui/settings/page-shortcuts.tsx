// Réglages › Raccourcis : touches actuelles des commandes de l'extension (lues par commands.getAll() dans la vue) et
// bouton qui ouvre la page des raccourcis du navigateur. Seul endroit des Réglages qui affiche ces touches.
// Pilote Preact : composants fonctions montés dans le conteneur de la vue (createShortcutsPage), mis à jour en place.
import { render } from 'preact';
import { t, type MessageKey } from '../../i18n';
import { createLogger } from '../../browser/logger';
import { LINK } from '../kit';
import { useLocale, useStore } from '../preact/hooks';
import { openShortcutSettings } from '../shortcut-settings';
import { createStore, type ReadonlyStore, type Store } from '../state';
import type { SettingsContext, SettingsMountedPage, ShortcutKeys } from './context';
import { DIVIDER, HELP_TEXT } from './rows';
import { RowsCard } from './rows-card';
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

export function shortcutRows(data: ShortcutKeys, target: BuildTarget = __SYNCKAI_TARGET__): ShortcutRowModel[] {
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

interface ShortcutRowProps {
  row: ShortcutRowModel;
  divider: boolean;
  /** Page des raccourcis impossible à ouvrir depuis cette ligne : marche à suivre affichée dessous */
  manual: boolean;
  onEdit: (kind: ShortcutKind) => void;
}

function ShortcutRow({ row, divider, manual, onEdit }: ShortcutRowProps) {
  const labelId = `sk-shortcut-${row.kind}`;
  return (
    <div class={divider ? DIVIDER : undefined}>
      <div class="flex items-center gap-3 px-3 py-2">
        <div class="flex min-w-0 flex-1 flex-col gap-0.5">
          <span class="text-[13px] font-bold" id={labelId}>
            {row.label}
          </span>
          {row.key !== null ? (
            <span class="flex flex-wrap items-center gap-x-1.5">
              <kbd class="rounded-md border border-line bg-ground px-1.5 py-px font-body text-[11px] font-bold text-ink" data-shortcut-key={row.kind}>
                {row.key}
              </kbd>
              {row.keyHint !== null && (
                <span class={HELP_TEXT} data-shortcut-hint={row.kind}>
                  {row.keyHint}
                </span>
              )}
            </span>
          ) : (
            <span class={HELP_TEXT} data-shortcut-key={row.kind}>
              {row.value}
            </span>
          )}
        </div>
        <button
          class={`${LINK} inline-flex min-h-8 shrink-0 cursor-pointer items-center bg-transparent px-1 text-[12px] font-bold`}
          type="button"
          aria-label={row.editAria}
          aria-describedby={labelId}
          data-focus={row.focus}
          onClick={() => onEdit(row.kind)}
        >
          {row.action}
        </button>
      </div>
      {/* Page des raccourcis impossible à ouvrir : marche à suivre (au lieu d'un clic sans effet) */}
      {manual && (
        <p class={`m-0 px-3 pb-2 ${HELP_TEXT}`} role="status" data-shortcut-manual={row.kind}>
          {t(__SYNCKAI_TARGET__ === 'firefox' ? 'settings.shortcut.manualFirefox' : 'settings.shortcut.manual')}
        </p>
      )}
    </div>
  );
}

export interface ShortcutsPageProps {
  /** Touches lues par la vue Réglages (commands.getAll(), relues quand elle reprend le focus) */
  keys: ReadonlyStore<ShortcutKeys>;
  /** Commande dont la page des raccourcis n'a pas pu s'ouvrir (conservée entre deux visites) */
  manual: Store<ShortcutKind | null>;
}

export function ShortcutsPage({ keys, manual }: ShortcutsPageProps) {
  // Abonnement à la langue : t() lit la langue active au rendu, le changement redessine la page en place
  useLocale();
  const shortcuts = useStore(keys);
  const manualKind = useStore(manual);

  /** Chrome : onglet chrome://extensions/shortcuts ; Firefox : commands.openShortcutSettings() (BRW-02) */
  function onEdit(kind: ShortcutKind): void {
    openShortcutSettings().catch((error: unknown) => {
      log.warn('Page des raccourcis impossible à ouvrir :', error);
      manual.set(kind);
    });
  }

  return (
    <div class="flex flex-col gap-2">
      <RowsCard>
        {shortcutRows(shortcuts).map((row, index) => (
          <ShortcutRow key={row.kind} row={row} divider={index > 0} manual={manualKind === row.kind} onEdit={onEdit} />
        ))}
      </RowsCard>
      <p class={`m-0 px-1 ${HELP_TEXT}`} data-shortcuts-help="">
        {t('settings.shortcuts.help')}
      </p>
    </div>
  );
}

export function createShortcutsPage(ctx: SettingsContext): SettingsMountedPage {
  // Hors de l'arbre Preact : la marche à suivre reste affichée d'une visite à l'autre, comme les autres pages
  const manual = createStore<ShortcutKind | null>(null);
  return {
    mount(container) {
      render(<ShortcutsPage keys={ctx.shortcuts} manual={manual} />, container);
      return () => render(null, container);
    },
  };
}
