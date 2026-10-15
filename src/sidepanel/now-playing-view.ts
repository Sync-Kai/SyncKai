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

/** Saison de diffusion : "Printemps 2023" ("2023年春" : l'année à la place que lui donne la langue), "2023", ou null */
export function airedLabel(media: Pick<PanelMedia, 'season' | 'seasonYear'>): string | null {
  if (media.seasonYear === null) return null;
  return media.season ? t(SEASON_LABELS[media.season], { year: media.seasonYear }) : String(media.seasonYear);
}

/** "Épisode 5 / 12", "Épisode 5" (total inconnu), null sans épisode */
export function episodeLine(episode: number | null, total: number | null): string | null {
  if (episode === null) return null;
  return total !== null ? t('panel.nowPlaying.episode', { episode, total }) : t('panel.nowPlaying.episodeNoTotal', { episode });
}

// Identité et lecture partielle d'une page : partagées avec le popup et le service worker (cache par onglet)
export { isPartialEpisodePage, pageKey } from '../shared/page-media-cache';

/** Événement utile à la fiche : épisode annoncé par la page (port de lecture), synchro terminée, saison choisie dans le menu */
export type LiveEvent = { type: 'page'; episodeId: string | null } | { type: 'synced' } | { type: 'season' };

/**
 * Relecture de la page de l'onglet due à un événement du port :
 * - `navigate` : saison choisie dans le menu d'une page de série (sans changement d'URL), relue comme une navigation
 *   (plafond des relectures automatiques remis à zéro : le panneau suit le menu quel que soit le nombre de choix) ;
 * - `redetect` : relecture automatique, plafonnée (AUTO_REDETECT_*). Synchro terminée (la page a pu se compléter ; la
 *   fiche elle-même arrive par le cache de l'onglet). Épisode annoncé qui diffère de la fiche (navigation SPA) ou fiche
 *   d'une lecture partielle. Port ouvert sur une page de série : une saison choisie entre la lecture de la page et la
 *   connexion du port n'est signalée par aucun événement (la page prend sa référence à la connexion) ;
 * - null : rien à relire.
 */
export function liveEventRead(shown: PageMediaInfo | null, event: LiveEvent): 'navigate' | 'redetect' | null {
  if (event.type === 'season') return 'navigate';
  if (event.type === 'synced') return 'redetect';
  if (event.episodeId === null) return shown?.kind === 'series' ? 'redetect' : null;
  return !shown || shown.episode?.episodeId !== event.episodeId || isPartialEpisodePage(shown) ? 'redetect' : null;
}
