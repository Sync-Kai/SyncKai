// Réglages › Mes données › Écarts AniList ↔ MAL (maquettes DonneesEcarts, DonneesEcartsEtats) : analyse des deux listes
// (jamais analysé, en cours avec l'attente du quota AniList, résumé et « Relancer », aucun écart, erreurs), filtres, zone
// « Aligner » (boutons en lot, puis confirmation, alignement en cours avec ses pauses et « Arrêter », bilan avec
// « Réessayer les échecs » : l'un remplace l'autre), et lignes d'écart (« Garder AniList / MAL », raison d'un bouton sans
// objet sous la ligne, série modifiée depuis l'analyse, série en cours d'écriture, erreur). Analyse et alignement sont
// des tâches du service worker (background/compare/), suivies par le contrôleur de l'hôte (ui/compare-controller.ts) :
// elles continuent page fermée.
import { useLayoutEffect, useRef } from 'preact/hooks';
import { t, tp, type MessageKey } from '../../i18n';
import { applicableDiffs, applyImpact, otherService, planApply, skipReasonText, type DiffFilter, type DiffSide, type ListDiff } from '../../shared/compare';
import { currentApplyMalId, isJobActive, type CompareJob } from '../../shared/compare-job';
import { entryLink, type EntryLink, type EntryLinkContext } from '../../shared/entry-link';
import { DEFAULT_SETTINGS } from '../../shared/settings';
import type { ListStatus } from '../../shared/sync.types';
import { TRACKER_IDS, TRACKER_LABELS, type TrackerId } from '../../shared/tracker.types';
import { formatRelativeTime } from '../../shared/watching';
import { isCountingDown, type CompareController, type CompareState } from '../compare-controller';
import { Alert } from '../components/alert';
import { Button } from '../components/button';
import { Cover } from '../components/cover';
import { Icon } from '../components/icon';
import { Section } from '../components/section';
import { jobPauseText } from '../job-pause';
import { useFocusFallback, useLocale, useNow, useStore } from '../preact/hooks';
import { formatStarValue } from '../rating';
import { breakdownText, COMPARE_SIDES, failedDiffs, filteredDiffs, jobSummary, skipNotes, visibleFilters, type JobSummaryTone } from './compare-model';
import type { SettingsContext, SettingsMountedPage } from './context';
import { preactPage } from './preact-page';

/** Compte à rebours d'une pause : relu chaque seconde ; sinon « Analysé il y a… » vieillit chaque minute */
const PAUSE_TICK_MS = 1_000;
const CLOCK_TICK_MS = 60_000;
/** Séries en échec listées dans le bilan (toutes restent marquées sur leur ligne) */
const MAX_FAILED_SHOWN = 5;

const CARD = 'rounded-card border border-line bg-surface';
const CHIP = 'max-w-full rounded-control bg-raised px-2 py-px text-secondary font-bold break-words text-muted';
const CHIP_MISSING = 'max-w-full rounded-control border border-butter/40 bg-butter/10 px-2 py-px text-secondary font-bold break-words text-butter';
/** Séparateur entre deux lignes d'écart, décalé après la jaquette */
const ROW_DIVIDER = 'before:absolute before:top-0 before:right-3 before:left-14 before:h-px before:bg-line';

const TONES: Readonly<Record<JobSummaryTone, string>> = {
  success: 'border-mint/40 bg-mint/10 text-mint',
  warning: 'border-butter/40 bg-butter/10 text-butter',
  error: 'border-danger/40 bg-danger/10 text-danger',
};

const statusLabel = (status: ListStatus): string => t(`page.status.${status}` satisfies MessageKey);
const scoreLabel = (score: number | null): string => (score === null ? '–' : formatStarValue(Math.round(score * 10) / 10));

/** Analyse ou alignement en cours (ou demandé) : les actions sont désactivées */
const isBusy = (state: CompareState, now: number): boolean => state.requesting !== null || isJobActive(state.job, now);
const isAnalyzing = (state: CompareState, now: number): boolean => state.requesting === 'analyze' || (state.job?.kind === 'analyze' && isJobActive(state.job, now));

// ─── Morceaux ─────────────────────────────────────────────────────────────

/** Ligne de pause d'une tâche (limite de requêtes, quota, reprise) : compte à rebours en place, sans région live */
function PauseLine({ text }: { text: string }) {
  return (
    <p class="m-0 flex items-start gap-1.5 text-secondary font-bold text-butter">
      <Icon name="pause" class="mt-0.5 size-3 shrink-0" strokeWidth="3" />
      <span data-job-pause="">{text}</span>
    </p>
  );
}

/** Pastilles des champs en écart : « Ép. AL 12 · MAL 10 », statuts, notes, absence */
function Chips({ diff }: { diff: ListDiff }) {
  const { anilist: al, mal } = diff;
  if (al === null || mal === null) {
    const present: DiffSide | null = al ?? mal;
    return (
      <>
        <span class={CHIP_MISSING}>{t(al ? 'compare.chip.missingMal' : 'compare.chip.missingAniList')}</span>
        {present && <span class={CHIP}>{t('compare.chip.entry', { service: al ? 'AL' : 'MAL', status: statusLabel(present.status), progress: present.progress })}</span>}
      </>
    );
  }
  return (
    <>
      {diff.fields.map((field) => {
        switch (field) {
          case 'progress':
            return (
              <span key={field} class={CHIP}>
                {t('compare.chip.progress', { al: al.progress, mal: mal.progress })}
              </span>
            );
          case 'status':
            return (
              <span key={field} class={CHIP}>
                {t('compare.chip.status', { al: statusLabel(al.status), mal: statusLabel(mal.status) })}
              </span>
            );
          case 'score':
            return (
              <span key={field} class={CHIP}>
                {t('compare.chip.score', { al: scoreLabel(al.score), mal: scoreLabel(mal.score) })}
              </span>
            );
          case 'presence':
            return null;
        }
      })}
    </>
  );
}

interface DiffRowProps {
  diff: ListDiff;
  first: boolean;
  /** Série en cours d'écriture par l'alignement */
  current: boolean;
  error: string | undefined;
  busy: boolean;
  link: EntryLink | null;
  onKeep: (source: TrackerId) => void;
}

function DiffRow({ diff, first, current, error, busy, link, onKeep }: DiffRowProps) {
  const cover = <Cover size="agenda" title={diff.title} src={diff.coverUrl} />;
  const notes = skipNotes(diff);
  const stale = diff.stale === true;
  return (
    <li
      class={`relative flex flex-col gap-1.5 px-3 py-2.5 ${first ? '' : ROW_DIVIDER} ${error ? 'shadow-[inset_3px_0_0_var(--color-danger)]' : ''}`}
      aria-busy={current ? 'true' : undefined}
      data-diff={diff.key}
    >
      <div class="flex gap-3 @max-[304px]:flex-wrap">
        {link ? (
          <a class="block shrink-0 self-start rounded-cover transition hover:brightness-110" href={link.url} target="_blank" rel="noopener noreferrer" tabIndex={-1} aria-hidden="true">
            {cover}
          </a>
        ) : (
          <span class="shrink-0 self-start">{cover}</span>
        )}
        <div class="flex min-w-0 flex-1 flex-col gap-1">
          <span class="line-clamp-2 font-bold break-words" title={diff.title} data-diff-title="">
            {link ? (
              <a
                class="text-ink no-underline underline-offset-2 hover:underline"
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('entry.openAria', { title: diff.title, service: TRACKER_LABELS[link.service] })}
                data-focus={`compare-entry-${diff.key}`}
              >
                {diff.title}
              </a>
            ) : (
              diff.title
            )}
          </span>
          <div class="flex flex-wrap gap-1">
            <Chips diff={diff} />
          </div>
        </div>
        {/* Carte étroite (panneau à 320 px) : boutons sous le titre, à droite, pour laisser la place aux pastilles */}
        <div class="flex shrink-0 flex-col items-stretch gap-1.5 @max-[304px]:basis-full @max-[304px]:flex-row @max-[304px]:flex-wrap @max-[304px]:justify-end">
          {current && (
            <span class="flex justify-end text-muted">
              <Icon name="spinner" class="size-3.5 animate-spin motion-reduce:animate-none" strokeWidth="2.6" />
            </span>
          )}
          {COMPARE_SIDES.map((source) => {
            const plan = planApply(diff, source);
            const target = otherService(source);
            const labels = { source: TRACKER_LABELS[source], target: TRACKER_LABELS[target] };
            return (
              <Button
                key={source}
                size="sm"
                disabled={plan.action === 'skip' || busy}
                title={plan.action === 'skip' ? skipReasonText(plan.reason, source) : t('compare.keepTitle', labels)}
                ariaLabel={t('compare.keepAria', { title: diff.title, ...labels })}
                focusKey={`compare-${source}-${diff.key}`}
                onClick={() => onKeep(source)}
              >
                {t(`compare.keep.${source}` satisfies MessageKey)}
              </Button>
            );
          })}
        </div>
      </div>
      {/* Sous la ligne, sur toute la largeur après la jaquette : erreur, série modifiée, raisons des boutons sans objet */}
      {(error || stale || notes.length > 0) && (
        <div class="flex flex-col gap-1 pl-11">
          {/* Erreur d'une ligne : texte simple (le bilan de l'alignement annonce les échecs) */}
          {error && <span class="text-secondary font-bold break-words text-danger">{error}</span>}
          {/* Modifiée depuis l'analyse : valeurs périmées, boutons désactivés (planApply) */}
          {stale && <span class="text-secondary font-bold text-butter">{t('compare.skip.changed')}</span>}
          {notes.map((note) => (
            <span key={note} class="flex items-start gap-1 text-secondary text-muted" data-skip-note="">
              <Icon name="info" class="mt-0.5 size-3 shrink-0" strokeWidth="2.2" />
              <span class="min-w-0 break-words">{note}</span>
            </span>
          ))}
        </div>
      )}
    </li>
  );
}

/** Confirmation « Tout aligner sur … » : changements réels sur le service de destination, ajouts mis en avant */
function Confirm({ filtered, source, onApply, onCancel }: { filtered: readonly ListDiff[]; source: TrackerId; onApply: () => void; onCancel: () => void }) {
  const cancel = useRef<HTMLDivElement>(null);
  // Confirmation ouverte : focus sur « Annuler » (charte : une confirmation en ligne met le focus sur le refus)
  useLayoutEffect(() => cancel.current?.querySelector<HTMLElement>('[data-focus="compare-bulk-cancel"]')?.focus({ preventScroll: true }), []);
  const labels = { source: TRACKER_LABELS[source], target: TRACKER_LABELS[otherService(source)] };
  const impact = applyImpact(filtered, source);
  const question = tp('compare.impact.question', impact.total, labels);
  const changes = [
    impact.progress > 0 && tp('compare.impact.progress', impact.progress),
    impact.status > 0 && tp('compare.impact.status', impact.status),
    impact.score > 0 && tp('compare.impact.score', impact.score),
  ].filter((change): change is string => typeof change === 'string');
  return (
    <div class="flex flex-col gap-2 rounded-card border border-butter/40 bg-butter/10 p-3" role="group" aria-label={question} data-compare-confirm="">
      <p class="m-0 font-bold text-ink">{question}</p>
      <ul class="m-0 flex list-disc flex-col gap-0.5 pl-5 text-secondary text-ink">
        {impact.created > 0 && <li class="font-bold text-butter">{tp('compare.impact.created', impact.created, labels)}</li>}
        {changes.map((change) => (
          <li key={change}>{change}</li>
        ))}
      </ul>
      {impact.created > 0 && <p class="m-0 text-secondary text-muted">{t('compare.impact.addWarning', labels)}</p>}
      <div ref={cancel} class="flex flex-wrap items-center justify-end gap-2">
        <Button variant="text" focusKey="compare-bulk-cancel" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button disabled={impact.total === 0} focusKey="compare-bulk-confirm" onClick={onApply}>
          {t('common.confirm')}
        </Button>
      </div>
    </div>
  );
}

/** Alignement en cours : progression, « Arrêter » (« Arrêt… » une fois demandé), pause éventuelle */
function Running({ job, now, onCancel }: { job: CompareJob; now: number; onCancel: () => void }) {
  const percent = job.total > 0 ? Math.round((job.done / job.total) * 100) : 0;
  const pause = jobPauseText(job, now);
  return (
    <div class={`${CARD} flex flex-col gap-2 p-3`} data-compare-running="">
      <div class="flex items-center justify-between gap-2">
        <span class="flex min-w-0 items-center gap-1.5 font-bold text-lavender" role="status">
          <Icon name="spinner" class="size-3.5 shrink-0 animate-spin motion-reduce:animate-none" strokeWidth="2.6" />
          <span class="truncate">{t('compare.bulk.running', { done: job.done, total: job.total })}</span>
        </span>
        <Button variant="danger" size="sm" disabled={job.cancelled} focusKey="compare-cancel" onClick={onCancel}>
          {job.cancelled ? t('compare.job.stopping') : t('compare.job.stop')}
        </Button>
      </div>
      <div
        class="h-1.5 overflow-hidden rounded-pill bg-raised"
        role="progressbar"
        aria-label={t('compare.job.progressAria')}
        aria-valuemin={0}
        aria-valuemax={job.total}
        aria-valuenow={job.done}
      >
        <div class="h-full rounded-pill bg-lavender transition-[width]" style={{ width: `${percent}%` }} />
      </div>
      {pause && <PauseLine text={pause} />}
      <p class="m-0 text-secondary text-muted">{t('compare.job.background')}</p>
    </div>
  );
}

/** Bilan du dernier alignement, jusqu'à « OK » ; les séries en échec listées avec leur erreur */
function Summary({ job, failed, errors, onRetry, onDismiss }: { job: CompareJob; failed: readonly ListDiff[]; errors: Record<string, string>; onRetry: (() => void) | null; onDismiss: () => void }) {
  const { text, tone } = jobSummary(job);
  return (
    <div class={`flex flex-col gap-2 rounded-card border p-3 ${TONES[tone]}`} title={job.messages.join('\n')} data-compare-summary={tone}>
      <div class="flex flex-wrap items-center gap-2">
        <p class="m-0 min-w-0 flex-1 font-bold break-words" role="status">
          {text}
        </p>
        <span class="ml-auto flex shrink-0 items-center gap-1">
          {onRetry && (
            <Button size="sm" focusKey="compare-retry-failed" onClick={onRetry}>
              {t('compare.job.retryFailed')}
            </Button>
          )}
          <Button variant="text" size="sm" focusKey="compare-dismiss" onClick={onDismiss}>
            {t('compare.job.dismiss')}
          </Button>
        </span>
      </div>
      {failed.length > 0 && (
        <ul class="m-0 flex list-none flex-col gap-1 p-0">
          {failed.slice(0, MAX_FAILED_SHOWN).map((diff) => (
            <li key={diff.key} class="flex min-w-0 flex-wrap gap-x-2 rounded-panel bg-surface px-2.5 py-1.5 text-secondary shadow-[inset_3px_0_0_var(--color-danger)]">
              <span class="min-w-0 truncate font-bold text-ink">{diff.title}</span>
              <span class="min-w-0 break-words text-danger">{errors[diff.key]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

interface ComparePageProps {
  ctx: SettingsContext;
  compare: CompareController;
}

export function ComparePage({ ctx, compare }: ComparePageProps) {
  useLocale();
  const state = useStore(compare.store);
  const data = useStore(ctx.state);
  const anilist = useStore(ctx.host.accounts.anilist);
  const mal = useStore(ctx.host.accounts.mal);
  const now = useNow(isCountingDown(state.job) ? PAUSE_TICK_MS : CLOCK_TICK_MS);
  const root = useRef<HTMLDivElement>(null);
  useFocusFallback(root);

  const connected = TRACKER_IDS.filter((service) => (service === 'anilist' ? anilist : mal).status === 'logged-in');
  const links: EntryLinkContext = { connected, preferred: data.settings?.entryService ?? DEFAULT_SETTINGS.entryService };
  // Fiche ouverte : connue une fois les réglages (« Fiche ouverte par défaut ») et les comptes lus, sinon titres sans lien
  const linksReady = data.settings !== null && anilist.status !== 'loading' && mal.status !== 'loading';
  const { result, job } = state;
  const busy = isBusy(state, now);
  const analyzing = isAnalyzing(state, now);
  const items = result?.items ?? [];
  const filtered = filteredDiffs(items, state.filter);
  const hidden = filtered.length - Math.min(filtered.length, state.shown);
  const analyzePause = job?.kind === 'analyze' && job.status === 'running' ? jobPauseText(job, now) : null;
  const applyJob = job?.kind === 'apply' ? job : null;
  const failed = failedDiffs(result);
  const applying = currentApplyMalId(job);

  const analyzeLabel = analyzing ? t('compare.analyzing') : result ? t('compare.rerun') : t('compare.analyze');
  const analyze = (primary: boolean) => (
    <Button
      variant={primary ? 'primary' : 'secondary'}
      size={primary ? 'md' : 'sm'}
      icon={primary ? undefined : 'retry'}
      busy={analyzing}
      disabled={busy && !analyzing}
      focusKey="compare-analyze"
      onClick={() => void compare.analyze()}
    >
      {analyzeLabel}
    </Button>
  );

  /** Zone « Aligner » : boutons en lot, ou ce qui les remplace (confirmation, alignement en cours, bilan) */
  function alignZone() {
    if (applyJob && applyJob.status === 'running') return <Running job={applyJob} now={now} onCancel={() => void compare.cancel()} />;
    if (applyJob) {
      const source = applyJob.source;
      return (
        <Summary
          job={applyJob}
          failed={failed}
          errors={result?.errors ?? {}}
          onRetry={failed.length > 0 && source !== null ? () => void compare.apply(failed, source) : null}
          onDismiss={() => void compare.dismissJob()}
        />
      );
    }
    if (filtered.length === 0) return null;
    if (state.confirm && !busy) {
      const source = state.confirm;
      return <Confirm filtered={filtered} source={source} onApply={() => void compare.apply(applicableDiffs(filtered, source), source)} onCancel={() => compare.setConfirm(null)} />;
    }
    const empty = COMPARE_SIDES.filter((source) => applicableDiffs(filtered, source).length === 0);
    return (
      <>
        <div class="@container flex flex-wrap gap-2">
          {COMPARE_SIDES.map((source) => {
            const count = applicableDiffs(filtered, source).length;
            const label: MessageKey = state.filter === 'all' ? `compare.bulk.${source}` : `compare.bulk.filtered.${source}`;
            return (
              <Button
                key={source}
                variant={source === 'anilist' ? 'primary' : 'secondary'}
                class="min-w-0 flex-1 basis-0 @max-[22rem]:basis-full"
                disabled={count === 0 || busy}
                focusKey={`compare-bulk-${source}`}
                onClick={() => compare.setConfirm(source)}
              >
                <span class="truncate">{t(label)}</span>
              </Button>
            );
          })}
        </div>
        {empty.map((source) => (
          <p key={source} class="m-0 flex items-center gap-1 text-secondary text-muted" data-bulk-empty={source}>
            <Icon name="info" class="size-3 shrink-0" strokeWidth="2.2" />
            {t('compare.bulk.empty', { source: TRACKER_LABELS[source] })}
          </p>
        ))}
        <p class="m-0 text-secondary text-muted">{t('compare.bulk.help', { action: t('compare.bulk.anilist') })}</p>
      </>
    );
  }

  return (
    <div ref={root} class="flex flex-col gap-4">
      <p class="m-0 mx-1 text-secondary text-muted">{t('compare.intro')}</p>

      {!result && (
        <div class="flex flex-col items-start gap-2">
          {analyze(true)}
          {analyzePause && <PauseLine text={analyzePause} />}
        </div>
      )}

      {result && (
        <div class={`${CARD} flex flex-col gap-1 p-3`} data-compare-result="">
          <p class="m-0 font-bold">
            {[tp('compare.summary.compared', result.counts.compared), tp('compare.summary.diffs', result.counts.different)].join(' · ')}
            {result.counts.notComparable > 0 && (
              <span class="font-semibold text-muted" title={t('compare.notComparableHint')}>{` · ${tp('compare.summary.notComparable', result.counts.notComparable)}`}</span>
            )}
          </p>
          {items.length > 0 && <p class="m-0 text-secondary text-muted">{breakdownText(items)}</p>}
          <div class="mt-1 flex flex-wrap items-center justify-between gap-2">
            <span class="text-secondary text-muted">{t('compare.analyzedAt', { relative: formatRelativeTime(result.analyzedAt, now) })}</span>
            {analyze(false)}
          </div>
          {analyzePause && <PauseLine text={analyzePause} />}
        </div>
      )}

      {state.error && <Alert message={state.error} />}

      {result && items.length === 0 && !applyJob && (
        <p class="m-0 mx-1 flex items-center gap-1.5 text-secondary font-bold text-mint" data-compare-none="">
          <Icon name="check" class="size-3.5 shrink-0" strokeWidth="2.6" />
          {t('compare.none')}
        </p>
      )}

      {(items.length > 0 || applyJob) && (
        <Section title={t('compare.align')}>
          {items.length > 0 && (
            <div class="flex flex-wrap gap-1.5" role="group" aria-label={t('compare.filter.aria')}>
              {visibleFilters(items, state.filter).map(({ filter, count }) => (
                <FilterChip key={filter} filter={filter} count={count} on={filter === state.filter} onPick={() => compare.setFilter(filter)} />
              ))}
            </div>
          )}
          {items.length > 0 && filtered.length === 0 && <p class="m-0 mx-1 font-bold">{t('compare.filter.empty')}</p>}
          {alignZone()}
        </Section>
      )}

      {filtered.length > 0 && (
        <Section title={tp('compare.summary.diffs', filtered.length)}>
          <div class={`${CARD} @container flex flex-col`}>
            <ul class="m-0 flex list-none flex-col p-0">
              {filtered.slice(0, state.shown).map((diff, index) => (
                <DiffRow
                  key={diff.key}
                  diff={diff}
                  first={index === 0}
                  current={applying === diff.malId}
                  error={result?.errors[diff.key]}
                  busy={busy}
                  link={linksReady ? entryLink(diff, links) : null}
                  onKeep={(source) => void compare.apply([diff], source)}
                />
              ))}
            </ul>
            {hidden > 0 && (
              <Button variant="text" class="mx-auto my-1" focusKey="compare-more" onClick={() => compare.showMore()}>
                {t('compare.showMore', { count: hidden })}
                <Icon name="chevronDown" class="size-3" strokeWidth="2.4" />
              </Button>
            )}
          </div>
        </Section>
      )}
    </div>
  );
}

/** Filtre des écarts : pastille à sélection neutre (charte), libellé et nombre */
function FilterChip({ filter, count, on, onPick }: { filter: DiffFilter; count: number; on: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      class={`inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-pill border px-3 text-secondary font-bold transition-colors ${
        on ? 'border-field bg-raised text-ink' : 'border-line bg-transparent text-muted hover:text-ink'
      }`}
      aria-pressed={on ? 'true' : 'false'}
      data-focus={`compare-filter-${filter}`}
      onClick={() => !on && onPick()}
    >
      {t(`compare.filter.${filter}` satisfies MessageKey)}{' '}
      <span class="tabular-nums">{count}</span>
    </button>
  );
}

export function createComparePage(ctx: SettingsContext): SettingsMountedPage {
  return preactPage(() => <ComparePage ctx={ctx} compare={ctx.host.compare()} />);
}
