import type { EpisodeInfo } from '../../../shared/episode.types';
import type { MediaMapping } from '../../../shared/sync.types';

// Modèle de la correspondance (module feuille, sans import de matching/) : fiches candidates, épisode, résultat, et les
// règles de numérotation partagées par les étapes, la concordance et les correspondances en cache.

/** Formats AniList considérés comme des "saisons" (exclut films, OVA, spéciaux, clips) */
export const SERIES_FORMATS: ReadonlySet<string> = new Set(['TV', 'TV_SHORT', 'ONA']);

/** Formats AniList d'un épisode spécial, d'un OVA ou d'un film (saisons « spéciales » de la plateforme) */
export const SPECIAL_FORMATS: ReadonlySet<string> = new Set(['OVA', 'ONA', 'SPECIAL', 'MOVIE']);

/**
 * Écart toléré entre le nombre d'épisodes d'une saison de la plateforme et celui d'AniList (épisode 0, récapitulatif…) :
 * alignement des saisons, groupe prouvé, concordance, alerte de la page de série
 */
export const SEASON_COUNT_TOLERANCE = 2;

/**
 * Lien entre une fiche AniList et la série de la plateforme :
 * - id       : externalLink vers /series/{seriesId} (fiable)
 * - slug     : ancien format d'URL crunchyroll.com/{slug}
 * - relation : suite/préquelle d'une fiche liée (même franchise)
 * - episode  : externalLink vers la page de lecture de l'épisode lui-même (/watch/{episodeId}),
 *              fréquent pour un spécial rangé dans une saison de la série (ex : ONE PIECE HEROINES)
 * - other    : externalLink vers une AUTRE série de la même plateforme (Naruto pour la page Naruto Shippuden) :
 *              jamais une saison de la série, ni un relais de propagation des relations (voir linksToOtherSeries)
 * - other-slug : comme `other`, mais désignée par un ancien slug différent (crunchyroll.com/naruto sur la page
 *              naruto-shippuden) : signal faible, un slug a pu être renommé (voir linksToOtherSeriesBySlug)
 * - platform : Disney+ / Prime Video, lien vers la plateforme d'une fiche au titre de la série, sans désigner la page
 *              elle-même (voir policies/ › titleBound) : prouve seulement la présence sur la plateforme. Comme `id` partout, sauf
 *              pour la confiance : fiable seulement si ces fiches forment une seule franchise (voir hasTrustedLinks)
 */
export type LinkKind = 'id' | 'slug' | 'relation' | 'episode' | 'platform' | 'other' | 'other-slug' | null;

/** Fiche liée seulement à une autre série de la plateforme (identifiant ou ancien slug différent) */
export const isOtherSeries = (candidate: Pick<MediaCandidate, 'link'>): boolean => candidate.link === 'other' || candidate.link === 'other-slug';

/** Fiche rattachée à la série de la plateforme (lien direct, épisode ou suite/préquelle d'une fiche liée) */
export const isLinked = (candidate: Pick<MediaCandidate, 'link'>): boolean => candidate.link !== null && !isOtherSeries(candidate);

/** Fiche liée directement à la série ou à l'épisode (hors rattachement par relation) */
export const isDirectlyLinked = (candidate: Pick<MediaCandidate, 'link'>): boolean =>
  candidate.link === 'id' || candidate.link === 'slug' || candidate.link === 'episode' || candidate.link === 'platform';

export interface MediaCandidate {
  id: number;
  format: string | null;
  episodes: number | null;
  /** Date de début triable (AAAAMMJJ), null si inconnue */
  startDate: number | null;
  titles: string[];
  link: LinkKind;
  /** Suite d'une fiche série (relation PREQUEL vers une fiche TV / ONA) : jamais la 1re saison de la franchise */
  hasPrequel?: boolean;
  /** Signaux AniList comparés à ceux de la plateforme (voir concordance.ts) : fin de diffusion (année), statut, minutes, pays */
  endYear?: number | null;
  status?: string | null;
  duration?: number | null;
  country?: string | null;
  /** Suites / préquelles (fiches anime) : franchises distinguées par la concordance (remakes au même titre) */
  relations?: readonly { id: number; type: 'SEQUEL' | 'PREQUEL' }[];
}

export type EpisodeNumbers = Pick<
  EpisodeInfo,
  'animeTitle' | 'seasonTitle' | 'seasonNumber' | 'seasonEpisodeNumber' | 'displayedEpisodeNumber'
> &
  // Page de lecture uniquement : reconnaît une saison réduite à une œuvre (voir isSpecialSeason) ; plateforme : texte de la
  // raison ; signaux de la plateforme (concordance avec les fiches)
  Partial<Pick<EpisodeInfo, 'episodeTitle' | 'platform' | 'signals'>>;

export interface SyncTarget extends MediaMapping {
  progress: number;
  confidence: 'high' | 'low';
  /** Explication lisible du choix (logs / toast "à vérifier") */
  reason: string;
  /** Correspondance lue dans le cache (à revalider avec le catalogue avant d'écrire, voir syncEpisode) */
  fromCache?: true;
  /** Fiche prouvée par les signaux de la plateforme (groupe de saison unique et confirmé, voir concordance.ts) */
  bySignals?: true;
  /**
   * Saison placée par son seul rang sur la plateforme (numéro de saison ≥ 2 de la plateforme, sans numéro dans son titre ni
   * signal), alors qu'elle porte un titre propre qui ne désigne aucune fiche : la plateforme peut compter un spécial comme
   * saison (Dr. STONE « RYUSUI » en saison 3). L'import de l'historique ne l'applique jamais sans vérification.
   */
  byRank?: true;
}

/**
 * `ignored` : série hors du périmètre de la plateforme (Netflix, Disney+ : sans fiche AniList liée ni au même titre ;
 * Prime Video : animation sans fiche au titre exact), ignorée en silence
 */
export type ResolveResult = { ok: true; target: SyncTarget } | { ok: false; reason: string; ignored?: true };

/** Échec de la résolution (raison lisible) */
export type ResolveFailure = Extract<ResolveResult, { ok: false }>;

// ─── Numérotation ─────────────────────────────────────────────────────────

/**
 * Numérotation absolue : numéro affiché au-delà du numéro dans la saison (One Piece : « E1180 » affiché pour le 25e
 * épisode de la saison 24). Numéro absent (null ou non transmis) : non.
 */
export const isAbsoluteNumbering = (episode: { seasonEpisodeNumber?: number | null | undefined; displayedEpisodeNumber?: number | null | undefined }): boolean =>
  episode.displayedEpisodeNumber !== undefined &&
  episode.displayedEpisodeNumber !== null &&
  episode.seasonEpisodeNumber !== undefined &&
  episode.seasonEpisodeNumber !== null &&
  episode.displayedEpisodeNumber > episode.seasonEpisodeNumber;

export function isValidProgress(progress: number, episodes: number | null): boolean {
  return Number.isInteger(progress) && progress >= 1 && (episodes === null || progress <= episodes);
}

export const fits = (candidate: MediaCandidate, progress: number): boolean => isValidProgress(progress, candidate.episodes);

export const byStartDate = (a: MediaCandidate, b: MediaCandidate): number =>
  (a.startDate ?? Number.MAX_SAFE_INTEGER) - (b.startDate ?? Number.MAX_SAFE_INTEGER);

/** Total des épisodes de fiches consécutives (parties d'une saison) ; null si l'un d'eux est inconnu (fiche en cours) */
export function totalEpisodes(entries: readonly { episodes: number | null }[]): number | null {
  let total = 0;
  for (const entry of entries) {
    if (entry.episodes === null) return null;
    total += entry.episodes;
  }
  return total;
}

/**
 * Répartit un numéro sur des saisons consécutives à partir de `startIndex`
 * (ex : épisode 30 avec des saisons de 25 et 12 épisodes → 2e saison, épisode 5).
 */
export function walkSeasons(seasons: readonly MediaCandidate[], startIndex: number, episode: number): { index: number; progress: number } | null {
  let remaining = episode;
  for (let i = startIndex; i < seasons.length; i++) {
    const episodes = seasons[i]?.episodes ?? null;
    // Nombre d'épisodes inconnu = saison en cours de diffusion (ex : One Piece) : elle absorbe le reste,
    // même si des fiches plus récentes existent (saison annoncée, refonte "Log" liée à la même série…)
    if (episodes === null || remaining <= episodes) return { index: i, progress: remaining };
    remaining -= episodes;
  }
  return null;
}
