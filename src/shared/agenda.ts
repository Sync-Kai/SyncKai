import type { AniListErrorCode } from './anilist.types';
import type { StreamingPlatform } from './episode.types';
import { isEntryExcluded, type ExcludedSeries } from './exclusions';
import { isRecord } from './guards';
import type { SyncSettings } from './settings';
import { mergePlatformLinks, platformsWithoutLink } from './platform-links';
import { choosePlatformLink } from './watching';
import type { PlatformLink, WatchingEntry } from './watching.types';
import type { Result } from './result';

// Agenda des sorties (panneau latéral) : règles pures partagées par le panneau et le service worker.

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

// ─── Semaine ──────────────────────────────────────────────────────────────

/** Premier jour de la semaine, numérotation ISO : 1 = lundi … 7 = dimanche */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

function toIsoWeekday(value: unknown): IsoWeekday | null {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5 || value === 6 || value === 7 ? value : null;
}

/**
 * Premier jour de la semaine pour une locale (`Intl.Locale.prototype.getWeekInfo`, ou l'ancien accesseur
 * `weekInfo`) ; lundi si le navigateur ne le fournit pas (Firefox) ou si la locale est invalide.
 */
export function firstDayOfWeek(localeTag: string): IsoWeekday {
  try {
    const locale: unknown = new Intl.Locale(localeTag);
    if (!isRecord(locale)) return 1;
    const getter = locale.getWeekInfo;
    const info: unknown = typeof getter === 'function' ? Reflect.apply(getter, locale, []) : locale.weekInfo;
    return (isRecord(info) ? toIsoWeekday(info.firstDay) : null) ?? 1;
  } catch {
    return 1;
  }
}

/**
 * Locale utilisée pour le premier jour de la semaine : la langue complète du navigateur (« en-GB ») si elle
 * correspond à la langue de l'interface, sinon la langue de l'interface seule (« en » → dimanche, comme en-US).
 */
export function weekLocaleTag(uiLocale: string, browserLanguage: string): string {
  const base = browserLanguage.toLowerCase().split(/[-_]/)[0];
  return base === uiLocale && /^[A-Za-z]{2,3}([-_][A-Za-z0-9]{2,8})*$/.test(browserLanguage) ? browserLanguage.replace(/_/g, '-') : uiLocale;
}

/** Semaine affichée : 7 minuits locaux (changement d'heure compris), bornes en ms */
export interface WeekRange {
  /** Clé de la semaine (date locale du premier jour, AAAA-MM-JJ) */
  key: string;
  /** Minuit local du premier jour (ms) */
  start: number;
  /** Minuit local du jour suivant le dernier (ms, exclu) */
  end: number;
  /** Minuit local de chaque jour (ms) */
  days: number[];
}

const pad = (value: number): string => String(value).padStart(2, '0');

/** Date locale AAAA-MM-JJ */
export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Date locale (minuit) d'une clé AAAA-MM-JJ valide (années 2000–2100), sinon null */
export function parseDateKey(key: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (year < 2000 || year > 2100) return null;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

export function isWeekKey(value: unknown): value is string {
  return typeof value === 'string' && parseDateKey(value) !== null;
}

/** Semaine commençant au minuit local de `start` (construite jour par jour : 23 h ou 25 h au changement d'heure) */
function rangeFrom(start: Date): WeekRange {
  const [y, m, d] = [start.getFullYear(), start.getMonth(), start.getDate()];
  const days = Array.from({ length: 7 }, (_, i) => new Date(y, m, d + i).getTime());
  return { key: dateKey(start), start: days[0] ?? start.getTime(), end: new Date(y, m, d + 7).getTime(), days };
}

/** Semaine contenant `at` (ms) pour un premier jour donné */
export function weekRange(at: number, firstDay: IsoWeekday): WeekRange {
  const date = new Date(at);
  const weekday = date.getDay() === 0 ? 7 : date.getDay();
  const back = (weekday - firstDay + 7) % 7;
  return rangeFrom(new Date(date.getFullYear(), date.getMonth(), date.getDate() - back));
}

/** Semaine désignée par sa clé (null si la clé est invalide) */
export function weekRangeFromKey(key: string): WeekRange | null {
  const start = parseDateKey(key);
  return start ? rangeFrom(start) : null;
}

/** Semaine décalée de `delta` semaines */
export function shiftWeek(range: WeekRange, delta: number): WeekRange {
  const start = new Date(range.start);
  return rangeFrom(new Date(start.getFullYear(), start.getMonth(), start.getDate() + delta * 7));
}

// ─── Calendrier AniList ───────────────────────────────────────────────────

/** Diffusion d'un épisode au Japon (airingSchedules AniList) */
export interface AiringSchedule {
  scheduleId: number;
  mediaId: number;
  episode: number;
  /** UNIX secondes */
  airingAt: number;
  title: string;
  coverUrl: string | null;
}

const isPositiveInt = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value > 0;

export function isAiringSchedule(value: unknown): value is AiringSchedule {
  return (
    isRecord(value) &&
    isPositiveInt(value.scheduleId) &&
    isPositiveInt(value.mediaId) &&
    typeof value.episode === 'number' &&
    Number.isFinite(value.episode) &&
    isPositiveInt(value.airingAt) &&
    typeof value.title === 'string' &&
    (value.coverUrl === null || typeof value.coverUrl === 'string')
  );
}

/** Sorties d'une semaine en cache (`airingWeek:<clé>`), écrites par l'alarme horaire ou à la demande du panneau */
export interface AiringWeekCache {
  weekStart: string;
  /** ms */
  fetchedAt: number;
  /** Séries interrogées : une série ajoutée depuis rend le cache incomplet */
  mediaIds: number[];
  schedules: AiringSchedule[];
  /** Pagination arrêtée avant la fin de la semaine : sorties les plus tardives manquantes, cache à relire (ALRT-06) */
  truncated?: boolean;
}

export const AIRING_WEEK_PREFIX = 'airingWeek:';

export function airingWeekKey(weekStart: string): string {
  return `${AIRING_WEEK_PREFIX}${weekStart}`;
}

export function isAiringWeekCache(value: unknown): value is AiringWeekCache {
  return (
    isRecord(value) &&
    isWeekKey(value.weekStart) &&
    typeof value.fetchedAt === 'number' &&
    Number.isFinite(value.fetchedAt) &&
    Array.isArray(value.mediaIds) &&
    value.mediaIds.every(isPositiveInt) &&
    Array.isArray(value.schedules) &&
    value.schedules.every(isAiringSchedule) &&
    (value.truncated === undefined || typeof value.truncated === 'boolean')
  );
}

/** Durée de validité du cache selon la position de la semaine */
export const AGENDA_TTL_MS = { current: HOUR_MS, past: 7 * DAY_MS, future: 6 * HOUR_MS } as const;
/** Tolérance d'horloge : un cache daté du futur au-delà est ignoré */
const CLOCK_SKEW_MS = 5 * MINUTE_MS;

export type WeekTiming = keyof typeof AGENDA_TTL_MS;

export function weekTiming(range: Pick<WeekRange, 'start' | 'end'>, now: number): WeekTiming {
  if (now < range.start) return 'future';
  return now >= range.end ? 'past' : 'current';
}

/**
 * Cache utilisable sans requête : âge inférieur au TTL de la semaine (1 h en cours, 6 h à venir,
 * 7 j passée — à condition d'avoir été lu après la fin de la semaine), complet et couvrant toutes les séries suivies.
 */
export function isWeekCacheFresh(cache: AiringWeekCache, range: Pick<WeekRange, 'start' | 'end'>, now: number, mediaIds: Iterable<number>): boolean {
  if (cache.truncated === true) return false;
  const age = now - cache.fetchedAt;
  if (age < -CLOCK_SKEW_MS) return false;
  const timing = weekTiming(range, now);
  if (age >= AGENDA_TTL_MS[timing]) return false;
  if (timing === 'past' && cache.fetchedAt < range.end) return false;
  const known = new Set(cache.mediaIds);
  for (const id of mediaIds) if (!known.has(id)) return false;
  return true;
}

/** Semaines conservées autour d'aujourd'hui ; au-delà, les caches sont supprimés */
export const AGENDA_KEEP_MS = 35 * DAY_MS;

/** Clés `airingWeek:*` trop éloignées d'aujourd'hui (ou invalides) */
export function weekKeysToPrune(keys: readonly string[], now: number): string[] {
  return keys.filter((key) => {
    if (!key.startsWith(AIRING_WEEK_PREFIX)) return false;
    const start = parseDateKey(key.slice(AIRING_WEEK_PREFIX.length));
    return start === null || Math.abs(start.getTime() - now) > AGENDA_KEEP_MS;
  });
}

// ─── Séries suivies ───────────────────────────────────────────────────────

/** Série en cours, fusionnée entre AniList et MyAnimeList par fiche AniList */
export interface AgendaSeries {
  mediaId: number;
  /** Progression la plus avancée des deux services */
  progress: number;
  title: string;
  coverUrl: string | null;
  /** Liens connus des deux services, un par plateforme */
  platforms: PlatformLink[];
  /** Lien « Ouvrir » (plateforme préférée si disponible) */
  link: PlatformLink | null;
}

/**
 * Séries en cours des deux services, par fiche AniList (progression la plus élevée), sans les séries exclues
 * ni les fiches MAL sans équivalent AniList (le calendrier ne les connaît pas).
 */
export function mergeWatchingSeries(
  entries: readonly WatchingEntry[],
  excluded: readonly ExcludedSeries[],
  preferred: StreamingPlatform,
): Map<number, AgendaSeries> {
  const series = new Map<number, AgendaSeries>();
  for (const entry of entries) {
    const mediaId = entry.mediaId;
    // Exclusion par fiche, ou par série de plateforme (exclue avant la résolution de la fiche, ALRT-03)
    if (mediaId === null || isEntryExcluded(excluded, { mediaId, platforms: entry.platforms })) continue;
    const previous = series.get(mediaId);
    // Liens des deux services réunis avant le choix : un lien ADN connu d'un seul service suffit
    const platforms = mergePlatformLinks(previous?.platforms ?? [], entry.platforms);
    series.set(mediaId, {
      mediaId,
      progress: Math.max(entry.progress, previous?.progress ?? 0),
      title: previous?.title ?? entry.title,
      coverUrl: previous?.coverUrl ?? entry.coverUrl,
      platforms,
      link: choosePlatformLink({ platforms }, preferred),
    });
  }
  return series;
}

/** Progression par fiche AniList (alertes de sortie) */
export function watchingProgress(entries: readonly WatchingEntry[], excluded: readonly ExcludedSeries[]): Map<number, number> {
  const progress = new Map<number, number>();
  for (const [mediaId, series] of mergeWatchingSeries(entries, excluded, 'crunchyroll')) progress.set(mediaId, series.progress);
  return progress;
}

// ─── Heure estimée sur les plateformes ────────────────────────────────────

export type OffsetSettings = Pick<SyncSettings, 'platformOffsets' | 'seriesOffsets'>;

/** Délai (minutes) propre à la série, s'il existe */
export function seriesOffset(settings: OffsetSettings, mediaId: number): number | null {
  const key = String(mediaId);
  return Object.hasOwn(settings.seriesOffsets, key) ? (settings.seriesOffsets[key] ?? null) : null;
}

/**
 * Sortie estimée sur la plateforme (UNIX secondes) : diffusion japonaise + délai de la série, sinon de la plateforme.
 * null si la plateforme est inconnue et qu'aucun délai n'est réglé pour la série.
 */
export function estimateRelease(airingAt: number, platform: StreamingPlatform | null, settings: OffsetSettings, mediaId: number): number | null {
  const offset = seriesOffset(settings, mediaId) ?? (platform ? settings.platformOffsets[platform] : null);
  return offset === null ? null : airingAt + offset * 60;
}

// ─── Jours de l'agenda ────────────────────────────────────────────────────

export interface AgendaRow {
  scheduleId: number;
  mediaId: number;
  episode: number;
  /** Diffusion japonaise (UNIX secondes) */
  airingAt: number;
  title: string;
  coverUrl: string | null;
  /** Épisode déjà vu (progression ≥ numéro) */
  watched: boolean;
  /** Plateforme de l'estimation (celle du lien « Ouvrir ») */
  platform: StreamingPlatform | null;
  /** Sortie estimée sur la plateforme (UNIX secondes) */
  estimateAt: number | null;
  /** Délai réglé pour cette série (minutes), sinon null */
  customOffset: number | null;
  link: PlatformLink | null;
  /** Plateformes sans lien connu (recherche proposée dans le menu « ⋯ ») */
  searchPlatforms: StreamingPlatform[];
}

export interface AgendaDay {
  /** Minuit local (ms) */
  start: number;
  isToday: boolean;
  rows: AgendaRow[];
}

/** Répartit les sorties des séries suivies sur les 7 jours de la semaine (heure de diffusion, ordre chronologique). */
export function buildAgendaDays(
  schedules: readonly AiringSchedule[],
  series: ReadonlyMap<number, AgendaSeries>,
  range: WeekRange,
  settings: OffsetSettings,
  now: number,
): AgendaDay[] {
  const days: AgendaDay[] = range.days.map((start, i) => {
    const next = range.days[i + 1] ?? range.end;
    return { start, isToday: now >= start && now < next, rows: [] };
  });
  const seen = new Set<number>();
  const sorted = [...schedules].sort((a, b) => a.airingAt - b.airingAt || a.mediaId - b.mediaId);
  for (const schedule of sorted) {
    const info = series.get(schedule.mediaId);
    if (!info || seen.has(schedule.scheduleId)) continue;
    const at = schedule.airingAt * 1000;
    const index = days.findIndex((day, i) => at >= day.start && at < (days[i + 1]?.start ?? range.end));
    const day = days[index];
    if (!day) continue;
    seen.add(schedule.scheduleId);
    const platform = info.link?.platform ?? null;
    day.rows.push({
      scheduleId: schedule.scheduleId,
      mediaId: schedule.mediaId,
      episode: schedule.episode,
      airingAt: schedule.airingAt,
      title: schedule.title || info.title,
      coverUrl: schedule.coverUrl ?? info.coverUrl,
      watched: info.progress >= schedule.episode,
      platform,
      estimateAt: estimateRelease(schedule.airingAt, platform, settings, schedule.mediaId),
      customOffset: seriesOffset(settings, schedule.mediaId),
      link: info.link,
      searchPlatforms: platformsWithoutLink(info.platforms),
    });
  }
  return days;
}

/** Applique (ou retire avec null) le délai d'une série dans les réglages */
export function withSeriesOffset<T extends OffsetSettings>(settings: T, mediaId: number, offset: number | null): T {
  const { [String(mediaId)]: _previous, ...rest } = settings.seriesOffsets;
  return { ...settings, seriesOffsets: offset === null ? rest : { ...rest, [String(mediaId)]: offset } };
}

/** Délai lisible et signé : « +1 h », « +1 h 30 », « +45 min », « −2 h » */
export function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? '−' : '+';
  const abs = Math.abs(Math.round(minutes));
  const hours = Math.floor(abs / 60);
  const rest = abs % 60;
  if (hours === 0) return `${sign}${rest} min`;
  return rest === 0 ? `${sign}${hours} h` : `${sign}${hours} h ${pad(rest)}`;
}

// ─── Message GET_AGENDA ───────────────────────────────────────────────────

export interface AgendaPayload {
  /** Clé de la semaine demandée (AAAA-MM-JJ, premier jour en heure locale) */
  weekStart: string;
}

export type AgendaResult = Result<AiringWeekCache, AniListErrorCode>;

export function isAgendaPayload(payload: unknown): payload is AgendaPayload {
  return isRecord(payload) && Object.keys(payload).length === 1 && isWeekKey(payload.weekStart);
}
