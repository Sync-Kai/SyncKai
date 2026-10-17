// Réglages › Affichage › Raccourcis (maquettes Raccourcis, RaccourcisEtats) : une carte par commande de l'extension
// (« Pendant la lecture », « Navigation »), touche actuelle (lue par commands.getAll() dans la vue) et bouton qui ouvre
// la page des raccourcis du navigateur. Seul endroit des Réglages qui affiche ces touches (la ligne d'Affichage les décrit).
import { t, type MessageKey } from '../../i18n';
import { createLogger } from '../../browser/logger';
import { buttonClass } from '../components/button';
import { Icon } from '../components/icon';
import { Section } from '../components/section';
import { useLocale, useStore } from '../preact/hooks';
import { openShortcutSettings } from '../shortcut-settings';
import { createStore, type ReadonlyStore, type Store } from '../state';
import type { SettingsContext, SettingsMountedPage, ShortcutKeys } from './context';
import { preactPage } from './preact-page';
import { azertyKeyHint, formatShortcut } from './summary';

const log = createLogger('settings');

type BuildTarget = 'chrome' | 'firefox';

/** Commandes affichées : « valider l'épisode » et « ouvrir le panneau » (Firefox : afficher ou masquer la barre latérale) */
export type ShortcutKind = 'episode' | 'panel';

const SHORTCUT_KINDS: readonly ShortcutKind[] = ['episode', 'panel'];

/** Libellé, section, nom accessible du bouton et repère de focus de chaque commande */
const SHORTCUT_COPY: Readonly<Record<ShortcutKind, { label: Readonly<Record<BuildTarget, MessageKey>>; section: MessageKey; editAria: MessageKey; focus: string }>> = {
  episode: {
    label: { chrome: 'settings.shortcuts.episode', firefox: 'settings.shortcuts.episode' },
    section: 'settings.shortcuts.duringPlayback',
    editAria: 'settings.shortcut.editAria',
    focus: 'shortcut',
  },
  panel: {
    label: { chrome: 'settings.shortcuts.panel', firefox: 'settings.shortcuts.panelFirefox' },
    section: 'settings.shortcuts.navigation',
    editAria: 'settings.shortcut.panelEditAria',
    focus: 'panel-shortcut',
  },
};

/** Ligne d'une commande, sans DOM (testée en fr, en et de, pour Chrome et Firefox) */
export interface ShortcutRowModel {
  kind: ShortcutKind;
  /** Titre de la section de la carte (« Pendant la lecture », « Navigation ») */
  section: string;
  label: string;
  /** Touche mise en forme (« Alt+Maj+1 ») ; null : en lecture ou non définie (voir `value`) */
  key: string | null;
  /** Français, touche chiffre : « touche & » (même touche en AZERTY) */
  keyHint: string | null;
  /** Texte affiché à la place de la touche : « Chargement… » ou « Non défini » */
  value: string | null;
  /** Touches pas encore lues */
  loading: boolean;
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
      section: t(copy.section),
      label: t(copy.label[target]),
      key: shortcut ? formatShortcut(shortcut) : null,
      keyHint: shortcut ? azertyKeyHint(shortcut) : null,
      loading: shortcut === undefined,
      value: shortcut === undefined ? t('settings.summary.loading') : shortcut ? null : t('settings.shortcuts.unset'),
      action: shortcut ? t('settings.shortcut.edit') : t('settings.shortcut.set'),
      editAria: t(copy.editAria),
      focus: copy.focus,
    };
  });
}

interface ShortcutRowProps {
  row: ShortcutRowModel;
  /** Page des raccourcis impossible à ouvrir depuis cette ligne : marche à suivre affichée dessous */
  manual: boolean;
  onEdit: (kind: ShortcutKind) => void;
}

function ShortcutRow({ row, manual, onEdit }: ShortcutRowProps) {
  const labelId = `sk-shortcut-${row.kind}`;
  // Touches pas encore lues : « Chargement… » et bouton désactivé ; non définie : « Non défini » (à vérifier, butter)
  const { loading } = row;
  return (
    <div class="flex flex-col gap-2 rounded-card border border-line bg-surface p-3" data-shortcut-card={row.kind}>
      <div class="flex items-center gap-3">
        <div class="flex min-w-0 flex-1 flex-col gap-1">
          <span class="font-bold" id={labelId}>
            {row.label}
          </span>
          {row.key !== null ? (
            <span class="flex flex-wrap items-center gap-x-1.5 gap-y-1">
              <kbd class="rounded-control border border-field bg-ground px-1.5 py-px font-body text-secondary font-bold text-ink" data-shortcut-key={row.kind}>
                {row.key}
              </kbd>
              {row.keyHint !== null && (
                <span class="text-secondary text-muted" data-shortcut-hint={row.kind}>
                  {row.keyHint}
                </span>
              )}
            </span>
          ) : (
            <span class={`text-secondary ${loading ? 'text-muted' : 'font-bold text-butter'}`} data-shortcut-key={row.kind}>
              {row.value}
            </span>
          )}
        </div>
        <button
          class={buttonClass('secondary', 'sm')}
          type="button"
          aria-label={row.editAria}
          aria-describedby={labelId}
          disabled={loading}
          data-focus={row.focus}
          onClick={() => onEdit(row.kind)}
        >
          {row.action}
          <Icon name="external" class="size-3" strokeWidth="2.4" />
        </button>
      </div>
      {/* Page des raccourcis impossible à ouvrir : marche à suivre (au lieu d'un clic sans effet) */}
      {manual && (
        <p class="m-0 text-secondary text-muted" role="status" data-shortcut-manual={row.kind}>
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
    <div class="flex flex-col gap-4">
      {shortcutRows(shortcuts).map((row) => (
        <Section key={row.kind} title={row.section}>
          <ShortcutRow row={row} manual={manualKind === row.kind} onEdit={onEdit} />
        </Section>
      ))}
      <p class="m-0 -mt-2 px-1 text-secondary text-muted" data-shortcuts-help="">
        {t('settings.shortcuts.help')}
      </p>
    </div>
  );
}

export function createShortcutsPage(ctx: SettingsContext): SettingsMountedPage {
  // Hors de l'arbre Preact : la marche à suivre reste affichée d'une visite à l'autre, comme les autres pages
  const manual = createStore<ShortcutKind | null>(null);
  return preactPage(() => <ShortcutsPage keys={ctx.shortcuts} manual={manual} />);
}
