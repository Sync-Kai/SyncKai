import { PLATFORMS } from '../../../../platforms/registry';
import type { LinkKind } from '../model';
import { linkOfMedia, otherSeriesBy, parseUrl, pathSegments, type PlatformMatchPolicy } from './policy';

// Crunchyroll : liens /series/{id} (actuels), /{slug} ou /{langue}/{slug} (ancien site), /watch/{episodeId} (épisode).

export function matchCrunchyrollLink(url: string, seriesId: string | null, seriesSlug: string | null): LinkKind {
  const parsed = parseUrl(url);
  if (!parsed || !PLATFORMS.crunchyroll.matchesHost(parsed.hostname)) return null;

  const segments = pathSegments(parsed);
  const seriesIndex = segments.indexOf('series');
  if (seriesIndex !== -1) {
    return seriesId && segments[seriesIndex + 1] === seriesId.toLowerCase() ? 'id' : null;
  }
  // Ancien format : /{slug} ou /{langue}/{slug}
  return seriesSlug && segments.length <= 2 && segments.at(-1) === seriesSlug ? 'slug' : null;
}

/** Lien Crunchyroll vers la page de lecture d'un épisode précis : /watch/{episodeId}[/slug] */
export function matchCrunchyrollEpisodeLink(url: string, episodeId: string | null): boolean {
  if (!episodeId) return false;
  const parsed = parseUrl(url);
  if (!parsed || !PLATFORMS.crunchyroll.matchesHost(parsed.hostname)) return false;
  const segments = pathSegments(parsed);
  const watchIndex = segments.indexOf('watch');
  return watchIndex !== -1 && segments[watchIndex + 1] === episodeId.toLowerCase();
}

/**
 * Même série sur l'ancien site Crunchyroll : même slug, ou sa page de version doublée
 * (« attack-on-titan-dubs », fréquente dans les liens AniList à côté de la page principale).
 */
function isSameCrunchyrollSlug(linkedSlug: string, slug: string): boolean {
  return linkedSlug === slug || linkedSlug === `${slug}-dubs` || linkedSlug === `${slug}-dub`;
}

const crunchyrollLinks = {
  /** /series/{id} */
  seriesIdInLink(url: string): string | null {
    const parsed = parseUrl(url);
    if (!parsed || !PLATFORMS.crunchyroll.matchesHost(parsed.hostname)) return null;
    const segments = pathSegments(parsed);
    const index = segments.indexOf('series');
    return index === -1 ? null : (segments[index + 1] ?? null);
  },
  /** Page de série de l'ancien site uniquement : /{slug} ou /{langue}/{slug} (pas /{slug}/episode-…, /series/…, /watch/…) */
  legacySlugInLink(url: string): string | null {
    const parsed = parseUrl(url);
    if (!parsed || !PLATFORMS.crunchyroll.matchesHost(parsed.hostname)) return null;
    const segments = pathSegments(parsed);
    const isSeriesPage = segments.length === 1 || (segments.length === 2 && /^[a-z]{2}(?:-[a-z]{2})?$/.test(segments[0] ?? ''));
    const linkedSlug = segments.at(-1);
    return isSeriesPage && linkedSlug !== undefined && !['series', 'watch'].includes(linkedSlug) ? linkedSlug : null;
  },
};

const base: Omit<PlatformMatchPolicy, 'linkOf'> = {
  titleBound: false,
  matchLink: (url, { seriesId, seriesSlug, episodeId }) => (matchCrunchyrollEpisodeLink(url, episodeId ?? null) ? 'episode' : matchCrunchyrollLink(url, seriesId, seriesSlug)),
  isOwnLink: () => false,
  ...crunchyrollLinks,
  otherSeries: (url, target) => otherSeriesBy(crunchyrollLinks, url, target, isSameCrunchyrollSlug),
  animeGate: () => 'open',
  filtersAnime: () => false,
  ignoredBeforeSearch: () => false,
  countsAsPresence: true,
};

export const crunchyrollPolicy: PlatformMatchPolicy = { ...base, linkOf: (media, query) => linkOfMedia(base, media, query) };
