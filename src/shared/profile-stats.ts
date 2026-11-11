// Statistiques détaillées du profil (écran Stats du popup), lues avec le profil : `Viewer.statistics.anime` d'AniList et
// `anime_statistics` de MyAnimeList (mêmes requêtes et même cache que le menu du compte). Fonctions pures (testées) :
// chaque bloc est lu seul, un bloc illisible est vide et les autres sont gardés.
import { isRecord } from './guards';
import { isAniListScoreFormat, type AniListScoreFormat } from './score';

/** Mêmes valeurs que `ListStatus` (sync.types.ts), redéclarées ici : l'importer fermerait un cycle (sync.types → anilist.types → profile-stats) */
type ListStatus = 'CURRENT' | 'PLANNING' | 'COMPLETED' | 'DROPPED' | 'PAUSED' | 'REPEATING';

export interface ProfileStats {
  /** Format des notes de l'utilisateur (MAL : 'POINT_10') */
  scoreFormat: AniListScoreFormat;
  /** Note moyenne sur 100 (AniList meanScore, toujours sur 100 ; MAL mean_score × 10) ; null sans note */
  meanScore100: number | null;
  statuses: { status: ListStatus; count: number }[];
  /** AniList seulement */
  formats: { format: string; count: number }[];
  /** 6 au plus */
  genres: { genre: string; count: number; meanScore100: number | null }[];
  /** Répartition des notes dans le format de l'utilisateur (POINT_10_DECIMAL : 65 reçu → 6,5) */
  scores: { score: number; count: number }[];
  /** 5 au plus */
  studios: { name: string; count: number }[];
  /** 1990, 2000… triées */
  decades: { decade: number; count: number }[];
  /** MAL num_times_rewatched ; null sur AniList */
  rewatched: number | null;
}

const MAX_GENRES = 6;
const MAX_STUDIOS = 5;
const STATUSES: readonly ListStatus[] = ['CURRENT', 'PLANNING', 'COMPLETED', 'DROPPED', 'PAUSED', 'REPEATING'];

const isStatus = (value: unknown): value is ListStatus => STATUSES.some((status) => status === value);
const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0;
const isMean = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
const isScore = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;

/** 0 = pas de note (AniList et MAL) */
const mean100 = (value: unknown): number | null => (isMean(value) && value > 0 ? value : null);

/** Éléments lisibles d'un bloc : un bloc qui n'est pas une liste est vide, un élément illisible est écarté */
function readList<T>(block: unknown, read: (item: Record<string, unknown>) => T | null): T[] {
  if (!Array.isArray(block)) return [];
  return block.flatMap((item: unknown) => {
    const value = isRecord(item) ? read(item) : null;
    return value === null ? [] : [value];
  });
}

/**
 * `statistics.anime` d'AniList (requête Viewer) et `mediaListOptions.scoreFormat`. Mesuré le 2026-11-11 sur des profils
 * publics : `meanScore` est sur 100 quel que soit le format ; `scores[].score` suit le format de l'utilisateur (1–10,
 * 1–5, 1–3, 0–100 par pas de 5), sauf POINT_10_DECIMAL qui renvoie des paliers sur 100 (65 → 6,5). null si `raw` n'est pas un objet
 */
export function aniListProfileStats(raw: unknown, scoreFormat: unknown): ProfileStats | null {
  if (!isRecord(raw)) return null;
  const format = isAniListScoreFormat(scoreFormat) ? scoreFormat : null;
  const scoreDivisor = format === 'POINT_10_DECIMAL' ? 10 : 1;

  const years = new Map<number, number>();
  for (const { releaseYear, count } of readList(raw.releaseYears, (item) => (isCount(item.releaseYear) && isCount(item.count) ? { releaseYear: item.releaseYear, count: item.count } : null))) {
    const decade = Math.floor(releaseYear / 10) * 10;
    years.set(decade, (years.get(decade) ?? 0) + count);
  }

  return {
    scoreFormat: format ?? 'POINT_10',
    meanScore100: mean100(raw.meanScore),
    statuses: readList(raw.statuses, (item) => (isStatus(item.status) && isCount(item.count) ? { status: item.status, count: item.count } : null)),
    formats: readList(raw.formats, (item) => (typeof item.format === 'string' && isCount(item.count) ? { format: item.format, count: item.count } : null)),
    genres: readList(raw.genres, (item) =>
      typeof item.genre === 'string' && isCount(item.count) ? { genre: item.genre, count: item.count, meanScore100: mean100(item.meanScore) } : null,
    ).slice(0, MAX_GENRES),
    // Format de note inconnu : le sens des notes l'est aussi, la répartition est écartée
    scores:
      format === null
        ? []
        : readList(raw.scores, (item) => (isScore(item.score) && isCount(item.count) ? { score: item.score / scoreDivisor, count: item.count } : null)).sort((a, b) => a.score - b.score),
    studios: readList(raw.studios, (item) =>
      isRecord(item.studio) && typeof item.studio.name === 'string' && isCount(item.count) ? { name: item.studio.name, count: item.count } : null,
    ).slice(0, MAX_STUDIOS),
    decades: [...years].map(([decade, count]) => ({ decade, count })).sort((a, b) => a.decade - b.decade),
    rewatched: null,
  };
}

/** Champs `num_items_*` de MAL → statut commun, dans l'ordre d'affichage */
const MAL_STATUS_FIELDS: readonly (readonly [string, ListStatus])[] = [
  ['num_items_watching', 'CURRENT'],
  ['num_items_completed', 'COMPLETED'],
  ['num_items_on_hold', 'PAUSED'],
  ['num_items_dropped', 'DROPPED'],
  ['num_items_plan_to_watch', 'PLANNING'],
];

/**
 * `anime_statistics` de MyAnimeList (même objet que malStats, champs de la documentation de l'API v2). MAL n'a ni
 * formats, ni genres, ni répartition des notes, ni studios, ni décennies : ces blocs sont vides. null si `raw` n'est pas un objet
 */
export function malProfileStats(raw: unknown): ProfileStats | null {
  if (!isRecord(raw)) return null;
  const mean = typeof raw.mean_score === 'number' ? Math.round(raw.mean_score * 1000) / 100 : null;
  return {
    scoreFormat: 'POINT_10',
    meanScore100: mean100(mean),
    statuses: MAL_STATUS_FIELDS.flatMap(([field, status]) => {
      const count = raw[field];
      return isCount(count) && count > 0 ? [{ status, count }] : [];
    }),
    formats: [],
    genres: [],
    scores: [],
    studios: [],
    decades: [],
    rewatched: isCount(raw.num_times_rewatched) ? raw.num_times_rewatched : null,
  };
}

function everyRecord(value: unknown, check: (item: Record<string, unknown>) => boolean): boolean {
  return Array.isArray(value) && value.every((item: unknown) => isRecord(item) && check(item));
}

export function isProfileStats(value: unknown): value is ProfileStats {
  return (
    isRecord(value) &&
    isAniListScoreFormat(value.scoreFormat) &&
    (value.meanScore100 === null || isMean(value.meanScore100)) &&
    everyRecord(value.statuses, (s) => isStatus(s.status) && isCount(s.count)) &&
    everyRecord(value.formats, (f) => typeof f.format === 'string' && isCount(f.count)) &&
    everyRecord(value.genres, (g) => typeof g.genre === 'string' && isCount(g.count) && (g.meanScore100 === null || isMean(g.meanScore100))) &&
    everyRecord(value.scores, (s) => isScore(s.score) && isCount(s.count)) &&
    everyRecord(value.studios, (s) => typeof s.name === 'string' && isCount(s.count)) &&
    everyRecord(value.decades, (d) => isCount(d.decade) && isCount(d.count)) &&
    (value.rewatched === null || isCount(value.rewatched))
  );
}

const oneDecimal = (value: number): number => Math.round(value * 10) / 10;

/** Moyenne affichée dans le format de l'utilisateur : POINT_100 → entier /100 ; POINT_10, POINT_10_DECIMAL → 1 décimale /10 ; POINT_5 → /5 ; POINT_3 → /10 */
export function meanInFormat(mean100Value: number, format: AniListScoreFormat): { value: number; max: number } {
  if (format === 'POINT_100') return { value: Math.round(mean100Value), max: 100 };
  if (format === 'POINT_5') return { value: oneDecimal(mean100Value / 20), max: 5 };
  return { value: oneDecimal(mean100Value / 10), max: 10 };
}
