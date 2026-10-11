import type { EpisodeInfo, StreamingPlatform } from '../../shared/episode.types';
import type { SeriesPageInfo } from '../../shared/page-media.types';

/**
 * Contrat commun à toutes les plateformes (Crunchyroll, ADN…).
 * Toute la logique spécifique au DOM/URL d'un site est isolée dans son adapter.
 */
export interface StreamingAdapter {
  readonly platform: StreamingPlatform;

  /** Vrai si l'adapter gère ce domaine */
  supportsHost(hostname: string): boolean;

  /** Identifiant de l'épisode si l'URL est une page de lecture, sinon null */
  getEpisodeId(url: URL): string | null;

  /** Extrait les métadonnées de l'épisode ; null si le DOM n'est pas encore prêt */
  extractEpisodeInfo(url: URL): EpisodeInfo | null;

  /**
   * Série affichée si l'URL est une page de série (hors page de lecture), sinon null.
   * Lecture à la demande (popup) : aucun écouteur DOM n'est posé.
   */
  detectSeries(url: URL): SeriesPageInfo | null;

  /** Retourne l'élément <video> du lecteur s'il est présent */
  findVideo(): HTMLVideoElement | null;

  /**
   * Début du générique de fin (s) si la plateforme le fournit, sinon null.
   * Optionnel : sans implémentation, la complétion se fait au seuil de repli.
   */
  getCreditsStart?(episodeId: string, signal: AbortSignal): Promise<number | null>;

  /**
   * Métadonnées obtenues de façon asynchrone (requête à la plateforme) plutôt que lues dans le DOM ;
   * null si l'épisode est introuvable ou la requête annulée. Si présente, la session de lecture l'utilise
   * à la place de l'attente de `extractEpisodeInfo` (qui ne fait alors que relire le cache de l'adapter).
   */
  loadEpisodeInfo?(episodeId: string, signal: AbortSignal): Promise<EpisodeInfo | null>;

  /**
   * Catalogue généraliste (Netflix) : la plupart des vidéos ne sont pas des animes. Ni toast
   * « Synchronisation… » ni toast « épisode non identifié » ; une série ignorée n'est plus renvoyée.
   */
  readonly quiet?: boolean;
}
