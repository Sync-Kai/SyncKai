import { t } from '../../i18n';
import type { EpisodeInfo, StreamingPlatform } from '../../shared/episode.types';
import type { MediaMapping, NumberingMode } from '../../shared/sync.types';
import { groupSeasons } from './season-groups';

/** Formats AniList considérés comme des "saisons" (exclut films, OVA, spéciaux, clips) */
export const SERIES_FORMATS: ReadonlySet<string> = new Set(['TV', 'TV_SHORT', 'ONA']);

/**
 * Lien entre une fiche AniList et la série de la plateforme :
 * - id       : externalLink vers /series/{seriesId} (fiable)
 * - slug     : ancien format d'URL crunchyroll.com/{slug}
 * - relation : suite/préquelle d'une fiche liée (même franchise)
 * - episode  : externalLink vers la page de lecture de l'épisode lui-même (/watch/{episodeId}),
 *              fréquent pour un spécial rangé dans une saison de la série (ex : ONE PIECE HEROINES)
 */
export type LinkKind = 'id' | 'slug' | 'relation' | 'episode' | null;

export interface MediaCandidate {
  id: number;
  format: string | null;
  episodes: number | null;
  /** Date de début triable (AAAAMMJJ), null si inconnue */
  startDate: number | null;
  titles: string[];
  link: LinkKind;
}

export type EpisodeNumbers = Pick<
  EpisodeInfo,
  'animeTitle' | 'seasonTitle' | 'seasonNumber' | 'seasonEpisodeNumber' | 'displayedEpisodeNumber'
>;

export interface SyncTarget extends MediaMapping {
  progress: number;
  confidence: 'high' | 'low';
  /** Explication lisible du choix (logs / toast "à vérifier") */
  reason: string;
}

export type ResolveResult = { ok: true; target: SyncTarget } | { ok: false; reason: string };

// ─── Helpers ──────────────────────────────────────────────────────────────

/** "Shingeki no Kyojin: Season 2" → "shingeki no kyojin season 2" (accents et ponctuation retirés) */
export function normalizeTitle(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function toSortableDate(date: { year: number | null; month: number | null; day: number | null } | null): number | null {
  if (!date?.year) return null;
  // Mois/jour inconnus : placés en fin de période pour ne pas passer devant une date précise
  return date.year * 10_000 + (date.month ?? 12) * 100 + (date.day ?? 31);
}

export function matchCrunchyrollLink(url: string, seriesId: string | null, seriesSlug: string | null): LinkKind {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!/(^|\.)crunchyroll\.com$/i.test(parsed.hostname)) return null;

  const segments = parsed.pathname.toLowerCase().split('/').filter(Boolean);
  const seriesIndex = segments.indexOf('series');
  if (seriesIndex !== -1) {
    return seriesId && segments[seriesIndex + 1] === seriesId.toLowerCase() ? 'id' : null;
  }
  // Ancien format : /{slug} ou /{langue}/{slug}
  return seriesSlug && segments.length <= 2 && segments.at(-1) === seriesSlug ? 'slug' : null;
}

/** Libellé lisible d'une saison : "One Piece · S24 (Elbaph)" */
export function seasonLabel(episode: Pick<EpisodeInfo, 'animeTitle' | 'seasonNumber' | 'seasonTitle'>): string {
  const season = episode.seasonNumber !== null ? ` · S${episode.seasonNumber}` : '';
  const hasDistinctTitle = episode.seasonTitle && normalizeTitle(episode.seasonTitle) !== normalizeTitle(episode.animeTitle);
  return `${episode.animeTitle}${season}${hasDistinctTitle ? ` (${episode.seasonTitle})` : ''}`;
}

/**
 * Lien ADN : /video/{seriesId}-{slug} (actuel) ou /video/{slug} (ancien format),
 * sur animationdigitalnetwork.com / .fr / .de.
 */
export function matchAdnLink(url: string, seriesId: string | null, seriesSlug: string | null): LinkKind {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!/(^|\.)animationdigitalnetwork\.(com|fr|de)$/i.test(parsed.hostname)) return null;

  const segments = parsed.pathname.toLowerCase().split('/').filter(Boolean);
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

/** Lien Crunchyroll vers la page de lecture d'un épisode précis : /watch/{episodeId}[/slug] */
export function matchCrunchyrollEpisodeLink(url: string, episodeId: string | null): boolean {
  if (!episodeId) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (!/(^|\.)crunchyroll\.com$/i.test(parsed.hostname)) return false;
  const segments = parsed.pathname.toLowerCase().split('/').filter(Boolean);
  const watchIndex = segments.indexOf('watch');
  return watchIndex !== -1 && segments[watchIndex + 1] === episodeId.toLowerCase();
}

/**
 * Lien d'une fiche AniList vers la série de la plateforme de l'épisode, ou vers l'épisode lui-même
 * (`episodeId` : page de lecture uniquement).
 */
export function matchPlatformLink(
  url: string,
  platform: StreamingPlatform,
  seriesId: string | null,
  seriesSlug: string | null,
  episodeId: string | null = null,
): LinkKind {
  switch (platform) {
    case 'crunchyroll':
      return matchCrunchyrollEpisodeLink(url, episodeId) ? 'episode' : matchCrunchyrollLink(url, seriesId, seriesSlug);
    case 'adn':
      return matchAdnLink(url, seriesId, seriesSlug);
  }
}

/** Clé de cache d'une saison : "crunchyroll:GRMG8ZQZR:s24" */
export function mappingKey(episode: Pick<EpisodeInfo, 'platform' | 'seriesId' | 'animeTitle' | 'seasonNumber'>): string {
  const series = episode.seriesId ?? `title:${normalizeTitle(episode.animeTitle)}`;
  return `${episode.platform}:${series}:s${episode.seasonNumber ?? 0}`;
}

/** Applique une correspondance en cache ; null si elle ne s'applique plus (ex : saison suivante). */
export function applyMapping(episode: EpisodeNumbers, mapping: MediaMapping): number | null {
  const base =
    mapping.numbering === 'displayed'
      ? episode.displayedEpisodeNumber
      : (episode.seasonEpisodeNumber ?? episode.displayedEpisodeNumber);
  if (base === null) return null;
  const progress = base - mapping.offset;
  return isValidProgress(progress, mapping.episodes) ? progress : null;
}

/**
 * Déduit une correspondance d'un choix manuel (fiche + épisode AniList confirmé par l'utilisateur).
 * Ex : Crunchyroll affiche E28, l'utilisateur confirme l'épisode 4 → numbering "displayed", offset 24,
 * donc E29 donnera 5. Retourne null si la progression est invalide pour la fiche.
 */
export function mappingFromManualChoice(
  episode: EpisodeNumbers,
  mediaId: number,
  progress: number,
  episodes: number | null,
): MediaMapping | null {
  if (!isValidProgress(progress, episodes)) return null;
  const { seasonEpisodeNumber: season, displayedEpisodeNumber: displayed } = episode;

  // Numéro dans la saison identique : correspondance la plus simple et la plus stable
  if (season !== null && progress === season) return { mediaId, numbering: 'season', offset: 0, episodes };
  if (displayed !== null) return { mediaId, numbering: 'displayed', offset: displayed - progress, episodes };
  if (season !== null) return { mediaId, numbering: 'season', offset: season - progress, episodes };
  return null;
}

function isValidProgress(progress: number, episodes: number | null): boolean {
  return Number.isInteger(progress) && progress >= 1 && (episodes === null || progress <= episodes);
}

const fits = (candidate: MediaCandidate, progress: number): boolean => isValidProgress(progress, candidate.episodes);

const byStartDate = (a: MediaCandidate, b: MediaCandidate): number =>
  (a.startDate ?? Number.MAX_SAFE_INTEGER) - (b.startDate ?? Number.MAX_SAFE_INTEGER);

/**
 * Répartit un numéro sur des saisons consécutives à partir de `startIndex`
 * (ex : épisode 30 avec des saisons de 25 et 12 épisodes → 2e saison, épisode 5).
 */
function walkSeasons(seasons: MediaCandidate[], startIndex: number, episode: number): { index: number; progress: number } | null {
  let remaining = episode;
  for (let i = startIndex; i < seasons.length; i++) {
    const { episodes } = seasons[i];
    // Nombre d'épisodes inconnu = saison en cours de diffusion (ex : One Piece) : elle absorbe le reste,
    // même si des fiches plus récentes existent (saison annoncée, refonte "Log" liée à la même série…)
    if (episodes === null || remaining <= episodes) return { index: i, progress: remaining };
    remaining -= episodes;
  }
  return null;
}

// ─── Résolution ───────────────────────────────────────────────────────────

/**
 * Saisons de la série, dans l'ordre de diffusion : fiches séries liées à la plateforme,
 * ou à défaut fiches séries au titre identique. Partagé par la synchro et la fiche de la page.
 */
export function seasonPool(candidates: readonly MediaCandidate[], animeTitle: string): MediaCandidate[] {
  const seasons = candidates.filter((c) => c.format !== null && SERIES_FORMATS.has(c.format)).sort(byStartDate);
  const linked = seasons.filter((c) => c.link !== null);
  if (linked.length > 0) return linked;
  // Sans lien vers la plateforme, repli sur un titre identique
  const animeKey = normalizeTitle(animeTitle);
  return seasons.filter((c) => c.titles.some((t) => normalizeTitle(t) === animeKey));
}

/**
 * Recherche AniList complémentaire pour un titre de saison distinct de la série : « One Piece HEROINES ».
 * Un titre de saison qui reprend déjà la série ("Attack on Titan Season 2") est cherché tel quel.
 * null : pas de titre de saison, ou identique à la série.
 */
export function seasonSearchQuery(animeTitle: string, seasonTitle: string | null): string | null {
  if (!seasonTitle) return null;
  const animeKey = normalizeTitle(animeTitle);
  const seasonKey = normalizeTitle(seasonTitle);
  if (!seasonKey || seasonKey === animeKey) return null;
  return seasonKey.startsWith(`${animeKey} `) ? seasonTitle : `${animeTitle} ${seasonTitle}`;
}

/** Fiche dédiée à l'épisode ou à sa saison, hors des saisons de la série (spécial, film, fiche non liée…) */
interface DedicatedEntry {
  candidate: MediaCandidate;
  progress: number;
  confident: boolean;
  reason: string;
}

/** Mots du titre de saison retrouvés tels quels dans un titre normalisé ("heroines" ⊂ "one piece heroines") */
const containsWords = (key: string, words: string): boolean => ` ${key} `.includes(` ${words} `);

/**
 * Fiche hors des saisons de la série désignant précisément l'épisode (numérotation relative uniquement) :
 * a) fiche liée à la page de lecture de l'épisode (/watch/{episodeId}) ;
 * b) fiche dont le titre est celui de la saison ("HEROINES" → « ONE PIECE HEROINES », spécial rangé
 *    en saison 30 de One Piece sur Crunchyroll) : titre exact, « série + saison », ou titre commençant par
 *    la série et contenant le titre de saison ; une seule fiche doit correspondre ;
 * c) aucune saison série : fiche unique au titre exact de la série (ex : spécial publié comme série à part).
 */
function dedicatedEntry(
  episode: EpisodeNumbers,
  candidates: readonly MediaCandidate[],
  pool: readonly MediaCandidate[],
  relative: number,
): DedicatedEntry | null {
  const poolIds = new Set(pool.map((c) => c.id));
  const outside = candidates.filter((c) => c.format !== 'MUSIC' && !poolIds.has(c.id));
  if (outside.length === 0) return null;

  // a) Lien vers l'épisode : une fiche à épisode unique (spécial, film) absorbe l'épisode quel que soit son numéro
  const byEpisode = outside.filter((c) => c.link === 'episode');
  if (byEpisode.length === 1) {
    const [only] = byEpisode;
    const progress = fits(only, relative) ? relative : only.episodes === 1 ? 1 : null;
    if (progress !== null) return { candidate: only, progress, confident: true, reason: t('match.episodeLink') };
  }

  const animeKey = normalizeTitle(episode.animeTitle);
  const seasonKey = episode.seasonTitle ? normalizeTitle(episode.seasonTitle) : '';
  const keysOf = (c: MediaCandidate): string[] => c.titles.map(normalizeTitle);
  // Une saison de la série porte déjà ce titre (« Attack on Titan Season 2 ») : l'étape 3 s'en charge,
  // un OVA « … Season 2 OVA » ne doit pas lui voler l'épisode
  const isPoolSeason = pool.some((c) => keysOf(c).some((k) => containsWords(k, seasonKey)));
  if (seasonKey.length >= 3 && seasonKey !== animeKey && !isPoolSeason) {
    const compound = seasonKey.startsWith(`${animeKey} `) ? seasonKey : `${animeKey} ${seasonKey}`;
    const exact = outside.filter((c) => keysOf(c).some((k) => k === compound || k === seasonKey));
    const loose = outside.filter((c) => keysOf(c).some((k) => k.startsWith(`${animeKey} `) && containsWords(k, seasonKey)));
    const matches = exact.length > 0 ? exact : loose;
    if (matches.length === 1 && fits(matches[0], relative)) {
      const [only] = matches;
      // Titre « série + saison » ou fiche liée : fiable ; titre de saison seul ou simplement inclus : à vérifier
      const confident = only.link !== null || keysOf(only).includes(compound);
      return { candidate: only, progress: relative, confident, reason: t('match.dedicatedSeason', { title: episode.seasonTitle ?? '' }) };
    }
  }

  if (pool.length === 0) {
    const sameTitle = outside.filter((c) => c.titles.some((title) => normalizeTitle(title) === animeKey));
    if (sameTitle.length === 1 && fits(sameTitle[0], relative)) {
      const [only] = sameTitle;
      return { candidate: only, progress: relative, confident: only.link !== null, reason: t('match.dedicatedSeries') };
    }
  }
  return null;
}

/** Choisit la fiche AniList et la progression correspondant à un épisode. */
export function resolveTarget(episode: EpisodeNumbers, candidates: MediaCandidate[]): ResolveResult {
  const linked = candidates.filter((c) => c.link !== null && c.format !== null && SERIES_FORMATS.has(c.format));
  const animeKey = normalizeTitle(episode.animeTitle);
  const pool = seasonPool(candidates, episode.animeTitle);
  const noEntry: ResolveResult = { ok: false, reason: t('match.noEntry', { title: episode.animeTitle }) };

  // Titre seul jugé fiable uniquement s'il désigne UNE fiche série et qu'il s'agit de la 1re saison
  // (fréquent sur ADN, rarement lié sur AniList). Remakes au même titre → plusieurs fiches → à vérifier.
  const isTrustedTitleMatch = linked.length === 0 && pool.length === 1 && (episode.seasonNumber ?? 1) === 1;
  const level = (isConfident: boolean): 'high' | 'low' => (isConfident && (linked.length > 0 || isTrustedTitleMatch) ? 'high' : 'low');

  const displayed = episode.displayedEpisodeNumber;
  const relative = episode.seasonEpisodeNumber ?? displayed;
  if (relative === null) return pool.length === 0 ? noEntry : { ok: false, reason: t('match.noNumber') };
  if (!Number.isInteger(relative) || (displayed !== null && !Number.isInteger(displayed))) {
    return pool.length === 0 ? noEntry : { ok: false, reason: t('match.special') };
  }
  // Ex. One Piece : "E1180" affiché pour le 25e épisode de la saison 24
  const isAbsolute = displayed !== null && episode.seasonEpisodeNumber !== null && displayed > episode.seasonEpisodeNumber;

  const target = (
    candidate: MediaCandidate,
    base: number,
    progress: number,
    numbering: NumberingMode,
    confidence: 'high' | 'low',
    reason: string,
  ): ResolveResult => ({
    ok: true,
    target: {
      mediaId: candidate.id,
      numbering,
      offset: base - progress,
      episodes: candidate.episodes,
      progress,
      confidence,
      reason:
        linked.length === 0 && candidate.link === null
          ? confidence === 'high'
            ? t('match.titleOnlyTrusted')
            : // Sans lien plateforme, c'est l'absence de lien (et non la règle appliquée) qui rend le choix incertain
              t('match.titleOnly')
          : reason,
    },
  });

  // 0. Fiche dédiée à l'épisode ou à sa saison (spécial rangé dans une saison de la série) : prime sur la
  //    fiche unique, qui avalerait sinon l'épisode 1 de « saison 30 » comme épisode 1 de One Piece.
  //    Jamais en numérotation absolue (One Piece E1180 reste sur la fiche principale).
  if (!isAbsolute) {
    const own = dedicatedEntry(episode, candidates, pool, relative);
    if (own) return target(own.candidate, relative, own.progress, 'season', own.confident ? 'high' : 'low', own.reason);
  }
  if (pool.length === 0) return noEntry;

  // 1. Fiche unique (ex : One Piece, une seule entrée AniList)
  if (pool.length === 1) {
    const only = pool[0];
    if (isAbsolute && displayed !== null && fits(only, displayed)) {
      return target(only, displayed, displayed, 'displayed', level(true), t('match.singleAbsolute'));
    }
    if (fits(only, relative)) {
      // Saison > 1 mais une seule fiche : la suite n'est peut-être pas liée sur AniList
      const isLaterSeason = !isAbsolute && (episode.seasonNumber ?? 1) > 1;
      return target(only, relative, relative, 'season', level(!isLaterSeason), isLaterSeason
        ? t('match.singleLaterSeason', { season: episode.seasonNumber ?? '?' })
        : t('match.single'));
    }
    return { ok: false, reason: t('match.beyondAniList', { episode: displayed ?? relative, total: only.episodes ?? '?' }) };
  }

  // 2. Plusieurs saisons, numérotation absolue : répartition cumulative
  if (isAbsolute && displayed !== null) {
    const hit = walkSeasons(pool, 0, displayed);
    if (hit && fits(pool[hit.index], hit.progress)) {
      return target(pool[hit.index], displayed, hit.progress, 'displayed', level(true), t('match.absoluteSplit', { count: pool.length }));
    }
  }

  // 3. Numérotation relative : saison identifiée par son titre…
  const seasonKey = episode.seasonTitle ? normalizeTitle(episode.seasonTitle) : '';
  if (seasonKey && seasonKey !== animeKey) {
    const exact = pool.filter((c) => c.titles.some((t) => normalizeTitle(t) === seasonKey));
    const matches = exact.length > 0 ? exact : pool.filter((c) => c.titles.some((t) => normalizeTitle(t).includes(seasonKey)));
    if (matches.length === 1 && fits(matches[0], relative)) {
      return target(matches[0], relative, relative, 'season', level(true), t('match.seasonByTitle', { title: episode.seasonTitle ?? '' }));
    }
  }

  // 4. …ou par son numéro. AniList découpe souvent une saison en plusieurs fiches (« Part 2 », « Cour 2 ») que
  //    la plateforme réunit : la saison N est le N-ième groupe de fiches (voir groupSeasons), avec report sur
  //    la partie suivante quand le numéro dépasse la première.
  if (episode.seasonNumber !== null && episode.seasonNumber >= 1) {
    const season = episode.seasonNumber;
    const groups = groupSeasons(pool);
    const isGrouped = groups.length < pool.length;

    if (isGrouped && season <= groups.length) {
      const group = groups[season - 1];
      const start = pool.indexOf(group[0]);
      const hit = walkSeasons(pool, start, relative);
      if (!hit || !fits(pool[hit.index], hit.progress)) return { ok: false, reason: t('match.undetermined') };
      // Fiable seulement si l'épisode reste dans le groupe de la saison N (sinon il déborde sur la saison suivante)
      const part = group.indexOf(pool[hit.index]);
      const reason =
        part === -1
          ? t('match.seasonSplit', { season })
          : group.length > 1
            ? t('match.seasonGroup', { season, part: part + 1, parts: group.length })
            : t('match.seasonExact', { season, index: start + 1 });
      return target(pool[hit.index], relative, hit.progress, 'season', level(part !== -1), reason);
    }

    // Aucune partie regroupée (saison N = N-ième fiche), ou saison au-delà des groupes détectés :
    // repli sur l'index des fiches, toujours à vérifier dans ce dernier cas
    const index = season - 1;
    const hit = walkSeasons(pool, index, relative);
    if (hit && fits(pool[hit.index], hit.progress)) {
      const isExact = hit.index === index;
      return target(pool[hit.index], relative, hit.progress, 'season', level(isExact && !isGrouped), isExact
        ? t('match.seasonExact', { season, index: index + 1 })
        : t('match.seasonSplit', { season }));
    }
  }

  return { ok: false, reason: t('match.undetermined') };
}
