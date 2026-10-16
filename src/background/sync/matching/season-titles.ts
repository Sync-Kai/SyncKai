import { normalizeTitle } from '../../../shared/title';
import type { EpisodeNumbers, MediaCandidate } from './model';
import { stripCourMarker } from './season-groups';

// Titres de saison : numéro de saison écrit dans un titre (fiche AniList ou saison de la plateforme), saisons spéciales,
// rapprochement d'un titre de saison et des titres des fiches.

/** Titre (normalisé) terminé par un mot de spécial : « … season 5 ova », « … specials », « … recap » */
const SPECIAL_TITLE_END = / (?:ovas?|oads?|specials?|recaps?)$/;

/** ONA titrée comme un spécial (« My Hero Academia Season 5 OVA ») : pas une saison, elle décalerait les suivantes */
export const isSpecialTitled = (c: Pick<MediaCandidate, 'titles'>): boolean => c.titles.some((title) => SPECIAL_TITLE_END.test(normalizeTitle(title)));

/**
 * Mots « saison » lus dans un titre, côté AniList (seasonMarker) comme côté plateforme (seasonNumberFromTitle). Le titre de
 * saison de la plateforme accepte aussi « Temporada » (SEASON_WORDS_PLATFORM) : un titre AniList « … Temporada 2 » ne
 * désigne aucune saison (écart relevé par l'audit 1-D11, gardé tel quel).
 */
const SEASON_WORDS = ['season', 'saison', 'staffel'];
const SEASON_WORDS_PLATFORM = [...SEASON_WORDS, 'temporada'];

/** Titre de fiche (normalisé) terminé par « season N » / « saison N » / « staffel N » */
const SEASON_MARKER_END = new RegExp(String.raw` (?:${SEASON_WORDS.join('|')}) (\d{1,2})$`);

/** « kaiju no 8 season 2 » → { base: « kaiju no 8 », season: 2 } (titre normalisé) ; null sans numéro de saison final */
function seasonMarker(key: string): { base: string; season: number } | null {
  const match = SEASON_MARKER_END.exec(key) ?? / (\d{1,2})(?:st|nd|rd|th) season$/.exec(key);
  const season = match ? Number(match[1]) : 0;
  return match && season >= 1 ? { base: key.slice(0, match.index), season } : null;
}

/**
 * Saison désignée par le titre d'une fiche, pour une série sans lien vers la plateforme : 1 pour le titre de la
 * série (ou l'une de ses parties « Part 2 »), N pour « Série Season N » / « Série 2nd Season » (parties comprises),
 * null si la fiche ne porte pas le titre de la série.
 */
export function titleSeasonOf(titles: readonly string[], animeKey: string): number | null {
  let numbered: number | null = null;
  for (const title of titles) {
    const key = normalizeTitle(title);
    const part = stripCourMarker(title);
    if (key === animeKey || part?.base === animeKey) return 1;
    const marker = seasonMarker(part?.base ?? key);
    if (marker && marker.base === animeKey) numbered ??= marker.season;
  }
  return numbered;
}

/** Fiche dont l'un des titres est celui de la série (ou d'une de ses saisons / parties), voir titleSeasonOf */
export function hasSeriesTitle(titles: readonly string[], animeTitle: string): boolean {
  return titleSeasonOf(titles, normalizeTitle(animeTitle)) !== null;
}

/** Titre de saison de la plateforme : « Season 2 », « Saison 2 », « Staffel 2 », « Temporada 2 » (n'importe où) */
const PLATFORM_SEASON_NUMBER = new RegExp(String.raw`\b(?:${SEASON_WORDS_PLATFORM.join('|')})\s*(\d{1,2})\b`, 'i');

/**
 * Numéro de saison écrit dans le titre de saison : « Season 2 », « Saison 2 », « Staffel 2 », « 2nd Season ».
 * Crunchyroll compte parfois une saison spéciale dans `season_number` (Kaiju No. 8 : S3 « Season 2 »).
 * « Part N » n'est pas un numéro de saison (JoJo « Part 3 », cours d'une même saison).
 */
export function seasonNumberFromTitle(seasonTitle: string | null): number | null {
  if (!seasonTitle) return null;
  const match = PLATFORM_SEASON_NUMBER.exec(seasonTitle) ?? /\b(\d{1,2})\s*(?:st|nd|rd|th)\s+season\b/i.exec(seasonTitle);
  const value = match ? Number(match[1]) : null;
  return value !== null && value >= 1 ? value : null;
}

/** Numéro de saison retenu pour choisir la fiche : celui du titre de saison s'il en contient un, sinon celui de la plateforme */
export function effectiveSeasonNumber(episode: Pick<EpisodeNumbers, 'seasonNumber' | 'seasonTitle'>): number | null {
  return seasonNumberFromTitle(episode.seasonTitle) ?? episode.seasonNumber;
}

/** Mots qui désignent une saison spéciale dans son titre (« OVA Season 1 », « Extras », « Specials », « Movie »…) */
const SPECIAL_SEASON = /\b(?:ovas?|oads?|extras?|specials?|speciaux|movies?|films?|recaps?)\b/;

/**
 * Saison spéciale de la plateforme : saison 0, titre de saison (hors titre de la série) désignant des OVA, des extras,
 * des spéciaux ou un film, ou saison réduite à une œuvre (isSingleWorkSeason). Ses épisodes ne sont jamais ceux de la
 * N-ième saison AniList.
 */
export function isSpecialSeason(episode: Pick<EpisodeNumbers, 'animeTitle' | 'seasonTitle' | 'seasonNumber' | 'episodeTitle'>): boolean {
  if (episode.seasonNumber === 0) return true;
  if (!episode.seasonTitle) return false;
  const animeKey = normalizeTitle(episode.animeTitle);
  let key = normalizeTitle(episode.seasonTitle);
  if (!key || key === animeKey) return false;
  if (key.startsWith(`${animeKey} `)) key = key.slice(animeKey.length + 1);
  return SPECIAL_SEASON.test(key) || isSingleWorkSeason(episode);
}

/**
 * Saison nommée dont l'épisode porte le nom de la saison elle-même (titre de la série et article « the » mis à part) :
 * film, spécial ou OVA publié comme une saison de la série (Crunchyroll : saison « Attack on Titan: Last Attack », épisode
 * « E1 - Attack on Titan: The Last Attack », film de 2 h 24). Son rang dans le menu (numéro de saison) ne désigne jamais
 * une saison TV : seule une fiche dédiée (titre, lien vers l'épisode) peut la recevoir.
 */
function isSingleWorkSeason({ animeTitle, seasonTitle, episodeTitle }: Pick<EpisodeNumbers, 'animeTitle' | 'seasonTitle' | 'episodeTitle'>): boolean {
  if (!seasonTitle || !episodeTitle) return false;
  const animeKey = titleWords(animeTitle);
  const withoutSeries = (key: string): string => (key.startsWith(`${animeKey} `) ? key.slice(animeKey.length + 1) : key);
  const season = withoutSeries(titleWords(seasonTitle));
  return season.length >= 3 && season !== animeKey && withoutSeries(titleWords(episodeTitle)) === season;
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

/**
 * Page de série sur une saison nommée, sans numéro ni plage d'épisodes absolus (Crunchyroll « HEROINES », spécial rangé
 * dans One Piece), rattachée à une fiche dont aucun titre ne reprend le nom de la saison : ni numéro ni titre ne la
 * désignent, le choix n'est jamais certain (la fiche principale de la série prendrait sinon la place d'une saison dont la
 * fiche manque à la recherche). Saison spéciale, numérotée, ou au titre de la série : non concernée.
 */
export function isUnmatchedNamedSeason(
  season: { animeTitle: string; seasonTitle: string | null; seasonNumber: number | null; seasonFirstEpisode?: number | undefined },
  candidate: Pick<MediaCandidate, 'titles'>,
): boolean {
  const { seasonTitle } = season;
  if (!seasonTitle || season.seasonNumber !== null || season.seasonFirstEpisode !== undefined) return false;
  if (seasonNumberFromTitle(seasonTitle) !== null || isSpecialSeason(season)) return false;
  const seasonKey = titleWords(seasonTitle);
  if (!seasonKey || seasonKey === titleWords(season.animeTitle)) return false;
  return !candidate.titles.some((title) => containsWords(titleWords(title), seasonKey));
}

/** Mots du titre de saison retrouvés tels quels dans un titre normalisé ("heroines" ⊂ "one piece heroines") */
export const containsWords = (key: string, words: string): boolean => ` ${key} `.includes(` ${words} `);

/**
 * Titre normalisé sans l'article « the », que la plateforme et AniList n'écrivent pas toujours de la même façon
 * (Crunchyroll « Attack on Titan: Last Attack », titre du film « Attack on Titan: THE LAST ATTACK ») : rapprochement
 * d'un titre de saison et du titre d'une fiche dédiée uniquement.
 */
export function titleWords(title: string): string {
  return normalizeTitle(title)
    .split(' ')
    .filter((word) => word !== 'the')
    .join(' ');
}

/** « ova season 1 » → « ova » : la 1re saison d'OVA porte souvent le titre AniList « … OVA » */
export const withoutFirstSeason = (key: string): string => key.replace(/ (?:season 1|saison 1|staffel 1|1st season)$/, '');

/** La fiche porte le titre de saison (titre normalisé qui le contient) : la correspondance en cache tient sans recherche */
export function carriesSeasonTitle(titles: readonly string[], seasonTitle: string): boolean {
  const seasonKey = normalizeTitle(seasonTitle);
  return seasonKey !== '' && titles.some((title) => normalizeTitle(title).includes(seasonKey));
}
