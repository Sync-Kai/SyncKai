import type { AniListErrorCode } from './anilist.types';
import type { CompareJob } from './compare-job';
import { isRecord } from './guards';
import { STORAGE_KEYS } from './storage';
import type { Result } from './result';
import { aniListScoreOn10, isAniListScoreFormat, toAniListScore, type AniListScoreFormat } from './score';
import type { ListStatus } from './sync.types';
import { isTrackerId, TRACKER_LABELS, type TrackerId } from './tracker.types';
import { t } from '../i18n';

// Comparaison des listes AniList ↔ MyAnimeList (Activité › Écarts) : logique pure, testée.
// Rien n'est corrigé automatiquement : l'utilisateur choisit le service de référence.

/** Clé de chrome.storage.local : dernière comparaison (+ erreurs d'alignement), effacée à la déconnexion */
export const COMPARE_STORAGE_KEY = STORAGE_KEYS.compareLast;

/** Entrée de la liste AniList, normalisée (score brut, dans le format du profil) */
export interface AniListListEntry {
  mediaId: number;
  malId: number | null;
  title: string;
  coverUrl: string | null;
  status: ListStatus;
  progress: number;
  /** Note brute AniList (format du profil), null si non notée (0) */
  score: number | null;
  repeat: number;
}

/** Entrée de la liste MAL, normalisée (is_rewatching → REPEATING) */
export interface MalListEntry {
  malId: number;
  /** Fiche AniList équivalente (catalogue), null si inconnue */
  mediaId: number | null;
  title: string;
  coverUrl: string | null;
  status: ListStatus;
  progress: number;
  /** Note MAL (entier 1 à 10), null si non notée (0) */
  score: number | null;
  repeat: number;
}

export interface CompareInput {
  anilist: readonly AniListListEntry[];
  mal: readonly MalListEntry[];
  scoreFormat: AniListScoreFormat;
}

/** État d'une série sur un service, tel qu'affiché et recopié */
export interface DiffSide {
  status: ListStatus;
  progress: number;
  /** Note sur 10 non arrondie (AniList 7,8 ; MAL 7), null si non notée */
  score: number | null;
  repeat: number;
}

export type DiffField = 'progress' | 'status' | 'score' | 'presence';

export interface ListDiff {
  /** Identifiant stable : `mal:<id>` */
  key: string;
  mediaId: number | null;
  malId: number;
  title: string;
  coverUrl: string | null;
  anilist: DiffSide | null;
  mal: DiffSide | null;
  fields: DiffField[];
  /** Fiche modifiée depuis l'analyse (synchro, contrôle, état relu différent) : à réanalyser, jamais alignée */
  stale?: boolean;
}

export interface CompareCounts {
  /** Séries examinées : paires trouvées des deux côtés + séries présentes d'un seul côté */
  compared: number;
  identical: number;
  different: number;
  onlyAniList: number;
  onlyMal: number;
  /** Séries AniList sans id MAL, séries MAL sans fiche AniList, doublons */
  notComparable: number;
}

export interface ComparisonResult {
  analyzedAt: number;
  scoreFormat: AniListScoreFormat;
  counts: CompareCounts;
  items: ListDiff[];
  /** Dernière erreur d'alignement par série (clé → message) */
  errors: Record<string, string>;
}

export type CompareErrorCode = AniListErrorCode | 'NOT_CONNECTED' | 'BUSY';
export type CompareResult = Result<ComparisonResult, CompareErrorCode>;

export interface ApplyDiffItem {
  mediaId: number | null;
  malId: number | null;
}

export interface ApplyDiffsPayload {
  items: ApplyDiffItem[];
  /** Service de référence : ses valeurs sont écrites sur l'autre */
  source: TrackerId;
}

export type ApplyErrorCode = CompareErrorCode | 'NO_COMPARISON';
/** Alignement accepté : la tâche démarre en arrière-plan (progression dans `compare:job`) */
export type ApplyResult = Result<CompareJob, ApplyErrorCode>;
export type CancelJobResult = Result<null, 'NOT_FOUND'>;

export const MAX_APPLY_ITEMS = 2000;

// ─── Notes ────────────────────────────────────────────────────────────────

/** Note sur 10 → note MAL (entier 1 à 10, arrondi à l'inférieur, comme toMalScore) */
export function malScoreFrom(score10: number): number {
  // Tolérance : 3 smileys AniList (10/3 × 3 = 9,999…) doit donner 10
  return Math.min(10, Math.max(1, Math.floor(score10 + 1e-9)));
}

/**
 * Notes équivalentes : MAL n'accepte que des entiers et SyncKai y écrit l'arrondi inférieur
 * (AniList 8,5 ↔ MAL 8 n'est pas un écart). Les formats AniList grossiers (POINT_5, POINT_3) sont
 * aussi comparés dans le format du profil (MAL 7 → 2 smileys = AniList 2).
 */
export function scoresMatch(anilistRaw: number | null, malScore: number | null, format: AniListScoreFormat): boolean {
  if (anilistRaw === null || malScore === null) return anilistRaw === malScore;
  const on10 = aniListScoreOn10(anilistRaw, format);
  if (on10 === null) return false;
  return malScoreFrom(on10) === malScore || toAniListScore(malScore, format) === anilistRaw;
}

// ─── Diff ─────────────────────────────────────────────────────────────────

const toSide = (status: ListStatus, progress: number, score: number | null, repeat: number): DiffSide => ({ status, progress, score, repeat });

/** Champs différents entre deux entrées présentes des deux côtés */
export function diffFields(al: AniListListEntry, mal: MalListEntry, format: AniListScoreFormat): DiffField[] {
  const fields: DiffField[] = [];
  if (al.progress !== mal.progress) fields.push('progress');
  if (al.status !== mal.status) fields.push('status');
  if (!scoresMatch(al.score, mal.score, format)) fields.push('score');
  return fields;
}

const byTitle = (a: ListDiff, b: ListDiff): number => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }) || a.malId - b.malId;

/**
 * Compare les deux listes complètes, appariées par id MAL (`idMal` AniList ↔ id MAL).
 * - entrée AniList sans idMal : non comparable ;
 * - entrée MAL absente d'AniList : « absente d'AniList » si une fiche AniList équivalente est connue
 *   (sinon non comparable : impossible de l'y recopier) ;
 * - doublons (même fiche dans plusieurs listes personnalisées) : première occurrence ; une seconde fiche
 *   AniList portant le même idMal compte comme non comparable.
 */
export function compareLists({ anilist, mal, scoreFormat }: CompareInput, analyzedAt: number): ComparisonResult {
  let notComparable = 0;

  const alByMal = new Map<number, AniListListEntry>();
  const seenMedia = new Set<number>();
  for (const entry of anilist) {
    if (seenMedia.has(entry.mediaId)) continue;
    seenMedia.add(entry.mediaId);
    if (entry.malId === null || alByMal.has(entry.malId)) notComparable++;
    else alByMal.set(entry.malId, entry);
  }

  const malById = new Map<number, MalListEntry>();
  for (const entry of mal) if (!malById.has(entry.malId)) malById.set(entry.malId, entry);

  const items: ListDiff[] = [];
  let pairs = 0;
  let onlyAniList = 0;
  let onlyMal = 0;

  for (const [malId, al] of alByMal) {
    const m = malById.get(malId);
    const base = { key: `mal:${malId}`, mediaId: al.mediaId, malId, title: al.title, coverUrl: al.coverUrl ?? m?.coverUrl ?? null };
    const alSide = toSide(al.status, al.progress, al.score === null ? null : aniListScoreOn10(al.score, scoreFormat), al.repeat);
    if (!m) {
      onlyAniList++;
      items.push({ ...base, anilist: alSide, mal: null, fields: ['presence'] });
      continue;
    }
    pairs++;
    const fields = diffFields(al, m, scoreFormat);
    if (fields.length > 0) items.push({ ...base, anilist: alSide, mal: toSide(m.status, m.progress, m.score, m.repeat), fields });
  }

  for (const [malId, m] of malById) {
    if (alByMal.has(malId)) continue;
    // Fiche AniList déjà dans la liste sous un autre idMal (doublon) ou inconnue : non comparable
    if (m.mediaId === null || seenMedia.has(m.mediaId)) {
      notComparable++;
      continue;
    }
    onlyMal++;
    items.push({
      key: `mal:${malId}`,
      mediaId: m.mediaId,
      malId,
      title: m.title,
      coverUrl: m.coverUrl,
      anilist: null,
      mal: toSide(m.status, m.progress, m.score, m.repeat),
      fields: ['presence'],
    });
  }

  items.sort(byTitle);
  const compared = pairs + onlyAniList + onlyMal;
  return {
    analyzedAt,
    scoreFormat,
    counts: { compared, identical: compared - items.length, different: items.length, onlyAniList, onlyMal, notComparable },
    items,
    errors: {},
  };
}

// ─── Alignement ───────────────────────────────────────────────────────────

/** Champs à écrire sur le service de destination (absents = inchangés) */
export interface EntryWrite {
  status?: ListStatus;
  progress?: number;
  /** Note sur 10 (non arrondie), convertie dans le format du service de destination */
  score?: number;
  repeat?: number;
}

export type ApplySkipReason = 'missing-source' | 'no-equivalent' | 'no-score' | 'nothing' | 'changed';

export type ApplyPlan =
  | { action: 'write'; target: TrackerId; id: number; write: EntryWrite; create: boolean }
  | { action: 'skip'; reason: ApplySkipReason };

export const otherService = (service: TrackerId): TrackerId => (service === 'anilist' ? 'mal' : 'anilist');

/**
 * Ce qu'il faut écrire sur l'autre service pour aligner `diff` sur `source` (pur, testable) :
 * - jamais de suppression : si la série est absente de la source, rien n'est écrit ;
 * - série absente de la destination : créée avec le statut, la progression, la note (si la source en a une)
 *   et le compteur de revisionnages de la source ;
 * - sinon seuls les champs en écart sont écrits (statut + progression ensemble, pour un état cohérent) ;
 * - une note n'est recopiée que si la source en a une : « pas de note » n'efface jamais une note existante ;
 * - série modifiée depuis l'analyse : rien n'est écrit (valeurs périmées), il faut relancer l'analyse.
 */
export function planApply(diff: ListDiff, source: TrackerId): ApplyPlan {
  if (diff.stale === true) return { action: 'skip', reason: 'changed' };
  const target = otherService(source);
  const from = diff[source];
  const to = diff[target];
  if (from === null) return { action: 'skip', reason: 'missing-source' };
  const id = target === 'mal' ? diff.malId : diff.mediaId;
  if (id === null) return { action: 'skip', reason: 'no-equivalent' };

  if (to === null) {
    const write: EntryWrite = { status: from.status, progress: from.progress };
    if (from.score !== null) write.score = from.score;
    if (from.repeat > 0) write.repeat = from.repeat;
    return { action: 'write', target, id, write, create: true };
  }

  const write: EntryWrite = {};
  if (diff.fields.includes('status') || diff.fields.includes('progress')) {
    write.status = from.status;
    write.progress = from.progress;
    if (from.repeat !== to.repeat) write.repeat = from.repeat;
  }
  if (diff.fields.includes('score') && from.score !== null) write.score = from.score;
  if (Object.keys(write).length === 0) return { action: 'skip', reason: diff.fields.includes('score') ? 'no-score' : 'nothing' };
  return { action: 'write', target, id, write, create: false };
}

/** Série de la comparaison visée par un élément du payload (id MAL d'abord, sinon fiche AniList) */
export function findDiff(result: ComparisonResult, item: ApplyDiffItem): ListDiff | null {
  return result.items.find((d) => (item.malId !== null ? d.malId === item.malId : d.mediaId === item.mediaId)) ?? null;
}

/** Retire une série alignée de la comparaison et met les compteurs à jour */
export function withoutDiff(result: ComparisonResult, key: string): ComparisonResult {
  const diff = result.items.find((d) => d.key === key);
  if (!diff) return result;
  const { [key]: _fixed, ...errors } = result.errors;
  const presence = diff.fields.includes('presence');
  const counts: CompareCounts = {
    ...result.counts,
    identical: result.counts.identical + 1,
    different: result.counts.different - 1,
    onlyAniList: result.counts.onlyAniList - (presence && diff.mal === null ? 1 : 0),
    onlyMal: result.counts.onlyMal - (presence && diff.anilist === null ? 1 : 0),
  };
  return { ...result, counts, items: result.items.filter((d) => d.key !== key), errors };
}

export function withDiffError(result: ComparisonResult, key: string, message: string | null): ComparisonResult {
  const { [key]: _previous, ...errors } = result.errors;
  return { ...result, errors: message === null ? errors : { ...errors, [key]: message } };
}

/**
 * Marque « à réanalyser » les séries visées par `matches` (leur erreur d'alignement, désormais caduque, est retirée).
 * Renvoie `result` lui-même si rien ne change : l'appelant n'écrit alors rien.
 */
export function withStaleDiffs(result: ComparisonResult, matches: (diff: ListDiff) => boolean): ComparisonResult {
  const keys = new Set(result.items.filter((d) => d.stale !== true && matches(d)).map((d) => d.key));
  if (keys.size === 0) return result;
  const errors = Object.fromEntries(Object.entries(result.errors).filter(([key]) => !keys.has(key)));
  return { ...result, items: result.items.map((d) => (keys.has(d.key) ? { ...d, stale: true } : d)), errors };
}

/** Entrée relue sur un service juste avant l'alignement (forme de `ListEntryState`, notes brutes du service) */
export interface LiveEntry {
  status: ListStatus;
  progress: number;
  repeat?: number;
  /** Note brute (format du profil AniList, entier MAL), absente si non notée */
  score?: number;
}

/**
 * L'entrée relue correspond-elle encore à l'instantané de l'analyse (présence, statut, progression, note, revisionnages) ?
 * Sinon les valeurs de l'instantané sont périmées : les écrire pourrait faire reculer la liste.
 */
export function sideMatches(side: DiffSide | null, entry: LiveEntry | null, service: TrackerId, scoreFormat: AniListScoreFormat): boolean {
  if (side === null || entry === null) return side === entry;
  const score = entry.score === undefined ? null : service === 'anilist' ? aniListScoreOn10(entry.score, scoreFormat) : entry.score;
  return (
    entry.status === side.status &&
    entry.progress === side.progress &&
    score === side.score &&
    // Compteur inconnu (absent de la réponse) : pas comparé
    (entry.repeat === undefined || entry.repeat === side.repeat)
  );
}

/** Les deux entrées relues sont-elles déjà alignées (mêmes règles que l'analyse) ? */
export function isAlignedNow(anilist: LiveEntry | null, mal: LiveEntry | null, scoreFormat: AniListScoreFormat): boolean {
  if (anilist === null || mal === null) return false;
  return anilist.progress === mal.progress && anilist.status === mal.status && scoresMatch(anilist.score ?? null, mal.score ?? null, scoreFormat);
}

// ─── Validation (stockage, messages) ──────────────────────────────────────

const LIST_STATUSES: readonly ListStatus[] = ['CURRENT', 'PLANNING', 'COMPLETED', 'DROPPED', 'PAUSED', 'REPEATING'];
const DIFF_FIELDS: readonly DiffField[] = ['progress', 'status', 'score', 'presence'];

export const isListStatus = (value: unknown): value is ListStatus => LIST_STATUSES.some((s) => s === value);
const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0;
const isPositiveInt = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 1;
const isNullableString = (value: unknown): value is string | null => value === null || typeof value === 'string';

function isDiffSide(value: unknown): value is DiffSide | null {
  if (value === null) return true;
  return (
    isRecord(value) &&
    isListStatus(value.status) &&
    isCount(value.progress) &&
    (value.score === null || (typeof value.score === 'number' && value.score > 0)) &&
    isCount(value.repeat)
  );
}

function isListDiff(value: unknown): value is ListDiff {
  return (
    isRecord(value) &&
    typeof value.key === 'string' &&
    (value.mediaId === null || isPositiveInt(value.mediaId)) &&
    isPositiveInt(value.malId) &&
    typeof value.title === 'string' &&
    isNullableString(value.coverUrl) &&
    isDiffSide(value.anilist) &&
    isDiffSide(value.mal) &&
    Array.isArray(value.fields) &&
    value.fields.every((f) => DIFF_FIELDS.some((d) => d === f)) &&
    (value.stale === undefined || typeof value.stale === 'boolean')
  );
}

const COUNT_KEYS: readonly (keyof CompareCounts)[] = ['compared', 'identical', 'different', 'onlyAniList', 'onlyMal', 'notComparable'];

/** Comparaison relue du stockage (format de l'extension, validé quand même : version précédente possible) */
export function isComparisonResult(value: unknown): value is ComparisonResult {
  return (
    isRecord(value) &&
    typeof value.analyzedAt === 'number' &&
    isAniListScoreFormat(value.scoreFormat) &&
    isRecord(value.counts) &&
    COUNT_KEYS.every((k) => isRecord(value.counts) && isCount(value.counts[k])) &&
    Array.isArray(value.items) &&
    value.items.every(isListDiff) &&
    isRecord(value.errors) &&
    Object.values(value.errors).every((m) => typeof m === 'string')
  );
}

const isApplyItem = (value: unknown): value is ApplyDiffItem =>
  isRecord(value) &&
  (value.mediaId === null || isPositiveInt(value.mediaId)) &&
  (value.malId === null || isPositiveInt(value.malId)) &&
  (value.mediaId !== null || value.malId !== null);

export function isApplyDiffsPayload(value: unknown): value is ApplyDiffsPayload {
  return (
    isRecord(value) &&
    isTrackerId(value.source) &&
    Array.isArray(value.items) &&
    value.items.length > 0 &&
    value.items.length <= MAX_APPLY_ITEMS &&
    value.items.every(isApplyItem)
  );
}

/** Séries que « Tout aligner sur `source` » modifierait réellement (les autres seraient ignorées) */
export function applicableDiffs(items: readonly ListDiff[], source: TrackerId): ListDiff[] {
  return items.filter((diff) => planApply(diff, source).action === 'write');
}

/** Explication d'un alignement sans effet (infobulle du bouton, bilan d'un lot) */
export function skipReasonText(reason: ApplySkipReason, source: TrackerId): string {
  const service = TRACKER_LABELS[source];
  switch (reason) {
    case 'missing-source':
      return t('compare.skip.missingSource', { service });
    case 'no-equivalent':
      return t('compare.skip.noEquivalent');
    case 'no-score':
      return t('compare.skip.noScore', { service });
    case 'nothing':
      return t('compare.skip.nothing');
    case 'changed':
      return t('compare.skip.changed');
  }
}

// ─── Répartition, filtres et impact d'un alignement en lot ────────────────

export type DiffFilter = 'all' | 'missingMal' | 'missingAniList' | 'progress' | 'status' | 'score';
export const DIFF_FILTERS: readonly DiffFilter[] = ['all', 'missingMal', 'missingAniList', 'progress', 'status', 'score'];

/** Une série peut relever de plusieurs types (progression + statut…) ; « absente » exclut les autres */
export function matchesFilter(diff: ListDiff, filter: DiffFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'missingMal':
      return diff.mal === null;
    case 'missingAniList':
      return diff.anilist === null;
    case 'progress':
    case 'status':
    case 'score':
      return diff.fields.includes(filter);
  }
}

export type DiffBreakdown = Record<DiffFilter, number>;

/** Nombre de séries par type d'écart (« 290 absentes de MAL · 30 progression… ») */
export function diffBreakdown(items: readonly ListDiff[]): DiffBreakdown {
  const counts = Object.fromEntries(DIFF_FILTERS.map((f) => [f, 0])) as DiffBreakdown;
  for (const diff of items) for (const filter of DIFF_FILTERS) if (matchesFilter(diff, filter)) counts[filter]++;
  return counts;
}

export interface ApplyImpact {
  /** Séries écrites */
  total: number;
  /** Séries ajoutées à la liste de destination */
  created: number;
  progress: number;
  status: number;
  score: number;
}

/** Ce qu'un alignement en lot changera réellement sur le service de destination (texte de confirmation) */
export function applyImpact(items: readonly ListDiff[], source: TrackerId): ApplyImpact {
  const impact: ApplyImpact = { total: 0, created: 0, progress: 0, status: 0, score: 0 };
  for (const diff of items) {
    const plan = planApply(diff, source);
    if (plan.action === 'skip') continue;
    impact.total++;
    if (plan.create) {
      impact.created++;
      continue;
    }
    if (diff.fields.includes('progress')) impact.progress++;
    if (diff.fields.includes('status')) impact.status++;
    if (plan.write.score !== undefined) impact.score++;
  }
  return impact;
}
