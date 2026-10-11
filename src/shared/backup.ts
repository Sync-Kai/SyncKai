import { t } from '../i18n';
import { isPendingRating, MAX_PENDING_RATINGS } from './engagement-store';
import { PENDING_RATINGS_KEY, REWATCH_DECLINED_KEY, STORAGE_KEYS } from './storage-keys';
import type { PendingRating } from './engagement.types';
import { EXCLUDED_SERIES_KEY, isExcludedSeries, mergeExclusion, type ExcludedSeries } from './exclusions';
import { isRecord } from './guards';
import type { Result } from './result';
import { isPendingReview, isRecentSync, type PendingReview, type RecentSync } from './review.types';
import type { SessionEpochs } from './session-epochs';
import { normalizeSettings, SETTINGS_STORAGE_KEY, type SyncSettings } from './settings';
import { MAX_PENDING_REVIEWS, MAX_RECENT_SYNCS } from './storage';
import { isImportableMapping, isMediaMapping, type MediaMapping } from './sync.types';

// Sauvegarde exportable / importable (module pur, testable). Ne contient JAMAIS les tokens,
// profils, caches, file de relance ni préférences d'affichage du popup.

export const BACKUP_FORMAT = 'synckai-backup';
export const BACKUP_VERSION = 1;
/** Taille maximale d'un fichier importé (octets) */
export const BACKUP_MAX_BYTES = 5 * 1024 * 1024;

export interface BackupData {
  /** null : réglages absents ou illisibles dans le fichier importé */
  settings: SyncSettings | null;
  mediaMappings: Record<string, MediaMapping>;
  pendingReviews: PendingReview[];
  recentSyncs: RecentSync[];
  excludedSeries: ExcludedSeries[];
  pendingRatings: PendingRating[];
  /** id (`anilist:…` / `mal:…`) → horodatage du refus */
  rewatchDeclined: Record<string, number>;
}

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  /** Date ISO 8601 */
  exportedAt: string;
  appVersion: string;
  data: BackupData;
}

export type BackupSection = keyof BackupData;

/** Section → clé chrome.storage.local (les 7 seules clés sauvegardées) */
export const BACKUP_STORAGE_KEYS: Record<BackupSection, string> = {
  settings: SETTINGS_STORAGE_KEY,
  mediaMappings: STORAGE_KEYS.mediaMappings,
  pendingReviews: STORAGE_KEYS.pendingReviews,
  recentSyncs: STORAGE_KEYS.recentSyncs,
  excludedSeries: EXCLUDED_SERIES_KEY,
  pendingRatings: PENDING_RATINGS_KEY,
  rewatchDeclined: REWATCH_DECLINED_KEY,
};

export type BackupErrorCode = 'INVALID_JSON' | 'INVALID_FORMAT' | 'UNSUPPORTED_VERSION' | 'TOO_LARGE';

export interface ParsedBackup {
  backup: Backup;
  /** Éléments invalides ignorés pendant la validation */
  invalidCount: number;
}

export interface BackupSummary {
  settings: boolean;
  mediaMappings: number;
  pendingReviews: number;
  recentSyncs: number;
  excludedSeries: number;
  pendingRatings: number;
  rewatchDeclined: number;
}

export type ImportMode = 'merge' | 'replace';

// ─── Validation ───────────────────────────────────────────────────────────

interface Validated<T> {
  value: T;
  invalid: number;
}

/** Tableau : éléments invalides et doublons de clé ignorés (le premier l'emporte). Section absente = vide. */
function validateList<T>(raw: unknown, guard: (v: unknown) => v is T, key: (item: T) => string): Validated<T[]> {
  if (raw === undefined) return { value: [], invalid: 0 };
  if (!Array.isArray(raw)) return { value: [], invalid: 1 };
  const seen = new Set<string>();
  const value: T[] = [];
  let invalid = 0;
  for (const item of raw) {
    if (!guard(item)) {
      invalid++;
      continue;
    }
    if (seen.has(key(item))) continue;
    seen.add(key(item));
    value.push(item);
  }
  return { value, invalid };
}

/** Dictionnaire : entrées invalides (valeur ou clé) ignorées. Section absente = vide. */
function validateRecord<T>(raw: unknown, guard: (v: unknown, key: string) => v is T): Validated<Record<string, T>> {
  if (raw === undefined) return { value: {}, invalid: 0 };
  if (!isRecord(raw) || Array.isArray(raw)) return { value: {}, invalid: 1 };
  const value: Record<string, T> = {};
  let invalid = 0;
  for (const [k, v] of Object.entries(raw)) {
    // defineProperty : une clé "__proto__" reste une simple donnée
    if (guard(v, k)) Object.defineProperty(value, k, { value: v, enumerable: true, writable: true, configurable: true });
    else invalid++;
  }
  return { value, invalid };
}

const isTimestamp = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Plus récents d'abord, bornés aux maximums de l'application */
function sortDesc<T>(list: T[], at: (item: T) => number, max: number): T[] {
  return [...list].sort((a, b) => at(b) - at(a)).slice(0, max);
}

/**
 * Valide les 7 sections (valeurs brutes du stockage ou du fichier) et compte les éléments ignorés. `fromFile` : fichier
 * importé, non fiable (réglages absents non importables, correspondances au format de clé attendu et décalage borné).
 */
function validateData(raw: Record<string, unknown>, fromFile: boolean): Validated<BackupData> {
  const rawSettings = raw.settings;
  const settingsValid = isRecord(rawSettings) && !Array.isArray(rawSettings);
  const mappings = validateRecord(raw.mediaMappings, (v, key): v is MediaMapping => (fromFile ? isImportableMapping(key, v) : isMediaMapping(v)));
  const reviews = validateList(raw.pendingReviews, isPendingReview, (r) => r.key);
  const syncs = validateList(raw.recentSyncs, isRecentSync, (s) => s.key);
  const exclusions = validateList(raw.excludedSeries, isExcludedSeries, (e) => e.id);
  const ratings = validateList(raw.pendingRatings, isPendingRating, (r) => r.id);
  const declines = validateRecord(raw.rewatchDeclined, isTimestamp);

  return {
    value: {
      // Stockage : réglages absents = valeurs par défaut ; fichier : absents = non importables
      settings: settingsValid || !fromFile ? normalizeSettings(rawSettings) : null,
      mediaMappings: mappings.value,
      pendingReviews: sortDesc(reviews.value, (r) => r.createdAt, MAX_PENDING_REVIEWS),
      recentSyncs: sortDesc(syncs.value, (s) => s.syncedAt, MAX_RECENT_SYNCS),
      excludedSeries: exclusions.value,
      pendingRatings: sortDesc(ratings.value, (r) => r.completedAt, MAX_PENDING_RATINGS),
      rewatchDeclined: declines.value,
    },
    invalid:
      (rawSettings !== undefined && !settingsValid ? 1 : 0) +
      mappings.invalid +
      reviews.invalid +
      syncs.invalid +
      exclusions.invalid +
      ratings.invalid +
      declines.invalid,
  };
}

// ─── API ──────────────────────────────────────────────────────────────────

/** Construit une sauvegarde à partir des valeurs brutes du stockage (indexées par section). */
export function buildBackup(raw: Record<string, unknown>, appVersion: string, now: Date): Backup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    appVersion,
    data: validateData(raw, false).value,
  };
}

/** Lit les valeurs du stockage (indexées par clé de stockage) sous forme de sections. */
export function sectionsFromStorage(stored: Record<string, unknown>): Record<BackupSection, unknown> {
  const k = BACKUP_STORAGE_KEYS;
  return {
    settings: stored[k.settings],
    mediaMappings: stored[k.mediaMappings],
    pendingReviews: stored[k.pendingReviews],
    recentSyncs: stored[k.recentSyncs],
    excludedSeries: stored[k.excludedSeries],
    pendingRatings: stored[k.pendingRatings],
    rewatchDeclined: stored[k.rewatchDeclined],
  };
}

/** Correspondances marquées « à revérifier » (Object.fromEntries : une clé "__proto__" reste une simple donnée) */
function markUnverified(mappings: Record<string, MediaMapping>): Record<string, MediaMapping> {
  return Object.fromEntries(Object.entries(mappings).map(([key, mapping]) => [key, { ...mapping, unverified: true as const }]));
}

function fail(code: BackupErrorCode, message: string): Result<ParsedBackup, BackupErrorCode> {
  return { ok: false, code, message };
}

/** Analyse un fichier de sauvegarde sans faire confiance à son contenu. */
export function parseBackup(text: string): Result<ParsedBackup, BackupErrorCode> {
  if (new TextEncoder().encode(text).length > BACKUP_MAX_BYTES) return fail('TOO_LARGE', t('backup.error.tooLarge'));

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return fail('INVALID_JSON', t('backup.error.invalidJson'));
  }

  if (!isRecord(json) || json.format !== BACKUP_FORMAT) return fail('INVALID_FORMAT', t('backup.error.notBackup'));
  if (json.version !== BACKUP_VERSION) return fail('UNSUPPORTED_VERSION', t('backup.error.version'));
  if (
    typeof json.exportedAt !== 'string' ||
    Number.isNaN(Date.parse(json.exportedAt)) ||
    typeof json.appVersion !== 'string' ||
    json.appVersion.length > 50 ||
    !isRecord(json.data) ||
    Array.isArray(json.data)
  ) {
    return fail('INVALID_FORMAT', t('backup.error.corrupted'));
  }

  const validated = validateData(json.data, true);
  const { invalid } = validated;
  // Une correction (« Corriger ») ne vaut que dans la session qui a écrit la valeur : importée (autre date, autre
  // compte peut-être), elle redevient une vérification simple, qui ne fait jamais reculer la progression.
  // Correspondances importées : revérifiées sur le catalogue AniList à leur premier usage (BAK-02, voir resolver.ts)
  const value: BackupData = {
    ...validated.value,
    mediaMappings: markUnverified(validated.value.mediaMappings),
    pendingReviews: validated.value.pendingReviews.map((r) => ({ ...r, previous: null })),
  };
  return {
    ok: true,
    data: {
      backup: { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: json.exportedAt, appVersion: json.appVersion, data: value },
      invalidCount: invalid,
    },
  };
}

/** Nombre d'éléments par section (aperçu avant import). */
export function summarizeBackup(backup: Backup): BackupSummary {
  const { data } = backup;
  return {
    settings: data.settings !== null,
    mediaMappings: Object.keys(data.mediaMappings).length,
    pendingReviews: data.pendingReviews.length,
    recentSyncs: data.recentSyncs.length,
    excludedSeries: data.excludedSeries.length,
    pendingRatings: data.pendingRatings.length,
    rewatchDeclined: Object.keys(data.rewatchDeclined).length,
  };
}

/**
 * Données importées rattachées aux sessions ouvertes (`epochs`) : celles du fichier viennent d'une autre installation
 * ou d'une autre date (générations sans rapport). Les notes et synchros importées valent pour les comptes connectés,
 * qui reçoivent l'import ; une vérification importée est toujours simple (sans session).
 */
export function bindBackupToSession(data: BackupData, epochs: SessionEpochs): BackupData {
  return {
    ...data,
    pendingReviews: data.pendingReviews.map(({ epochs: _ignored, ...review }) => review),
    recentSyncs: data.recentSyncs.map((sync) => ({ ...sync, epochs })),
    pendingRatings: data.pendingRatings.map((rating) => ({ ...rating, epochs })),
  };
}

/** Ajoute les éléments entrants dont la clé est inconnue (l'existant l'emporte). */
function mergeByKey<T>(current: readonly T[], incoming: readonly T[], key: (item: T) => string): T[] {
  const known = new Set(current.map(key));
  return [...current, ...incoming.filter((item) => !known.has(key(item)))];
}

/**
 * Combine les données actuelles et importées.
 * - replace : les données importées remplacent tout
 * - merge   : ajout sans écrasement (l'existant l'emporte en cas de conflit)
 * Les réglages ne sont repris que si `includeSettings` (et présents dans la sauvegarde).
 */
export function mergeBackup(current: BackupData, incoming: BackupData, mode: ImportMode, includeSettings = false): BackupData {
  const settings = includeSettings && incoming.settings !== null ? incoming.settings : current.settings;
  if (mode === 'replace') return { ...incoming, settings };

  // Exclusions : même id ignoré ; sinon mergeExclusion complète une entrée qui partage une clé
  let excludedSeries = [...current.excludedSeries];
  for (const entry of incoming.excludedSeries) {
    if (excludedSeries.some((e) => e.id === entry.id)) continue;
    excludedSeries = mergeExclusion(excludedSeries, entry, entry.excludedAt);
  }

  const rewatchDeclined: Record<string, number> = { ...current.rewatchDeclined };
  for (const [id, ts] of Object.entries(incoming.rewatchDeclined)) {
    const existing = Object.hasOwn(rewatchDeclined, id) ? rewatchDeclined[id] : undefined;
    rewatchDeclined[id] = existing === undefined ? ts : Math.max(existing, ts);
  }

  return {
    settings,
    mediaMappings: { ...incoming.mediaMappings, ...current.mediaMappings },
    pendingReviews: sortDesc(mergeByKey(current.pendingReviews, incoming.pendingReviews, (r) => r.key), (r) => r.createdAt, MAX_PENDING_REVIEWS),
    recentSyncs: sortDesc(mergeByKey(current.recentSyncs, incoming.recentSyncs, (s) => s.key), (s) => s.syncedAt, MAX_RECENT_SYNCS),
    excludedSeries,
    pendingRatings: sortDesc(mergeByKey(current.pendingRatings, incoming.pendingRatings, (r) => r.id), (r) => r.completedAt, MAX_PENDING_RATINGS),
    rewatchDeclined,
  };
}

/** "synckai-sauvegarde-2026-10-01.json" (date locale) */
export function backupFileName(now: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `synckai-sauvegarde-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}
