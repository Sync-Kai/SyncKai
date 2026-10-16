import { PLATFORMS } from '../../../../platforms/registry';
import type { LinkKind } from '../model';
import { linkOfMedia, otherSeriesBy, parseUrl, pathSegments, type PlatformMatchPolicy } from './policy';

// ADN : liens /video/{seriesId}-{slug} (actuel) ou /video/{slug} (ancien format), sur animationdigitalnetwork.com / .fr / .de.

/** Lien ADN vers la série : identifiant explicite d'abord, slug de l'ancien format sinon */
export function matchAdnLink(url: string, seriesId: string | null, seriesSlug: string | null): LinkKind {
  const parsed = parseUrl(url);
  if (!parsed || !PLATFORMS.adn.matchesHost(parsed.hostname)) return null;

  const segments = pathSegments(parsed);
  const series = segments[segments.indexOf('video') + 1];
  if (!segments.includes('video') || !series) return null;
  const [, linkedId, linkedSlug] = /^(?:(\d+)-)?(.+)$/.exec(series) ?? [];
  if (linkedId !== undefined) {
    // Identifiant explicite : il fait foi (un slug identique avec un autre identifiant est une autre série)
    return seriesId !== null && linkedId === seriesId ? 'id' : null;
  }
  // Ancien format sans identifiant : comparaison du slug
  return seriesSlug && linkedSlug === seriesSlug ? 'slug' : null;
}

const adnLinks = {
  /** /video/{id}-{slug} */
  seriesIdInLink(url: string): string | null {
    const parsed = parseUrl(url);
    if (!parsed || !PLATFORMS.adn.matchesHost(parsed.hostname)) return null;
    const segments = pathSegments(parsed);
    const index = segments.indexOf('video');
    return index === -1 ? null : (/^(\d+)-/.exec(segments[index + 1] ?? '')?.[1] ?? null);
  },
  /** /video/{slug} sans identifiant (avec identifiant : signal fort, voir seriesIdInLink) */
  legacySlugInLink(url: string): string | null {
    const parsed = parseUrl(url);
    if (!parsed || !PLATFORMS.adn.matchesHost(parsed.hostname)) return null;
    const segments = pathSegments(parsed);
    const index = segments.indexOf('video');
    const linkedSlug = index === -1 ? undefined : segments[index + 1];
    return linkedSlug !== undefined && !/^\d+-/.test(linkedSlug) ? linkedSlug : null;
  },
};

const base: Omit<PlatformMatchPolicy, 'linkOf'> = {
  titleBound: false,
  matchLink: (url, { seriesId, seriesSlug }) => matchAdnLink(url, seriesId, seriesSlug),
  isOwnLink: () => false,
  ...adnLinks,
  otherSeries: (url, target) => otherSeriesBy(adnLinks, url, target),
  animeGate: () => 'open',
  filtersAnime: () => false,
  ignoredBeforeSearch: () => false,
  countsAsPresence: true,
};

export const adnPolicy: PlatformMatchPolicy = { ...base, linkOf: (media, query) => linkOfMedia(base, media, query) };
