// Réglages › Lecture & synchro : synchro automatique, moment de la synchro, lecteur préféré, fiche ouverte par défaut,
// accès à Netflix, Disney+ et Prime Video (permissions optionnelles) et options du panneau latéral. Les raccourcis clavier ont leur
// propre catégorie (page-shortcuts.ts) : un lien y mène.
import { t, type MessageKey } from '../../i18n';
import { createLogger } from '../../browser/logger';
import { removePlatformAccess } from '../../browser/platform-access';
import { isOptionalPlatform, PLATFORMS, STREAMING_PLATFORMS, type StreamingPlatform } from '../../platforms/registry';
import { DEFAULT_SETTINGS, effectivePlayer, isPreferredPlayerOption, PERCENTAGE_RANGE, type PanelDefaultTab, type SyncSettings } from '../../shared/settings';
import { renderAlert } from '../alert';
import { alertAttrs } from '../live-region';
import { CARD, LINK, segmented } from '../kit';
import { h } from '../dom';
import { icon } from '../icons';
import { requestPlatformAccessFromClick } from '../platform-access-store';
import type { SettingsContext, SettingsPageView } from './context';
import { choiceRow, DIVIDER, HELP_TEXT, renderRadio, rowsCard, settingsSection, toggleRow } from './rows';

const log = createLogger('settings');

/** Lecteurs proposés : Netflix et Prime Video seulement avec leur accès accordé ; jamais Disney+ (voir isPreferredPlayerOption) */
function playerOptions(granted: readonly StreamingPlatform[]): { value: StreamingPlatform; label: string }[] {
  const offered = (platform: StreamingPlatform): boolean => isPreferredPlayerOption(platform) && (!isOptionalPlatform(platform) || granted.includes(platform));
  return STREAMING_PLATFORMS.filter(offered).map((platform) => ({
    value: platform,
    label: PLATFORMS[platform].label,
  }));
}

/** "85 %" (fr, de) / "85%" (en) */
export function formatPercent(value: number | string): string {
  return t('settings.percent', { value });
}

/** Services proposés pour la fiche ouverte par défaut (libellé court, nom complet pour les lecteurs d'écran) */
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

/** Plateformes activées par un interrupteur (permission d'hôte optionnelle) */
type ToggledPlatform = 'netflix' | 'disney' | 'prime';
const TOGGLED_PLATFORMS: readonly ToggledPlatform[] = ['netflix', 'disney', 'prime'];

type AccessText = 'section' | 'label' | 'helpOff' | 'helpOn' | 'denied' | 'disabled' | 'error';

/** Textes de l'interrupteur de chaque plateforme */
const ACCESS_TEXTS: Readonly<Record<ToggledPlatform, Readonly<Record<AccessText, MessageKey>>>> = {
  netflix: {
    section: 'settings.netflix.section',
    label: 'settings.netflix.label',
    helpOff: 'settings.netflix.helpOff',
    helpOn: 'settings.netflix.helpOn',
    denied: 'settings.netflix.denied',
    disabled: 'settings.netflix.disabled',
    error: 'settings.netflix.error',
  },
  disney: {
    section: 'settings.disney.section',
    label: 'settings.disney.label',
    helpOff: 'settings.disney.helpOff',
    helpOn: 'settings.disney.helpOn',
    denied: 'settings.disney.denied',
    disabled: 'settings.disney.disabled',
    error: 'settings.disney.error',
  },
  prime: {
    section: 'settings.prime.section',
    label: 'settings.prime.label',
    helpOff: 'settings.prime.helpOff',
    helpOn: 'settings.prime.helpOn',
    denied: 'settings.prime.denied',
    disabled: 'settings.prime.disabled',
    error: 'settings.prime.error',
  },
};

/**
 * Retour de la dernière demande d'accès (affiché sous l'interrupteur jusqu'au prochain changement).
 * `disabled` : accès retiré, le script déjà exécuté dans un onglet ouvert tourne jusqu'à son rechargement.
 */
type AccessNotice = 'denied' | 'error' | 'disabled' | null;

export function createSyncPage(ctx: SettingsContext): SettingsPageView {
  const notices: Record<ToggledPlatform, AccessNotice> = { netflix: null, disney: null, prime: null };

  /**
   * Retour de la demande affiché après relecture des accès (store de l'hôte) ; redessin même si la liste n'a pas changé
   * (refus : l'interrupteur coché par le clic revient à l'état réel). `reread` faux : accès déjà relus par la demande.
   */
  function settle(platform: ToggledPlatform, notice: AccessNotice, reread = true): void {
    notices[platform] = notice;
    const access = ctx.host.platformAccess;
    void (reread ? access.refresh() : access.read()).then(() => ctx.redraw(['home', 'sync']));
  }

  const isGranted = (platform: ToggledPlatform): boolean => ctx.data.platformAccess?.includes(platform) === true;

  /**
   * Interrupteur d'une plateforme. Activation : permissions.request appelé directement dans le gestionnaire (geste
   * utilisateur exigé, aucun await avant). Retrait de Netflix ou de Prime Video : ce lecteur préféré repasse sur le lecteur par défaut.
   */
  function onAccessToggle(platform: ToggledPlatform, checked: boolean): void {
    const { label } = PLATFORMS[platform];
    if (checked) {
      requestPlatformAccessFromClick(platform, ctx.host.platformAccess).then(
        (granted) => settle(platform, granted ? null : 'denied', false),
        (error: unknown) => {
          log.warn(`Demande d’accès à ${label} impossible :`, error);
          settle(platform, 'error');
        },
      );
      return;
    }
    removePlatformAccess(platform).then(
      (removed) => {
        if (removed && ctx.data.settings?.preferredPlayer === platform) void ctx.update({ preferredPlayer: DEFAULT_SETTINGS.preferredPlayer }, true);
        settle(platform, removed ? 'disabled' : 'error');
      },
      (error: unknown) => {
        log.warn(`Retrait de l’accès à ${label} impossible :`, error);
        settle(platform, 'error');
      },
    );
  }

  function renderAccess(platform: ToggledPlatform): HTMLElement {
    const texts = ACCESS_TEXTS[platform];
    const granted = isGranted(platform);
    const state = notices[platform];
    const errorText = state === 'denied' ? t(texts.denied) : state === 'error' ? t(texts.error) : null;
    const notice =
      state === 'disabled'
        ? !granted && h('p', { class: 'm-0 px-3 pb-2 text-[11px] font-semibold text-muted', attrs: { role: 'status' } }, t(texts.disabled))
        : errorText && h('p', { class: 'm-0 px-3 pb-2 text-[11px] font-semibold text-danger', attrs: alertAttrs(errorText) }, errorText);
    return settingsSection(
      t(texts.section),
      rowsCard(
        toggleRow({
          id: `sk-${platform}`,
          label: t(texts.label),
          help: t(granted ? texts.helpOn : texts.helpOff),
          checked: granted,
          onChange: (checked) => onAccessToggle(platform, checked),
        }),
        notice,
      ),
    );
  }

  /** Lien vers Réglages › Raccourcis (touches de « valider l'épisode » et du panneau, autrefois affichées ici) */
  function renderShortcutsLink(): HTMLElement {
    return h(
      'button',
      {
        class: `${LINK} ${DIVIDER} flex min-h-9 w-full cursor-pointer items-center justify-between gap-2 bg-transparent px-3 text-left text-[12px] font-bold`,
        attrs: { type: 'button', 'data-focus': 'shortcuts-link' },
        on: { click: () => ctx.openCategory('shortcuts') },
      },
      t('settings.shortcuts.pointer'),
      icon('chevronRight', 'h-3.5 w-3.5', '2.6'),
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
      const players = playerOptions(ctx.data.platformAccess ?? []);
      return [
        settingsSection(
          t('settings.section.sync'),
          rowsCard(
            toggleRow({ id: 'sk-auto', label: t('settings.autoSync.label'), help: t(s.autoSync ? 'settings.autoSync.helpOn' : 'settings.autoSync.helpOff'), checked: s.autoSync, onChange: (checked) => void ctx.update({ autoSync: checked }) }),
            ...renderTrigger(s),
            renderShortcutsLink(),
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
                options: players,
                current: effectivePlayer(s.preferredPlayer, ctx.data.platformAccess),
                dense: players.length > 3,
                onPick: (value) => void ctx.update({ preferredPlayer: value }, true),
                attrs: { 'aria-labelledby': 'sk-player-label' },
                focusKey: 'player',
                activeClass: 'bg-sakura',
                trackClass: 'bg-ground',
              }),
            }),
          ),
        ),
        ...TOGGLED_PLATFORMS.map(renderAccess),
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
