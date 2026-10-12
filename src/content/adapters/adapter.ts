import type { EpisodeInfo, StreamingPlatform } from '../../shared/episode.types';
import type { SeriesPageInfo } from '../../shared/page-media.types';

/** Position et durée de lecture (s) */
export interface PlaybackTime {
  currentTime: number;
  duration: number;
}

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

  /**
   * Page de série dont les métadonnées arrivent de façon asynchrone (pont du monde MAIN : Netflix, Disney+) ; null hors
   * page de série, si elles sont indisponibles ou si `signal` est annulé. Optionnel : appelé par la réponse à
   * GET_PAGE_MEDIA seulement quand `detectSeries` (lecture du cache) ne donne rien, dans un délai borné.
   */
  loadSeries?(url: URL, signal: AbortSignal): Promise<SeriesPageInfo | null>;

  /**
   * Page de série : surveille la saison choisie dans le menu de la page (le site ne change pas l'URL) et appelle
   * `onChange` à chaque changement ; retourne l'arrêt, null hors page de série. Posé seulement tant qu'un panneau latéral
   * est connecté (voir lib/season-watch.ts). Optionnel : sans implémentation, le panneau suit les changements d'URL.
   */
  watchSeason?(url: URL, onChange: () => void): (() => void) | null;

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
   * Position et durée de lecture (s) si la <video> ne les donne pas de façon fiable (Disney+ : `duration` vaut
   * Infinity ou NaN, la position est lue dans la barre de progression du lecteur). Null si indisponibles pour
   * l'instant. Optionnel : sans implémentation, `currentTime` et `duration` de la <video> font foi.
   * Lue à chaque `timeupdate` de la <video> (et par la progression en direct du panneau) : doit rester légère.
   */
  readPlayback?(video: HTMLVideoElement): PlaybackTime | null;

  /**
   * Catalogue généraliste (Netflix, Disney+) : la plupart des vidéos ne sont pas des animes. Ni toast
   * « Synchronisation… » ni toast « épisode non identifié » ; une série ignorée n'est plus renvoyée.
   */
  readonly quiet?: boolean;
}
