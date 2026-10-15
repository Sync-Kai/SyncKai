import type { StreamingPlatform } from '../../platforms/registry';
import { deleteMediaMappingsIfUnchanged, getMediaMappings } from '../../browser/storage/mappings';
import { STORAGE_KEYS } from '../../protocol/storage-keys';
import type { MediaMapping } from '../../shared/sync.types';
import { createLogger } from '../../browser/logger';
import { getAnimeByIds, type AniListMedia } from '../anilist/media';
import { legacySeriesSlugInLink, linksToOtherSeries, linksToOtherSeriesBySlug, matchPlatformLink, SERIES_FORMATS } from './matching';

// Purge unique des correspondances apprises avant le correctif SYNC-01 (2.3.0) : une suite publiée comme une autre
// série de la plateforme (Naruto Shippuden) pouvait être mise en cache vers la fiche de la série précédente (Naruto).
// Netflix, même version : une série en plusieurs saisons dont AniList lie les premières à un autre titre Netflix
// (Ranma1/2) pouvait être mise en cache vers la fiche de la DERNIÈRE saison (« Fiche unique », S1E1 → saison 3).
// Le résolveur ne refait plus ces erreurs, mais une correspondance en cache est réutilisée telle quelle.

const log = createLogger('sync');

/** Fiches demandées par requête (Page(perPage: 50) de getAnimeByIds) */
const IDS_PER_REQUEST = 50;
const PENDING = 'pending';

/** Clés vérifiables : saison d'une série Crunchyroll, ADN ou Netflix désignée par son identifiant (pas `title:…`) */
const MAPPING_KEY = /^(crunchyroll|adn|netflix):([^:]+):s(\d+)$/;

interface MappingCheck {
  key: string;
  mapping: MediaMapping;
  platform: Extract<StreamingPlatform, 'crunchyroll' | 'adn' | 'netflix'>;
  seriesId: string;
  /** Slug de la page déduit du libellé enregistré (null : inconnu ou indéductible) */
  seriesSlug: string | null;
}

/** Slug d'URL d'un titre, au format des plateformes : « Naruto Shippuden » → naruto-shippuden, « JoJo's » → jojos */
export function slugFromTitle(title: string): string | null {
  const slug = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.length > 0 ? slug : null;
}

/**
 * Slug de la série déduit du libellé de la correspondance (« Naruto Shippuden · S1 », voir seasonLabel) : titre de la
 * série seul, sans saison ni titre de saison. null si le libellé est absent (correspondance d'avant la 1.1) ou ambigu.
 */
export function seriesSlugFromLabel(label: string | undefined, season: number): string | null {
  if (!label) return null;
  const marker = label.lastIndexOf(` · S${season}`);
  if (marker > 0) return slugFromTitle(label.slice(0, marker));
  // Sans numéro de saison, une parenthèse finale peut être le titre de saison ou faire partie du titre : on s'abstient
  return label.includes('(') ? null : slugFromTitle(label);
}

/**
 * Fiche d'une AUTRE série de la plateforme, sur preuve positive uniquement, et jamais si l'un de ses liens désigne la
 * série elle-même :
 * - lien avec identifiant vers une autre série (/series/{autre id}, /video/{autre id}-…) : signal fort ;
 * - ancien lien par slug dont le slug est le début de celui de la série (naruto ← naruto-shippuden, bleach ←
 *   bleach-thousand-year-blood-war) : schéma d'une suite publiée à part. Un slug simplement différent ne suffit pas :
 *   le slug déduit du libellé peut différer du vrai (titre traduit, ponctuation), la correspondance resterait juste.
 */
export function belongsToOtherSeries(
  media: Pick<AniListMedia, 'externalLinkUrls'>,
  platform: StreamingPlatform,
  seriesId: string,
  seriesSlug: string | null,
): boolean {
  const urls = media.externalLinkUrls;
  const linksToThisSeries = urls.some(
    (url) =>
      matchPlatformLink(url, platform, seriesId, seriesSlug, null) !== null ||
      // Ancien slug identique ou version doublée (naruto-shippuden-dubs)
      (seriesSlug !== null && legacySeriesSlugInLink(url, platform) !== null && !linksToOtherSeriesBySlug(url, platform, seriesSlug)),
  );
  if (linksToThisSeries) return false;
  if (urls.some((url) => linksToOtherSeries(url, platform, seriesId))) return true;
  if (seriesSlug === null) return false;
  return urls.some((url) => {
    const linkedSlug = legacySeriesSlugInLink(url, platform);
    return linkedSlug !== null && seriesSlug.startsWith(`${linkedSlug}-`);
  });
}

/**
 * Netflix : fiche suite d'une autre fiche série (relation PREQUEL vers une fiche TV / ONA). Seul ce cas a pu être mis en
 * cache à tort (fiche unique retenue pour une saison antérieure) ; une correspondance juste vers une suite est simplement
 * recalculée au prochain épisode (épisodes par saison de Netflix, voir alignPlatformSeasons).
 */
export function isSequelEntry(media: Pick<AniListMedia, 'relations'>): boolean {
  return media.relations.some((rel) => rel.type === 'ANIME' && rel.relationType === 'PREQUEL' && rel.format !== null && SERIES_FORMATS.has(rel.format));
}

function toCheck(key: string, mapping: MediaMapping): MappingCheck | null {
  const match = MAPPING_KEY.exec(key);
  if (!match) return null;
  const [, platform, seriesId, season] = match;
  if ((platform !== 'crunchyroll' && platform !== 'adn' && platform !== 'netflix') || !seriesId || season === undefined) return null;
  return { key, mapping, platform, seriesId, seriesSlug: seriesSlugFromLabel(mapping.seriesLabel, Number(season)) };
}

/**
 * Supprime les correspondances Crunchyroll et ADN dont la fiche appartient à une autre série de la plateforme
 * (voir belongsToOtherSeries), et les correspondances Netflix vers une suite (voir isSequelEntry) ; elles seront
 * recalculées au prochain épisode. Lecture, puis catalogue AniList hors du
 * verrou du stockage, puis suppression sous le verrou des seules entrées inchangées. Une erreur réseau remonte
 * avant toute suppression. Retourne le nombre supprimé.
 */
export async function purgeOtherSeriesMappings(): Promise<number> {
  const checks = Object.entries(await getMediaMappings()).flatMap(([key, mapping]) => toCheck(key, mapping) ?? []);
  if (checks.length === 0) return 0;

  const ids = [...new Set(checks.map((check) => check.mapping.mediaId))];
  const mediaById = new Map<number, AniListMedia>();
  for (let i = 0; i < ids.length; i += IDS_PER_REQUEST) {
    for (const media of await getAnimeByIds(ids.slice(i, i + IDS_PER_REQUEST), 'background')) mediaById.set(media.id, media);
  }

  // Fiche absente de la réponse (supprimée d'AniList) : aucune preuve, correspondance gardée
  const wrong = checks.filter((check) => {
    const media = mediaById.get(check.mapping.mediaId);
    if (media === undefined) return false;
    return check.platform === 'netflix' ? isSequelEntry(media) : belongsToOtherSeries(media, check.platform, check.seriesId, check.seriesSlug);
  });
  if (wrong.length === 0) return 0;
  return deleteMediaMappingsIfUnchanged(Object.fromEntries(wrong.map(({ key, mapping }) => [key, mapping])));
}

/** Purge à faire (mise à jour depuis une version antérieure au correctif) : relancée jusqu'à sa réussite */
export async function markOtherSeriesPurgePending(): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.otherSeriesPurge]: PENDING });
}

/**
 * Purge en attente (mise à jour, démarrage du navigateur) : une seule lecture du stockage si rien n'est à faire.
 * Échec (AniList injoignable, limite de requêtes) : rien n'est supprimé, la purge reste en attente pour le prochain
 * démarrage ou la prochaine mise à jour. Ne lève jamais.
 */
export async function runPendingOtherSeriesPurge(): Promise<void> {
  try {
    const flag: unknown = (await chrome.storage.local.get(STORAGE_KEYS.otherSeriesPurge))[STORAGE_KEYS.otherSeriesPurge];
    if (flag !== PENDING) return;
    const removed = await purgeOtherSeriesMappings();
    await chrome.storage.local.remove(STORAGE_KEYS.otherSeriesPurge);
    if (removed > 0) log.info(`${removed} correspondance(s) vers une autre série de la plateforme oubliée(s)`);
  } catch (error: unknown) {
    log.warn('Vérification des correspondances reportée au prochain démarrage :', error);
  }
}
