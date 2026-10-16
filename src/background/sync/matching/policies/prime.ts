import { isSentPrimeAnimeVerdict, type EpisodeInfo } from '../../../../shared/episode.types';
import { parsePrimeDetailId, primeId, primeIdInLink } from '../../../../platforms/prime/metadata';
import { hasExactTitle } from '../matching';
import { isDirectlyLinked, isLinked, type LinkKind, type MediaCandidate } from '../model';
import { seasonPool } from '../season-pool';
import { linkOfMedia, type LinkTarget, type PlatformMatchPolicy } from './policy';

// Prime Video (anime seulement, verdict de genre de la page de détail) : aucun identifiant de série sur la page de lecture,
// un lien par saison, liens AniList rares (souvent vers d'anciennes pages amazon.<tld>).

/**
 * Lien Prime Video d'une fiche AniList (primevideo.com ou amazon.<tld> : /detail/{id}, /dp/{ASIN}, /gp/video/detail/{id},
 * `?gti=`) : prouve seulement que la fiche est sur Prime Video (identifiants régionaux, une saison par lien). Retenu comme
 * lien de la série si un titre de la fiche est celui de la série (titleBound) ou s'il désigne la page elle-même
 * (isPrimeOwnLink). null pour un autre site ou une autre page.
 */
export function matchPrimeLink(url: string): LinkKind {
  return primeIdInLink(url) !== null ? 'id' : null;
}

/**
 * Identifiants Prime Video de la page (forme canonique de primeId) : GTI compact de la saison (`seriesId` d'une page de
 * détail), épisode en lecture (`episodeId`, GTI de l'épisode) et identifiant du chemin /detail/{id} de l'URL de l'épisode
 * (GTI compact de sa saison).
 */
export function primeOwnIds(query: { seriesId: string | null; episodeId?: string | null; url?: string }): string[] {
  let fromUrl: string | null = null;
  try {
    fromUrl = query.url ? parsePrimeDetailId(new URL(query.url).pathname) : null;
  } catch {
    fromUrl = null;
  }
  return [...new Set([query.seriesId, query.episodeId ?? null, fromUrl].flatMap((id) => primeId(id) ?? []))];
}

/** Lien Prime Video vers la page elle-même (saison ou épisode, voir primeOwnIds) : correspondance certaine, sans condition de titre */
export function isPrimeOwnLink(url: string, ownIds: readonly string[]): boolean {
  const id = primeIdInLink(url);
  return id !== null && ownIds.includes(id);
}

/** Identifiants de la page d'une requête (URL de l'épisode seulement si elle est connue) */
const ownIdsOf = ({ seriesId, episodeId, url }: LinkTarget): string[] => primeOwnIds({ seriesId, episodeId: episodeId ?? null, ...(url !== undefined ? { url } : {}) });

/**
 * Verdict « anime » de Prime Video (script de contenu, genres de la page de détail : voir EpisodeInfo.primeAnime) :
 * - `anime` : résolution normale (`open`), comme Crunchyroll / ADN ;
 * - `animation-ja` (animation avec une piste japonaise : indice faible, l'animation occidentale a aussi des doublages
 *   japonais, Secret Level le 2026-10-16) : résolution normale si une fiche est liée à la série ou porte son titre (saison
 *   numérotée « Season 2 » comprise, voir seasonPool) ; sinon `none` (ignorée en silence, jamais « introuvable ») ;
 * - `animation-exact-only` (animation sans piste japonaise : animation occidentale possible) : suivie seulement si une
 *   fiche porte exactement le titre de la série, ou est liée à Prime Video (lien vers la page, ou lien au titre de la
 *   série : voir titleBound) ; sinon `none` (ignorée en silence, comme une série Netflix sans fiche liée) ;
 * - verdict absent ou inconnu (ne devrait jamais arriver : `ignored` ne quitte pas le script de contenu) : `none`.
 * Autres plateformes : `open` (rien à filtrer ici).
 */
export function primeAnimeGate(episode: Pick<EpisodeInfo, 'platform' | 'animeTitle' | 'primeAnime'>, candidates: readonly MediaCandidate[]): 'open' | 'none' {
  if (episode.platform !== 'prime') return 'open';
  const verdict: unknown = episode.primeAnime;
  if (!isSentPrimeAnimeVerdict(verdict)) return 'none';
  if (verdict === 'anime') return 'open';
  const { animeTitle } = episode;
  const matches =
    verdict === 'animation-ja'
      ? candidates.some((c) => isLinked(c) || hasExactTitle(c, animeTitle)) || seasonPool(candidates, animeTitle).length > 0
      : candidates.some((c) => isDirectlyLinked(c) || hasExactTitle(c, animeTitle));
  return matches ? 'open' : 'none';
}

const base: Omit<PlatformMatchPolicy, 'linkOf'> = {
  titleBound: true,
  // Tout lien vers la plateforme ; condition de titre ou lien vers la page appliqués par linkOfMedia
  matchLink: (url) => matchPrimeLink(url),
  isOwnLink: (url, target) => isPrimeOwnLink(url, ownIdsOf(target)),
  // Un lien par saison (identifiants différents d'une saison à l'autre de la même série) : aucune autre série reconnaissable
  seriesIdInLink: () => null,
  legacySlugInLink: () => null,
  otherSeries: () => null,
  animeGate: (query, candidates) => primeAnimeGate({ ...query, platform: 'prime' }, candidates),
  filtersAnime: ({ primeAnime }) => primeAnime !== 'anime',
  ignoredBeforeSearch: ({ primeAnime }) => !isSentPrimeAnimeVerdict(primeAnime),
  countsAsPresence: false,
};

export const primePolicy: PlatformMatchPolicy = { ...base, linkOf: (media, query) => linkOfMedia(base, media, query) };
