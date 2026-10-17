// En-tête de « En lecture » (maquettes PanelLecture, PanelFicheDetails, PanelFicheEtats) : bannière AniList (image, sinon
// dégradé de la couleur de l'affiche) et « Actualiser la fiche » en surimpression, jaquette 64 × 90 et titre (lien vers
// la fiche), ligne d'infos ; puis note moyenne, saison de diffusion, studio (lien), pastille du prochain épisode et sa
// date, genres. Squelette de chargement : HeroSkeleton (titre lu sur la page dès qu'il est connu).
import { t } from '../../i18n';
import type { EntryLink } from '../../shared/entry-link';
import type { PageMediaView } from '../../shared/page-media.types';
import type { PanelMedia } from '../../shared/panel-media.types';
import { TRACKER_LABELS } from '../../shared/tracker.types';
import { toImageSrc } from '../../shared/url';
import type { NextEpisodeBadge } from '../../shared/watching.types';
import { Cover } from '../../ui/components/cover';
import { Icon } from '../../ui/components/icon';
import { formatAiringDate, mediaMetaParts, pageBadge } from '../../ui/page-media-view';
import { airedLabel } from '../now-playing-view';

export interface NowPlayingHeroProps {
  view: PageMediaView;
  details: PanelMedia | null;
  /** Fiche ouverte par le titre et la jaquette (réglage « Fiche ouverte par défaut ») */
  entry: EntryLink | null;
  /** Relecture en cours : bouton en rotation */
  refreshing: boolean;
  /** Relecture ou action en cours : bouton inactif */
  busy: boolean;
  now: number;
  onRefresh: () => void;
}

const BADGE_TONES: Readonly<Record<NextEpisodeBadge['kind'], string>> = {
  available: 'bg-mint text-on-fill',
  upcoming: 'bg-lavender text-on-fill',
  finished: 'border border-line text-muted',
  unknown: 'border border-line text-muted',
};

/** Fond de repli de la bannière : couleur de l'affiche (#rrggbb validé) vers le fond de la page */
const bannerGradient = (color: string | null): string => `linear-gradient(135deg, ${color ?? 'var(--color-raised)'} 0%, var(--color-surface) 100%)`;

/** Lien externe (nouvel onglet) annoncé comme tel aux lecteurs d'écran */
export function newTabLabel(label: string): string {
  return t('panel.nowPlaying.newTab', { label });
}

function Banner({ details }: { details: PanelMedia | null }) {
  const src = toImageSrc(details?.bannerUrl);
  return (
    <div class="relative h-24 overflow-hidden bg-raised" style={{ backgroundImage: bannerGradient(details?.coverColor ?? null) }} aria-hidden="true" data-banner="">
      {src !== null && <img class="absolute inset-0 size-full object-cover" src={src} alt="" referrerpolicy="no-referrer" decoding="async" onError={(event) => event.currentTarget.remove()} />}
    </div>
  );
}

export function NowPlayingHero({ view, details, entry, refreshing, busy, now, onRefresh }: NowPlayingHeroProps) {
  const { media } = view;
  const meta = mediaMetaParts(view);
  const badge = pageBadge(view, now);
  const next = media.nextEpisode;
  const aired = details ? airedLabel(details) : null;
  const score = details?.averageScore ?? null;
  const studio = details?.studio ?? null;
  const cover = <Cover size="hero" title={media.title} src={details?.coverUrl ?? media.coverUrl} />;
  const entryLabel = entry ? t('entry.openAria', { title: media.title, service: TRACKER_LABELS[entry.service] }) : undefined;
  return (
    <section class="overflow-hidden rounded-card border border-line bg-surface" data-now-playing-hero="">
      <div class="relative">
        <Banner details={details} />
        <button
          type="button"
          class="absolute top-2 right-2 inline-flex size-8 cursor-pointer items-center justify-center rounded-pill border-0 bg-ground/80 p-0 text-ink transition-colors hover:bg-ground aria-disabled:cursor-default aria-disabled:opacity-60"
          aria-label={t('panel.nowPlaying.refresh')}
          title={t('panel.nowPlaying.refresh')}
          aria-disabled={busy ? 'true' : undefined}
          aria-busy={refreshing ? 'true' : undefined}
          data-focus="panel-refresh"
          onClick={() => {
            if (!busy) onRefresh();
          }}
        >
          <span class={`flex ${refreshing ? 'motion-safe:animate-spin' : ''}`}>
            <Icon name="retry" class="size-4" strokeWidth="2.2" />
          </span>
        </button>
      </div>
      <div class="relative -mt-9 flex gap-3 px-3 pb-3">
        {/* Jaquette : même lien que le titre, hors tabulation et masqué aux lecteurs d'écran (doublon) */}
        <span class="flex shrink-0 self-start rounded-control border-2 border-surface bg-surface">
          {entry ? (
            <a class="flex rounded-cover transition hover:brightness-110" href={entry.url} target="_blank" rel="noopener noreferrer" tabIndex={-1} aria-hidden="true">
              {cover}
            </a>
          ) : (
            cover
          )}
        </span>
        <div class="flex min-w-0 flex-1 flex-col justify-end pt-10">
          <h2 class="m-0 line-clamp-3 font-display text-stat font-extrabold break-words" title={media.title}>
            {entry ? (
              <a class="text-ink underline decoration-line underline-offset-3 hover:decoration-ink" href={entry.url} target="_blank" rel="noopener noreferrer" aria-label={entryLabel} data-focus="panel-entry">
                {media.title}
              </a>
            ) : (
              media.title
            )}
          </h2>
          {meta.length > 0 && <span class="text-secondary text-muted">{meta.join(' · ')}</span>}
        </div>
      </div>
      <div class="flex flex-col gap-2 px-3 pb-3">
        {(score !== null || aired !== null || studio !== null) && (
          <div class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-secondary font-bold text-muted">
            {score !== null && (
              <span class="flex items-center gap-1 text-butter" title={t('panel.nowPlaying.score', { score })} aria-label={t('panel.nowPlaying.score', { score })}>
                <Icon name="star" class="size-3 fill-current" strokeWidth="0" />
                {`${score} %`}
              </span>
            )}
            {aired !== null && <span>{aired}</span>}
            {studio !== null &&
              (studio.siteUrl ? (
                <a
                  class="flex min-w-0 items-center gap-1 text-muted underline decoration-field underline-offset-2 hover:text-ink"
                  href={studio.siteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={newTabLabel(t('common.labelValue', { label: t('panel.nowPlaying.studio'), value: studio.name }))}
                >
                  <span class="min-w-0 truncate">{studio.name}</span>
                  <Icon name="external" class="size-3" />
                </a>
              ) : (
                <span class="min-w-0 truncate" title={t('panel.nowPlaying.studio')}>
                  {studio.name}
                </span>
              ))}
          </div>
        )}
        <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span class={`flex h-5 items-center rounded-pill px-2 text-secondary font-extrabold whitespace-nowrap ${BADGE_TONES[badge.kind]}`} data-airing={badge.kind}>
            {badge.label}
          </span>
          {next !== null && next.airingAt > now && <span class="text-secondary text-muted">{formatAiringDate(next.airingAt)}</span>}
        </div>
        {details !== null && details.genres.length > 0 && (
          <ul class="m-0 flex list-none flex-wrap gap-1 p-0" aria-label={t('panel.nowPlaying.genres')}>
            {details.genres.map((genre) => (
              <li key={genre} class="rounded-pill bg-raised px-2 py-0.5 text-secondary font-bold text-lavender">
                {genre}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/** Chargement de la fiche (maquette PanelFicheEtats) : bannière, jaquette grisée, titre de la page dès qu'il est connu */
export function HeroSkeleton({ title }: { title: string | null }) {
  return (
    <div class="flex flex-col gap-2.5 motion-safe:animate-pulse" role="status" aria-busy="true" aria-label={t('panel.nowPlaying.loading')} data-now-playing-skeleton="">
      <div class="overflow-hidden rounded-card border border-line bg-surface">
        <div class="h-24 bg-raised" />
        <div class="relative -mt-9 flex gap-3 px-3 pb-3">
          <span class="h-23.5 w-17 shrink-0 rounded-control border-2 border-surface bg-raised" />
          <div class="flex min-w-0 flex-1 flex-col gap-2 pt-10">
            {title !== null ? <span class="truncate font-display text-stat font-extrabold text-muted">{title}</span> : <span class="h-4 w-40 rounded-pill bg-raised" />}
            <span class="h-2.5 w-32 rounded-pill bg-raised" />
            <span class="h-4 w-24 rounded-pill bg-raised" />
          </div>
        </div>
      </div>
      <div class="flex flex-col gap-3 rounded-card border border-line bg-surface p-3">
        <span class="h-2.5 w-24 rounded-pill bg-raised" />
        <span class="h-2 rounded-pill bg-raised" />
        <span class="flex items-center gap-3">
          <span class="h-2.5 w-30 rounded-pill bg-raised" />
          <span class="flex-1" />
          <span class="h-9 w-32 rounded-pill bg-raised" />
        </span>
      </div>
    </div>
  );
}
