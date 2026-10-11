import { t, type MessageKey } from '../../i18n';
import type { Result } from '../../shared/result';
import type { CandidateSummary, PendingReview } from '../../shared/review.types';
import { describeOutcome, type SyncFeedback } from '../../shared/sync-feedback';
import type { SyncOutcome } from '../../shared/sync.types';
import { busyAttrs, h, nodes, preserveFocus } from '../../ui/dom';
import { icon, warnIcon } from '../../ui/icons';
import { BTN_GHOST, BTN_PRIMARY, PLATFORM_LABELS, renderCover } from '../../ui/kit';
import { createLogger } from '../../shared/logger';

const log = createLogger('popup');

export interface ReviewActions {
  search(query: string): Promise<Result<CandidateSummary[], string>>;
  confirm(key: string, mediaId: number, progress: number): Promise<SyncOutcome>;
  dismiss(key: string): Promise<void>;
  /** « Ne plus synchroniser » : exclut la série puis ignore la vérification */
  exclude(review: PendingReview): Promise<void>;
}

export interface ReviewCard {
  readonly element: HTMLElement;
  /** Nouvelle donnée pour la même saison (nouvel épisode, correction rouverte) */
  update(review: PendingReview): void;
  /** Vrai pendant l'envoi ou l'affichage du résultat : la carte ne doit pas disparaître */
  isBusy(): boolean;
}

const RESULT_VISIBLE_MS = 5_000;

/** Formats traduits ; les autres (TV, ONA, OVA…) restent tels qu'AniList les nomme */
const FORMAT_LABELS: Record<string, MessageKey> = {
  TV_SHORT: 'review.format.tvShort',
  MOVIE: 'review.format.movie',
  SPECIAL: 'review.format.special',
};

function formatLabel(format: string): string {
  const key = FORMAT_LABELS[format];
  return key ? t(key) : format;
}

const TONE_CLASSES: Record<SyncFeedback['tone'], string> = {
  success: 'border-mint/40 bg-mint/10 text-mint',
  info: 'border-lavender/40 bg-lavender/10 text-lavender',
  warning: 'border-butter/40 bg-butter/10 text-butter',
  error: 'border-danger/40 bg-danger/10 text-danger',
};

function episodeLabel({ episode }: PendingReview): string {
  const parts = [
    episode.seasonNumber !== null ? `S${episode.seasonNumber}` : null,
    episode.seasonEpisodeNumber !== null ? `E${episode.seasonEpisodeNumber}` : null,
  ].filter((p): p is string => p !== null);
  const displayed = episode.displayedEpisodeNumber;
  if (displayed !== null && displayed !== episode.seasonEpisodeNumber) parts.push(t('review.displayed', { number: displayed }));
  parts.push(PLATFORM_LABELS[episode.platform]);
  return parts.join(' · ');
}

function candidateMeta(c: CandidateSummary): string {
  return [c.format ? formatLabel(c.format) : null, c.episodes !== null ? t('review.episodes', { count: c.episodes }) : null, c.year]
    .filter((p) => p !== null)
    .join(' · ');
}

function defaultProgress(review: PendingReview): string {
  const value = review.suggestion?.progress ?? review.episode.seasonEpisodeNumber ?? review.episode.displayedEpisodeNumber;
  return value !== null ? String(value) : '';
}

/**
 * Carte de vérification d'une saison. Elle gère son propre état local (sélection, saisie, recherche)
 * et ne se redessine que sur ses propres actions : taper un numéro ne fait pas perdre le focus.
 */
export function createReviewCard(initial: PendingReview, actions: ReviewActions, onClose: () => void): ReviewCard {
  let review = initial;
  let selected: CandidateSummary | null = null;
  let progressText = '';
  let searchQuery = '';
  let searchResults: CandidateSummary[] | null = null;
  let isSearching = false;
  let phase: 'editing' | 'submitting' | 'done' = 'editing';
  let feedback: SyncFeedback | null = null;
  let note: string | null = null;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;

  // Carte traitée : le focus passe sur « Fermer » (les boutons d'édition disparaissent)
  const element = h('article', { class: 'flex flex-col gap-3 rounded-card bg-raised p-3 shadow-pop', attrs: { 'data-focus-fallback': 'review-close' } });

  function reset(next: PendingReview): void {
    review = next;
    const suggestedId = next.suggestion?.mediaId;
    selected = next.candidates.find((c) => c.id === suggestedId) ?? next.candidates[0] ?? null;
    progressText = defaultProgress(next);
    searchQuery = '';
    searchResults = null;
    phase = 'editing';
    feedback = null;
    note = null;
  }

  function renderCandidate(candidate: CandidateSummary): HTMLElement {
    const isSelected = candidate.id === selected?.id;

    return h(
      'button',
      {
        class: `flex min-h-[52px] w-full cursor-pointer items-center gap-3 rounded-lg border-2 px-2 py-1 text-left text-ink transition-colors ${
          isSelected ? 'border-lavender bg-surface' : 'border-line bg-transparent hover:bg-surface/60'
        }`,
        attrs: { type: 'button', 'aria-pressed': String(isSelected), 'data-focus': `cand-${candidate.id}` },
        on: {
          click: () => {
            selected = candidate;
            render();
          },
        },
      },
      renderCover(candidate.title, candidate.coverUrl, 'h-10 w-7', 'text-[9px]'),
      h(
        'span',
        { class: 'flex min-w-0 flex-1 flex-col gap-0.5' },
        h('span', { class: 'truncate text-[12px] font-bold', attrs: { title: candidate.title } }, candidate.title),
        h('span', { class: 'text-[11px] font-semibold text-muted' }, candidateMeta(candidate) || '—'),
      ),
      h(
        'span',
        {
          class: `flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 text-on-fill ${isSelected ? 'border-lavender bg-lavender' : 'border-line'}`,
          attrs: { 'aria-hidden': 'true' },
        },
        isSelected && icon('check', 'h-2.5 w-2.5', '4'),
      ),
    );
  }

  function renderSearch(): HTMLElement {
    const input = h('input', {
      class: 'h-8 min-w-0 flex-1 rounded-lg border border-line bg-ground px-2 text-[12px] text-ink placeholder:text-muted/70',
      attrs: { type: 'search', placeholder: t('review.searchPlaceholder'), 'aria-label': t('review.searchAria'), maxlength: '100', 'data-focus': 'search' },
      on: { input: () => (searchQuery = input.value) },
    });
    input.value = searchQuery;

    return h(
      'form',
      {
        class: 'flex gap-1.5',
        on: {
          submit: (e) => {
            e.preventDefault();
            void runSearch();
          },
        },
      },
      input,
      h(
        'button',
        {
          class: 'flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-ink aria-disabled:opacity-50',
          attrs: { type: 'submit', 'aria-label': t('review.search'), 'data-focus': 'search-btn', ...busyAttrs(isSearching, true) },
        },
        isSearching ? icon('spinner', 'h-3.5 w-3.5 motion-safe:animate-spin') : icon('search', 'h-3.5 w-3.5'),
      ),
    );
  }

  function renderProgressField(): HTMLElement {
    const id = `sk-ep-${review.createdAt}`;
    const input = h('input', {
      class: 'h-8 w-16 rounded-lg border border-line bg-ground px-2 text-right text-[13px] font-bold text-ink tabular-nums',
      attrs: { id, type: 'number', min: '1', step: '1', inputmode: 'numeric', 'data-focus': 'progress' },
      on: { input: () => (progressText = input.value) },
    });
    input.value = progressText;
    const total = selected?.episodes;

    return h(
      'div',
      { class: 'flex items-center justify-between gap-2' },
      h('label', { class: 'text-[12px] font-semibold text-muted', attrs: { for: id } }, t('review.episodeOnEntry')),
      h('span', { class: 'flex items-center gap-1.5' }, input, total ? h('span', { class: 'text-[11px] text-muted' }, `/ ${total}`) : null),
    );
  }

  function renderFeedback(): HTMLElement | null {
    if (!feedback) return null;
    return h(
      'div',
      { class: `rounded-lg border px-2.5 py-2 text-[11px] ${TONE_CLASSES[feedback.tone]}`, attrs: { role: 'status' } },
      h('p', { class: 'm-0 font-bold' }, feedback.title),
      feedback.message && h('p', { class: 'm-0 opacity-80' }, feedback.message),
      note && h('p', { class: 'm-0 mt-1 font-bold text-butter' }, note),
    );
  }

  function render(): void {
    preserveFocus(element, draw);
  }

  function draw(): void {
    const header = h(
      'p',
      { class: 'm-0 truncate text-[13px] font-bold', attrs: { title: review.episode.animeTitle } },
      review.episode.animeTitle,
      h('span', { class: 'text-[12px] font-semibold text-muted' }, ` · ${episodeLabel(review)}`),
    );

    if (phase === 'done') {
      element.replaceChildren(...nodes([
        header,
        renderFeedback(),
        h('button', { class: `${BTN_GHOST} self-end text-muted`, attrs: { type: 'button', 'data-focus': 'review-close' }, on: { click: close } }, t('common.close')),
      ]));
      return;
    }

    const isSubmitting = phase === 'submitting';
    const listItems = review.candidates.map(renderCandidate);
    const searchItems = searchResults?.map(renderCandidate) ?? [];

    element.replaceChildren(...nodes([
      h(
        'div',
        { class: 'flex flex-col gap-1' },
        header,
        h('p', { class: 'm-0 flex items-start gap-1.5 text-[12px] font-semibold text-butter' }, warnIcon('mt-px h-3.5 w-3.5 text-butter'), h('span', {}, review.reason)),
      ),
      h(
        'div',
        { class: 'sk-scroll flex max-h-56 flex-col gap-1 overflow-y-auto pr-0.5', attrs: { role: 'group', 'aria-label': t('review.candidatesAria') } },
        ...(listItems.length > 0 ? listItems : [h('p', { class: 'm-0 text-[11px] text-muted' }, t('review.noCandidates'))]),
        searchResults && h('p', { class: 'm-0 mt-1 text-[10px] font-bold tracking-wide text-muted uppercase' }, t('review.results', { count: searchResults.length })),
        ...searchItems,
      ),
      renderSearch(),
      renderProgressField(),
      renderFeedback(),
      h(
        'div',
        { class: 'flex flex-wrap items-center justify-end gap-x-2 gap-y-1' },
        h(
          'button',
          {
            class: `${BTN_GHOST} mr-auto gap-1 px-2 text-muted hover:text-danger`,
            attrs: {
              type: 'button',
              'aria-label': t('common.stopSyncAria', { title: review.episode.animeTitle }),
              title: t('review.excludeTitle'),
              'data-focus': 'exclude',
              ...busyAttrs(isSubmitting),
            },
            on: { click: () => void exclude() },
          },
          icon('ban', 'h-3 w-3', '2.4'),
          t('common.stopSync'),
        ),
        h(
          'button',
          {
            class: `${BTN_GHOST} text-muted`,
            attrs: { type: 'button', 'data-focus': 'dismiss', ...busyAttrs(isSubmitting) },
            on: { click: () => void dismiss() },
          },
          t('common.ignore'),
        ),
        h(
          'button',
          {
            class: BTN_PRIMARY,
            attrs: { type: 'button', 'data-focus': 'confirm', ...(selected ? busyAttrs(isSubmitting, true) : { disabled: '' }) },
            on: { click: () => void submit() },
          },
          isSubmitting && icon('spinner', 'h-3.5 w-3.5 motion-safe:animate-spin'),
          isSubmitting ? t('common.syncing') : t('common.confirm'),
        ),
      ),
    ]));
  }

  async function runSearch(): Promise<void> {
    const query = searchQuery.trim();
    if (!query || isSearching) return;
    isSearching = true;
    render();
    const result = await actions.search(query);
    isSearching = false;
    searchResults = result.ok ? result.data.filter((c) => !review.candidates.some((r) => r.id === c.id)) : [];
    feedback = result.ok ? null : { tone: 'error', title: t('review.searchFailed'), message: result.message };
    render();
  }

  async function submit(): Promise<void> {
    if (!selected || phase !== 'editing') return;
    const progress = Number(progressText);
    const max = selected.episodes;
    if (!Number.isInteger(progress) || progress < 1 || (max !== null && progress > max)) {
      feedback = { tone: 'error', title: t('review.invalidEpisode'), message: max !== null ? t('review.invalidRange', { max }) : t('review.invalidMin') };
      render();
      return;
    }

    const chosen = selected;
    phase = 'submitting';
    feedback = null;
    render();

    const outcome = await actions.confirm(review.key, chosen.id, progress);
    feedback = describeOutcome(outcome);
    // Fiche appliquée (même en succès partiel : la correspondance est mémorisée, "Réessayer" reste possible depuis la page)
    if (outcome.status !== 'synced') {
      phase = 'editing';
      render();
      return;
    }

    phase = 'done';
    // Correction vers une autre fiche : la progression écrite sur l'ancienne n'est pas annulée
    const previous = review.previous;
    note = previous && previous.mediaId !== chosen.id
      ? t('review.previousNote', { title: previous.title, progress: previous.progress })
      : null;
    render();
    // Avec une note à lire, la carte reste affichée jusqu'au clic sur "Fermer"
    if (!note) closeTimer = setTimeout(close, RESULT_VISIBLE_MS);
  }

  async function dismiss(): Promise<void> {
    try {
      await actions.dismiss(review.key);
    } catch (error: unknown) {
      log.error('Impossible d’ignorer la vérification :', error);
      feedback = { tone: 'error', title: t('common.actionFailed'), message: t('review.dismissFailed') };
      render();
    }
  }

  async function exclude(): Promise<void> {
    try {
      await actions.exclude(review);
    } catch (error: unknown) {
      log.error('Impossible d’exclure la série :', error);
      feedback = { tone: 'error', title: t('common.actionFailed'), message: t('common.excludeFailed') };
      render();
    }
  }

  function close(): void {
    clearTimeout(closeTimer);
    element.remove();
    onClose();
  }

  reset(initial);
  render();

  return {
    element,
    update(next) {
      if (phase !== 'editing' || next.createdAt === review.createdAt) return;
      reset(next);
      render();
    },
    isBusy: () => phase !== 'editing',
  };
}
