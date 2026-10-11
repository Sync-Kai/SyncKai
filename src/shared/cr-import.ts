import { isCrHistoryResult, isHistoryStats, type CrHistoryResult, type HistorySeason, type HistoryStats } from './cr-history';
import { isEpisodeInfo, type EpisodeInfo } from './episode.types';
import { normalizeSeriesTitle } from './exclusions';
import { isRecord } from './guards';
import { isJobOf, startJob, type Job } from './job';
import type { Result } from './result';
import { isCandidateSummary, type CandidateSummary } from './review.types';
import { isMediaMapping, type ListStatus, type MediaMapping } from './sync.types';
import { isListStatus } from './compare';
import { STORAGE_KEYS } from './storage-keys';
import { isTrackerId, type TrackerId } from './tracker.types';

// Import de l'historique Crunchyroll (Réglages › Importer depuis Crunchyroll) : types, stockage et planification
// (pur, testé). Déroulé : lecture de l'historique dans l'onglet Crunchyroll (script de contenu) → analyse en
// tâche de fond (correspondance saison → fiche AniList, sans rien écrire) → aperçu → application en tâche de fond.
// Règles : jamais de recul, une série terminée ou en revisionnage n'est pas touchée, une correspondance
// incertaine n'est jamais appliquée (« À vérifier » : cartes de vérification créées à la demande).

/** Clés de chrome.storage.local (effacées à la déconnexion d'un compte) */
export const CR_IMPORT_KEYS = {
  /** Tâche en cours (analyse ou application) */
  job: STORAGE_KEYS.crImportJob,
  /** Historique réduit par saison, en attente d'analyse */
  input: STORAGE_KEYS.crImportInput,
  /** Correspondance de chaque saison (index → résultat), écrite pendant l'analyse */
  resolutions: STORAGE_KEYS.crImportResolutions,
  /** Aperçu : ce que l'import écrira, puis le résultat de chaque série */
  plan: STORAGE_KEYS.crImportPlan,
} as const;

/** Alarme de reprise d'une tâche d'import interrompue */
export const CR_IMPORT_ALARM = 'synckai:cr-import-job';

// ─── Tâche ────────────────────────────────────────────────────────────────

export type CrJobKind = 'cr-analyze' | 'cr-apply';
/** Élément final de l'analyse : lecture des listes et construction de l'aperçu */
export const FINALIZE_ITEM = 'finalize';
/** Analyse : `s:<index de saison>` puis FINALIZE_ITEM ; application : identifiant d'élément du plan (`m:<mediaId>`) */
export type CrImportJob = Job<CrJobKind, string>;

export const seasonItem = (index: number): string => `s:${index}`;
export function seasonIndexOf(item: string): number | null {
  const match = /^s:(\d{1,5})$/.exec(item);
  return match ? Number(match[1]) : null;
}
export const planItemId = (mediaId: number): string => `m:${mediaId}`;

const ITEM_PATTERN = /^(?:s:\d{1,5}|m:\d{1,10}|finalize)$/;
const isJobItem = (v: unknown): v is string => typeof v === 'string' && ITEM_PATTERN.test(v);
const isCrJobKind = (v: unknown): v is CrJobKind => v === 'cr-analyze' || v === 'cr-apply';

export function startAnalyzeJob(seasonCount: number, now: number): CrImportJob {
  return startJob<CrJobKind, string>('cr-analyze', [...Array.from({ length: seasonCount }, (_, i) => seasonItem(i)), FINALIZE_ITEM], now);
}
export const startApplyJob = (ids: readonly string[], now: number): CrImportJob => startJob<CrJobKind, string>('cr-apply', ids, now);

export function isCrImportJob(value: unknown): value is CrImportJob {
  return isJobOf(value, isCrJobKind, isJobItem);
}

// ─── Entrée et correspondances ────────────────────────────────────────────

export interface CrImportInput extends CrHistoryResult {
  createdAt: number;
}

export function isCrImportInput(value: unknown): value is CrImportInput {
  return isRecord(value) && typeof value.createdAt === 'number' && isCrHistoryResult(value);
}

export type SeasonResolution =
  /** Correspondance sûre (cache ou lien plateforme) : `progress` = épisode AniList à atteindre */
  | { kind: 'certain'; key: string; mediaId: number; progress: number; mapping: MediaMapping }
  /** Correspondance incertaine ou introuvable : jamais appliquée, vérification à créer à la demande */
  | { kind: 'review'; key: string; reason: string; suggestion: { mediaId: number; progress: number } | null; candidates: CandidateSummary[] }
  /** Série exclue par l'utilisateur (Réglages › Séries exclues) */
  | { kind: 'excluded'; key: string }
  /** Erreur définitive pendant la recherche (la saison est simplement ignorée) */
  | { kind: 'failed'; key: string; message: string };

const isPositiveInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 1;
const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

export function isSeasonResolution(value: unknown): value is SeasonResolution {
  if (!isRecord(value) || typeof value.key !== 'string') return false;
  switch (value.kind) {
    case 'certain':
      return isPositiveInt(value.mediaId) && isPositiveInt(value.progress) && isMediaMapping(value.mapping);
    case 'review':
      return (
        typeof value.reason === 'string' &&
        (value.suggestion === null || (isRecord(value.suggestion) && isPositiveInt(value.suggestion.mediaId) && isPositiveInt(value.suggestion.progress))) &&
        Array.isArray(value.candidates) &&
        value.candidates.every(isCandidateSummary)
      );
    case 'excluded':
      return true;
    case 'failed':
      return typeof value.message === 'string';
    default:
      return false;
  }
}

/** Correspondances relues du stockage (index de saison → résultat), entrées illisibles ignorées */
export function readResolutions(value: unknown): Record<string, SeasonResolution> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, SeasonResolution] => /^\d+$/.test(entry[0]) && isSeasonResolution(entry[1])));
}

/** Épisode équivalent à celui que lirait le script de contenu sur la page de lecture (même clé de saison, mêmes numéros) */
export function toEpisodeInfo(season: HistorySeason): EpisodeInfo {
  return {
    platform: 'crunchyroll',
    episodeId: season.episodeId,
    seriesId: season.seriesId,
    seriesSlug: season.seriesSlug,
    animeTitle: season.seriesTitle,
    seasonNumber: season.seasonNumber,
    seasonTitle: season.seasonTitle,
    seasonEpisodeNumber: season.seasonEpisodeNumber,
    displayedEpisodeNumber: season.episodeNumber,
    episodeTitle: season.episodeTitle,
    url: `https://www.crunchyroll.com/watch/${season.episodeId}`,
  };
}

/** Numéro affiché absolu (One Piece E1180 = 25e épisode de sa saison) */
export const isAbsoluteSeason = (season: Pick<HistorySeason, 'episodeNumber' | 'seasonEpisodeNumber'>): boolean =>
  season.seasonEpisodeNumber !== null && season.episodeNumber > season.seasonEpisodeNumber;

/** « One Piece · S24 (Elbaph) » ; titre de saison omis s'il reprend celui de la série */
export function historySeasonLabel(season: Pick<HistorySeason, 'seriesTitle' | 'seasonNumber' | 'seasonTitle'>): string {
  const number = season.seasonNumber !== null ? ` · S${season.seasonNumber}` : '';
  const distinct = season.seasonTitle && normalizeSeriesTitle(season.seasonTitle) !== normalizeSeriesTitle(season.seriesTitle);
  return `${season.seriesTitle}${number}${distinct ? ` (${season.seasonTitle})` : ''}`;
}

// ─── Plan (aperçu) ────────────────────────────────────────────────────────

/** État d'une entrée de liste (statut + progression) */
export interface CrListState {
  status: ListStatus;
  progress: number;
}

export type CrSkipReason = 'up-to-date' | 'completed' | 'repeating' | 'beyond' | 'no-equivalent';
export const CR_SKIP_REASONS: readonly CrSkipReason[] = ['up-to-date', 'completed', 'repeating', 'beyond', 'no-equivalent'];

/** Statut écrit par l'import : comme la synchro en direct (Terminé au dernier épisode, En cours avant) */
export type CrWriteStatus = 'CURRENT' | 'COMPLETED';

export type CrImportDecision = { action: 'update'; progress: number; status: CrWriteStatus } | { action: 'skip'; reason: CrSkipReason };

/**
 * Règles de l'import (pur, testé), plus prudentes que la synchro en direct :
 * - au-delà du nombre d'épisodes de la fiche (découpage différent) : rien ;
 * - série terminée ou en revisionnage : jamais touchée (l'historique ne dit pas si c'est un revisionnage) ;
 * - jamais de recul ni de réécriture identique ;
 * - sinon Terminé au dernier épisode, En cours avant (une série En pause / Abandonnée reprend comme en direct).
 */
export function decideImport(entry: CrListState | null, progress: number, totalEpisodes: number | null): CrImportDecision {
  if (totalEpisodes !== null && progress > totalEpisodes) return { action: 'skip', reason: 'beyond' };
  if (entry?.status === 'COMPLETED') return { action: 'skip', reason: 'completed' };
  if (entry?.status === 'REPEATING') return { action: 'skip', reason: 'repeating' };
  if (entry && progress <= entry.progress) return { action: 'skip', reason: 'up-to-date' };
  return { action: 'update', progress, status: totalEpisodes !== null && progress >= totalEpisodes ? 'COMPLETED' : 'CURRENT' };
}

export type CrServicePlan =
  | { service: TrackerId; current: CrListState | null; action: 'update'; progress: number; status: CrWriteStatus }
  | { service: TrackerId; current: CrListState | null; action: 'skip'; reason: CrSkipReason };

export interface CrItemResult {
  outcome: 'updated' | 'skipped' | 'failed';
  message: string | null;
}

/** Une fiche AniList à mettre à jour (plusieurs saisons Crunchyroll peuvent y mener : progression maximale) */
export interface CrPlanItem {
  id: string;
  mediaId: number;
  malId: number | null;
  title: string;
  coverUrl: string | null;
  episodes: number | null;
  progress: number;
  /** Saisons Crunchyroll à l'origine de l'élément (libellés) */
  seasons: string[];
  services: CrServicePlan[];
  /** Correspondances saison → fiche, mémorisées à l'application si absentes (synchro en direct plus rapide) */
  mappings: { key: string; mapping: MediaMapping }[];
  /** Résultat de l'application (null : pas encore appliqué) */
  result: CrItemResult | null;
  /**
   * Services déjà écrits par un essai précédent de l'élément (un autre service a échoué pour une raison passagère) :
   * la nouvelle tentative ne retente que les autres et compte ceux-ci « mis à jour ». Retiré avec le résultat.
   */
  written?: TrackerId[];
}

export interface CrReviewItem {
  key: string;
  label: string;
  /** Saisons Crunchyroll réunies dans cette vérification (numérotation absolue menant à la même fiche) */
  seasons: string[];
  episode: EpisodeInfo;
  reason: string;
  suggestion: { mediaId: number; progress: number } | null;
  candidates: CandidateSummary[];
  /** Carte de vérification déjà créée */
  created: boolean;
}

export interface CrImportPlan {
  builtAt: number;
  /** Services connectés au moment de l'analyse */
  services: TrackerId[];
  stats: HistoryStats;
  /** Saisons lues dans l'historique */
  seasonCount: number;
  items: CrPlanItem[];
  review: CrReviewItem[];
  excluded: number;
  /** Saisons dont la recherche a échoué */
  failed: number;
}

/** Fiche du catalogue AniList (titre, jaquette, nombre d'épisodes, équivalent MAL) */
export interface CrCatalogEntry {
  mediaId: number;
  idMal: number | null;
  title: string;
  coverUrl: string | null;
  episodes: number | null;
}

export interface PlanInput {
  seasons: readonly HistorySeason[];
  resolutions: Readonly<Record<string, SeasonResolution>>;
  catalog: ReadonlyMap<number, CrCatalogEntry>;
  /** Listes lues en bloc : AniList par mediaId, MAL par id MAL (services connectés seulement) */
  lists: Partial<Record<TrackerId, ReadonlyMap<number, CrListState>>>;
  services: readonly TrackerId[];
  /** Fiches exclues par l'utilisateur */
  excludedMediaIds: ReadonlySet<number>;
  stats: HistoryStats;
}

/**
 * Construit l'aperçu (pur, testé) : saisons sûres regroupées par fiche (progression maximale), état actuel
 * de chaque liste → nouvelle valeur selon decideImport ; saisons incertaines listées à part.
 */
export function buildCrImportPlan(input: PlanInput, now: number): CrImportPlan {
  const byMedia = new Map<number, { progress: number; seasons: string[]; mappings: { key: string; mapping: MediaMapping }[] }>();
  const review: CrReviewItem[] = [];
  const reviewByMedia = new Map<string, CrReviewItem>();
  let excluded = 0;
  let failed = 0;

  input.seasons.forEach((season, index) => {
    const resolution = input.resolutions[String(index)];
    if (!resolution) return;
    const label = historySeasonLabel(season);
    switch (resolution.kind) {
      case 'excluded':
        excluded++;
        return;
      case 'failed':
        failed++;
        return;
      case 'review': {
        const item: CrReviewItem = { key: resolution.key, label, seasons: [label], episode: toEpisodeInfo(season), reason: resolution.reason, suggestion: resolution.suggestion, candidates: resolution.candidates, created: false };
        // Numérotation absolue (One Piece E1180) : toutes les saisons mènent à la même fiche → une seule vérification,
        // celle de l'épisode le plus avancé
        const mergeKey = isAbsoluteSeason(season) && resolution.suggestion ? `${season.seriesId}:${resolution.suggestion.mediaId}` : null;
        const merged = mergeKey ? reviewByMedia.get(mergeKey) : undefined;
        if (merged) {
          const seasons = merged.seasons.includes(label) ? merged.seasons : [...merged.seasons, label];
          const replaced = (resolution.suggestion?.progress ?? 0) > (merged.suggestion?.progress ?? 0) ? { ...item, seasons } : { ...merged, seasons };
          review[review.indexOf(merged)] = replaced;
          if (mergeKey) reviewByMedia.set(mergeKey, replaced);
          return;
        }
        review.push(item);
        if (mergeKey) reviewByMedia.set(mergeKey, item);
        return;
      }
      case 'certain': {
        if (input.excludedMediaIds.has(resolution.mediaId)) {
          excluded++;
          return;
        }
        const group = byMedia.get(resolution.mediaId) ?? { progress: 0, seasons: [], mappings: [] };
        group.progress = Math.max(group.progress, resolution.progress);
        group.seasons.push(label);
        if (!group.mappings.some((m) => m.key === resolution.key)) group.mappings.push({ key: resolution.key, mapping: resolution.mapping });
        byMedia.set(resolution.mediaId, group);
        return;
      }
    }
  });

  const items: CrPlanItem[] = [];
  for (const [mediaId, group] of byMedia) {
    const catalog = input.catalog.get(mediaId);
    const malId = catalog?.idMal ?? null;
    const episodes = catalog?.episodes ?? null;
    const services = input.services.map((service): CrServicePlan => {
      const id = service === 'anilist' ? mediaId : malId;
      if (id === null) return { service, current: null, action: 'skip', reason: 'no-equivalent' };
      const current = input.lists[service]?.get(id) ?? null;
      const decision = decideImport(current, group.progress, episodes);
      return decision.action === 'update' ? { service, current, ...decision } : { service, current, action: 'skip', reason: decision.reason };
    });
    items.push({
      id: planItemId(mediaId),
      mediaId,
      malId,
      title: catalog?.title ?? group.seasons[0] ?? `#${mediaId}`,
      coverUrl: catalog?.coverUrl ?? null,
      episodes,
      progress: group.progress,
      seasons: group.seasons,
      services,
      mappings: group.mappings,
      result: null,
    });
  }
  items.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }) || a.mediaId - b.mediaId);
  // Une vérification par saison (même clé que la synchro en direct), regroupées par série dans l'aperçu
  const uniqueReview = review
    .filter((r, i) => review.findIndex((o) => o.key === r.key) === i)
    .sort((a, b) => a.episode.animeTitle.localeCompare(b.episode.animeTitle, undefined, { sensitivity: 'base' }) || (a.episode.seasonNumber ?? 0) - (b.episode.seasonNumber ?? 0));
  return { builtAt: now, services: [...input.services], stats: input.stats, seasonCount: input.seasons.length, items, review: uniqueReview, excluded, failed };
}

/** Élément qui modifierait au moins une liste (coché par défaut dans l'aperçu) */
export const hasUpdate = (item: CrPlanItem): boolean => item.services.some((s) => s.action === 'update');

/** Résultats d'éléments appliqués (identifiant → résultat), inscrits dans le plan en une fois ; `written` retiré */
export function withItemResults(plan: CrImportPlan, results: ReadonlyMap<string, CrItemResult>): CrImportPlan {
  if (results.size === 0) return plan;
  return {
    ...plan,
    items: plan.items.map((item) => {
      const result = results.get(item.id);
      if (result === undefined) return item;
      const { written: _written, ...rest } = item;
      return { ...rest, result };
    }),
  };
}

/** Résultat d'un élément appliqué, inscrit dans le plan */
export function withItemResult(plan: CrImportPlan, id: string, result: CrItemResult): CrImportPlan {
  return withItemResults(plan, new Map([[id, result]]));
}

/** Services déjà écrits d'un élément dont un autre service sera retenté */
export function withItemWritten(plan: CrImportPlan, id: string, written: readonly TrackerId[]): CrImportPlan {
  return { ...plan, items: plan.items.map((item) => (item.id === id ? { ...item, written: [...written] } : item)) };
}

export function withReviewsCreated(plan: CrImportPlan, keys: ReadonlySet<string>): CrImportPlan {
  return { ...plan, review: plan.review.map((r) => (keys.has(r.key) ? { ...r, created: true } : r)) };
}

// ─── Validation du plan relu du stockage ──────────────────────────────────

const isNullableString = (v: unknown): v is string | null => v === null || typeof v === 'string';
const isNullablePositive = (v: unknown): v is number | null => v === null || isPositiveInt(v);

function isListState(value: unknown): value is CrListState | null {
  return value === null || (isRecord(value) && isListStatus(value.status) && isCount(value.progress));
}

function isServicePlan(value: unknown): value is CrServicePlan {
  if (!isRecord(value) || !isTrackerId(value.service) || !isListState(value.current)) return false;
  if (value.action === 'update') return isPositiveInt(value.progress) && (value.status === 'CURRENT' || value.status === 'COMPLETED');
  return value.action === 'skip' && CR_SKIP_REASONS.some((r) => r === value.reason);
}

function isItemResult(value: unknown): value is CrItemResult | null {
  return value === null || (isRecord(value) && (value.outcome === 'updated' || value.outcome === 'skipped' || value.outcome === 'failed') && isNullableString(value.message));
}

function isPlanItem(value: unknown): value is CrPlanItem {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    isPositiveInt(value.mediaId) &&
    isNullablePositive(value.malId) &&
    typeof value.title === 'string' &&
    isNullableString(value.coverUrl) &&
    (value.episodes === null || isCount(value.episodes)) &&
    isPositiveInt(value.progress) &&
    Array.isArray(value.seasons) &&
    value.seasons.every((s) => typeof s === 'string') &&
    Array.isArray(value.services) &&
    value.services.every(isServicePlan) &&
    Array.isArray(value.mappings) &&
    value.mappings.every((m) => isRecord(m) && typeof m.key === 'string' && isMediaMapping(m.mapping)) &&
    isItemResult(value.result) &&
    (value.written === undefined || (Array.isArray(value.written) && value.written.every(isTrackerId)))
  );
}

function isReviewItem(value: unknown): value is CrReviewItem {
  return (
    isRecord(value) &&
    typeof value.key === 'string' &&
    typeof value.label === 'string' &&
    Array.isArray(value.seasons) &&
    value.seasons.every((s) => typeof s === 'string') &&
    isEpisodeInfo(value.episode) &&
    typeof value.reason === 'string' &&
    (value.suggestion === null || (isRecord(value.suggestion) && isPositiveInt(value.suggestion.mediaId) && isPositiveInt(value.suggestion.progress))) &&
    Array.isArray(value.candidates) &&
    value.candidates.every(isCandidateSummary) &&
    typeof value.created === 'boolean'
  );
}

export function isCrImportPlan(value: unknown): value is CrImportPlan {
  return (
    isRecord(value) &&
    typeof value.builtAt === 'number' &&
    Array.isArray(value.services) &&
    value.services.every(isTrackerId) &&
    isHistoryStats(value.stats) &&
    isCount(value.seasonCount) &&
    Array.isArray(value.items) &&
    value.items.every(isPlanItem) &&
    Array.isArray(value.review) &&
    value.review.every(isReviewItem) &&
    isCount(value.excluded) &&
    isCount(value.failed)
  );
}

// ─── Messages (page d'import → service worker) ────────────────────────────

export type CrImportErrorCode = 'NOT_CONNECTED' | 'BUSY' | 'NO_PLAN' | 'EMPTY' | 'API_ERROR';
export type CrImportJobResult = Result<CrImportJob, CrImportErrorCode>;
export type CrImportReviewsResult = Result<{ created: number; limited: boolean }, CrImportErrorCode>;

export interface CrImportAnalyzePayload {
  history: CrHistoryResult;
}
export interface CrImportApplyPayload {
  ids: string[];
}
export interface CrImportReviewsPayload {
  keys: string[];
}

/** Éléments au plus par application / vérifications créées en une fois */
export const MAX_APPLY_IDS = 2000;
export const MAX_REVIEW_KEYS = 200;

export const isCrImportAnalyzePayload = (p: unknown): p is CrImportAnalyzePayload => isRecord(p) && isCrHistoryResult(p.history);
export const isCrImportApplyPayload = (p: unknown): p is CrImportApplyPayload =>
  isRecord(p) && Array.isArray(p.ids) && p.ids.length > 0 && p.ids.length <= MAX_APPLY_IDS && p.ids.every((id) => typeof id === 'string' && /^m:\d{1,10}$/.test(id));
export const isCrImportReviewsPayload = (p: unknown): p is CrImportReviewsPayload =>
  isRecord(p) && Array.isArray(p.keys) && p.keys.length > 0 && p.keys.length <= MAX_REVIEW_KEYS && p.keys.every((k) => typeof k === 'string' && k.length > 0 && k.length <= 200);

// ─── Aperçu : sélection et compteurs ──────────────────────────────────────

/** Éléments cochés par défaut : au moins une liste avance, pas encore appliqués avec succès */
export function defaultSelection(plan: CrImportPlan): string[] {
  return plan.items.filter((item) => hasUpdate(item) && item.result?.outcome !== 'updated').map((item) => item.id);
}

export interface PlanCounts {
  /** Séries qui avanceraient sur au moins un service */
  toUpdate: number;
  /** Séries déjà à jour (ou intouchables : terminées, revisionnage, au-delà de la fiche) */
  upToDate: number;
  review: number;
  /** Vérifications pas encore créées */
  reviewPending: number;
}

export function planCounts(plan: CrImportPlan): PlanCounts {
  const toUpdate = plan.items.filter(hasUpdate).length;
  return {
    toUpdate,
    upToDate: plan.items.length - toUpdate,
    review: plan.review.length,
    reviewPending: plan.review.filter((r) => !r.created).length,
  };
}
