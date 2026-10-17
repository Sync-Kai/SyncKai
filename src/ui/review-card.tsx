// Carte « À vérifier » d'une saison (maquette PopupVerification) : épisode et raison du doute, fiches proposées (la
// suggestion cochée), recherche d'une autre fiche, numéro d'épisode sur la fiche, « Ne plus synchroniser » (exclut la
// série), « Ignorer » et « Confirmer » ; envoi (« Synchronisation… »), résultat (fermeture seule après 5 s, ou « Fermer »
// quand une note est à lire : correction vers une autre fiche), erreurs dans la carte, qui reste modifiable. La carte
// garde son état local (choix, saisie, recherche, résultat) ; les actions restent celles de l'hôte (messages au service
// worker). Liste des cartes (ReviewList) : nouvelles vérifications en tête, une carte occupée reste après le retrait de
// sa vérification. Popup › Activité ; prévu pour le panneau latéral (aucune dépendance au popup).
import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { t } from '../i18n';
import type { Result } from '../shared/result';
import type { CandidateSummary, PendingReview } from '../shared/review.types';
import { describeOutcome, type SyncFeedback } from '../shared/sync-feedback';
import type { SyncOutcome } from '../shared/sync.types';
import { createLogger } from '../browser/logger';
import { Button } from './components/button';
import { Cover } from './components/cover';
import { Icon } from './components/icon';
import { useFocusFallback, useLocale } from './preact/hooks';
import { candidateMeta, checkProgress, defaultCandidate, defaultProgress, deferredNote, freshResults, previousNote, reviewEpisodeLabel, reviewOrder } from './review-view';

const log = createLogger('review');

/** Actions de l'hôte (service worker, stockage) */
export interface ReviewActions {
  search(query: string): Promise<Result<CandidateSummary[], string>>;
  confirm(key: string, mediaId: number, progress: number): Promise<SyncOutcome>;
  dismiss(key: string): Promise<void>;
  /** « Ne plus synchroniser » : exclut la série puis retire la vérification */
  exclude(review: PendingReview): Promise<void>;
}

/** Résultat d'une synchro réussie visible avant la fermeture automatique */
export const RESULT_VISIBLE_MS = 5_000;

const TONES: Readonly<Record<SyncFeedback['tone'], string>> = {
  success: 'border-mint/40 bg-mint/10 text-mint',
  info: 'border-lavender/40 bg-lavender/10 text-lavender',
  warning: 'border-butter/40 bg-butter/10 text-butter',
  error: 'border-danger/40 bg-danger/10 text-danger',
};

type Phase = 'editing' | 'submitting' | 'done';

export interface ReviewCardProps {
  review: PendingReview;
  actions: ReviewActions;
  /** Envoi en cours ou résultat affiché (vrai) : la carte doit rester affichée même sans sa vérification */
  onBusyChange?: (busy: boolean, review: PendingReview) => void;
  /** « Fermer » ou fermeture automatique après une synchro réussie */
  onClose?: () => void;
}

/** Retour dans la carte : titre en gras, message, note à lire */
function CardFeedback({ feedback, note }: { feedback: SyncFeedback; note: string | null }) {
  return (
    <div class={`rounded-panel border px-2.5 py-2 text-secondary break-words ${TONES[feedback.tone]}`} role="status" data-review-feedback={feedback.tone}>
      <p class="m-0 font-extrabold">{feedback.title}</p>
      {feedback.message && <p class="m-0 opacity-85">{feedback.message}</p>}
      {note && <p class="m-0 mt-1 font-extrabold text-butter">{note}</p>}
    </div>
  );
}

/** Fiche candidate : bouton bascule (jaquette, titre, détails, rond coché) */
function Candidate({ candidate, selected, focusKey, onSelect }: { candidate: CandidateSummary; selected: boolean; focusKey: string; onSelect: () => void }) {
  return (
    <button
      type="button"
      class={`flex min-h-13 w-full cursor-pointer items-center gap-2.5 rounded-panel border-2 px-2 py-1 text-left text-ink transition-colors ${
        selected ? 'border-lavender bg-raised' : 'border-line bg-transparent hover:bg-raised/60'
      }`}
      aria-pressed={selected ? 'true' : 'false'}
      data-focus={focusKey}
      data-candidate={candidate.id}
      onClick={onSelect}
    >
      <Cover size="agenda" title={candidate.title} src={candidate.coverUrl} />
      <span class="flex min-w-0 flex-1 flex-col gap-px">
        <span class="text-secondary font-bold break-words">{candidate.title}</span>
        <span class="text-secondary font-semibold text-muted">{candidateMeta(candidate)}</span>
      </span>
      <span
        class={`flex size-4.5 shrink-0 items-center justify-center rounded-pill border-2 text-on-fill ${selected ? 'border-lavender bg-lavender' : 'border-line'}`}
        aria-hidden="true"
      >
        {selected && <Icon name="check" class="size-2.5" strokeWidth="4" />}
      </span>
    </button>
  );
}

export function ReviewCard({ review, actions, onBusyChange, onClose }: ReviewCardProps) {
  useLocale();
  const [selectedId, setSelectedId] = useState<number | null>(() => defaultCandidate(review)?.id ?? null);
  const [progressText, setProgressText] = useState(() => defaultProgress(review));
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CandidateSummary[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [phase, setPhase] = useState<Phase>('editing');
  const [feedback, setFeedback] = useState<SyncFeedback | null>(null);
  const [note, setNote] = useState<string | null>(null);
  // Réponses arrivées après le démontage (carte retirée entre-temps) : ignorées
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );

  const latest = useRef({ review, onBusyChange, onClose });
  latest.current = { review, onBusyChange, onClose };
  const busy = phase !== 'editing';
  useLayoutEffect(() => latest.current.onBusyChange?.(busy, latest.current.review), [busy]);
  // Synchro réussie sans note à lire : la carte se referme seule
  useEffect(() => {
    if (phase !== 'done' || note) return undefined;
    const timer = setTimeout(() => latest.current.onClose?.(), RESULT_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [phase, note]);

  const key = review.key;
  const focus = (part: string): string => `review-${part}-${key}`;
  const title = review.episode.animeTitle;
  const selected = review.candidates.find((c) => c.id === selectedId) ?? results?.find((c) => c.id === selectedId) ?? null;
  const submitting = phase === 'submitting';

  async function runSearch(): Promise<void> {
    const text = query.trim();
    if (!text || searching) return;
    setSearching(true);
    const result = await actions.search(text);
    if (!alive.current) return;
    setSearching(false);
    setResults(result.ok ? freshResults(review, result.data) : []);
    setFeedback(result.ok ? null : { tone: 'error', title: t('review.searchFailed'), message: result.message });
  }

  async function submit(): Promise<void> {
    if (!selected || phase !== 'editing') return;
    const check = checkProgress(progressText, selected.episodes);
    if (!check.ok) {
      setFeedback({ tone: 'error', title: check.title, message: check.message });
      return;
    }
    const chosen = selected;
    // Carte gardée dès l'envoi : le service worker retire la vérification avant de répondre
    onBusyChange?.(true, review);
    setPhase('submitting');
    setFeedback(null);
    const outcome = await actions.confirm(key, chosen.id, check.progress);
    if (!alive.current) return;
    setFeedback(describeOutcome(outcome));
    // Fiche appliquée (même en succès partiel : la correspondance est mémorisée) ; sinon la carte reste modifiable
    if (outcome.status !== 'synced') {
      setPhase('editing');
      return;
    }
    // Avec une note à lire (correction vers une autre fiche), la carte reste affichée jusqu'au clic sur « Fermer »
    setNote(previousNote(review, chosen.id));
    setPhase('done');
  }

  async function dismiss(): Promise<void> {
    try {
      await actions.dismiss(key);
    } catch (error: unknown) {
      log.error('Impossible d’ignorer la vérification :', error);
      if (alive.current) setFeedback({ tone: 'error', title: t('common.actionFailed'), message: t('review.dismissFailed') });
    }
  }

  async function exclude(): Promise<void> {
    try {
      await actions.exclude(review);
    } catch (error: unknown) {
      log.error('Impossible d’exclure la série :', error);
      if (alive.current) setFeedback({ tone: 'error', title: t('common.actionFailed'), message: t('common.excludeFailed') });
    }
  }

  const header = (
    <p class="m-0 truncate font-bold" title={title}>
      {title}
      <span class="text-secondary font-semibold text-muted"> · {reviewEpisodeLabel(review)}</span>
    </p>
  );

  // Carte traitée : le focus passe sur « Fermer » (les boutons d'édition disparaissent)
  if (phase === 'done') {
    return (
      <article class="flex flex-col gap-2.5 rounded-card border border-butter/30 bg-surface p-3" data-review={key} data-focus-fallback={focus('close')}>
        {header}
        {feedback && <CardFeedback feedback={feedback} note={note} />}
        <Button variant="ghost" class="self-end" focusKey={focus('close')} onClick={() => onClose?.()}>
          {t('common.close')}
        </Button>
      </article>
    );
  }

  const deferred = deferredNote(review);
  const progressId = `sk-review-episode-${key}`;
  const total = selected?.episodes ?? null;
  return (
    <article class="flex flex-col gap-2.5 rounded-card border border-butter/30 bg-surface p-3" data-review={key} data-focus-fallback={focus('close')}>
      <div class="flex flex-col gap-1">
        {header}
        <p class="m-0 flex items-start gap-1.5 text-secondary font-semibold text-butter" data-review-reason="">
          <span class="flex shrink-0 pt-px">
            <Icon name="triangle" class="size-3.5" strokeWidth="2.4" />
          </span>
          <span class="min-w-0 break-words">{review.reason}</span>
        </p>
        {deferred && <p class="m-0 text-secondary font-semibold text-muted">{deferred}</p>}
      </div>
      <div class="flex flex-col gap-1" role="group" aria-label={t('review.candidatesAria')}>
        {review.candidates.length > 0 ? (
          review.candidates.map((c) => <Candidate key={c.id} candidate={c} selected={c.id === selectedId} focusKey={`cand-${key}-${c.id}`} onSelect={() => setSelectedId(c.id)} />)
        ) : (
          <p class="m-0 text-secondary text-muted">{t('review.noCandidates')}</p>
        )}
        {results && <p class="m-0 mt-1 text-section text-muted uppercase">{t('review.results', { count: results.length })}</p>}
        {results?.map((c) => <Candidate key={c.id} candidate={c} selected={c.id === selectedId} focusKey={`cand-${key}-${c.id}`} onSelect={() => setSelectedId(c.id)} />)}
      </div>
      <form
        class="m-0 flex gap-1.5"
        onSubmit={(event) => {
          event.preventDefault();
          void runSearch();
        }}
      >
        <input
          class="h-8 min-w-0 flex-1 rounded-panel border border-field bg-ground px-2.5 text-secondary text-ink placeholder:text-muted/70"
          type="search"
          placeholder={t('review.searchPlaceholder')}
          aria-label={t('review.searchAria')}
          maxLength={100}
          value={query}
          data-focus={focus('search')}
          onInput={(event) => setQuery(event.currentTarget.value)}
        />
        <button
          type="submit"
          class="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-pill border-0 bg-transparent p-0 text-muted transition-colors hover:bg-raised hover:text-ink aria-disabled:opacity-50"
          aria-label={t('review.search')}
          title={t('review.search')}
          aria-disabled={searching ? 'true' : undefined}
          aria-busy={searching ? 'true' : undefined}
          data-focus={focus('search-btn')}
        >
          {searching ? <Icon name="spinner" class="size-3.5 motion-safe:animate-spin" strokeWidth="2.6" /> : <Icon name="search" class="size-3.5" strokeWidth="2.4" />}
        </button>
      </form>
      <div class="flex items-center justify-between gap-2">
        <label class="text-secondary font-semibold text-muted" for={progressId}>
          {t('review.episodeOnEntry')}
        </label>
        <span class="flex items-center gap-1.5">
          <input
            id={progressId}
            class="h-8 w-16 rounded-panel border border-field bg-ground px-2 text-right font-extrabold text-ink tabular-nums"
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={progressText}
            data-focus={focus('progress')}
            onInput={(event) => setProgressText(event.currentTarget.value)}
          />
          {total ? <span class="text-secondary text-muted tabular-nums">/ {total}</span> : null}
        </span>
      </div>
      {feedback && <CardFeedback feedback={feedback} note={note} />}
      {/* Boutons texte (maquette : sans fond) : les trois tiennent sur une ligne à 400 px ; sinon « Confirmer » passe dessous */}
      <div class="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
        <Button
          variant="text"
          icon="ban"
          class="mr-auto"
          title={t('review.excludeTitle')}
          ariaLabel={t('common.stopSyncAria', { title })}
          disabled={submitting}
          focusKey={focus('exclude')}
          onClick={() => void exclude()}
        >
          {t('common.stopSync')}
        </Button>
        <Button variant="text" disabled={submitting} focusKey={focus('dismiss')} onClick={() => void dismiss()}>
          {t('common.ignore')}
        </Button>
        <Button variant="primary" busy={submitting} disabled={!selected} focusKey={focus('confirm')} onClick={() => void submit()}>
          {submitting ? t('common.syncing') : t('common.confirm')}
        </Button>
      </div>
    </article>
  );
}

export interface ReviewListProps {
  /** Titre de la section (« À vérifier ») ; le nombre de vérifications suit (« À VÉRIFIER · 2 ») */
  title: string;
  /** Vérifications du stockage, la plus récente en premier */
  reviews: readonly PendingReview[];
  actions: ReviewActions;
  /** Aucune carte affichée */
  empty: ComponentChildren;
}

/**
 * Section « À vérifier » : titre beurre en capitales et cartes réconciliées par clé de saison, chaque carte gardant son
 * état local (saisie, résultat) entre deux lectures du stockage. Nouvelle vérification de la même saison (correction
 * rouverte) : carte remise à zéro, sauf pendant un envoi ou l'affichage d'un résultat ; une carte fermée dont la
 * vérification existe encore repart à zéro. Carte retirée (fermée, ignorée, exclue) avec le focus : il passe au titre.
 */
export function ReviewList({ title, reviews, actions, empty }: ReviewListProps) {
  const root = useRef<HTMLElement>(null);
  useFocusFallback(root);
  /** Vérification montrée par chaque carte occupée (figée jusqu'à sa fermeture) */
  const [held, setHeld] = useState<ReadonlyMap<string, PendingReview>>(new Map());
  /** Fermetures par saison : une carte refermée repart à zéro */
  const [closed, setClosed] = useState<ReadonlyMap<string, number>>(new Map());
  const order = useRef<string[]>([]);
  const stored = new Map(reviews.map((r) => [r.key, r]));
  order.current = reviewOrder(order.current, reviews.map((r) => r.key), new Set(held.keys()));

  const setBusy = (key: string, busy: boolean, review: PendingReview): void =>
    setHeld((current) => {
      if (busy === current.has(key)) return current;
      const next = new Map(current);
      if (busy) next.set(key, review);
      else next.delete(key);
      return next;
    });
  const close = (key: string): void => {
    setHeld((current) => {
      const next = new Map(current);
      next.delete(key);
      return next;
    });
    setClosed((current) => new Map(current).set(key, (current.get(key) ?? 0) + 1));
  };

  const cards = order.current.flatMap((key) => {
    const review = held.get(key) ?? stored.get(key);
    return review ? [review] : [];
  });
  return (
    <section ref={root} class="flex flex-col gap-2" aria-labelledby="sk-review-title" data-focus-fallback="review-title">
      <h2 class="m-0 mx-1 text-section text-butter uppercase outline-none" id="sk-review-title" tabIndex={-1} data-focus="review-title">
        {title}
        {reviews.length > 0 && <span class="tabular-nums" data-section-count="">{` · ${reviews.length}`}</span>}
      </h2>
      {cards.length === 0
        ? empty
        : cards.map((review) => (
            <ReviewCard
              key={`${review.key}:${review.createdAt}:${closed.get(review.key) ?? 0}`}
              review={review}
              actions={actions}
              onBusyChange={(busy, shown) => setBusy(review.key, busy, shown)}
              onClose={() => close(review.key)}
            />
          ))}
    </section>
  );
}
