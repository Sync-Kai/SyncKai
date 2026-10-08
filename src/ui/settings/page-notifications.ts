// Réglages › Notifications & Agenda : notifications sur la page, proposition de note,
// alertes de sortie (délai, vérification manuelle) et heures estimées de l'agenda.
import { t, tp } from '../../i18n';
import { formatAiringStatus } from '../../shared/airing.types';
import { AIRING_DELAYS, type AiringDelayHours } from '../../shared/engagement.types';
import type { StreamingPlatform } from '../../shared/episode.types';
import { createLogger } from '../../shared/logger';
import { sendMessage } from '../../shared/messages';
import { normalizeOffset, OFFSET_RANGE, type NotificationLevel, type SyncSettings } from '../../shared/settings';
import { BTN_GHOST, CARD, PLATFORM_LABELS, segmented } from '../../popup/components/ui';
import { h, nodes, preserveFocus, type Child } from '../dom';
import { icon } from '../icons';
import type { SettingsContext, SettingsPageView } from './context';
import { choiceRow, DIVIDER, HELP_TEXT, rowsCard, settingsSection, toggleRow } from './rows';
import { settingsPlaceholder } from './page-sync';

const log = createLogger('settings');

type NotifGlyph = 'pill' | 'bubble' | 'alert';

/** Niveaux de notification (textes traduits à chaque rendu) */
function notificationOptions(): readonly { value: NotificationLevel; title: string; desc: string; glyph: NotifGlyph; recommended: boolean }[] {
  return [
    { value: 'discreet', title: t('settings.notif.discreet.title'), desc: t('settings.notif.discreet.desc'), glyph: 'pill', recommended: true },
    { value: 'detailed', title: t('settings.notif.detailed.title'), desc: t('settings.notif.detailed.desc'), glyph: 'bubble', recommended: false },
    { value: 'alerts-only', title: t('settings.notif.alertsOnly.title'), desc: t('settings.notif.alertsOnly.desc'), glyph: 'alert', recommended: false },
  ];
}

type DelayKey = `${AiringDelayHours}`;

/** Délais du segmenté (valeurs texte : le contrôle segmenté travaille sur des chaînes) */
function delayOptions(): { value: DelayKey; label: string; aria: string }[] {
  return AIRING_DELAYS.map((hours) => ({ value: `${hours}` as DelayKey, label: t('settings.delay.label', { hours }), aria: tp('settings.delay.aria', hours) }));
}

function delayFromKey(key: DelayKey): AiringDelayHours {
  return AIRING_DELAYS.find((hours) => `${hours}` === key) ?? AIRING_DELAYS[0];
}

/** Miniature d'écran illustrant chaque niveau de notification */
function notifGlyph(glyph: NotifGlyph): SVGSVGElement {
  const NS = 'http://www.w3.org/2000/svg';
  const el = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string>): SVGElementTagNameMap[K] => {
    const node = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
  };
  const svg = el('svg', { viewBox: '0 0 32 24', 'aria-hidden': 'true', class: 'mt-0.5 h-6 w-8 shrink-0' });
  svg.append(el('rect', { x: '0.75', y: '0.75', width: '30.5', height: '22.5', rx: '4', fill: '#16131F', stroke: '#3D3554', 'stroke-width': '1.5' }));
  if (glyph === 'pill') svg.append(el('rect', { x: '18', y: '16', width: '10', height: '4', rx: '2', fill: '#7EE0C3' }));
  if (glyph === 'bubble') {
    svg.append(
      el('rect', { x: '12', y: '8', width: '16', height: '12', rx: '2.5', fill: '#FF8FB8' }),
      el('rect', { x: '15', y: '11', width: '10', height: '1.5', rx: '0.75', fill: '#1A0F1C' }),
      el('rect', { x: '15', y: '15', width: '7', height: '1.5', rx: '0.75', fill: '#1A0F1C' }),
    );
  }
  if (glyph === 'alert') {
    svg.append(
      el('path', { d: 'M23 8 28.5 18H17.5Z', fill: '#FFD37A', stroke: '#FFD37A', 'stroke-width': '1.5', 'stroke-linejoin': 'round' }),
      el('path', { d: 'M23 11.5V14', stroke: '#1A0F1C', 'stroke-width': '1.5', 'stroke-linecap': 'round' }),
      el('circle', { cx: '23', cy: '16.2', r: '0.8', fill: '#1A0F1C' }),
    );
  }
  return svg;
}

export interface NotificationsPage extends SettingsPageView {
  /** Redessine seulement la ligne d'état des alertes (tic d'horloge, résumé relu) sans toucher aux champs */
  drawAiring(now: number): void;
}

export function createNotificationsPage(ctx: SettingsContext): NotificationsPage {
  // Ligne d'état des alertes : emplacement persistant, redessiné seul (tic d'horloge, stockage) sans refaire le formulaire
  const airingSlot = h('div', { class: `flex items-center justify-between gap-2 px-3 py-1.5 ${DIVIDER}` });
  let airingNow = Date.now();
  let airingPending = false;

  function drawAiring(): void {
    preserveFocus(airingSlot, () => airingSlot.replaceChildren(...nodes(renderAiring())));
  }

  function renderAiring(): Child[] {
    const enabled = ctx.data.settings?.airingAlerts ?? false;
    const line = formatAiringStatus(ctx.data.airing, airingNow);
    return [
      h(
        'span',
        { class: `min-w-0 text-[11px] font-semibold ${line.tone === 'danger' ? 'text-danger' : 'text-muted'}`, attrs: { role: 'status', 'aria-live': 'polite' } },
        airingPending ? t('settings.airing.checking') : line.text,
      ),
      h(
        'button',
        {
          class: `${BTN_GHOST} text-sakura`,
          attrs: {
            type: 'button',
            'data-focus': 'airing-check',
            title: enabled ? t('settings.airing.checkTitle') : t('settings.airing.enableFirst'),
            ...(!enabled || airingPending ? { disabled: '' } : {}),
          },
          on: { click: () => void checkAiringNow() },
        },
        airingPending && icon('spinner', 'h-3 w-3 motion-safe:animate-spin'),
        t('settings.airing.checkNow'),
      ),
    ];
  }

  async function checkAiringNow(): Promise<void> {
    if (airingPending) return;
    airingPending = true;
    drawAiring();
    try {
      const result = await sendMessage('CHECK_AIRING', null);
      // Réponse de secours du service worker : horodatage absent
      ctx.data.airing = { ...result, checkedAt: result.checkedAt || Date.now() };
    } catch (error: unknown) {
      log.error('Vérification des sorties impossible :', error);
      ctx.data.airing = { checkedAt: Date.now(), notified: 0, skipped: null, error: t('settings.airing.unavailable') };
    }
    airingNow = Date.now();
    airingPending = false;
    drawAiring();
  }

  /** Agenda : délai estimé de sortie par plateforme (minutes après la diffusion japonaise) */
  function renderOffsets(s: SyncSettings): HTMLElement {
    const field = (platform: StreamingPlatform): HTMLElement => {
      const id = `sk-offset-${platform}`;
      const input = h('input', {
        class: 'h-8 w-[72px] rounded-lg border border-line bg-ground px-2 text-[12px] font-bold tabular-nums invalid:border-danger',
        attrs: {
          id,
          type: 'number',
          inputmode: 'numeric',
          step: '5',
          min: String(OFFSET_RANGE.min),
          max: String(OFFSET_RANGE.max),
          required: '',
          'aria-label': t('settings.offsets.aria', { platform: PLATFORM_LABELS[platform] }),
          'aria-describedby': 'sk-offsets-help',
          'data-focus': id,
        },
        on: {
          // Valeur hors bornes ou vide : non enregistrée (le champ reste signalé invalide)
          change: () => {
            const value = normalizeOffset(input.value.trim() === '' ? Number.NaN : Number(input.value));
            if (value === null || !input.checkValidity()) return;
            void ctx.update({ platformOffsets: { ...(ctx.data.settings ?? s).platformOffsets, [platform]: value } });
          },
        },
      });
      input.value = String(s.platformOffsets[platform]);
      return h(
        'label',
        { class: 'flex items-center gap-1.5 text-[12px] font-bold' },
        h('span', { attrs: { 'aria-hidden': 'true' } }, PLATFORM_LABELS[platform]),
        input,
        h('span', { class: HELP_TEXT, attrs: { 'aria-hidden': 'true' } }, t('settings.offsets.unit')),
      );
    };
    return h(
      'div',
      { class: 'flex flex-col gap-1.5 px-3 py-2.5', attrs: { role: 'group', 'aria-labelledby': 'sk-offsets-title' } },
      h('span', { class: 'text-[13px] font-bold', attrs: { id: 'sk-offsets-title' } }, t('settings.offsets.title')),
      h('div', { class: 'flex flex-wrap items-center gap-x-4 gap-y-1.5' }, field('crunchyroll'), field('adn')),
      h('span', { class: HELP_TEXT, attrs: { id: 'sk-offsets-help' } }, t('settings.offsets.help')),
    );
  }

  function renderLevels(s: SyncSettings): HTMLElement[] {
    return notificationOptions().map((opt) => {
      const input = h('input', {
        class: 'm-0 mt-0.5 h-4 w-4 shrink-0 cursor-pointer',
        attrs: { type: 'radio', name: 'sk-notif', value: opt.value, 'data-focus': `notif-${opt.value}` },
        on: { change: () => input.checked && void ctx.update({ notificationLevel: opt.value }) },
      });
      input.checked = s.notificationLevel === opt.value;
      return h(
        'label',
        {
          class:
            'flex min-h-11 cursor-pointer items-start gap-3 rounded-[10px] border-[1.5px] border-line p-2 transition-colors has-checked:border-sakura has-checked:bg-raised has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-lavender',
        },
        notifGlyph(opt.glyph),
        h(
          'span',
          { class: 'flex min-w-0 flex-1 flex-col gap-0.5' },
          h(
            'span',
            { class: 'flex flex-wrap items-center gap-1.5' },
            h('span', { class: 'text-[13px] font-bold' }, opt.title),
            opt.recommended && h('span', { class: 'inline-flex h-[18px] items-center rounded-full bg-mint px-2 text-[11px] font-bold text-on-fill' }, t('settings.recommended')),
          ),
          h('span', { class: 'text-[11px] leading-[15px] font-semibold text-muted' }, opt.desc),
        ),
        input,
      );
    });
  }

  return {
    drawAiring(now: number): void {
      airingNow = now;
      drawAiring();
    },
    render(): Node[] {
      const s = ctx.data.settings;
      if (!s) return settingsPlaceholder(ctx);
      drawAiring();
      return [
        h(
          'section',
          { class: 'flex flex-col gap-2' },
          h('h2', { class: 'm-0 text-[11px] font-bold tracking-[0.06em] text-muted uppercase', attrs: { id: 'sk-notif-title' } }, t('settings.section.notifications')),
          h(
            'div',
            { class: `${CARD} flex flex-col gap-2 p-2` },
            h('div', { class: 'flex flex-col gap-1', attrs: { role: 'radiogroup', 'aria-labelledby': 'sk-notif-title' } }, ...renderLevels(s)),
            h('span', { class: `px-1 ${HELP_TEXT}` }, t('settings.notif.alertsAlways')),
          ),
          rowsCard(
            toggleRow({
              id: 'sk-rating',
              label: t('settings.ratingPrompt.label'),
              help: t('settings.ratingPrompt.help'),
              checked: s.ratingPrompt,
              onChange: (checked) => void ctx.update({ ratingPrompt: checked }),
            }),
          ),
        ),
        settingsSection(
          t('settings.section.airing'),
          rowsCard(
            toggleRow({ id: 'sk-airing', label: t('settings.airing.label'), help: t('settings.airing.help'), checked: s.airingAlerts, onChange: (checked) => void ctx.update({ airingAlerts: checked }, true) }),
            choiceRow({
              labelId: 'sk-delay-label',
              label: t('settings.delay.title'),
              muted: !s.airingAlerts,
              divider: true,
              control: segmented({
                options: delayOptions(),
                current: `${s.airingDelayHours}`,
                onPick: (value) => void ctx.update({ airingDelayHours: delayFromKey(value) }, true),
                attrs: { 'aria-labelledby': 'sk-delay-label', 'aria-describedby': 'sk-airing-help' },
                focusKey: 'delay',
                activeClass: 'bg-sakura',
                trackClass: 'bg-ground',
                disabled: !s.airingAlerts,
              }),
            }),
            airingSlot,
          ),
        ),
        settingsSection(t('settings.section.agenda'), rowsCard(renderOffsets(s))),
      ];
    },
  };
}
