// Écran Stats du popup (maquette « Stats », option 2 : une colonne de sections compactes) : l'activité de SyncKai sur la
// période choisie (historique local), « En cours » (temps à rattraper), puis, sous « Depuis le début · AniList », les
// blocs du profil (mêmes requête et cache que le menu du compte). Un bloc vide n'est pas affiché ; MAL n'a ni genres,
// ni formats, ni répartition des notes, ni studios, ni décennies. Données et actions : popup/controllers/stats.ts.
import type { ComponentChildren } from 'preact';
import { getLocale, t, tp } from '../../i18n';
import type { ActivitySummary, StatsPeriod } from '../../shared/activity-history';
import { dateKey, parseDateKey } from '../../shared/agenda';
import { genreKey } from '../../shared/genres';
import { meanInFormat, type ProfileStats } from '../../shared/profile-stats';
import { formatDuration } from '../../shared/remaining-time';
import type { AniListScoreFormat } from '../../shared/score';
import { TRACKER_LABELS, type TrackerId } from '../../shared/tracker.types';
import { statsView } from '../../ui/account-menu-model';
import { Alert } from '../../ui/components/alert';
import { Button } from '../../ui/components/button';
import { Icon } from '../../ui/components/icon';
import { Section } from '../../ui/components/section';
import { Segmented } from '../../ui/components/segmented';
import { ServiceLogo } from '../../ui/components/service-logo';
import { Placeholder, StatTiles } from '../../ui/components/stat-tiles';
import type { Tone } from '../../ui/components/tone';
import { useLocale, useStore } from '../../ui/preact/hooks';
import { formatLabel } from '../../ui/review-view';
import type { ReadonlyStore } from '../../ui/state';
import type { StatsView } from '../controllers/stats';
import { BarColumns, BarRows, type BarColumn, type BarRow } from './stats-bars';

export interface StatsScreenProps {
  /** null tant que le contrôleur n'existe pas (section jamais affichée) */
  state: ReadonlyStore<StatsView | null>;
  now: number;
  onService: (service: TrackerId) => void;
  onPeriod: (period: StatsPeriod) => void;
  onReconnect: (service: TrackerId) => void;
  onRetry: () => void;
  onOpenAccounts: () => void;
}

type ListStatus = ProfileStats['statuses'][number]['status'];

/** Ordre d'affichage des statuts et ton de chacun (point et barre) */
const STATUSES: readonly (readonly [ListStatus, Tone])[] = [
  ['CURRENT', 'info'],
  ['COMPLETED', 'ok'],
  ['PAUSED', 'warn'],
  ['DROPPED', 'error'],
  ['PLANNING', 'muted'],
  ['REPEATING', 'info'],
];

const PERIODS: readonly { value: StatsPeriod; key: 'stats.period.week' | 'stats.period.month' | 'stats.period.year' | 'compare.filter.all' }[] = [
  { value: '7d', key: 'stats.period.week' },
  { value: '30d', key: 'stats.period.month' },
  { value: '12m', key: 'stats.period.year' },
  { value: 'all', key: 'compare.filter.all' },
];

/** Plus haute note de chaque format, et pas des colonnes affichées (POINT_100 : paliers de 5 reçus, regroupés par 10) */
const SCORE_RANGE: Readonly<Record<AniListScoreFormat, { max: number; step: number }>> = {
  POINT_100: { max: 100, step: 10 },
  POINT_10_DECIMAL: { max: 10, step: 1 },
  POINT_10: { max: 10, step: 1 },
  POINT_5: { max: 5, step: 1 },
  POINT_3: { max: 3, step: 1 },
};

/** Répartition des notes sur toute l'échelle du format (colonnes vides comprises), chaque note arrondie au palier supérieur */
export function scoreBuckets(scores: ProfileStats['scores'], format: AniListScoreFormat): { score: number; count: number }[] {
  const { max, step } = SCORE_RANGE[format];
  const buckets = Array.from({ length: max / step }, (_, i) => ({ score: (i + 1) * step, count: 0 }));
  for (const { score, count } of scores) {
    const index = Math.min(buckets.length, Math.max(1, Math.ceil(score / step))) - 1;
    const bucket = buckets[index];
    if (bucket) bucket.count += count;
  }
  return buckets;
}

const formatCount = (value: number): string => new Intl.NumberFormat(getLocale()).format(value);
const formatScore = (value: number): string => new Intl.NumberFormat(getLocale(), { maximumFractionDigits: 1 }).format(value);

/** Genre traduit, sinon le nom AniList */
function genreLabel(name: string): string {
  const key = genreKey(name);
  return key ? t(key) : name;
}

/** « 26 oct. », année ajoutée quand elle n'est pas celle de `now` */
function shortDate(date: Date, now: number): string {
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return new Intl.DateTimeFormat(getLocale(), { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) }).format(date);
}

/** Libellé, infobulle et texte lu de chaque barre d'activité (jour : jour de la semaine sur 7 j, date sinon ; mois) */
function activityColumns(activity: ActivitySummary, now: number): BarColumn[] {
  const locale = getLocale();
  const long = activity.bars.length > 12;
  return activity.bars.flatMap((bar) => {
    const date = parseDateKey(activity.unit === 'day' ? bar.key : `${bar.key}-01`);
    if (date === null) return [];
    const label =
      activity.unit === 'day'
        ? activity.bars.length <= 7
          ? new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date)
          : shortDate(date, now)
        : new Intl.DateTimeFormat(locale, { month: 'short', ...(long ? { year: '2-digit' } : {}) }).format(date);
    const when = activity.unit === 'day' ? shortDate(date, now) : new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(date);
    const parts = [when, tp('accountMenu.week.value', bar.episodes), ...(bar.minutes > 0 ? [formatDuration(bar.minutes).text] : [])];
    return [{ key: bar.key, label, value: bar.episodes, title: parts.join(' · ') }];
  });
}

/** « depuis le … » : rien d'enregistré (depuis aujourd'hui), ou premier jour après le début de la période */
function sinceDay(activity: ActivitySummary, period: StatsPeriod, now: number): Date | null {
  if (activity.firstDay === null) return parseDateKey(dateKey(new Date(now)));
  if (period === 'all') return null;
  const first = activity.bars[0];
  const start = first ? (activity.unit === 'day' ? first.key : `${first.key}-01`) : null;
  return start !== null && activity.firstDay > start ? parseDateKey(activity.firstDay) : null;
}

/** Contrôle AniList / MAL du titre de l'écran : seulement avec deux comptes */
export function StatsServiceControl({ state, onService }: { state: ReadonlyStore<StatsView | null>; onService: (service: TrackerId) => void }) {
  useLocale();
  const view = useStore(state);
  if (view === null || view.service === null || view.services.length < 2) return null;
  return (
    <Segmented
      options={view.services.map((service) => ({ value: service, label: service === 'mal' ? 'MAL' : TRACKER_LABELS[service], aria: TRACKER_LABELS[service] }))}
      value={view.service}
      onChange={onService}
      label={t('stats.service')}
      focusKey="stats-service"
    />
  );
}

const CARD = 'rounded-card border border-line bg-surface p-3';

function Block({ id, title, children }: { id: string; title?: string; children: ComponentChildren }) {
  return (
    <div data-stats-block={id}>
      {title === undefined ? <div class={CARD}>{children}</div> : (
        <Section title={title}>
          <div class={CARD}>{children}</div>
        </Section>
      )}
    </div>
  );
}

function ActivityBlock({ view, now, onPeriod }: { view: StatsView; now: number; onPeriod: (period: StatsPeriod) => void }) {
  const { activity, period } = view;
  const since = sinceDay(activity, period, now);
  const duration = activity.minutes > 0 ? formatDuration(activity.minutes) : null;
  return (
    <Block id="activity" title={t('stats.activity')}>
      <div class="flex flex-col gap-2.5">
        <Segmented options={PERIODS.map(({ value, key }) => ({ value, label: t(key) }))} value={period} onChange={onPeriod} label={t('stats.period')} fill focusKey="stats-period" />
        <div class="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-0.5">
          <span class="font-display text-stat text-ink tabular-nums" data-activity-episodes="">
            {tp('accountMenu.week.value', activity.episodes)}
          </span>
          {duration && (
            <span class="flex items-center gap-1 text-secondary text-muted tabular-nums" title={duration.spoken}>
              <Icon name="clock" class="size-3.5 self-center" strokeWidth="2.2" />
              {duration.text}
            </span>
          )}
          {since && (
            <span class="ml-auto text-secondary text-muted" data-activity-since="">
              {t('stats.since', { date: shortDate(since, now) })}
            </span>
          )}
        </div>
        {activity.episodes > 0 ? (
          <BarColumns bars={activityColumns(activity, now)} caps="peak" />
        ) : (
          <p class="m-0 flex flex-col items-center gap-1 rounded-panel border border-dashed border-line px-3 py-3 text-center text-secondary text-muted">
            <Icon name="chart" class="size-4" />
            {t('stats.activity.empty')}
          </p>
        )}
      </div>
    </Block>
  );
}

function AllTimeDivider({ service }: { service: TrackerId }) {
  return (
    <div class="flex items-center gap-2 text-secondary text-muted" data-stats-all-time="">
      <span class="h-px min-w-4 flex-1 bg-line" aria-hidden="true" />
      <h2 class="m-0 flex min-w-0 items-center gap-1 text-secondary font-semibold">
        <span class="truncate">{t('stats.allTime')}</span>
        <span aria-hidden="true">·</span>
        <ServiceLogo id={service} size="sm" />
        <span class="shrink-0">{TRACKER_LABELS[service]}</span>
      </h2>
      <span class="h-px min-w-4 flex-1 bg-line" aria-hidden="true" />
    </div>
  );
}

/** Pavés des statuts pendant la lecture du profil (même hauteur que les lignes) */
function ProfileSkeleton() {
  return (
    <div class={`${CARD} flex flex-col gap-2`} aria-busy="true">
      {['w-16', 'w-20', 'w-14', 'w-16', 'w-12'].map((width, index) => (
        <div key={index} class="flex items-center gap-2 text-secondary">
          <Placeholder width={width} />
          <span class="h-2 flex-1 rounded-pill bg-line motion-safe:animate-pulse" aria-hidden="true" />
          <Placeholder width="w-6" />
        </div>
      ))}
    </div>
  );
}

/** Note moyenne dans le format de l'utilisateur (« 7,6 /10 ») */
function MeanScore({ mean100, format }: { mean100: number; format: AniListScoreFormat }) {
  const { value, max } = meanInFormat(mean100, format);
  return (
    <span class="flex min-w-0 flex-col">
      <span class="font-display text-stat text-ink tabular-nums">
        {formatScore(value)}
        <span class="text-secondary text-muted">{` /${max}`}</span>
      </span>
      <span class="text-secondary hyphens-auto break-words text-muted">{t('stats.meanScore')}</span>
    </span>
  );
}

function ProfileBlocks({ profile }: { profile: ProfileStats }) {
  const format = profile.scoreFormat;
  const statuses: BarRow[] = STATUSES.flatMap(([status, tone]) => {
    const item = profile.statuses.find((entry) => entry.status === status);
    return item && item.count > 0 ? [{ key: status, label: t(`page.status.${status}`), value: item.count, display: formatCount(item.count), tone }] : [];
  });
  const scores = profile.scores.length > 0 ? scoreBuckets(profile.scores, format) : [];
  const genres: BarRow[] = profile.genres.map((genre) => ({
    key: genre.genre,
    label: genreLabel(genre.genre),
    value: genre.count,
    display: formatCount(genre.count),
    extra:
      genre.meanScore100 === null ? undefined : (
        <>
          <Icon name="star" class="size-2.5 text-butter" strokeWidth="2.4" />
          {formatScore(meanInFormat(genre.meanScore100, format).value)}
        </>
      ),
  }));
  const formats: BarRow[] = profile.formats.map((entry) => ({ key: entry.format, label: formatLabel(entry.format), value: entry.count, display: formatCount(entry.count) }));
  const studios: BarRow[] = profile.studios.map((studio) => ({ key: studio.name, label: studio.name, value: studio.count, display: formatCount(studio.count) }));
  const decades: BarColumn[] = profile.decades.map(({ decade, count }) => {
    const label = t('stats.decade', { decade });
    return { key: String(decade), label, value: count, title: `${label} · ${formatCount(count)}` };
  });
  const mean = profile.meanScore100;

  return (
    <>
      {statuses.length > 0 && (
        <Block id="statuses" title={t('stats.statuses')}>
          <BarRows rows={statuses} />
        </Block>
      )}
      {scores.length > 0 ? (
        <Block id="scores" title={t('stats.scores')}>
          <div class="flex items-end gap-3">
            {mean !== null && (
              <span class="max-w-36 shrink-0 pb-4">
                <MeanScore mean100={mean} format={format} />
              </span>
            )}
            <BarColumns bars={scores.map(({ score, count }) => ({ key: String(score), label: formatScore(score), value: count, title: `${formatScore(score)} · ${formatCount(count)}` }))} />
          </div>
        </Block>
      ) : (
        (mean !== null || profile.rewatched !== null) && (
          // MAL : note moyenne et revisionnages côte à côte, sans répartition des notes
          <Block id="rewatched">
            <div class="grid grid-cols-2 gap-2">
              {mean !== null && (
                <span class="rounded-control bg-raised px-3 py-2">
                  <MeanScore mean100={mean} format={format} />
                </span>
              )}
              {profile.rewatched !== null && <span class="flex items-center rounded-control bg-raised px-3 py-2 font-display text-stat text-ink tabular-nums">{tp('stats.rewatched', profile.rewatched)}</span>}
            </div>
          </Block>
        )
      )}
      {genres.length > 0 && (
        <Block id="genres" title={t('panel.nowPlaying.genres')}>
          <BarRows rows={genres} />
        </Block>
      )}
      {formats.length > 0 && (
        <Block id="formats" title={t('stats.formats')}>
          <BarRows rows={formats} />
        </Block>
      )}
      {studios.length > 0 && (
        <Block id="studios" title={t('stats.studios')}>
          <BarRows rows={studios} />
        </Block>
      )}
      {decades.length > 0 && (
        <Block id="decades" title={t('stats.decades')}>
          <BarColumns bars={decades} caps="all" />
        </Block>
      )}
    </>
  );
}

/** Profil « Depuis le début » : session expirée (Reconnecter), lecture (pavés), erreur sans cache (Réessayer), blocs */
function Profile({ view, service, onReconnect, onRetry }: { view: StatsView; service: TrackerId; onReconnect: (service: TrackerId) => void; onRetry: () => void }) {
  const { account, refreshing } = view;
  if (account.status === 'logged-out') {
    return account.expired ? <Alert message={t('common.sessionExpired')} action={{ label: t('common.reconnect'), icon: 'retry', onClick: () => onReconnect(service), focusKey: 'stats-reconnect' }} /> : null;
  }
  if (account.status === 'logged-in' && account.viewer === null && account.error !== null && !refreshing) {
    return <Alert message={account.error} action={{ label: t('common.retry'), icon: 'retry', onClick: onRetry, focusKey: 'stats-retry' }} />;
  }
  const viewer = account.status === 'logged-in' ? account.viewer : null;
  const tiles = statsView(account, refreshing);
  const profile = viewer?.profile;
  return (
    <>
      <AllTimeDivider service={service} />
      {tiles !== 'hidden' && <StatTiles stats={tiles} />}
      {profile ? <ProfileBlocks profile={profile} /> : (viewer === null || (profile === undefined && refreshing)) && <ProfileSkeleton />}
    </>
  );
}

export function StatsScreen({ state, now, onPeriod, onReconnect, onRetry, onOpenAccounts }: StatsScreenProps) {
  useLocale();
  const view = useStore(state);
  if (view === null) return null;
  const { service } = view;
  if (service === null) {
    return (
      <div class={`${CARD} mt-1 flex flex-col items-center gap-2 text-center`} data-stats-screen="">
        <p class="m-0 text-secondary text-muted">{t('settings.summary.noAccount')}</p>
        <Button size="sm" onClick={onOpenAccounts} focusKey="stats-connect">
          {t('common.connect')}
        </Button>
      </div>
    );
  }
  return (
    <div class="flex flex-col gap-4 pt-1" data-stats-screen="">
      <ActivityBlock view={view} now={now} onPeriod={onPeriod} />
      {view.remaining !== null && (
        <Block id="watching" title={t('nav.watching')}>
          <p class="m-0 flex min-w-0 items-center gap-2 text-body text-ink tabular-nums">
            <Icon name="list" class="size-4 shrink-0 text-lavender" />
            <span class="truncate" title={view.remaining}>
              {view.remaining}
            </span>
          </p>
        </Block>
      )}
      <Profile view={view} service={service} onReconnect={onReconnect} onRetry={onRetry} />
    </div>
  );
}
