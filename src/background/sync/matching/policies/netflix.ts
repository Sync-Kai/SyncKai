import { PLATFORMS } from '../../../../platforms/registry';
import type { LinkKind } from '../model';
import { linkOfMedia, linkRequiredVerdict, otherSeriesBy, parseUrl, type PlatformMatchPolicy } from './policy';

// Netflix (catalogue généraliste : filtre « anime » par lien AniList) : liens /title/{showId}, pays éventuel devant.

/**
 * Série Netflix d'un lien AniList : /title/{id}, éventuellement précédé du pays (/be-fr/title/{id}, /us/title/{id}) ; null pour
 * un autre site ou une autre page, dont les pages de lecture /watch/{id} (filtre « anime » de l'import de l'historique Netflix,
 * liens des fiches)
 */
export function netflixShowIdInLink(url: string | URL): string | null {
  const parsed = parseUrl(url);
  if (!parsed || !PLATFORMS.netflix.matchesHost(parsed.hostname)) return null;
  return /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?title\/(\d+)\/?$/i.exec(parsed.pathname)?.[1] ?? null;
}

/** Lien Netflix vers la fiche de la série elle-même (audit 1-D15 : une seule lecture du chemin, netflixShowIdInLink) */
export function matchNetflixLink(url: string, seriesId: string | null): LinkKind {
  return seriesId && netflixShowIdInLink(url) === seriesId ? 'id' : null;
}

const netflixLinks = { seriesIdInLink: (url: string): string | null => netflixShowIdInLink(url), legacySlugInLink: (): string | null => null };

const base: Omit<PlatformMatchPolicy, 'linkOf'> = {
  titleBound: false,
  matchLink: (url, { seriesId }) => matchNetflixLink(url, seriesId),
  isOwnLink: () => false,
  ...netflixLinks,
  otherSeries: (url, target) => otherSeriesBy(netflixLinks, url, target),
  animeGate: linkRequiredVerdict,
  filtersAnime: () => true,
  ignoredBeforeSearch: () => false,
  countsAsPresence: true,
};

export const netflixPolicy: PlatformMatchPolicy = { ...base, linkOf: (media, query) => linkOfMedia(base, media, query) };
