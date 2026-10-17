// Écran « Activité » du popup (maquettes PopupActivite, PopupActiviteEtats, PopupActiviteNoter, PopupVerification) :
// synchros en échec puis en attente de relance (« Réessayer », « Abandonner »), séries « À noter » (10 étoiles à
// demi-étoiles, « Ignorer »), cartes « À vérifier » (ui/review-card.tsx), dernières synchros (« Corriger », exclusion de
// la série, lien vers la fiche) et ligne « Écarts AniList ↔ MyAnimeList » (Réglages › Mes données › Écarts, les deux
// comptes connectés). Les sections « Échec », « En attente » et « À noter » n'apparaissent qu'avec un élément, un
// résultat ou une erreur à montrer ; « À vérifier » et « Dernières synchros » sont toujours là. Données et actions :
// contrôleurs sans rendu (controllers/queue.ts, controllers/ratings.ts) et popup.ts.
import { useRef, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { entryLink, type EntryLink, type EntryLinkContext } from '../../shared/entry-link';
import type { PendingRating } from '../../shared/engagement.types';
import type { SyncQueueItem } from '../../shared/queue.types';
import type { RecentSync } from '../../shared/review.types';
import { TRACKER_LABELS, type TrackerId } from '../../shared/tracker.types';
import { formatRelativeTime } from '../../shared/watching';
import type { CompareState } from '../../ui/compare-controller';
import { Alert } from '../../ui/components/alert';
import { Button } from '../../ui/components/button';
import { Cover } from '../../ui/components/cover';
import { FeedbackBanner } from '../../ui/components/feedback-banner';
import { Icon } from '../../ui/components/icon';
import { Section } from '../../ui/components/section';
import { StarRating } from '../../ui/components/star-rating';
import { alertAttrs } from '../../ui/live-region';
import { useFocusFallback, useLocale, useStore } from '../../ui/preact/hooks';
import { ReviewList, type ReviewActions } from '../../ui/review-card';
import { diffBadge } from '../../ui/settings/compare-model';
import type { AccountState, ExclusionsState, InlineFeedback, ReadonlyStore } from '../../ui/state';
import type { QueueState, RatingsState, SyncData } from '../state';
import { formatUntil, isRecentExcluded, queueRoute, queueTitle, recentTitle } from './activity-view';
import type { WatchingContext } from './watching-screen';

export interface ActivityScreenProps {
  accounts: Readonly<Record<TrackerId, ReadonlyStore<AccountState<unknown>>>>;
  sync: ReadonlyStore<SyncData>;
  queue: ReadonlyStore<QueueState>;
  ratings: ReadonlyStore<RatingsState>;
  exclusions: ReadonlyStore<ExclusionsState>;
  /** Comptes connectés et fiche préférée : liens des titres et jaquettes */
  context: ReadonlyStore<WatchingContext>;
  /** Écarts AniList ↔ MAL (compteur de la ligne) */
  compare: ReadonlyStore<CompareState>;
  now: number;
  reviewActions: ReviewActions;
  onRetryQueued: (id: string) => void;
  onAbandonQueued: (id: string) => void;
  onRate: (item: PendingRating, value: number) => void;
  onIgnoreRating: (item: PendingRating) => void;
  /** « Corriger » : carte « À vérifier » rouverte par le service worker */
  onCorrect: (key: string) => void;
  onExcludeRecent: (sync: RecentSync) => void;
  /** Ligne des écarts : Réglages › Mes données › Écarts */
  onOpenCompare: () => void;
}

/** Titre lien vers la fiche (nouvel onglet) ; sans lien : le texte */
function EntryTitle({ link, title, focusKey }: { link: EntryLink | null; title: string; focusKey: string }) {
  if (!link) return <>{title}</>;
  return (
    <a
      class="text-ink no-underline underline-offset-2 hover:underline"
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t('entry.openAria', { title, service: TRACKER_LABELS[link.service] })}
      data-focus={focusKey}
    >
      {title}
    </a>
  );
}

/** Retour d'action en tête de section (réessai, note enregistrée) */
function Notice({ notice }: { notice: InlineFeedback }) {
  return <FeedbackBanner tone={notice.tone} text={notice.text} detail={notice.detail} />;
}

// ─── Échec / En attente ─────────────────────────────────────────────────────

function QueueItem({ item, busy, now, props }: { item: SyncQueueItem; busy: boolean; now: number; props: ActivityScreenProps }) {
  const failed = item.status === 'failed';
  const title = queueTitle(item.episode);
  return (
    <li class={`flex flex-col gap-2 rounded-card border bg-surface px-3 py-2.5 ${failed ? 'border-danger/30' : 'border-line'}`} data-queue-item={item.status} aria-busy={busy ? 'true' : undefined}>
      <div class="flex items-start gap-2.5">
        <span class={`flex shrink-0 pt-0.5 ${failed ? 'text-danger' : 'text-lavender'}`}>
          <Icon name={failed ? 'xCircle' : 'clock'} class="size-4.5" strokeWidth="2.2" />
        </span>
        <span class="flex min-w-0 flex-1 flex-col">
          <span class="font-bold break-words">{title}</span>
          <span class="text-secondary text-muted">{queueRoute(item)}</span>
          {item.lastError && (
            <span class="line-clamp-2 text-secondary text-muted" title={item.lastError}>
              {item.lastError}
            </span>
          )}
        </span>
      </div>
      {/* État et boutons sur une ligne quand ils tiennent ; sinon les boutons passent dessous, à droite (libellé long) */}
      <div class="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        {failed ? (
          <span class="flex min-w-0 flex-[1_1_auto] items-center gap-1.5 text-secondary font-extrabold text-danger">
            <Icon name="alert" class="size-3.5 shrink-0" strokeWidth="2.4" />
            <span class="min-w-0 break-words">{t('queue.failed')}</span>
          </span>
        ) : (
          <span class="min-w-0 flex-[1_1_auto] text-secondary font-extrabold break-words text-lavender">{t('queue.nextAttempt', { when: formatUntil(item.nextAttemptAt, now) })}</span>
        )}
        <span class="ml-auto flex gap-1.5">
          <Button variant="ghost" class="px-3" ariaLabel={t('queue.abandonAria', { title })} disabled={busy} focusKey={`queue-drop-${item.id}`} onClick={() => props.onAbandonQueued(item.id)}>
            {t('queue.abandon')}
          </Button>
          <Button variant={failed ? 'primary' : 'secondary'} ariaLabel={t('queue.retryAria', { title })} busy={busy} focusKey={`queue-retry-${item.id}`} onClick={() => props.onRetryQueued(item.id)}>
            {t('common.retry')}
          </Button>
        </span>
      </div>
    </li>
  );
}

/** Synchros abandonnées (« Échec ») puis en attente de relance ; retour du dernier réessai et erreur en tête */
function QueueSections({ queue, now, props }: { queue: QueueState; now: number; props: ActivityScreenProps }) {
  const failed = queue.items.filter((item) => item.status === 'failed');
  const pending = queue.items.filter((item) => item.status === 'pending');
  const head = (
    <>
      {queue.notice && <Notice notice={queue.notice} />}
      {queue.error && <Alert message={queue.error} />}
    </>
  );
  const list = (items: SyncQueueItem[]) => (
    <ul class="m-0 flex list-none flex-col gap-2 p-0">
      {items.map((item) => (
        <QueueItem key={item.id} item={item} busy={queue.busyIds.has(item.id)} now={now} props={props} />
      ))}
    </ul>
  );
  if (failed.length === 0 && pending.length === 0) return queue.notice || queue.error ? <div class="flex flex-col gap-2">{head}</div> : null;
  return (
    <>
      {failed.length > 0 && (
        <Section title={t('queue.failedHeading')} count={failed.length} countInline tone="danger">
          {head}
          {list(failed)}
        </Section>
      )}
      {pending.length > 0 && (
        <Section title={t('queue.pendingHeading')} count={pending.length} countInline tone="info">
          {failed.length === 0 && head}
          {list(pending)}
        </Section>
      )}
    </>
  );
}

// ─── À noter ────────────────────────────────────────────────────────────────

function RatingItem({ item, busy, error, now, links, props }: { item: PendingRating; busy: boolean; error: string | undefined; now: number; links: EntryLinkContext; props: ActivityScreenProps }) {
  /** Note choisie : affichée pendant l'envoi et après un échec (la carte reste pour réessayer) */
  const [chosen, setChosen] = useState(0);
  const link = entryLink(item, links);
  const cover = <Cover size="row" title={item.title} src={item.coverUrl} />;
  return (
    <li class="flex gap-2.5 rounded-card border border-line bg-surface px-3 py-2.5" aria-busy={busy ? 'true' : 'false'} data-rating-item={item.id}>
      {link ? (
        // Même lien que le titre : hors tabulation et masqué aux lecteurs d'écran (doublon)
        <a class="flex shrink-0 self-start rounded-cover transition hover:brightness-110" href={link.url} target="_blank" rel="noopener noreferrer" tabIndex={-1} aria-hidden="true">
          {cover}
        </a>
      ) : (
        <span class="flex shrink-0 self-start">{cover}</span>
      )}
      <div class="flex min-w-0 flex-1 flex-col gap-1">
        <div class="flex min-w-0 flex-col">
          <span class="truncate font-bold" title={item.title}>
            <EntryTitle link={link} title={item.title} focusKey={`rate-entry-${item.id}`} />
          </span>
          <span class="truncate text-secondary text-muted">{t('ratings.completed', { relative: formatRelativeTime(item.completedAt, now) })}</span>
        </div>
        {/* Étoiles et « Ignorer » sur une ligne quand ils tiennent ; sinon « Ignorer » passe dessous, à droite */}
        <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span class={busy ? 'opacity-50' : undefined}>
            <StarRating
              size="sm"
              label={t('rating.groupLabel', { title: item.title })}
              value={chosen}
              disabled={busy}
              focusKey={`rate-${item.id}`}
              onChange={setChosen}
              onConfirm={(value) => {
                setChosen(value);
                props.onRate(item, value);
              }}
            />
          </span>
          {busy ? (
            <span class="ml-auto flex h-8 items-center px-2.5 text-muted" role="status" aria-label={t('prompt.rating.saving')}>
              <Icon name="spinner" class="size-3.5 motion-safe:animate-spin" strokeWidth="2.6" />
            </span>
          ) : (
            <Button variant="ghost" class="ml-auto px-3" ariaLabel={t('ratings.ignoreAria', { title: item.title })} focusKey={`rate-ignore-${item.id}`} onClick={() => props.onIgnoreRating(item)}>
              {t('common.ignore')}
            </Button>
          )}
        </div>
        {error && (
          <span class="flex items-start gap-1.5 text-secondary font-bold text-danger" {...alertAttrs(error)}>
            <span class="flex shrink-0 pt-0.5">
              <Icon name="alert" class="size-3.5" strokeWidth="2.4" />
            </span>
            <span class="min-w-0 break-words">{error}</span>
          </span>
        )}
      </div>
    </li>
  );
}

function RatingSection({ ratings, now, links, props }: { ratings: RatingsState; now: number; links: EntryLinkContext; props: ActivityScreenProps }) {
  const { items, notice, error } = ratings;
  if (items.length === 0 && !notice && !error) return null;
  return (
    <Section title={t('ratings.heading')} count={items.length > 0 ? items.length : undefined} countInline tone="accent">
      {notice && <Notice notice={notice} />}
      {error && <Alert message={error} />}
      {items.length > 0 && (
        <ul class="m-0 flex list-none flex-col gap-2 p-0">
          {items.map((item) => (
            <RatingItem key={item.id} item={item} busy={ratings.busyIds.has(item.id)} error={ratings.errors.get(item.id)} now={now} links={links} props={props} />
          ))}
        </ul>
      )}
    </Section>
  );
}

// ─── Dernières synchros ─────────────────────────────────────────────────────

function RecentRow({ sync, pending, busyKey, excluded, links, props }: { sync: RecentSync; pending: boolean; busyKey: string | null; excluded: boolean; links: EntryLinkContext; props: ActivityScreenProps }) {
  const title = recentTitle(sync);
  const busy = busyKey === sync.key;
  return (
    <li class="flex min-h-13 items-center gap-2 rounded-panel border border-line bg-surface py-1.5 pr-1 pl-3" data-recent={sync.key}>
      <span class="flex shrink-0 text-mint">
        <Icon name="check" class="size-3.5" strokeWidth="3" />
      </span>
      <span class="flex min-w-0 flex-1 flex-col gap-0.5">
        <span class="font-bold break-words">
          <EntryTitle link={entryLink({ mediaId: sync.mediaId, malId: sync.malId ?? null }, links)} title={title} focusKey={`recent-entry-${sync.key}`} />
        </span>
        <span class="text-secondary font-semibold break-words text-muted">{t('recent.line', { title: sync.mediaTitle, progress: sync.progress })}</span>
      </span>
      {pending ? (
        <Button variant="ghost" class="px-2.5" disabled ariaLabel={t('recent.alreadyPendingAria', { title })} focusKey={`correct-${sync.key}`}>
          {t('recent.pending')}
        </Button>
      ) : (
        // Correction en cours d'ouverture : indicateur sur sa ligne, les autres « Corriger » grisés
        <Button
          variant="ghost"
          class="px-2.5 text-sakura hover:text-sakura"
          busy={busy}
          disabled={busyKey !== null && !busy}
          ariaLabel={t('recent.correctAria', { title })}
          focusKey={`correct-${sync.key}`}
          onClick={() => props.onCorrect(sync.key)}
        >
          {t('recent.correct')}
        </Button>
      )}
      {excluded ? (
        <span class="mr-1.5 inline-flex h-5 shrink-0 items-center rounded-pill border border-line px-2 text-section font-extrabold tracking-normal text-muted" title={t('common.excludedTitle')} data-recent-excluded="">
          {t('common.excluded')}
        </span>
      ) : (
        <button
          type="button"
          class="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-pill border-0 bg-transparent p-0 text-muted transition-colors hover:bg-raised hover:text-danger"
          aria-label={t('common.stopSyncAria', { title: sync.episode.animeTitle })}
          title={t('common.stopSyncSeries')}
          data-focus={`exclude-${sync.key}`}
          onClick={() => props.onExcludeRecent(sync)}
        >
          <Icon name="ban" class="size-3.5" strokeWidth="2.2" />
        </button>
      )}
    </li>
  );
}

function RecentSection({ data, exclusions, links, props }: { data: SyncData; exclusions: ExclusionsState; links: EntryLinkContext; props: ActivityScreenProps }) {
  const pendingKeys = new Set(data.reviews.map((r) => r.key));
  return (
    <Section title={t('recent.title')}>
      {data.recentError && <Alert message={data.recentError} />}
      {data.recentSyncs.length > 0 ? (
        <ul class="m-0 flex list-none flex-col gap-1 p-0">
          {data.recentSyncs.map((sync) => (
            <RecentRow key={sync.key} sync={sync} pending={pendingKeys.has(sync.key)} busyKey={data.busyKey} excluded={isRecentExcluded(sync, exclusions)} links={links} props={props} />
          ))}
        </ul>
      ) : (
        <p class="m-0 rounded-card border border-line bg-surface p-3 text-secondary text-muted">{t('recent.empty')}</p>
      )}
    </Section>
  );
}

/** Ligne « Écarts AniList ↔ MyAnimeList » : compteur des écarts restants après la première analyse */
function CompareLink({ count, onOpen }: { count: number | null; onOpen: () => void }) {
  return (
    <button
      type="button"
      class="flex w-full cursor-pointer items-center gap-3 rounded-card border border-line bg-surface px-3 py-2.5 text-left text-ink transition-colors hover:bg-raised"
      data-focus="activity-compare"
      onClick={onOpen}
    >
      <span class="flex min-w-0 flex-1 flex-col">
        <span class="text-body font-bold">{t('settings.compare.title')}</span>
        <span class="text-secondary text-muted">{t('settings.compare.help')}</span>
      </span>
      {count !== null && count > 0 && (
        <span class="shrink-0 rounded-pill bg-butter/16 px-2 text-secondary font-extrabold text-butter tabular-nums" data-diff-count="">
          {count}
        </span>
      )}
      <span class="flex shrink-0 text-muted">
        <Icon name="chevronRight" class="size-3.5" strokeWidth="2.4" />
      </span>
    </button>
  );
}

export function ActivityScreen(props: ActivityScreenProps) {
  useLocale();
  const root = useRef<HTMLDivElement>(null);
  const anilist = useStore(props.accounts.anilist);
  const mal = useStore(props.accounts.mal);
  const data = useStore(props.sync);
  const queue = useStore(props.queue);
  const ratings = useStore(props.ratings);
  const exclusions = useStore(props.exclusions);
  const context = useStore(props.context);
  const compare = useStore(props.compare);
  // Élément retiré (synchro abandonnée, carte fermée) : son voisin, ou le repli déclaré par sa section
  useFocusFallback(root);

  const connected = [anilist, mal].filter((account) => account.status === 'logged-in').length;
  const reviews = connected > 0 ? data.reviews : [];
  const links = context.entryLinks;

  return (
    <div ref={root} class="flex flex-col gap-4 pb-1" data-activity="">
      {connected > 0 && <QueueSections queue={queue} now={props.now} props={props} />}
      {connected > 0 && <RatingSection ratings={ratings} now={props.now} links={links} props={props} />}
      <ReviewList
        title={t('inline.toCheck')}
        reviews={reviews}
        actions={props.reviewActions}
        empty={
          <p class="m-0 flex items-center gap-2 rounded-card border border-line bg-surface p-3 text-secondary text-muted" data-review-empty="">
            <span class="flex shrink-0 text-mint">
              <Icon name="check" class="size-3.5" strokeWidth="3" />
            </span>
            {t('review.empty')}
          </p>
        }
      />
      <RecentSection data={data} exclusions={exclusions} links={links} props={props} />
      {connected === 2 && <CompareLink count={diffBadge(compare.result)} onOpen={props.onOpenCompare} />}
    </div>
  );
}
