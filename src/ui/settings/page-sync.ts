// Réglages › Lecture & synchro : synchro automatique, moment de la synchro, raccourci clavier,
// lecteur préféré et options du panneau latéral.
import { t } from '../../i18n';
import type { StreamingPlatform } from '../../shared/episode.types';
import { PERCENTAGE_RANGE, type PanelDefaultTab, type SyncSettings } from '../../shared/settings';
import { renderAlert } from '../../popup/components/alert';
import { CARD, LINK, segmented } from '../../popup/components/ui';
import { h } from '../dom';
import type { SettingsContext, SettingsPageView } from './context';
import { choiceRow, DIVIDER, HELP_TEXT, renderRadio, rowsCard, settingsSection, toggleRow } from './rows';

const SHORTCUTS_URL = 'chrome://extensions/shortcuts';

const PLAYER_OPTIONS = [
  { value: 'crunchyroll', label: 'Crunchyroll' },
  { value: 'adn', label: 'ADN' },
] as const satisfies readonly { value: StreamingPlatform; label: string }[];

/** "Alt+Shift+S" → "Alt+Maj+S" (nom de la touche Maj dans la langue active) */
function formatShortcut(shortcut: string): string {
  return shortcut.replace(/Shift/g, t('settings.shortcut.shiftKey'));
}

/** "85 %" (fr, de) / "85%" (en) */
export function formatPercent(value: number | string): string {
  return t('settings.percent', { value });
}

function panelTabOptions(): { value: PanelDefaultTab; label: string }[] {
  return [
    { value: 'last', label: t('settings.panel.tab.last') },
    { value: 'nowPlaying', label: t('panel.tab.nowPlaying') },
    { value: 'agenda', label: t('panel.tab.agenda') },
  ];
}

/** Squelette ou erreur tant que les réglages ne sont pas lus (pages qui en dépendent) */
export function settingsPlaceholder(ctx: SettingsContext): Node[] {
  if (ctx.data.settingsError) return [renderAlert({ message: t('settings.loadError') })];
  return [h('div', { class: `${CARD} h-40 motion-safe:animate-pulse`, attrs: { 'aria-busy': 'true', 'aria-label': t('settings.loading') } })];
}

export function createSyncPage(ctx: SettingsContext): SettingsPageView {
  function renderShortcutHint(): HTMLElement {
    const { shortcut } = ctx.data;
    // Touche mise en forme (<kbd>) au milieu de la phrase traduite
    const [before = '', after = ''] = t('settings.shortcut.hint').split('{key}');
    const text =
      shortcut === undefined
        ? t('settings.shortcut.loading')
        : shortcut
          ? h('span', {}, before, h('kbd', { class: 'font-body font-bold text-ink' }, formatShortcut(shortcut)), after)
          : t('settings.shortcut.none');
    return h(
      'div',
      { class: `flex items-center justify-between gap-2 px-3 py-1 ${DIVIDER}` },
      h('span', { class: `min-w-0 ${HELP_TEXT}` }, text),
      h(
        'button',
        {
          class: `${LINK} inline-flex min-h-8 shrink-0 cursor-pointer items-center bg-transparent px-1 text-[12px] font-bold`,
          attrs: { type: 'button', 'aria-label': t('settings.shortcut.editAria'), 'data-focus': 'shortcut' },
          // Les pages chrome:// ne s'ouvrent pas via un lien : passage par l'API tabs
          on: { click: () => ctx.host.openTab(SHORTCUTS_URL) },
        },
        shortcut ? t('settings.shortcut.edit') : t('settings.shortcut.set'),
      ),
    );
  }

  function renderTrigger(s: SyncSettings): HTMLElement[] {
    const percentLabel = h('span', { class: 'shrink-0 text-[12px] font-bold tabular-nums', attrs: { 'aria-hidden': 'true' } }, formatPercent(s.completionPercentage));
    const range = h('input', {
      class: 'm-0 h-6 w-full cursor-pointer',
      attrs: {
        id: 'sk-pct',
        type: 'range',
        min: String(PERCENTAGE_RANGE.min),
        max: String(PERCENTAGE_RANGE.max),
        step: '1',
        'aria-describedby': 'sk-pct-help',
        'aria-valuetext': formatPercent(s.completionPercentage),
        'data-focus': 'pct',
      },
      on: {
        // "input" met à jour l'affichage en continu, "change" n'enregistre qu'au relâchement
        input: () => {
          percentLabel.textContent = formatPercent(range.value);
          range.setAttribute('aria-valuetext', formatPercent(range.value));
        },
        change: () => void ctx.update({ completionPercentage: Number(range.value) }),
      },
    });
    range.value = String(s.completionPercentage);
    const percentage = s.completionTrigger === 'percentage';

    return [
      h(
        'fieldset',
        { class: `m-0 flex flex-col border-0 px-3 pt-2 pb-0 ${DIVIDER}` },
        h('legend', { class: 'float-left mb-0.5 w-full p-0 text-[13px] font-bold' }, t('settings.trigger.legend')),
        renderRadio('sk-trigger', s.completionTrigger === 'credits', t('settings.trigger.credits'), () => void ctx.update({ completionTrigger: 'credits' }, true)),
        renderRadio('sk-trigger', percentage, t('settings.trigger.percentage'), () => void ctx.update({ completionTrigger: 'percentage' }, true)),
      ),
      h(
        'div',
        { class: 'flex flex-col gap-1 px-3 pt-1 pb-2.5' },
        h(
          'div',
          { class: 'flex items-center justify-between gap-3' },
          h('label', { class: 'text-[12px] font-bold', attrs: { for: 'sk-pct' } }, t(percentage ? 'settings.percentage.label' : 'settings.percentage.fallbackLabel')),
          percentLabel,
        ),
        range,
        h('span', { class: HELP_TEXT, attrs: { id: 'sk-pct-help' } }, t(percentage ? 'settings.percentage.help' : 'settings.percentage.fallbackHelp')),
      ),
    ];
  }

  return {
    render(): Node[] {
      const s = ctx.data.settings;
      if (!s) return settingsPlaceholder(ctx);
      return [
        settingsSection(
          t('settings.section.sync'),
          rowsCard(
            toggleRow({ id: 'sk-auto', label: t('settings.autoSync.label'), help: t(s.autoSync ? 'settings.autoSync.helpOn' : 'settings.autoSync.helpOff'), checked: s.autoSync, onChange: (checked) => void ctx.update({ autoSync: checked }) }),
            ...renderTrigger(s),
            renderShortcutHint(),
          ),
        ),
        settingsSection(
          t('settings.section.playback'),
          rowsCard(
            choiceRow({
              labelId: 'sk-player-label',
              label: t('settings.player.label'),
              help: t('settings.player.help'),
              control: segmented({
                options: PLAYER_OPTIONS,
                current: s.preferredPlayer,
                onPick: (value) => void ctx.update({ preferredPlayer: value }, true),
                attrs: { 'aria-labelledby': 'sk-player-label' },
                focusKey: 'player',
                activeClass: 'bg-sakura',
                trackClass: 'bg-ground',
              }),
            }),
          ),
        ),
        settingsSection(
          t('settings.section.panel'),
          rowsCard(
            choiceRow({
              labelId: 'sk-panel-tab-label',
              label: t('settings.panel.defaultTab'),
              control: segmented({
                options: panelTabOptions(),
                current: s.panelDefaultTab,
                onPick: (value) => void ctx.update({ panelDefaultTab: value }, true),
                attrs: { 'aria-labelledby': 'sk-panel-tab-label' },
                focusKey: 'panel-tab',
                activeClass: 'bg-sakura',
                trackClass: 'bg-ground',
              }),
            }),
            toggleRow({
              id: 'sk-panel-live',
              label: t('settings.panel.live.label'),
              help: t('settings.panel.live.help'),
              checked: s.panelLiveProgress,
              onChange: (checked) => void ctx.update({ panelLiveProgress: checked }),
              divider: true,
            }),
          ),
        ),
      ];
    },
  };
}
