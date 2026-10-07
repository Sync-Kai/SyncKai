import { t, type MessageKey } from '../i18n';
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

/** Clé d'identité d'une page (série/saison + épisode) : même clé = rien à recharger */
export function pageKey(page: PageMediaInfo): string {
  return JSON.stringify([page.platform, page.kind, page.seriesId, page.seriesSlug, page.seriesTitle, page.seasonNumber, page.seasonTitle, page.episode?.episodeId ?? null]);
}
