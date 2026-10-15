import { isRecord } from './guards';
import { hasSignals, isPlatformSignals, isSignalYear, medianMinutes, toPlatformSignals, type PlatformSignals } from './match-signals';

// Métadonnées de série Crunchyroll pour les signaux de correspondance (feature/match-signals). Relevé du 2026-10-14
// (anonyme, requêtes de la page elle-même) : l'application web demande
// - `/content/v2/cms/series/{seriesId}` → `data[0]` `{ series_launch_year, episode_count, season_count… }` ;
// - `/content/v2/cms/series/{seriesId}/seasons` → `data[]` `{ id, season_number, season_sequence_number,
//   number_of_episodes, audio_locale, is_dubbed, is_subbed, versions[]… }` : une ligne par saison originale, ses doublages
//   dans `versions[]` (`is_dubbed: true` dès qu'un doublage existe) ; ailleurs, un doublage peut être une saison à part ;
// - `/content/v2/cms/seasons/{seasonId}/episodes` → `data[]` `{ id, season_number, duration_ms, episode_air_date,
//   audio_locale, media_type… }` ;
// - `/content/v2/discover/up_next/{seriesId}` → `data[0].panel` `{ id, episode_metadata: { season_id, duration_ms… } }`.
// Le pont du monde MAIN (content/crunchyroll/page-bridge.iife.ts) réduit ces réponses ICI, en formes bornées sans
// rien de propre au compte, puis en calcule la table des signaux (crunchyrollSignalTable : année, nombre d'épisodes,
// durée…) ; le script isolé n'y lit que les signaux de la saison affichée (crunchyrollTableSignals), revalidés par
// toPlatformSignals. Les règles (doublages, saison d'origine) restent hors du script de contenu (budget de taille).
// Module pur : importé par le pont, le script de contenu et le corpus de correspondance.

/** Saison d'une série Crunchyroll, réduite (statistiques des épisodes : null tant que la liste n'a pas été vue) */
export interface CrunchyrollSeason {
  id: string;
  /** `season_number` */
  seasonNumber: number | null;
  /** `season_sequence_number` */
  sequenceNumber: number | null;
  /** `number_of_episodes` */
  episodeCount: number | null;
  /** `audio_locale` (ja-JP, en-US…) */
  audioLocale: string | null;
  /**
   * Version doublée (saison à part, même numéro que l'originale) : `versions[]`, entrée de la saison elle-même
   * (`original`) ; sans elle, `is_dubbed` d'une saison non sous-titrée (voir dubbedSeason)
   */
  dubbed: boolean | null;
  /** Année du premier `episode_air_date` des épisodes vus de la saison */
  firstAirYear: number | null;
  /** Durée médiane des épisodes vus (minutes) */
  episodeMinutes: number | null;
  /** Un épisode vu est un film (`media_type` movie) */
  movie: boolean;
  /** Identifiants des épisodes vus (et de leurs autres versions audio), pour retrouver la saison d'une page de lecture */
  episodeIds: string[];
}

export interface CrunchyrollSeries {
  seriesId: string;
  /** `series_launch_year` */
  launchYear: number | null;
  seasons: CrunchyrollSeason[];
}

/** Statistiques des épisodes d'une saison (réponse `episodes` ou `up_next`) */
export type CrunchyrollEpisodeStats = Pick<CrunchyrollSeason, 'firstAirYear' | 'episodeMinutes' | 'movie' | 'episodeIds'>;

/** Saison telle que listée par la réponse `seasons` (sans statistiques d'épisodes) */
export type CrunchyrollSeasonRow = Omit<CrunchyrollSeason, keyof CrunchyrollEpisodeStats>;

export const CRUNCHYROLL_MAX_SEASONS = 200;
export const CRUNCHYROLL_MAX_EPISODE_IDS = 500;
const MAX_NUMBER = 9_999;

const CR_ID = /^[A-Z0-9]{3,32}$/;
const AUDIO_LOCALE = /^[a-z]{2,3}(?:-[A-Z0-9]{2,3})?$/;

const isCrId = (v: unknown): v is string => typeof v === 'string' && CR_ID.test(v);
const isNullableInt = (v: unknown): boolean => v === null || (typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= MAX_NUMBER);

// ─── Réductions (monde MAIN) ──────────────────────────────────────────────

const record = (value: unknown): Record<string, unknown> => (isRecord(value) && !Array.isArray(value) ? value : {});
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const int = (value: unknown): number | null => (isNullableInt(value) && typeof value === 'number' ? value : null);
const crId = (value: unknown): string | null => (isCrId(value) ? value : null);

/** Année d'une date ISO (`2023-09-29T00:00:00Z`), null si illisible ou hors bornes */
function yearOf(value: unknown): number | null {
  const year = typeof value === 'string' ? Number(/^(\d{4})-/.exec(value)?.[1]) : NaN;
  return isSignalYear(year) ? year : null;
}

/** Réponse `cms/series/{id}` → année de lancement ; null si ce n'est pas une série */
export function reduceCrunchyrollSeries(raw: unknown): { launchYear: number | null } | null {
  const [item] = list(record(raw).data);
  if (!isRecord(item)) return null;
  const year = item.series_launch_year;
  return { launchYear: isSignalYear(year) ? year : null };
}

/**
 * Saison doublée ? Forme réelle (2026-10-14, `versions_considered`) : une ligne par saison ORIGINALE, `is_dubbed: true`
 * dès qu'un doublage existe, chaque version dans `versions[]` (`guid`, `original`) : l'entrée de la saison elle-même fait
 * foi. Sans elle : `is_dubbed` seulement pour une saison non sous-titrée (une originale doublée est aussi sous-titrée),
 * inconnu sinon.
 */
function dubbedSeason(season: Record<string, unknown>, id: string): boolean | null {
  const own = list(season.versions).map(record).find((version) => version.guid === id);
  if (typeof own?.original === 'boolean') return !own.original;
  if (season.is_dubbed === false) return false;
  return season.is_dubbed === true && season.is_subbed !== true ? true : null;
}

/** Réponse `cms/series/{id}/seasons` → saisons réduites (une saison sans identifiant est écartée) ; null sans liste */
export function reduceCrunchyrollSeasons(raw: unknown): CrunchyrollSeasonRow[] | null {
  const data = record(raw).data;
  if (!Array.isArray(data)) return null;
  return data.slice(0, CRUNCHYROLL_MAX_SEASONS).flatMap((value) => {
    const season = record(value);
    const id = crId(season.id);
    const audio = season.audio_locale;
    if (!id) return [];
    return [
      {
        id,
        seasonNumber: int(season.season_number),
        sequenceNumber: int(season.season_sequence_number),
        episodeCount: int(season.number_of_episodes) || null,
        audioLocale: typeof audio === 'string' && AUDIO_LOCALE.test(audio) ? audio : null,
        dubbed: dubbedSeason(season, id),
      },
    ];
  });
}

/** Identifiants d'un épisode et de ses autres versions audio (`versions[].guid`, lu s'il est présent) */
function episodeIds(episode: Record<string, unknown>): string[] {
  const ids = [episode.id, ...list(episode.versions).map((version) => record(version).guid)];
  return ids.map(crId).filter((id): id is string => id !== null);
}

function statsOf(episodes: readonly Record<string, unknown>[], withYear: boolean): CrunchyrollEpisodeStats {
  const years = withYear ? episodes.map((episode) => yearOf(episode.episode_air_date)).filter((year): year is number => year !== null) : [];
  const durations = episodes.map((episode) => (typeof episode.duration_ms === 'number' ? episode.duration_ms / 1000 : null));
  return {
    firstAirYear: years.length > 0 ? Math.min(...years) : null,
    episodeMinutes: medianMinutes(durations) ?? null,
    movie: episodes.some((episode) => episode.media_type === 'movie'),
    episodeIds: [...new Set(episodes.flatMap(episodeIds))].slice(0, CRUNCHYROLL_MAX_EPISODE_IDS),
  };
}

/** Réponse `cms/seasons/{id}/episodes` → statistiques de la saison ; null sans épisode */
export function reduceCrunchyrollEpisodes(raw: unknown): CrunchyrollEpisodeStats | null {
  const episodes = list(record(raw).data).filter(isRecord);
  return episodes.length > 0 ? statsOf(episodes, true) : null;
}

/**
 * Réponse `discover/up_next/{seriesId}` → épisode suggéré, réduit à sa saison, son identifiant et sa durée (une seule
 * date ne dit rien de la première diffusion de la saison) ; null sans saison
 */
export function reduceCrunchyrollUpNext(raw: unknown): { seasonId: string; stats: CrunchyrollEpisodeStats } | null {
  const [item] = list(record(raw).data);
  const panel = record(record(item).panel);
  const metadata = record(panel.episode_metadata);
  const seasonId = crId(metadata.season_id);
  return seasonId ? { seasonId, stats: statsOf([{ ...metadata, id: panel.id }], false) } : null;
}

/** Série réduite : saisons listées, complétées des statistiques d'épisodes vues pour chacune */
export function mergeCrunchyrollSeries(
  seriesId: string,
  launchYear: number | null,
  rows: readonly CrunchyrollSeasonRow[],
  stats: (seasonId: string) => CrunchyrollEpisodeStats | undefined,
): CrunchyrollSeries {
  const empty: CrunchyrollEpisodeStats = { firstAirYear: null, episodeMinutes: null, movie: false, episodeIds: [] };
  return { seriesId, launchYear, seasons: rows.map((row) => ({ ...row, ...(stats(row.id) ?? empty) })) };
}

// ─── Signaux (calculés dans le monde MAIN, lus par le script isolé) ───────

/** Saison affichée : épisode de la page de lecture (prioritaire), sinon numéro lu sur la page (JSON-LD, menu des saisons) */
export interface CrunchyrollSeasonPick {
  episodeId?: string;
  seasonNumber: number | null;
}

/**
 * Version ORIGINALE de la saison affichée : Crunchyroll publie chaque doublage comme une saison à part, de même numéro,
 * parfois incomplète. Saison de l'épisode si elle n'est pas doublée ; sinon l'unique saison non doublée de même numéro
 * (`season_number` ou `season_sequence_number` : la page n'indique pas lequel) ; une saison au doublage inconnu
 * seulement si elle est seule à porter ce numéro ; sans numéro, l'unique saison originale de la série. Dans le doute :
 * aucune (jamais le nombre d'épisodes d'un doublage pris pour celui de l'originale).
 */
export function originalCrunchyrollSeason(series: CrunchyrollSeries, pick: CrunchyrollSeasonPick): CrunchyrollSeason | null {
  const { seasons } = series;
  const own = pick.episodeId !== undefined ? seasons.find((season) => season.episodeIds.includes(pick.episodeId ?? '')) : undefined;
  if (own?.dubbed === false) return own;
  const number = own ? own.seasonNumber : pick.seasonNumber;
  const same = number === null ? (own ? [] : seasons) : seasons.filter((season) => season.seasonNumber === number || season.sequenceNumber === number);
  const originals = same.filter((season) => season.dubbed === false);
  if (originals.length === 1) return originals[0] ?? null;
  return number !== null && same.length === 1 && same[0]?.dubbed === null ? same[0] : null;
}

/**
 * Signaux de la saison affichée (version originale, voir originalCrunchyrollSeason) : année de sa première diffusion,
 * sinon année de lancement de la série ; nombre d'épisodes ; durée ; format série seulement à partir de 2 épisodes (un
 * film est parfois publié comme saison d'une série : « Attack on Titan: The Last Attack ») ; pays JP pour une version
 * originale en japonais. undefined sans donnée vue (onglet ouvert avant l'extension, état SPA en cache).
 */
export function crunchyrollSignals(series: CrunchyrollSeries, pick: CrunchyrollSeasonPick): PlatformSignals | undefined {
  const season = originalCrunchyrollSeason(series, pick);
  const year = season?.firstAirYear ?? null;
  const count = season?.episodeCount ?? null;
  return toPlatformSignals({
    seasonYear: year,
    seriesYear: year === null ? series.launchYear : null,
    seasonEpisodeCount: count,
    episodeMinutes: season?.episodeMinutes,
    format: season?.movie ? 'movie' : count !== null && count >= 2 ? 'series' : null,
    country: season?.dubbed === false && season.audioLocale === 'ja-JP' ? 'JP' : null,
  });
}

/**
 * Table des signaux d'une série, calculée dans le monde MAIN et transmise au script isolé : `signals[0]` = série seule
 * (saison inconnue) ; `keys` : `e{épisode}` → signaux de la saison de cet épisode, `n{numéro}` → signaux du numéro de
 * saison lu sur la page (JSON-LD, menu des saisons), `-` → signaux sans numéro (unique saison originale de la série).
 */
export interface CrunchyrollSignalTable {
  seriesId: string;
  signals: PlatformSignals[];
  keys: Record<string, number>;
}

export function crunchyrollSignalTable(series: CrunchyrollSeries): CrunchyrollSignalTable {
  const signals: PlatformSignals[] = [];
  const indexOf = (value: PlatformSignals | undefined): number => {
    const key = JSON.stringify(value ?? {});
    const found = signals.findIndex((known) => JSON.stringify(known) === key);
    return found >= 0 ? found : signals.push(value ?? {}) - 1;
  };
  indexOf(toPlatformSignals({ seriesYear: series.launchYear }));
  const keys: Record<string, number> = { '-': indexOf(crunchyrollSignals(series, { seasonNumber: null })) };
  for (const season of series.seasons) {
    for (const episodeId of season.episodeIds) keys[`e${episodeId}`] ??= indexOf(crunchyrollSignals(series, { episodeId, seasonNumber: null }));
    for (const number of [season.seasonNumber, season.sequenceNumber]) {
      if (number !== null) keys[`n${number}`] ??= indexOf(crunchyrollSignals(series, { seasonNumber: number }));
    }
  }
  return { seriesId: series.seriesId, signals, keys };
}

/**
 * Valeur d'une table reçue de la page. Clés lues : `keys`, `signals`, `e{identifiant [A-Z0-9]}`, `n{entier}`, `-` et un
 * indice numérique, jamais le nom d'une propriété héritée d'Object.prototype (pas de hasOwn : budget du script de contenu).
 */
const own = (table: unknown, key: string | number): unknown => (isRecord(table) ? table[key] : undefined);

/**
 * Signaux de la saison affichée dans une table reçue du pont (script isolé) : saison de l'épisode, sinon numéro de saison
 * lu sur la page, sinon série seule. Revalidés (isPlatformSignals) : la page peut émettre n'importe quoi.
 */
export function crunchyrollTableSignals(table: unknown, pick: CrunchyrollSeasonPick): PlatformSignals | undefined {
  const keys = own(table, 'keys');
  // Sans épisode (page de série) : clé « eundefined », absente (identifiants Crunchyroll en majuscules et chiffres)
  const index = own(keys, `e${pick.episodeId}`) ?? own(keys, pick.seasonNumber === null ? '-' : `n${pick.seasonNumber}`);
  const signals = own(own(table, 'signals'), typeof index === 'number' ? index : 0);
  return isPlatformSignals(signals) && hasSignals(signals) ? signals : undefined;
}
