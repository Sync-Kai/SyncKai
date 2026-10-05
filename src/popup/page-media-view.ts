import { getLocale, t, tp, type Locale, type MessageKey } from '../i18n';
import type { PageListState, PageMediaView, PageSeason, SeasonSlot } from '../shared/page-media.types';
import type { ListStatus } from '../shared/sync.types';
import { nextEpisodeBadge } from '../shared/watching';
import type { AiringStatus, NextEpisodeBadge } from '../shared/watching.types';

// Vue de la carte « Sur cette page » : fonctions pures (testables) dérivées de la réponse du service worker.

export type InListState = Extract<PageListState, { state: 'in-list' }>;

/** Entrée de référence pour la progression, le statut et les contrôles : premier service où la série est dans la liste */
export function primaryList(lists: readonly PageListState[]): InListState | null {
  return lists.find((l): l is InListState => l.state === 'in-list') ?? null;
}

/** Au moins un service connecté où la série manque : boutons « Ajouter » affichés */
export function hasMissingList(lists: readonly PageListState[]): boolean {
  return lists.some((l) => l.state === 'not-in-list');
}

/** Note affichée dans les étoiles : la première note connue (AniList d'abord), null si non notée */
export function displayScore(lists: readonly PageListState[]): number | null {
  for (const list of lists) {
    if (list.state === 'in-list' && list.score !== null) return list.score;
  }
  return null;
}

/**
 * Pastille de diffusion (mêmes règles que « En cours »). Hors liste, la progression est ignorée :
 * pas de « Ép. N disponible », seulement la prochaine sortie, « terminée » ou « date inconnue ».
 */
export function pageBadge(view: PageMediaView, now: number): NextEpisodeBadge {
  const { media } = view;
  const progress = primaryList(view.lists)?.progress ?? Number.MAX_SAFE_INTEGER;
  return nextEpisodeBadge(
    {
      mediaId: media.mediaId,
      malId: media.idMal,
      title: media.title,
      coverUrl: media.coverUrl,
      progress,
      totalEpisodes: media.episodes,
      updatedAt: null,
      nextEpisode: media.nextEpisode,
      airingStatus: media.airingStatus,
      platforms: [],
      lastSync: null,
      siteUrl: media.siteUrl,
    },
    now,
  );
}

/**
 * Position de la fiche dans les saisons de la série (parties « Part 2 » regroupées), null si la fiche est
 * hors des saisons (spécial, autre résultat) ou si la série tient en une seule fiche.
 */
export function seasonPosition(view: PageMediaView): SeasonSlot | null {
  const slot = view.seasons.find((s) => s.id === view.media.mediaId)?.slot ?? null;
  if (!slot) return null;
  const seasonCount = Math.max(...view.seasons.map((s) => s.slot?.season ?? 0));
  return seasonCount > 1 || slot.parts > 1 ? slot : null;
}

/** "Saison 2", ou "Saison 2 · partie 1/2" pour une saison découpée en plusieurs fiches AniList */
export function seasonSlotLabel(slot: SeasonSlot): string {
  return slot.parts > 1 ? t('page.seasonSlotPart', { season: slot.season, part: slot.part, parts: slot.parts }) : t('page.seasonSlot', { season: slot.season });
}

/** Option du sélecteur : "Saison 2 · partie 1 — Mushoku Tensei II (2023)", ou "Titre (2023)" hors des saisons */
export function seasonOptionLabel(season: Pick<PageSeason, 'title' | 'year' | 'slot'>): string {
  const title = season.year !== null ? `${season.title} (${season.year})` : season.title;
  const { slot } = season;
  if (!slot) return title;
  return slot.parts > 1 ? t('page.seasonOptionPart', { season: slot.season, part: slot.part, title }) : t('page.seasonOption', { season: slot.season, title });
}

const AIRING_LABELS: Record<AiringStatus, MessageKey> = {
  RELEASING: 'page.airing.RELEASING',
  FINISHED: 'page.airing.FINISHED',
  NOT_YET_RELEASED: 'page.airing.NOT_YET_RELEASED',
  HIATUS: 'page.airing.HIATUS',
  CANCELLED: 'page.airing.CANCELLED',
};

/** Formats affichés tels quels (les séries TV, cas courant, ne sont pas précisées) */
const SHOWN_FORMATS: ReadonlySet<string> = new Set(['MOVIE', 'OVA', 'ONA', 'SPECIAL']);

/** Ligne d'infos sous le titre : "Saison 2 · partie 1/2 · 2023 · 12 ép. · Terminée" */
export function mediaMetaParts(view: PageMediaView): string[] {
  const { media } = view;
  const position = seasonPosition(view);
  const parts: string[] = [];
  if (position) parts.push(seasonSlotLabel(position));
  const format = media.format !== null && SHOWN_FORMATS.has(media.format) ? media.format : null;
  const when = [format, media.year].filter((p) => p !== null).join(' ');
  if (when) parts.push(when);
  if (media.episodes !== null) parts.push(tp('page.episodes', media.episodes));
  if (media.airingStatus) parts.push(t(AIRING_LABELS[media.airingStatus]));
  return parts;
}

const LIST_STATUS_LABELS: Record<ListStatus, MessageKey> = {
  CURRENT: 'page.status.CURRENT',
  PLANNING: 'page.status.PLANNING',
  COMPLETED: 'page.status.COMPLETED',
  DROPPED: 'page.status.DROPPED',
  PAUSED: 'page.status.PAUSED',
  REPEATING: 'page.status.REPEATING',
};

export function listStatusLabel(status: ListStatus): string {
  return t(LIST_STATUS_LABELS[status]);
}

/** Progression d'une entrée : "Ép. 5 / 12" ou "Ép. 5" (total inconnu) */
export function progressText(progress: number, total: number | null): string {
  return total !== null ? t('watching.heroProgress', { progress, total }) : t('watching.heroProgressNoTotal', { progress });
}

/** Date de sortie du prochain épisode, courte : "ven. 10 oct., 17:00" */
export function formatAiringDate(airingAt: number, locale: Locale = getLocale()): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(airingAt);
}
