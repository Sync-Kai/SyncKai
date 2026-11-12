import { isRecord } from './guards';
import { toSafeUrl } from './url';
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

/** Champs d'affichage d'une fiche à venir : suite annoncée ou série de la liste (sans série source) */
export type SequelDisplay = Omit<SequelSnapshot, 'sourceId' | 'sourceTitle'>;
/** Date et format d'une fiche à venir (lue avec la liste AniList, compare-parse) */
export type ReleaseInfo = Pick<SequelSnapshot, 'format' | 'status' | 'siteUrl' | 'year' | 'month' | 'day' | 'season' | 'seasonYear'>;
export type ListedStatus = 'PLANNING' | 'CURRENT';

/** Série d'une liste de l'utilisateur à venir (À regarder, ou En cours pas encore sortie) : « Annoncées » de l'Agenda */
export interface ListedEntry extends SequelDisplay {
  listStatus: ListedStatus;
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
  /** Absent avant 2.5.0, jamais vérifié par isSequelStore : toujours lu par `listedEntries` */
  listed?: ListedEntry[];
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

/** Seul MyAnimeList est connecté : une suite sans idMal n'a pas d'entrée où écrire */
export function noMalEntry(connected: readonly TrackerId[], idMal: number | null): boolean {
  return idMal === null && connected.includes('mal') && !connected.includes('anilist');
}

export const EMPTY_SEQUEL_STORE: SequelStore = { records: [], known: [], seeded: [], lastCheck: null };
export const MAX_SEQUEL_RECORDS = 200;
export const MAX_KNOWN_SEQUELS = 2000;
export const MAX_LISTED_ENTRIES = 200;

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

function isDisplay(value: unknown): value is SequelDisplay {
  return (
    isRecord(value) &&
    isFiniteNumber(value['id']) &&
    isNullableNumber(value['idMal']) &&
    typeof value['title'] === 'string' &&
    isFormat(value['format']) &&
    isStatus(value['status']) &&
    isNullableString(value['coverUrl']) &&
    typeof value['siteUrl'] === 'string' &&
    toSafeUrl(value['siteUrl'], 'anilist.co') !== null &&
    isNullableNumber(value['year']) &&
    isNullableNumber(value['month']) &&
    isNullableNumber(value['day']) &&
    (value['season'] === null || isSeason(value['season'])) &&
    isNullableNumber(value['seasonYear'])
  );
}

function isSnapshot(value: unknown): value is SequelSnapshot {
  return isRecord(value) && isFiniteNumber(value['sourceId']) && typeof value['sourceTitle'] === 'string' && isDisplay(value);
}

function isListedEntry(value: unknown): value is ListedEntry {
  return isRecord(value) && (value['listStatus'] === 'PLANNING' || value['listStatus'] === 'CURRENT') && isDisplay(value);
}

/** Séries de la liste du store ; absentes ou illisibles → ignorées (un `listed` abîmé n'invalide jamais le store ni `known`) */
export function listedEntries(store: SequelStore): ListedEntry[] {
  const listed: unknown = store.listed;
  return Array.isArray(listed) ? listed.filter(isListedEntry) : [];
}

/** Statut de liste montré dans « Annoncées » : À regarder (à venir ou en diffusion), En cours seulement pas encore sortie */
export function listedQualifies(listStatus: string, status: SequelStatus): listStatus is ListedStatus {
  return listStatus === 'PLANNING' || (listStatus === 'CURRENT' && status === 'NOT_YET_RELEASED');
}

const num = (value: unknown): number | null => (isFiniteNumber(value) ? value : null);

/** Date et format d'une fiche AniList (réponse externe) ; hors TV / TV_SHORT / ONA / MOVIE à venir ou en diffusion → null */
export function parseRelease(media: Record<string, unknown>, id: number): ReleaseInfo | null {
  const { format, status } = media;
  if (!isFormat(format) || !isStatus(status)) return null;
  const date: Record<string, unknown> = isRecord(media['startDate']) ? media['startDate'] : {};
  const siteUrl = typeof media['siteUrl'] === 'string' ? toSafeUrl(media['siteUrl'], 'anilist.co') : null;
  return {
    format, status, siteUrl: siteUrl ?? `https://anilist.co/anime/${id}`, year: num(date['year']), month: num(date['month']), day: num(date['day']),
    season: isSeason(media['season']) ? media['season'] : null, seasonYear: num(media['seasonYear']),
  };
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

/** Recréée vue (`firstSeenAt` 0) : sous les masquées, sinon elle en évincerait une, recréée vue à la passe suivante (masquage perdu) */
const keepRank = (record: SequelRecord): number => (record.state === 'seen' && record.firstSeenAt === 0 ? 3 : KEEP_RANK[record.state]);

/** Plafond des enregistrements : partent d'abord les recréées, puis les masquées, puis les plus anciennes vues, puis les plus anciennes nouvelles. */
function capRecords(records: SequelRecord[]): SequelRecord[] {
  if (records.length <= MAX_SEQUEL_RECORDS) return records;
  const ranked = [...records].sort((a, b) => keepRank(a) - keepRank(b) || b.firstSeenAt - a.firstSeenAt);
  const kept = new Set(ranked.slice(0, MAX_SEQUEL_RECORDS));
  return records.filter((record) => kept.has(record));
}

/**
 * Fusionne une passe de vérification. Un id déjà connu sans enregistrement (ajouté puis retiré de la liste) revient vu, le
 * plus ancien, jamais renotifié ; un service pas encore amorcé enregistre sans notifier (première passe), les suivantes
 * notifient les nouvelles suites de services déjà amorcés. `listed` remplace les séries de la liste du store.
 */
export function mergeSequelPass(
  store: SequelStore,
  candidates: readonly SequelCandidate[],
  servicesThisPass: readonly TrackerId[],
  now: number,
  listed: readonly ListedEntry[] = [],
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
    if (present.has(snapshot.id)) continue;
    // firstSeenAt 0 : la première à partir au plafond, d'une passe à l'autre (un id écarté par le plafond y reste écarté)
    if (known.has(snapshot.id)) {
      records.push({ snapshot, state: 'seen', firstSeenAt: 0 });
      continue;
    }
    records.push({ snapshot, state: 'new', firstSeenAt: now });
    knownList.push(snapshot.id);
    known.add(snapshot.id);
    if (services.some((service) => store.seeded.includes(service))) toNotify.push(snapshot);
  }
  const capped = capRecords(records);
  const survivors = new Set(capped.map((record) => record.snapshot.id));
  const seeded = [...store.seeded, ...servicesThisPass.filter((service) => !store.seeded.includes(service))];
  return {
    store: { records: capped, known: knownList.slice(-MAX_KNOWN_SEQUELS), seeded, lastCheck: now, listed: capListed(listed) },
    toNotify: toNotify.filter((snapshot) => survivors.has(snapshot.id)),
  };
}

/** Ordre d'affichage : la plus récemment détectée d'abord ; à égalité (suites d'une même passe), par id, pour qu'une ligne garde sa place */
export function newestFirst(a: SequelRecord, b: SequelRecord): number {
  return b.firstSeenAt - a.firstSeenAt || a.snapshot.id - b.snapshot.id;
}

/** Suites à afficher (nouvelles et vues), la plus récemment détectée d'abord. */
export function visibleSequels(store: SequelStore): SequelRecord[] {
  return store.records.filter((record) => record.state !== 'dismissed').sort(newestFirst);
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

/**
 * Suites ajoutées à la liste (`listStatus` donné par id) : enregistrement retiré (id gardé dans `known`), fiche dans `listed`
 * à la place d'une précédente du même id. Un id sans enregistrement est ignoré.
 */
export function listSequels(store: SequelStore, moves: readonly { id: number; listStatus: ListedStatus }[]): SequelStore {
  const status = new Map(moves.map((move) => [move.id, move.listStatus]));
  const moved = store.records.flatMap(({ snapshot: { sourceId: _sourceId, sourceTitle: _sourceTitle, ...display } }): ListedEntry[] => {
    const listStatus = status.get(display.id);
    return listStatus === undefined ? [] : [{ ...display, listStatus }];
  });
  if (moved.length === 0) return store;
  const ids = new Set(moved.map((entry) => entry.id));
  return {
    ...store,
    records: store.records.filter((record) => !ids.has(record.snapshot.id)),
    listed: capListed([...moved, ...listedEntries(store).filter((entry) => !ids.has(entry.id))]),
  };
}

/** Retire des séries de la liste (plus dans aucune liste, ou autre statut) */
export function dropListed(store: SequelStore, ids: readonly number[]): SequelStore {
  const targets = new Set(ids);
  return { ...store, listed: listedEntries(store).filter((entry) => !targets.has(entry.id)) };
}

export interface SequelGroup<T> {
  key: string;
  season: AniListSeason | null;
  year: number | null;
  items: T[];
}

type Dated = Pick<SequelSnapshot, 'title' | 'year' | 'month' | 'day' | 'season' | 'seasonYear'>;

const SEASON_ORDER: readonly AniListSeason[] = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];

/** Saison d'anime d'un mois (janvier–mars hiver, avril–juin printemps, juillet–septembre été, octobre–décembre automne) */
function seasonOfMonth(month: number): AniListSeason {
  return SEASON_ORDER[Math.min(3, Math.max(0, Math.floor((month - 1) / 3)))] ?? 'WINTER';
}

/** Période d'une suite : date exacte ou mois → sa saison ; saison seule ; année seule ; sinon inconnue. */
function periodOf(snapshot: Dated): { season: AniListSeason | null; year: number | null } {
  if (snapshot.year !== null && snapshot.month !== null) return { season: seasonOfMonth(snapshot.month), year: snapshot.year };
  if (snapshot.season !== null && snapshot.seasonYear !== null) return { season: snapshot.season, year: snapshot.seasonYear };
  return { season: null, year: snapshot.year };
}

const periodRank = ({ season, year }: { season: AniListSeason | null; year: number | null }): number => (year === null ? Number.POSITIVE_INFINITY : year * 10 + (season === null ? 4 : SEASON_ORDER.indexOf(season)));
const dayRank = (dated: Dated): number => (dated.month ?? 99) * 100 + (dated.day ?? 99);
/** Ordre chronologique : période, puis date, puis titre */
const byDate = (a: Dated, b: Dated): number => periodRank(periodOf(a)) - periodRank(periodOf(b)) || dayRank(a) - dayRank(b) || a.title.localeCompare(b.title);

/** Séries de la liste : une par id (la première), les 200 plus proches, par date */
function capListed(entries: readonly ListedEntry[]): ListedEntry[] {
  const byId = new Map<number, ListedEntry>();
  for (const entry of entries) if (!byId.has(entry.id)) byId.set(entry.id, entry);
  return [...byId.values()].sort(byDate).slice(0, MAX_LISTED_ENTRIES);
}

/** Fiches groupées par saison d'anime, dans l'ordre chronologique : l'année seule après les saisons de son année, l'inconnu en dernier ; par date puis titre dans un groupe. */
export function groupSequelsByPeriod<T>(items: readonly T[], dated: (item: T) => Dated): SequelGroup<T>[] {
  const groups = new Map<string, SequelGroup<T>>();
  for (const item of items) {
    const { season, year } = periodOf(dated(item));
    const key = year === null ? 'unknown' : season === null ? String(year) : `${year}-${season}`;
    const group = groups.get(key);
    if (group) group.items.push(item);
    else groups.set(key, { key, season, year, items: [item] });
  }
  return [...groups.values()]
    .sort((a, b) => periodRank(a) - periodRank(b))
    .map((group) => ({ ...group, items: group.items.sort((a, b) => byDate(dated(a), dated(b))) }));
}
