import { PLATFORMS } from '../../../../platforms/registry';
import type { LinkKind } from '../model';
import { linkOfMedia, linkRequiredVerdict, parseUrl, type LinkedMedia, type PlatformMatchPolicy } from './policy';

// Disney+ (catalogue généraliste, anime japonais seulement) : aucun identifiant de série sur la page de lecture, un lien AniList
// vers Disney+ ne rattache qu'une fiche au titre de la série, sauf lien vers l'entité de la page de série elle-même.

/** Lien Disney+ vers une page de série : /browse/entity-{uuid}, éventuellement précédé de la langue */
const DISNEY_ENTITY_PATH = /^\/(?:[a-z]{2,3}(?:-[a-z0-9]{2,4})?\/)?browse\/entity-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i;

/** uuid de l'entité d'un lien Disney+ /browse/entity-{uuid} (minuscules), null pour une autre forme ou un autre site */
export function disneyEntityInLink(url: string): string | null {
  const parsed = parseUrl(url);
  if (!parsed || !PLATFORMS.disney.matchesHost(parsed.hostname)) return null;
  return DISNEY_ENTITY_PATH.exec(parsed.pathname)?.[1]?.toLowerCase() ?? null;
}

/** Ancien lien Disney+ vers une série : /series/{slug}/{id}, éventuellement précédé de la langue */
const DISNEY_LEGACY_SERIES_PATH = /^\/(?:[a-z]{2,3}(?:-[a-z0-9]{2,4})?\/)?series\/[^/]+\/([a-z0-9]{6,20})\/?$/i;

/**
 * Série Disney+ désignée par un lien AniList : « series:{id} » (ancien lien /series/{slug}/{id}) ou « entity:{uuid} »
 * (/browse/entity-{uuid}). Deux liens de même forme et de clés différentes désignent deux séries Disney+ distinctes ;
 * deux formes différentes ne se comparent pas. null pour une autre forme ou un autre site.
 */
export function disneySeriesKey(url: string): string | null {
  const entity = disneyEntityInLink(url);
  if (entity) return `entity:${entity}`;
  const parsed = parseUrl(url);
  if (!parsed || !PLATFORMS.disney.matchesHost(parsed.hostname)) return null;
  const id = DISNEY_LEGACY_SERIES_PATH.exec(parsed.pathname)?.[1];
  return id ? `series:${id.toLowerCase()}` : null;
}

/**
 * Lien de la fiche vers la série Disney+ elle-même (page de série : `seriesId` = uuid de l'entité) : correspondance
 * certaine, sans condition de titre. Faux sur une page de lecture (aucun identifiant de série).
 */
export function isDisneyEntityLink(url: string, seriesId: string | null): boolean {
  return seriesId !== null && disneyEntityInLink(url) === seriesId.toLowerCase();
}

/**
 * Lien Disney+ (source « Disney Plus » d'AniList, toutes formes : /series/{slug}/{id}, /browse/entity-{uuid}…) :
 * la page de lecture ne donne aucun identifiant de série, le lien prouve seulement que la fiche est sur Disney+.
 * Retenu comme lien de la série uniquement si un titre de la fiche est celui de la série (voir titleBound), ou
 * s'il désigne l'entité de la page de série (isDisneyEntityLink). Page de série : un lien vers une AUTRE entité ne
 * rattache pas la fiche (sans l'exclure pour autant : une saison peut être publiée comme série à part).
 */
export function matchDisneyLink(url: string, seriesId: string | null = null): LinkKind {
  const parsed = parseUrl(url);
  if (!parsed || !PLATFORMS.disney.matchesHost(parsed.hostname)) return null;
  const entity = seriesId !== null ? disneyEntityInLink(url) : null;
  return entity !== null && entity !== seriesId?.toLowerCase() ? null : 'id';
}

/**
 * Fiche liée à Disney+ mais refusée par la règle du titre, dont le lien désigne une AUTRE série Disney+ que celle des fiches
 * retenues (BLEACH, /series/bleach/…, pour BLEACH: Thousand-Year Blood War, /series/bleach-thousand-year-blood-war/…) : autre
 * série de la plateforme, jamais une saison par relation (sinon BLEACH, préquelle, deviendrait la saison 1). Même lien qu'une
 * fiche retenue (« The Separation », suite publiée dans la même série Disney+) : fiche de la série.
 */
function settleDisneyLinks(media: Iterable<LinkedMedia>, links: Map<number, LinkKind>): void {
  const all = [...media];
  const ownKeys = new Set(all.filter((m) => links.get(m.id) === 'id' || links.get(m.id) === 'platform').flatMap((m) => m.externalLinkUrls.flatMap((url) => disneySeriesKey(url) ?? [])));
  if (ownKeys.size === 0) return;
  const ownForms = new Set([...ownKeys].map((key) => key.split(':')[0]));
  for (const entry of all) {
    const link = links.get(entry.id);
    if (link !== null && link !== 'relation') continue;
    const keys = entry.externalLinkUrls.flatMap((url) => disneySeriesKey(url) ?? []);
    if (keys.some((key) => ownKeys.has(key))) links.set(entry.id, 'platform');
    else if (keys.some((key) => ownForms.has(key.split(':')[0]))) links.set(entry.id, 'other');
  }
}

const base: Omit<PlatformMatchPolicy, 'linkOf'> = {
  titleBound: true,
  matchLink: (url, { seriesId }) => matchDisneyLink(url, seriesId),
  isOwnLink: (url, { seriesId }) => isDisneyEntityLink(url, seriesId),
  // Aucun identifiant de série côté lecture : une autre série Disney+ n'est pas reconnaissable à son lien (voir settleLinks)
  seriesIdInLink: () => null,
  legacySlugInLink: () => null,
  otherSeries: () => null,
  settleLinks: settleDisneyLinks,
  animeGate: linkRequiredVerdict,
  filtersAnime: () => true,
  ignoredBeforeSearch: () => false,
  countsAsPresence: true,
};

export const disneyPolicy: PlatformMatchPolicy = { ...base, linkOf: (media, query) => linkOfMedia(base, media, query) };
