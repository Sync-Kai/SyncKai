import { t, tp, type MessageKey, type PluralKey } from '../../i18n';
import {
  applicableDiffs,
  applyImpact,
  DIFF_FILTERS,
  diffBreakdown,
  matchesFilter,
  otherService,
  planApply,
  skipReasonText,
  type DiffFilter,
  type DiffSide,
  type ListDiff,
} from '../../shared/compare';
import { isJobActive, pauseSecondsLeft, type CompareJob } from '../../shared/compare-job';
import type { ListStatus } from '../../shared/sync.types';
import { TRACKER_LABELS, type TrackerId } from '../../shared/tracker.types';
import { formatRelativeTime } from '../../shared/watching';
import { h, nodes } from '../../ui/dom';
import { icon } from '../../ui/icons';
import { formatStarValue } from '../../ui/rating';
import { TONE_CHIP } from '../feedback';
import type { CompareState } from '../state';
import { renderAlert } from './alert';
import { BTN_GHOST, BTN_PRIMARY, renderCover, sectionTitle } from './ui';

/** Lignes affichées d'emblée, puis par tranche (« Afficher plus ») : le popup reste rapide sur de longues listes */
export const COMPARE_PAGE_SIZE = 30;

interface CompareSectionProps {
  state: CompareState;
  now: number;
  onAnalyze: () => void;
  onApply: (diffs: readonly ListDiff[], source: TrackerId) => void;
  onConfirm: (source: TrackerId | null) => void;
  onFilter: (filter: DiffFilter) => void;
  onShowMore: () => void;
  onCancel: () => void;
  onDismissJob: () => void;
  /** « Réessayer les échecs » : séries en erreur, sur le même service de référence */
  onRetryFailed: (diffs: readonly ListDiff[], source: TrackerId) => void;
}

const SIDES: readonly TrackerId[] = ['anilist', 'mal'];
/** Couleur du texte des boutons : bleu MAL éclairci pour rester lisible (contraste ≥ 4,5:1 sur la surface) */
const SERVICE_TEXT: Record<TrackerId, string> = { anilist: 'text-anilist', mal: 'text-[#8fa9ee]' };

const statusLabel = (status: ListStatus): string => t(`page.status.${status}` satisfies MessageKey);
const scoreLabel = (score: number | null): string => (score === null ? '–' : formatStarValue(Math.round(score * 10) / 10));

const CHIP = 'rounded-full bg-raised px-2 py-0.5 text-[10px] font-bold leading-tight text-muted';
const CHIP_MISSING = 'rounded-full border border-butter/40 bg-butter/10 px-2 py-0.5 text-[10px] font-bold leading-tight text-butter';

/** Analyse ou alignement en cours (ou demandé) : les actions sont désactivées plutôt que refusées */
function isBusy(state: CompareState): boolean {
  return state.requesting !== null || isJobActive(state.job, Date.now());
}

const isAnalyzing = (state: CompareState): boolean =>
  state.requesting === 'analyze' || (state.job?.kind === 'analyze' && isJobActive(state.job, Date.now()));

/** Série en cours d'écriture (première de la tâche) */
function currentMalId(job: CompareJob | null): number | null {
  return job?.kind === 'apply' && job.status === 'running' ? (job.pending[0]?.malId ?? null) : null;
}

// ─── Lignes ───────────────────────────────────────────────────────────────

/** Pastilles des champs en écart : « Ép. AL 12 · MAL 10 », statuts, notes, absence */
function renderChips(diff: ListDiff): HTMLElement[] {
  const { anilist: al, mal } = diff;
  if (al === null || mal === null) {
    const present: DiffSide | null = al ?? mal;
    return nodes([
      h('span', { class: CHIP_MISSING }, t(al ? 'compare.chip.missingMal' : 'compare.chip.missingAniList')),
      present && h('span', { class: CHIP }, t('compare.chip.entry', { service: al ? 'AL' : 'MAL', status: statusLabel(present.status), progress: present.progress })),
    ]).filter((c): c is HTMLElement => c instanceof HTMLElement);
  }
  return diff.fields.flatMap((field) => {
    switch (field) {
      case 'progress':
        return [h('span', { class: CHIP }, t('compare.chip.progress', { al: al.progress, mal: mal.progress }))];
      case 'status':
        return [h('span', { class: CHIP }, t('compare.chip.status', { al: statusLabel(al.status), mal: statusLabel(mal.status) }))];
      case 'score':
        return [h('span', { class: CHIP }, t('compare.chip.score', { al: scoreLabel(al.score), mal: scoreLabel(mal.score) }))];
      case 'presence':
        return [];
    }
  });
}

function keepButton(diff: ListDiff, source: TrackerId, busy: boolean, onApply: CompareSectionProps['onApply']): HTMLElement {
  const plan = planApply(diff, source);
  const target = otherService(source);
  const disabled = busy || plan.action === 'skip';
  const hint = plan.action === 'skip' ? skipReasonText(plan.reason, source) : t('compare.keepTitle', { source: TRACKER_LABELS[source], target: TRACKER_LABELS[target] });
  return h(
    'button',
    {
      class: `${BTN_GHOST} h-7 px-2.5 text-[11px] ${SERVICE_TEXT[source]}`,
      attrs: {
        type: 'button',
        title: hint,
        'aria-label': t('compare.keepAria', { title: diff.title, source: TRACKER_LABELS[source], target: TRACKER_LABELS[target] }),
        'data-focus': `compare-${source}-${diff.key}`,
        ...(disabled ? { disabled: '' } : {}),
      },
      on: { click: () => onApply([diff], source) },
    },
    t(`compare.keep.${source}` satisfies MessageKey),
  );
}

function renderRow(diff: ListDiff, { state, onApply }: CompareSectionProps, busy: boolean): HTMLElement {
  const current = currentMalId(state.job) === diff.malId;
  const error = state.result?.errors[diff.key];
  return h(
    'li',
    { class: `flex gap-2.5 rounded-lg bg-surface px-2.5 py-2 ${error ? 'shadow-[inset_3px_0_0_var(--color-danger)]' : ''}`, attrs: current ? { 'aria-busy': 'true' } : {} },
    renderCover(diff.title, diff.coverUrl, 'h-12 w-9', 'text-[11px]'),
    h(
      'div',
      { class: 'flex min-w-0 flex-1 flex-col gap-1' },
      h('span', { class: 'truncate text-[12px] font-bold', attrs: { title: diff.title } }, diff.title),
      h('div', { class: 'flex flex-wrap gap-1' }, ...renderChips(diff)),
      error && h('span', { class: 'line-clamp-2 text-[11px] font-semibold text-danger', attrs: { role: 'alert', title: error } }, error),
      h(
        'div',
        { class: 'flex flex-wrap items-center justify-end gap-1' },
        current && icon('spinner', 'mr-1 h-3 w-3 text-muted motion-safe:animate-spin'),
        ...SIDES.map((source) => keepButton(diff, source, busy, onApply)),
      ),
    ),
  );
}

// ─── Tâche en cours / bilan ───────────────────────────────────────────────

/** Barre de progression de l'alignement (restaurée à la réouverture du popup) + « Arrêter » */
/** Texte de la pause en cours (compte à rebours recalculé chaque seconde par le popup) */
function pauseText(job: CompareJob): string | null {
  if (job.pausedUntil === null || job.pauseReason === null) return null;
  if (job.pauseReason === 'resume') return t('compare.pause.resume');
  const service = job.pauseService ? TRACKER_LABELS[job.pauseService] : '';
  return t(`compare.pause.${job.pauseReason}` satisfies MessageKey, { service, seconds: pauseSecondsLeft(job, Date.now()) });
}

function renderJob(job: CompareJob, { state, onCancel, onDismissJob, onRetryFailed }: CompareSectionProps): HTMLElement | null {
  if (job.kind !== 'apply') return null;
  if (job.status === 'running') {
    const percent = job.total > 0 ? Math.round((job.done / job.total) * 100) : 0;
    const pause = pauseText(job);
    return h(
      'div',
      { class: 'flex flex-col gap-1.5 rounded-lg bg-surface px-2.5 py-2' },
      h(
        'div',
        { class: 'flex items-center justify-between gap-2' },
        h(
          'span',
          { class: 'flex min-w-0 items-center gap-1.5 text-[11px] font-bold text-lavender', attrs: { role: 'status' } },
          icon('spinner', 'h-3 w-3 shrink-0 motion-safe:animate-spin'),
          h('span', { class: 'truncate' }, t('compare.bulk.running', { done: job.done, total: job.total })),
        ),
        h(
          'button',
          {
            class: `${BTN_GHOST} h-7 px-2.5 text-[11px] text-danger`,
            attrs: { type: 'button', 'data-focus': 'compare-cancel', ...(job.cancelled ? { disabled: '' } : {}) },
            on: { click: onCancel },
          },
          job.cancelled ? t('compare.job.stopping') : t('compare.job.stop'),
        ),
      ),
      h(
        'div',
        {
          class: 'h-1.5 overflow-hidden rounded-full bg-raised',
          attrs: { role: 'progressbar', 'aria-label': t('compare.job.progressAria'), 'aria-valuemin': '0', 'aria-valuemax': String(job.total), 'aria-valuenow': String(job.done) },
        },
        h('div', { class: 'h-full rounded-full bg-lavender transition-[width]', attrs: { style: `width:${percent}%` } }),
      ),
      pause && h('p', { class: 'm-0 flex items-center gap-1.5 text-[11px] font-bold text-butter', attrs: { role: 'status' } }, icon('clock', 'h-3 w-3 shrink-0'), pause),
    );
  }

  // Bilan du dernier alignement, jusqu'à « OK » ; les séries en échec restent listées avec leur erreur
  const errors = state.result?.errors ?? {};
  const retry = (state.result?.items ?? []).filter((d) => errors[d.key] !== undefined);
  const parts = [
    job.updated > 0 && tp('compare.result.updated', job.updated),
    job.skipped > 0 && tp('compare.result.skipped', job.skipped),
    job.failed > 0 && tp('compare.result.failed', job.failed),
  ].filter((p): p is string => typeof p === 'string');
  const head = job.status === 'stopped' ? t('compare.job.stopped', { message: job.message ?? '' }) : t(job.status === 'cancelled' ? 'compare.job.cancelled' : 'compare.job.done');
  const tone = job.status === 'stopped' || (job.failed > 0 && job.updated === 0) ? 'error' : job.failed > 0 || job.status === 'cancelled' ? 'warning' : 'success';
  return h(
    'div',
    { class: `flex items-start gap-2 rounded-lg border px-2.5 py-2 text-[11px] font-bold ${TONE_CHIP[tone]}`, attrs: { role: 'status', title: job.messages.join('\n') } },
    h('p', { class: 'm-0 min-w-0 flex-1 break-words' }, [head, ...parts].join(' · ')),
    retry.length > 0 &&
      job.source !== null &&
      h(
        'button',
        { class: 'shrink-0 cursor-pointer rounded-full px-1 text-ink underline-offset-2 hover:underline', attrs: { type: 'button', 'data-focus': 'compare-retry-failed' }, on: { click: () => job.source && onRetryFailed(retry, job.source) } },
        t('compare.job.retryFailed'),
      ),
    h('button', { class: 'shrink-0 cursor-pointer rounded-full px-1 text-ink underline-offset-2 hover:underline', attrs: { type: 'button', 'data-focus': 'compare-dismiss' }, on: { click: onDismissJob } }, t('compare.job.dismiss')),
  );
}

// ─── Filtres et alignement en lot ─────────────────────────────────────────

const FILTER_BREAKDOWN: Partial<Record<DiffFilter, PluralKey>> = {
  missingMal: 'compare.breakdown.missingMal',
  missingAniList: 'compare.breakdown.missingAniList',
  progress: 'compare.breakdown.progress',
  status: 'compare.breakdown.status',
  score: 'compare.breakdown.score',
};

/** « 290 absentes de MAL · 30 progressions · 15 statuts · 9 notes » (types présents seulement) */
function breakdownText(items: readonly ListDiff[]): string {
  const counts = diffBreakdown(items);
  return DIFF_FILTERS.flatMap((filter) => {
    const key = FILTER_BREAKDOWN[filter];
    return key && counts[filter] > 0 ? [tp(key, counts[filter])] : [];
  }).join(' · ');
}

function renderFilters(items: readonly ListDiff[], { state, onFilter }: CompareSectionProps): HTMLElement {
  const counts = diffBreakdown(items);
  return h(
    'div',
    { class: 'flex flex-wrap gap-1', attrs: { role: 'group', 'aria-label': t('compare.filter.aria') } },
    ...DIFF_FILTERS.filter((f) => f === 'all' || f === state.filter || counts[f] > 0).map((filter) => {
      const on = filter === state.filter;
      return h(
        'button',
        {
          class: `h-6 cursor-pointer rounded-full px-2.5 text-[10px] font-bold transition-colors ${on ? 'bg-sakura text-on-fill' : 'bg-surface text-muted hover:text-ink'}`,
          attrs: { type: 'button', 'aria-pressed': String(on), 'data-focus': `compare-filter-${filter}` },
          on: { click: () => !on && onFilter(filter) },
        },
        `${t(`compare.filter.${filter}` satisfies MessageKey)} ${counts[filter]}`,
      );
    }),
  );
}

/** Confirmation : nombre de séries et changements réels sur le service de destination, ajouts mis en avant */
function renderConfirm(filtered: readonly ListDiff[], source: TrackerId, { onApply, onConfirm }: CompareSectionProps): HTMLElement {
  const target = otherService(source);
  const labels = { source: TRACKER_LABELS[source], target: TRACKER_LABELS[target] };
  const impact = applyImpact(filtered, source);
  const changes = [
    impact.progress > 0 && tp('compare.impact.progress', impact.progress),
    impact.status > 0 && tp('compare.impact.status', impact.status),
    impact.score > 0 && tp('compare.impact.score', impact.score),
  ].filter((c): c is string => typeof c === 'string');
  return h(
    'div',
    { class: 'flex flex-col gap-1.5 rounded-lg border border-butter/40 bg-butter/10 px-2.5 py-2', attrs: { role: 'group', 'aria-label': tp('compare.impact.question', impact.total, labels) } },
    h('p', { class: 'm-0 text-[11px] font-bold text-ink' }, tp('compare.impact.question', impact.total, labels)),
    h(
      'ul',
      { class: 'm-0 flex list-disc flex-col gap-0.5 pl-4 text-[11px] text-ink' },
      ...nodes([
        impact.created > 0 && h('li', { class: 'font-bold text-butter' }, tp('compare.impact.created', impact.created, labels)),
        ...changes.map((c) => h('li', {}, c)),
      ]),
    ),
    impact.created > 0 && h('p', { class: 'm-0 text-[10px] text-muted' }, t('compare.impact.addWarning', labels)),
    h(
      'div',
      { class: 'flex flex-wrap justify-end gap-1' },
      h('button', { class: `${BTN_GHOST} h-7 text-muted`, attrs: { type: 'button', 'data-focus': 'compare-bulk-cancel' }, on: { click: () => onConfirm(null) } }, t('common.cancel')),
      h(
        'button',
        {
          class: `${BTN_PRIMARY} h-7 px-3`,
          attrs: { type: 'button', 'data-focus': 'compare-bulk-confirm', ...(impact.total === 0 ? { disabled: '' } : {}) },
          on: { click: () => onApply(applicableDiffs(filtered, source), source) },
        },
        t('common.confirm'),
      ),
    ),
  );
}

function renderBulk(filtered: readonly ListDiff[], busy: boolean, props: CompareSectionProps): HTMLElement {
  const { state, onConfirm } = props;
  if (state.confirm && !busy) return renderConfirm(filtered, state.confirm, props);
  return h(
    'div',
    { class: 'flex flex-wrap gap-1' },
    ...SIDES.map((source) => {
      const count = applicableDiffs(filtered, source).length;
      const label: MessageKey = state.filter === 'all' ? `compare.bulk.${source}` : `compare.bulk.filtered.${source}`;
      return h(
        'button',
        {
          class: `${BTN_GHOST} h-7 bg-surface px-2.5 text-[11px] ${SERVICE_TEXT[source]}`,
          attrs: {
            type: 'button',
            'data-focus': `compare-bulk-${source}`,
            ...(count === 0 ? { title: t('compare.bulk.empty', { source: TRACKER_LABELS[source] }) } : {}),
            ...(count === 0 || busy ? { disabled: '' } : {}),
          },
          on: { click: () => onConfirm(source) },
        },
        t(label),
      );
    }),
  );
}

function analyzeButton(state: CompareState, onAnalyze: () => void, label: string, primary: boolean): HTMLElement {
  const analyzing = isAnalyzing(state);
  return h(
    'button',
    {
      class: primary ? `${BTN_PRIMARY} self-start` : `${BTN_GHOST} h-7 px-2.5 text-[11px] text-sakura`,
      attrs: { type: 'button', 'data-focus': 'compare-analyze', ...(isBusy(state) ? { disabled: '' } : {}), ...(analyzing ? { 'aria-busy': 'true' } : {}) },
      on: { click: onAnalyze },
    },
    analyzing ? icon('spinner', 'h-3 w-3 motion-safe:animate-spin') : !primary && icon('retry', 'h-3 w-3', '2.4'),
    analyzing ? t('compare.analyzing') : label,
  );
}

/** Activité › « Écarts AniList ↔ MAL » : affiché seulement si les deux services sont connectés */
export function renderCompareSection(props: CompareSectionProps): HTMLElement {
  const { state, now, onAnalyze, onShowMore } = props;
  const { result, job } = state;
  const busy = isBusy(state);
  const items = result?.items ?? [];
  const filtered = items.filter((diff) => matchesFilter(diff, state.filter));
  const hidden = filtered.length - Math.min(filtered.length, state.shown);
  const breakdown = breakdownText(items);

  return h(
    'section',
    { class: 'flex flex-col gap-2', attrs: { 'aria-label': t('compare.section') } },
    ...nodes([
      sectionTitle(t('compare.section'), { text: 'クラベ', class: 'text-sakura' }),
      !result && h('p', { class: 'm-0 text-[11px] text-muted' }, t('compare.intro')),
      !result && analyzeButton(state, onAnalyze, t('compare.analyze'), true),
      result &&
        h(
          'div',
          { class: 'flex flex-col gap-0.5' },
          h(
            'p',
            { class: 'm-0 text-[12px] font-bold' },
            [tp('compare.summary.compared', result.counts.compared), tp('compare.summary.diffs', result.counts.different)].join(' · '),
            result.counts.notComparable > 0 &&
              h('span', { class: 'font-semibold text-muted', attrs: { title: t('compare.notComparableHint') } }, ` · ${tp('compare.summary.notComparable', result.counts.notComparable)}`),
          ),
          breakdown && h('p', { class: 'm-0 text-[11px] font-semibold text-muted' }, breakdown),
          h(
            'div',
            { class: 'flex flex-wrap items-center justify-between gap-1' },
            h('span', { class: 'text-[11px] text-muted' }, t('compare.analyzedAt', { relative: formatRelativeTime(result.analyzedAt, now) })),
            analyzeButton(state, onAnalyze, t('compare.rerun'), false),
          ),
        ),
      job && renderJob(job, props),
      state.error && renderAlert({ message: state.error }),
      result && items.length === 0 && h('p', { class: 'm-0 flex items-center gap-1.5 text-[11px] font-bold text-mint' }, icon('check', 'h-3 w-3', '2.4'), t('compare.none')),
      items.length > 0 && renderFilters(items, props),
      filtered.length > 0 && renderBulk(filtered, busy, props),
      items.length > 0 && filtered.length === 0 && h('p', { class: 'm-0 text-[11px] text-muted' }, t('compare.filter.empty')),
      filtered.length > 0 && h('ul', { class: 'm-0 flex list-none flex-col gap-1 p-0' }, ...filtered.slice(0, state.shown).map((diff) => renderRow(diff, props, busy))),
      hidden > 0 &&
        h(
          'button',
          { class: `${BTN_GHOST} self-center text-[11px] text-sakura`, attrs: { type: 'button', 'data-focus': 'compare-more' }, on: { click: onShowMore } },
          t('compare.showMore', { count: hidden }),
        ),
    ]),
  );
}
