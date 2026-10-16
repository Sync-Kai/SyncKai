import type { EpisodeInfo } from '../../../../shared/episode.types';
import { normalizeTitle } from '../../../../shared/title';
import type { PlatformLinkVerdict } from '../matching';
import { isLinked, type LinkKind, type MediaCandidate } from '../model';
import { seasonPool } from '../season-pool';
import { hasSeriesTitle } from '../season-titles';

// Règles de correspondance propres à une plateforme (audit 1-§4.2, Strategy) : lecture des liens AniList (série, épisode,
// page elle-même, autre série), règlement des liens entre fiches, filtre « anime », présence sur la plateforme. Une
// plateforme = un fichier de policies/ ; le registre (registry.ts) les réunit. Ajouter une plateforme (HIDIVE) : une
// politique de plus, le compilateur exige son entrée (Record exhaustif).

/** Série visée par les liens d'une fiche : identifiants de la page (épisode en lecture, page de série) */
export interface LinkTarget {
  seriesId: string | null;
  seriesSlug: string | null;
  /** Page de lecture : épisode (lien AniList vers l'épisode lui-même) */
  episodeId?: string | null;
  /** Page de lecture Prime Video : URL de l'épisode (GTI compact de sa saison, voir prime.ts › primeOwnIds) */
  url?: string;
}

/** Série de la page confrontée aux fiches : identifiants et titres (règle du titre des plateformes sans identifiant de série) */
export interface PolicyQuery extends LinkTarget {
  animeTitle: string;
  seasonTitle: string | null;
}

/** Fiche AniList lue par une politique (titres et liens externes) */
export interface LinkedMedia {
  id: number;
  titles: readonly string[];
  externalLinkUrls: readonly string[];
}

/** Verdict « anime » d'une série (filtre des plateformes généralistes et de Prime Video) */
export type AnimeQuery = Pick<EpisodeInfo, 'animeTitle' | 'primeAnime'>;

export interface PlatformMatchPolicy {
  /**
   * Lien vers la plateforme valable seulement pour une fiche au titre de la série (Disney+, Prime Video : aucun identifiant
   * de série sur la page de lecture), sauf lien vers la page elle-même (isOwnLink)
   */
  titleBound: boolean;
  /** Lien d'UNE URL AniList vers la série de la page, ou vers l'épisode lui-même (formes d'URL de la plateforme) */
  matchLink(url: string, target: LinkTarget): LinkKind;
  /** Lien d'une fiche avec la série de la page, toutes ses URL (règle du titre comprise) */
  linkOf(media: LinkedMedia, query: PolicyQuery): LinkKind;
  /** Lien vers la page elle-même (entité Disney+ ; saison ou épisode Prime Video) : certain, sans condition de titre */
  isOwnLink(url: string, target: LinkTarget): boolean;
  /** Identifiant de série explicite d'un lien de la plateforme (autre série reconnaissable), null sinon */
  seriesIdInLink(url: string): string | null;
  /** Slug de série d'un ancien lien sans identifiant (page de série de l'ancien site), null sinon */
  legacySlugInLink(url: string): string | null;
  /** URL vers une AUTRE série de la plateforme : identifiant différent (signal fort), ancien slug différent (faible) */
  otherSeries(url: string, target: LinkTarget): 'id' | 'slug' | null;
  /**
   * Liens réglés entre fiches après chaque ajout (Disney+ : fiche refusée par la règle du titre, de même clé de série Disney+
   * qu'une fiche retenue → de la série ; d'une autre clé de même forme → autre série)
   */
  settleLinks?(media: Iterable<LinkedMedia>, links: Map<number, LinkKind>): void;
  /** Filtre « anime » sur les candidats (voir PlatformLinkVerdict) */
  animeGate(query: AnimeQuery, candidates: readonly MediaCandidate[]): PlatformLinkVerdict;
  /** Série soumise à un filtre « anime » (verdict « série ignorée » possible, mémorisé : voir ignored-series.ts) */
  filtersAnime(query: Pick<AnimeQuery, 'primeAnime'>): boolean;
  /** Série ignorée avant toute recherche (Prime Video sans verdict « anime » envoyé : ne devrait jamais arriver) */
  ignoredBeforeSearch(query: Pick<AnimeQuery, 'primeAnime'>): boolean;
  /**
   * Ses liens AniList prouvent la présence d'une fiche sur la plateforme (fiche « liée seulement à une autre plateforme »,
   * voir resolver.ts › linksElsewhereOnly). Faux pour Prime Video : liens rares et souvent vers d'anciennes pages amazon.com.
   */
  countsAsPresence: boolean;
}

/** URL analysée, null si invalide */
export function parseUrl(url: string | URL): URL | null {
  if (typeof url !== 'string') return url;
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/** Segments du chemin, en minuscules */
export const pathSegments = (url: URL): string[] => url.pathname.toLowerCase().split('/').filter(Boolean);

/**
 * Autre série d'un lien, à partir des lectures de la plateforme : identifiant explicite différent → `id` ; ancien slug sans
 * identifiant différent (`sameSlug` : même série, page doublée comprise sur Crunchyroll) → `slug`. Un slug seul n'est qu'un
 * signal faible : renommé ou fusionné, il ne doit pas exclure à tort une saison (voir resolveTarget).
 */
export function otherSeriesBy(
  policy: Pick<PlatformMatchPolicy, 'seriesIdInLink' | 'legacySlugInLink'>,
  url: string,
  { seriesId, seriesSlug }: LinkTarget,
  sameSlug: (linkedSlug: string, slug: string) => boolean = (linkedSlug, slug) => linkedSlug === slug,
): 'id' | 'slug' | null {
  const linkedId = seriesId ? policy.seriesIdInLink(url) : null;
  if (linkedId !== null && seriesId && linkedId !== seriesId.toLowerCase()) return 'id';
  const linkedSlug = seriesSlug ? policy.legacySlugInLink(url) : null;
  return linkedSlug !== null && seriesSlug && !sameSlug(linkedSlug, seriesSlug.toLowerCase()) ? 'slug' : null;
}

/**
 * Lien d'une fiche avec la série de la page (toutes plateformes) :
 * - plateforme sans identifiant de série (`titleBound`) : fiche hors titre de la série (ou de la saison) et sans lien vers la
 *   page elle-même → aucun lien ;
 * - lien vers l'épisode lui-même → `episode` (prime sur le lien vers la série) ;
 * - lien vers la série → son genre, ou `platform` (présence seule, voir hasTrustedLinks) sur une plateforme sans identifiant
 *   de série, sauf lien vers la page elle-même ;
 * - sinon, liée seulement à une autre série de la plateforme → `other` (identifiant) ou `other-slug` (ancien slug), jamais une
 *   saison par relation.
 */
export function linkOfMedia(policy: Omit<PlatformMatchPolicy, 'linkOf'>, media: LinkedMedia, query: PolicyQuery): LinkKind {
  const urls = media.externalLinkUrls;
  const isOwnEntity = policy.titleBound && urls.some((url) => policy.isOwnLink(url, query));
  if (policy.titleBound && !isOwnEntity && !hasSeriesTitle(media.titles, query.animeTitle) && !(query.seasonTitle && hasSeriesTitle(media.titles, query.seasonTitle))) return null;
  const kinds = urls.map((url) => policy.matchLink(url, query));
  // Le lien vers l'épisode lui-même prime sur le lien vers la série
  if (kinds.includes('episode')) return 'episode';
  const own = kinds.find((k) => k !== null);
  if (own) return policy.titleBound && !isOwnEntity ? 'platform' : own;
  // Liée seulement à une autre série de la plateforme : marquée pour ne jamais devenir une saison par relation
  const others = urls.map((url) => policy.otherSeries(url, query));
  if (others.includes('id')) return 'other';
  return others.includes('slug') ? 'other-slug' : null;
}

/**
 * Filtre « anime » d'une plateforme généraliste (PLATFORMS[…].linkRequired : Netflix, Disney+) : `linked` (fiche liée à la
 * série), `title` (fiches au titre de la série seulement : jamais fiable), `none` (série ignorée).
 */
export function linkRequiredVerdict(query: Pick<AnimeQuery, 'animeTitle'>, candidates: readonly MediaCandidate[]): PlatformLinkVerdict {
  if (candidates.some(isLinked)) return 'linked';
  const animeKey = normalizeTitle(query.animeTitle);
  const isTitleMatch = seasonPool(candidates, query.animeTitle).length > 0 || candidates.some((c) => c.titles.some((title) => normalizeTitle(title) === animeKey));
  return isTitleMatch ? 'title' : 'none';
}
