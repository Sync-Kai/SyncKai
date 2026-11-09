import { isRecord } from './guards';
import type { TrackerId } from './tracker.types';

/** Suites d'animes pas encore dans les listes : règles pures (candidates, état, plafonds). */

export type SequelFormat = 'TV' | 'TV_SHORT' | 'ONA' | 'MOVIE';
export type SequelStatus = 'NOT_YET_RELEASED' | 'RELEASING';
export type AniListSeason = 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL';

export interface SequelSnapshot {
  id: number;
  idMal: number | null;
  title: string;
  format: SequelFormat;
  status: SequelStatus;
  coverUrl: string | null;
  siteUrl: string;
  year: number | null;
  month: number | null;
  day: number | null;
  season: AniListSeason | null;
  seasonYear: number | null;
  sourceId: number;
  sourceTitle: string;
}

export type SequelState = 'new' | 'seen' | 'dismissed';

export interface SequelRecord {
  snapshot: SequelSnapshot;
  state: SequelState;
  firstSeenAt: number;
}

export interface SequelStore {
  records: SequelRecord[];
  known: number[];
  seeded: TrackerId[];
  lastCheck: number | null;
}

export interface RelationEdge {
  relationType: string;
  node: {
    id: number;
    idMal: number | null;
    type: string;
    format: string | null;
    status: string | null;
    title: string;
    coverUrl: string | null;
    siteUrl: string;
    year: number | null;
    month: number | null;
    day: number | null;
    season: string | null;
    seasonYear: number | null;
  };
}

export interface SourceSeries {
  id: number;
  title: string;
  services: TrackerId[];
}

export interface InLists {
  ids: ReadonlySet<number>;
  malIds: ReadonlySet<number>;
}

export interface SequelCandidate {
  snapshot: SequelSnapshot;
  services: TrackerId[];
}

/** `blocked` : suites enregistrées, aucune notification (désactivées dans le navigateur) */
export interface SequelCheckResult {
  checkedAt: number;
  found: number;
  notified: number;
  skipped: 'disabled' | 'not-connected' | 'not-due' | 'blocked' | null;
  error: string | null;
}

const SKIP_REASONS: readonly unknown[] = ['disabled', 'not-connected', 'not-due', 'blocked'];

/** Résumé relu du stockage : valeur absente ou d'une autre forme = pas de résumé */
export function isSequelCheckResult(value: unknown): value is SequelCheckResult {
  return (
    isRecord(value) &&
    isFiniteNumber(value['checkedAt']) &&
    typeof value['found'] === 'number' &&
    Number.isInteger(value['found']) &&
    value['found'] >= 0 &&
    typeof value['notified'] === 'number' &&
    Number.isInteger(value['notified']) &&
    value['notified'] >= 0 &&
    (value['skipped'] === null || SKIP_REASONS.includes(value['skipped'])) &&
    (value['error'] === null || typeof value['error'] === 'string')
  );
}

export const EMPTY_SEQUEL_STORE: SequelStore = { records: [], known: [], seeded: [], lastCheck: null };
export const MAX_SEQUEL_RECORDS = 200;
export const MAX_KNOWN_SEQUELS = 2000;

const FORMATS: readonly string[] = ['TV', 'TV_SHORT', 'ONA', 'MOVIE'];
const STATUSES: readonly string[] = ['NOT_YET_RELEASED', 'RELEASING'];
const SEASONS: readonly string[] = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];
const STATES: readonly string[] = ['new', 'seen', 'dismissed'];
const SERVICES: readonly string[] = ['anilist', 'mal'];

function isFormat(value: unknown): value is SequelFormat {
  return typeof value === 'string' && FORMATS.includes(value);
}

function isStatus(value: unknown): value is SequelStatus {
  return typeof value === 'string' && STATUSES.includes(value);
}

function isSeason(value: unknown): value is AniListSeason {
  return typeof value === 'string' && SEASONS.includes(value);
}

function isTrackerId(value: unknown): value is TrackerId {
  return typeof value === 'string' && SERVICES.includes(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || isFiniteNumber(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isSnapshot(value: unknown): value is SequelSnapshot {
  return (
    isRecord(value) &&
    isFiniteNumber(value['id']) &&
    isNullableNumber(value['idMal']) &&
    typeof value['title'] === 'string' &&
    isFormat(value['format']) &&
    isStatus(value['status']) &&
    isNullableString(value['coverUrl']) &&
    typeof value['siteUrl'] === 'string' &&
    isNullableNumber(value['year']) &&
    isNullableNumber(value['month']) &&
    isNullableNumber(value['day']) &&
    (value['season'] === null || isSeason(value['season'])) &&
    isNullableNumber(value['seasonYear']) &&
    isFiniteNumber(value['sourceId']) &&
    typeof value['sourceTitle'] === 'string'
  );
}

function isSequelRecord(value: unknown): value is SequelRecord {
  return (
    isRecord(value) &&
    isSnapshot(value['snapshot']) &&
    typeof value['state'] === 'string' &&
    STATES.includes(value['state']) &&
    isFiniteNumber(value['firstSeenAt'])
  );
}

export function isSequelStore(value: unknown): value is SequelStore {
  return (
    isRecord(value) &&
    Array.isArray(value['records']) &&
    value['records'].every(isSequelRecord) &&
    Array.isArray(value['known']) &&
    value['known'].every(isFiniteNumber) &&
    Array.isArray(value['seeded']) &&
    value['seeded'].every(isTrackerId) &&
    isNullableNumber(value['lastCheck'])
  );
}

/** Suites SEQUEL / ANIME / (TV, TV_SHORT, ONA, MOVIE) à venir ou en cours, absentes des listes ; une candidate par id, services en union. */
export function sequelCandidates(sources: readonly { source: SourceSeries; edges: readonly RelationEdge[] }[], inLists: InLists): SequelCandidate[] {
  const byId = new Map<number, SequelCandidate>();
  for (const { source, edges } of sources) {
    for (const { relationType, node } of edges) {
      if (relationType !== 'SEQUEL' || node.type !== 'ANIME' || !isFormat(node.format) || !isStatus(node.status)) continue;
      if (inLists.ids.has(node.id) || (node.idMal !== null && inLists.malIds.has(node.idMal))) continue;
      const existing = byId.get(node.id);
      if (existing) {
        for (const service of source.services) if (!existing.services.includes(service)) existing.services.push(service);
        continue;
      }
      byId.set(node.id, {
        snapshot: {
          id: node.id, idMal: node.idMal, title: node.title, format: node.format, status: node.status, coverUrl: node.coverUrl, siteUrl: node.siteUrl,
          year: node.year, month: node.month, day: node.day, season: isSeason(node.season) ? node.season : null, seasonYear: node.seasonYear,
          sourceId: source.id, sourceTitle: source.title,
        },
        services: [...source.services],
      });
    }
  }
  return [...byId.values()];
}

/** Rang de conservation : les nouvelles se gardent le plus, puis les vues, puis les masquées */
const KEEP_RANK: Record<SequelState, number> = { new: 0, seen: 1, dismissed: 2 };

/** Plafond des enregistrements : partent d'abord les masquées, puis les plus anciennes vues, puis les plus anciennes nouvelles. */
function capRecords(records: SequelRecord[]): SequelRecord[] {
  if (records.length <= MAX_SEQUEL_RECORDS) return records;
  const ranked = [...records].sort((a, b) => KEEP_RANK[a.state] - KEEP_RANK[b.state] || b.firstSeenAt - a.firstSeenAt);
  const kept = new Set(ranked.slice(0, MAX_SEQUEL_RECORDS));
  return records.filter((record) => kept.has(record));
}

/**
 * Fusionne une passe de vérification. Un id déjà connu sans enregistrement n'est jamais recréé ; un service pas encore amorcé
 * enregistre sans notifier (première passe), les suivantes notifient les nouvelles suites de services déjà amorcés.
 */
export function mergeSequelPass(
  store: SequelStore,
  candidates: readonly SequelCandidate[],
  servicesThisPass: readonly TrackerId[],
  now: number,
): { store: SequelStore; toNotify: SequelSnapshot[] } {
  const byId = new Map(candidates.map((candidate) => [candidate.snapshot.id, candidate]));
  const known = new Set(store.known);
  const records: SequelRecord[] = [];
  for (const record of store.records) {
    const candidate = byId.get(record.snapshot.id);
    if (candidate) records.push({ ...record, snapshot: candidate.snapshot });
  }
  const present = new Set(records.map((record) => record.snapshot.id));
  const knownList = [...store.known];
  const toNotify: SequelSnapshot[] = [];
  for (const { snapshot, services } of candidates) {
    if (known.has(snapshot.id) || present.has(snapshot.id)) continue;
    records.push({ snapshot, state: 'new', firstSeenAt: now });
    knownList.push(snapshot.id);
    known.add(snapshot.id);
    if (services.some((service) => store.seeded.includes(service))) toNotify.push(snapshot);
  }
  const capped = capRecords(records);
  const survivors = new Set(capped.map((record) => record.snapshot.id));
  const seeded = [...store.seeded, ...servicesThisPass.filter((service) => !store.seeded.includes(service))];
  return {
    store: { records: capped, known: knownList.slice(-MAX_KNOWN_SEQUELS), seeded, lastCheck: now },
    toNotify: toNotify.filter((snapshot) => survivors.has(snapshot.id)),
  };
}

/** Suites à afficher (nouvelles et vues), la plus récemment détectée d'abord. */
export function visibleSequels(store: SequelStore): SequelRecord[] {
  return store.records.filter((record) => record.state !== 'dismissed').sort((a, b) => b.firstSeenAt - a.firstSeenAt);
}

/** Change l'état des ids donnés ; `removed` supprime l'enregistrement mais garde `known` (jamais renotifié). */
export function setSequelStates(store: SequelStore, ids: readonly number[], state: SequelState | 'removed'): SequelStore {
  const targets = new Set(ids);
  const records =
    state === 'removed'
      ? store.records.filter((record) => !targets.has(record.snapshot.id))
      : store.records.map((record) => (targets.has(record.snapshot.id) ? { ...record, state } : record));
  return { ...store, records };
}

export interface SequelGroup {
  key: string;
  season: AniListSeason | null;
  year: number | null;
  records: SequelRecord[];
}

const SEASON_ORDER: readonly AniListSeason[] = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];

/** Saison d'anime d'un mois (janvier–mars hiver, avril–juin printemps, juillet–septembre été, octobre–décembre automne) */
function seasonOfMonth(month: number): AniListSeason {
  return SEASON_ORDER[Math.min(3, Math.max(0, Math.floor((month - 1) / 3)))] ?? 'WINTER';
}

/** Période d'une suite : date exacte ou mois → sa saison ; saison seule ; année seule ; sinon inconnue. */
function periodOf(snapshot: SequelSnapshot): { season: AniListSeason | null; year: number | null } {
  if (snapshot.year !== null && snapshot.month !== null) return { season: seasonOfMonth(snapshot.month), year: snapshot.year };
  if (snapshot.season !== null && snapshot.seasonYear !== null) return { season: snapshot.season, year: snapshot.seasonYear };
  return { season: null, year: snapshot.year };
}

/** Suites groupées par saison d'anime, dans l'ordre chronologique : l'année seule après les saisons de son année, l'inconnu en dernier ; par date puis titre dans un groupe. */
export function groupSequelsByPeriod(records: readonly SequelRecord[]): SequelGroup[] {
  const groups = new Map<string, SequelGroup>();
  for (const record of records) {
    const { season, year } = periodOf(record.snapshot);
    const key = year === null ? 'unknown' : season === null ? String(year) : `${year}-${season}`;
    const group = groups.get(key);
    if (group) group.records.push(record);
    else groups.set(key, { key, season, year, records: [record] });
  }
  const rank = (group: SequelGroup): number => (group.year === null ? Number.POSITIVE_INFINITY : group.year * 10 + (group.season === null ? 4 : SEASON_ORDER.indexOf(group.season)));
  const day = (snapshot: SequelSnapshot): number => (snapshot.month ?? 99) * 100 + (snapshot.day ?? 99);
  return [...groups.values()]
    .sort((a, b) => rank(a) - rank(b))
    .map((group) => ({ ...group, records: group.records.sort((a, b) => day(a.snapshot) - day(b.snapshot) || a.snapshot.title.localeCompare(b.snapshot.title)) }));
}
