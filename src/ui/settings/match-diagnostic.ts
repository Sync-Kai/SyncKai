// Réglages › Aide › Diagnostic des correspondances (builds de dev seulement : créé sous `if (__SYNCKAI_DEBUG__)` par
// page-help.ts, absent des bundles publiés). Décisions écrites par le service worker (background/sync/match-diagnostic.ts)
// dans storage.session ; « Copier » donne une décision en JSON (cas du corpus), « Effacer » vide la liste.
import { getLocale, t } from '../../i18n';
import { clearMatchDecisions, readMatchDecisions, type MatchDecision } from '../../shared/match-diagnostic';
import { MATCH_DIAGNOSTIC_KEY } from '../../shared/storage-keys';
import { PLATFORMS } from '../../shared/platforms';
import { createLogger } from '../../shared/logger';
import { BTN_GHOST, CARD } from '../kit';
import { h, type Child } from '../dom';
import { icon } from '../icons';
import { DIVIDER, HELP_TEXT, settingsSection } from './rows';

const log = createLogger('settings');
const COPIED_MS = 2_000;

export interface MatchDiagnosticSection {
  render(): HTMLElement;
}

/** Signaux reçus, en une ligne compacte (valeurs brutes : outil de développement) */
function signalsLine(decision: MatchDecision): string {
  const s = decision.signals;
  if (!s) return '—';
  const parts = [
    s.seasonYear !== undefined && `season ${s.seasonYear}`,
    s.seriesYear !== undefined && `series ${s.seriesYear}`,
    s.seasonEpisodeCount !== undefined && `${s.seasonEpisodeCount} ep${s.airing === true ? '+' : ''}`,
    s.episodeMinutes !== undefined && `${s.episodeMinutes} min`,
    s.format,
    s.country,
    s.originalTitle,
  ];
  return parts.filter((part): part is string => typeof part === 'string' && part.length > 0).join(' · ') || '—';
}

function numbersLine(decision: MatchDecision): string {
  const season = decision.seasonNumber === null ? '' : `S${decision.seasonNumber}`;
  const episode = decision.seasonEpisodeNumber === null ? '' : `E${decision.seasonEpisodeNumber}`;
  const absolute = decision.displayedEpisodeNumber !== null && decision.displayedEpisodeNumber !== decision.seasonEpisodeNumber ? ` (${decision.displayedEpisodeNumber})` : '';
  return `${season}${episode}${absolute}`;
}

const idOf = (decision: MatchDecision): string => `${decision.at}:${decision.key}`;

export function createMatchDiagnosticSection(redraw: () => void): MatchDiagnosticSection {
  let decisions: MatchDecision[] | null = null;
  /** Décision copiée (horodatage et clé), retour « copiée » pendant 2 s */
  let copiedId: string | null = null;
  let copyFailed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function load(): Promise<void> {
    try {
      decisions = await readMatchDecisions();
    } catch (error: unknown) {
      log.warn('Diagnostic des correspondances illisible :', error);
      decisions = [];
    }
    redraw();
  }

  async function copy(decision: MatchDecision): Promise<void> {
    clearTimeout(timer);
    try {
      await navigator.clipboard.writeText(JSON.stringify(decision, null, 2));
      copiedId = idOf(decision);
      copyFailed = false;
      timer = setTimeout(() => {
        copiedId = null;
        redraw();
      }, COPIED_MS);
    } catch (error: unknown) {
      log.warn('Copie de la décision impossible :', error);
      copyFailed = true;
    }
    redraw();
  }

  async function clear(): Promise<void> {
    await clearMatchDecisions();
    await load();
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'session' && changes[MATCH_DIAGNOSTIC_KEY]) void load();
  });
  void load();

  const time = (at: number): string => new Date(at).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  function row(decision: MatchDecision, index: number): HTMLElement {
    const { mediaId, confidence, reason, mapping, source, bySignals } = decision.decision;
    const platform = decision.platform in PLATFORMS ? PLATFORMS[decision.platform].label : decision.platform;
    const target = mediaId === null ? t('settings.matchDiag.noEntry') : `#${mediaId}`;
    const meta = [source, confidence, bySignals && 'signals', mapping && `${mapping.origin}/${mapping.verdict}`].filter((part): part is string => typeof part === 'string');
    const copied = copiedId === idOf(decision);
    return h(
      'li',
      { class: `flex min-w-0 flex-col gap-0.5 px-3 py-2 ${index > 0 ? DIVIDER : ''}` },
      h(
        'div',
        { class: 'flex min-w-0 items-center gap-2' },
        h('span', { class: 'min-w-0 flex-1 truncate text-[12px] font-bold', attrs: { title: `${decision.seriesTitle} · ${decision.key}` } }, `${platform} · ${decision.seriesTitle} ${numbersLine(decision)}`),
        h('span', { class: 'shrink-0 text-[10px] font-semibold text-muted tabular-nums' }, time(decision.at)),
        h(
          'button',
          {
            class: `${BTN_GHOST} shrink-0 border border-line px-2 text-[11px] ${copied ? 'text-mint' : 'text-ink'}`,
            attrs: { type: 'button', title: t('settings.matchDiag.copyTitle'), 'data-focus': `match-diag-copy-${idOf(decision)}` },
            on: { click: () => void copy(decision) },
          },
          copied && icon('check', 'h-3 w-3', '3'),
          copied ? t('settings.matchDiag.copied') : t('settings.matchDiag.copy'),
        ),
      ),
      // Raison et signaux en entier (repliés sur plusieurs lignes) : c'est ce que le propriétaire vient lire
      h('span', { class: `min-w-0 break-words ${HELP_TEXT}` }, `→ ${target} · ${meta.join(' · ')} · ${reason}`),
      h(
        'span',
        { class: `min-w-0 break-words ${HELP_TEXT}` },
        `${signalsLine(decision)} · ${t('settings.matchDiag.candidates', { count: String(decision.candidates.length) })}`,
      ),
    );
  }

  function body(): Child[] {
    if (decisions === null) return [h('span', { class: `block px-3 py-2 ${HELP_TEXT}` }, icon('spinner', 'h-3 w-3 motion-safe:animate-spin'))];
    if (decisions.length === 0) return [h('span', { class: `block px-3 py-2 ${HELP_TEXT}`, attrs: { role: 'status' } }, t('settings.matchDiag.empty'))];
    return [h('ul', { class: 'm-0 flex list-none flex-col p-0' }, ...decisions.map(row))];
  }

  return {
    render: () =>
      settingsSection(
        t('settings.matchDiag.title'),
        h(
          'div',
          { class: `${CARD} flex flex-col overflow-hidden` },
          h(
            'div',
            { class: 'flex items-start gap-2 px-3 py-2' },
            h('p', { class: `m-0 min-w-0 flex-1 ${HELP_TEXT}` }, t('settings.matchDiag.text')),
            h(
              'button',
              {
                class: `${BTN_GHOST} shrink-0 border border-line px-2.5 text-[11px] text-danger`,
                attrs: { type: 'button', 'data-focus': 'match-diag-clear', ...(decisions === null || decisions.length === 0 ? { disabled: '' } : {}) },
                on: { click: () => void clear() },
              },
              t('settings.matchDiag.clear'),
            ),
          ),
          copyFailed && h('span', { class: 'px-3 pb-2 text-[11px] font-bold text-danger', attrs: { role: 'status' } }, t('settings.matchDiag.copyFailed')),
          h('div', { class: DIVIDER }, ...body()),
        ),
      ),
  };
}
