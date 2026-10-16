import type { EpisodeInfo } from '../../../../shared/episode.types';
import type { StreamingPlatform } from '../../../../platforms/registry';
import type { PlatformLinkVerdict } from '../matching';
import type { LinkKind, MediaCandidate } from '../model';
import { adnPolicy } from './adn';
import { crunchyrollPolicy } from './crunchyroll';
import { disneyPolicy } from './disney';
import { netflixPolicy } from './netflix';
import { primePolicy } from './prime';
import type { PlatformMatchPolicy } from './policy';

// Règles de correspondance de chaque plateforme (voir policy.ts), et les questions qu'on leur pose sans connaître la
// plateforme d'avance (synchro, page de série, purge des correspondances).

const POLICIES: Readonly<Record<StreamingPlatform, PlatformMatchPolicy>> = {
  crunchyroll: crunchyrollPolicy,
  adn: adnPolicy,
  netflix: netflixPolicy,
  disney: disneyPolicy,
  prime: primePolicy,
};

export const policyOf = (platform: StreamingPlatform): PlatformMatchPolicy => POLICIES[platform];

/**
 * Lien d'une fiche AniList vers la série de la plateforme de l'épisode, ou vers l'épisode lui-même
 * (`episodeId` : page de lecture uniquement).
 */
export function matchPlatformLink(url: string, platform: StreamingPlatform, seriesId: string | null, seriesSlug: string | null, episodeId: string | null = null): LinkKind {
  return POLICIES[platform].matchLink(url, { seriesId, seriesSlug, episodeId });
}

/**
 * Plateforme sans identifiant de série sur la page de lecture (Disney+, Prime Video) : un lien vers la plateforme ne
 * rattache une fiche à la série que si l'un de ses titres est celui de la série (titre exact, partie « Part 2 » ou
 * « Season N »), sauf lien vers la page elle-même. Sans cette condition, toute fiche Disney+ ou Prime Video des résultats
 * de recherche deviendrait une saison de la série.
 */
export const isTitleBoundLink = (platform: StreamingPlatform): boolean => POLICIES[platform].titleBound;

/**
 * Lien vers une AUTRE série de la même plateforme, désignée par son identifiant (Naruto → /series/{id de Naruto}
 * sur la page Naruto Shippuden). Un slug seul (ancien format Crunchyroll) ne suffit pas : les slugs ont pu être
 * renommés ou fusionnés, et exclure à tort une saison décalerait toutes les suivantes.
 */
export function linksToOtherSeries(url: string, platform: StreamingPlatform, seriesId: string | null): boolean {
  return POLICIES[platform].otherSeries(url, { seriesId, seriesSlug: null }) === 'id';
}

/**
 * Ancien lien sans identifiant vers une AUTRE série de la plateforme : crunchyroll.com/{slug} (ou /{langue}/{slug}),
 * animationdigitalnetwork.fr/video/{slug}, slug différent de celui de la série. Signal faible (slug renommé ou
 * ancienne page par saison possible) : la fiche est écartée, mais la confiance du résultat est plafonnée
 * (voir resolveTarget).
 */
export function linksToOtherSeriesBySlug(url: string, platform: StreamingPlatform, seriesSlug: string | null): boolean {
  return POLICIES[platform].otherSeries(url, { seriesId: null, seriesSlug }) === 'slug';
}

/**
 * Slug de série d'un ancien lien sans identifiant : crunchyroll.com/{slug} ou /{langue}/{slug} (page de série de
 * l'ancien site uniquement, pas /{slug}/episode-…, /series/…, /watch/…), animationdigitalnetwork.fr/video/{slug}.
 * null pour un autre site, un lien avec identifiant ou une page d'épisode.
 */
export function legacySeriesSlugInLink(url: string, platform: StreamingPlatform): string | null {
  return POLICIES[platform].legacySlugInLink(url);
}

/**
 * Série soumise à un filtre « anime » (verdict « série ignorée » possible, mémorisé : voir ignored-series.ts) : plateforme
 * généraliste (`linkRequired`), ou Prime Video hors genre anime (`animation-ja`, `animation-exact-only`, verdict absent).
 */
export function filtersAnime(episode: Pick<EpisodeInfo, 'platform' | 'primeAnime'>): boolean {
  return POLICIES[episode.platform].filtersAnime(episode);
}

/** Filtre « anime » de la plateforme sur les candidats (voir PlatformLinkVerdict, judge.ts) */
export function platformLinkVerdict(episode: Pick<EpisodeInfo, 'platform' | 'animeTitle' | 'primeAnime'>, candidates: readonly MediaCandidate[]): PlatformLinkVerdict {
  return POLICIES[episode.platform].animeGate(episode, candidates);
}
