// En-tête de la fiche d'une série (maquettes PopupPageEtats, PopupPageRetours ; carte « Sur cette page » du popup, prévu
// pour « En lecture » du panneau) : jaquette 44 × 62, surtitre en petites capitales, titre (lien vers la fiche, deux lignes
// au plus avec infobulle), ligne d'infos, pastille du prochain épisode et sa date, actions de l'hôte (« ⋯ ») à droite.
// Sans jaquette (introuvable, erreur, pas un anime) : surtitre et titre seuls, titre atténué si `muted`. Squelette de
// chargement : MediaHeaderSkeleton. Tous les textes arrivent traduits.
import type { ComponentChildren } from 'preact';
import { Cover } from './cover';
import type { SeriesEntryLink } from './series-row';
import type { Tone } from './tone';

/** Pastille du prochain épisode (« Ép. 7 dans 18 h ») et date de sortie */
export interface MediaAiring {
  tone: Extract<Tone, 'ok' | 'info'>;
  text: string;
  /** « sam. 17 oct., 18:00 » ; null : date passée ou inconnue */
  date: string | null;
}

export interface MediaHeaderProps {
  /** « Sur cette page » */
  overline: string;
  title: string;
  /** Jaquette ; absente (`undefined`) : en-tête sans jaquette */
  coverUrl?: string | null;
  /** Fiche ouverte par le titre et la jaquette ; null : texte seul */
  entry?: SeriesEntryLink | null;
  /** data-focus du lien du titre */
  titleFocusKey?: string;
  /** Ligne d'infos (« Saison 1 · Crunchyroll ») */
  meta?: string;
  airing?: MediaAiring | null;
  /** Titre atténué (pas un anime, plateforme désactivée) */
  muted?: boolean;
  /** Actions à droite (bouton « ⋯ ») */
  actions?: ComponentChildren;
}

const AIRING_TONES: Readonly<Record<MediaAiring['tone'], string>> = {
  ok: 'bg-mint/15 text-mint',
  info: 'bg-lavender/15 text-lavender',
};

const OVERLINE = 'truncate text-section text-muted uppercase';

export function MediaHeader({ overline, title, coverUrl, entry = null, titleFocusKey, meta, airing, muted = false, actions }: MediaHeaderProps) {
  const cover = coverUrl !== undefined && <Cover size="card" title={title} src={coverUrl} />;
  return (
    <div class="flex min-w-0 items-start gap-3" data-media-header="">
      {cover &&
        (entry ? (
          // Même lien que le titre : hors tabulation et masqué aux lecteurs d'écran (doublon)
          <a class="flex shrink-0 rounded-cover transition hover:brightness-110" href={entry.href} target="_blank" rel="noopener noreferrer" tabIndex={-1} aria-hidden="true">
            {cover}
          </a>
        ) : (
          cover
        ))}
      <div class="flex min-w-0 flex-1 flex-col">
        <span class={OVERLINE}>{overline}</span>
        <span class={`line-clamp-2 text-stat break-words ${muted ? 'text-muted' : 'text-ink'}`} title={title} data-media-title="">
          {entry ? (
            <a class="text-ink no-underline underline-offset-2 hover:underline" href={entry.href} target="_blank" rel="noopener noreferrer" aria-label={entry.label} data-focus={titleFocusKey}>
              {title}
            </a>
          ) : (
            title
          )}
        </span>
        {meta !== undefined && meta !== '' && (
          <span class="text-secondary font-semibold text-muted" data-media-meta="">
            {meta}
          </span>
        )}
        {airing && (
          <span class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-secondary" data-media-airing="">
            <span class={`rounded-pill px-1.5 font-extrabold whitespace-nowrap ${AIRING_TONES[airing.tone]}`}>{airing.text}</span>
            {airing.date !== null && <span class="whitespace-nowrap text-muted">{airing.date}</span>}
          </span>
        )}
      </div>
      {actions}
    </div>
  );
}

/** Chargement de la fiche : jaquette grisée, surtitre, titre de la page atténué, deux blocs (infos, progression) */
export function MediaHeaderSkeleton({ overline, title }: { overline: string; title: string }) {
  return (
    <div class="flex min-w-0 items-start gap-3 motion-safe:animate-pulse" data-media-skeleton="">
      <span class="h-15.5 w-11 shrink-0 rounded-cover bg-raised" />
      <div class="flex min-w-0 flex-1 flex-col gap-1.5">
        <span class={OVERLINE}>{overline}</span>
        <span class="truncate text-stat text-muted" title={title}>
          {title}
        </span>
        <span class="flex items-center gap-2">
          <span class="h-2.5 w-30 rounded-pill bg-raised" />
          <span class="flex-1" />
          <span class="h-7 w-30 rounded-pill bg-raised" />
        </span>
      </div>
    </div>
  );
}
