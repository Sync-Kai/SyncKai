import { t, type MessageKey } from '../i18n';
import { isPartialEpisodePage } from '../shared/page-media-cache';
import type { PageMediaInfo } from '../shared/page-media.types';
import type { MediaSeason, PanelMedia, PanelRelationType } from '../shared/panel-media.types';

// Onglet « En lecture » : fonctions pures (testables) dérivées de la page et de la fiche AniList.

const RELATION_LABELS: Record<PanelRelationType, MessageKey> = {
  PREQUEL: 'panel.nowPlaying.relation.PREQUEL',
  SEQUEL: 'panel.nowPlaying.relation.SEQUEL',
  PARENT: 'panel.nowPlaying.relation.PARENT',
  SIDE_STORY: 'panel.nowPlaying.relation.SIDE_STORY',
  SPIN_OFF: 'panel.nowPlaying.relation.SPIN_OFF',
};

export function relationLabel(type: PanelRelationType): string {
  return t(RELATION_LABELS[type]);
}

const SEASON_LABELS: Record<MediaSeason, MessageKey> = {
  WINTER: 'panel.nowPlaying.season.WINTER',
  SPRING: 'panel.nowPlaying.season.SPRING',
  SUMMER: 'panel.nowPlaying.season.SUMMER',
  FALL: 'panel.nowPlaying.season.FALL',
};

/** Saison de diffusion : "Printemps 2023", "2023", ou null */
export function airedLabel(media: Pick<PanelMedia, 'season' | 'seasonYear'>): string | null {
  if (media.seasonYear === null) return null;
  return media.season ? `${t(SEASON_LABELS[media.season])} ${media.seasonYear}` : String(media.seasonYear);
}

/** "Épisode 5 / 12", "Épisode 5" (total inconnu), null sans épisode */
export function episodeLine(episode: number | null, total: number | null): string | null {
  if (episode === null) return null;
  return total !== null ? t('panel.nowPlaying.episode', { episode, total }) : t('panel.nowPlaying.episodeNoTotal', { episode });
}

// Identité et lecture partielle d'une page : partagées avec le popup et le service worker (cache par onglet)
export { isPartialEpisodePage, pageKey } from '../shared/page-media-cache';

/** Événement utile à la fiche : épisode annoncé par la page (port de lecture), synchro terminée */
export type LiveEvent = { type: 'page'; episodeId: string | null } | { type: 'synced' };

/**
 * Relire la page de l'onglet ? Synchro terminée : oui (la page a pu se compléter depuis ; la fiche elle-même
 * arrive par le cache de l'onglet, écrit par le service worker). Épisode annoncé : s'il diffère de la fiche
 * (navigation SPA) ou si la fiche vient d'une lecture partielle.
 */
export function shouldRedetect(shown: PageMediaInfo | null, event: LiveEvent): boolean {
  if (event.type === 'synced') return true;
  if (event.episodeId === null) return false;
  return !shown || shown.episode?.episodeId !== event.episodeId || isPartialEpisodePage(shown);
}
