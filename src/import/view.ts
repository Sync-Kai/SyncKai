import { t, tp, type PluralKey } from '../i18n';
import { summarizeBackup, type BackupSummary, type ImportMode, type ParsedBackup } from '../shared/backup';

// Page Sauvegarde (maquettes Sauvegarde, SauvegardeEtats) : états de l'export et de l'import, contenu du fichier choisi,
// options de l'import. Sans DOM (testé) ; logique dans import.ts, rendu dans components/backup-app.tsx.

export type ExportState = 'idle' | 'exporting' | 'exported' | 'error';

export type ReadyState = {
  kind: 'ready';
  fileName: string;
  parsed: ParsedBackup;
  mode: ImportMode;
  includeSettings: boolean;
  /** Remplacement demandé : « Effacer et importer » à confirmer */
  confirming: boolean;
  applying: boolean;
  error: string | null;
};

export type ImportState = { kind: 'idle'; error: string | null } | { kind: 'reading' } | ReadyState | { kind: 'done' };

export interface BackupPageState {
  export: ExportState;
  import: ImportState;
}

const SUMMARY_LABELS: readonly { id: Exclude<keyof BackupSummary, 'settings'>; label: PluralKey }[] = [
  { id: 'mediaMappings', label: 'import.summary.mediaMappings' },
  { id: 'excludedSeries', label: 'import.summary.excludedSeries' },
  { id: 'recentSyncs', label: 'import.summary.recentSyncs' },
  { id: 'pendingReviews', label: 'import.summary.pendingReviews' },
  { id: 'pendingRatings', label: 'import.summary.pendingRatings' },
  { id: 'rewatchDeclined', label: 'import.summary.rewatchDeclined' },
];

export interface ContentRow {
  id: keyof BackupSummary;
  label: string;
  value: string;
  /** Réglages : `ok` inclus, `warn` absents */
  tone: 'ok' | 'warn' | null;
}

/** « Contenu du fichier » : réglages inclus ou absents, puis chaque section avec son nombre */
export function fileContents(parsed: ParsedBackup): ContentRow[] {
  const summary = summarizeBackup(parsed.backup);
  return [
    { id: 'settings', label: t('import.summary.settings'), value: summary.settings ? t('import.summary.included') : t('import.summary.missing'), tone: summary.settings ? 'ok' : 'warn' },
    ...SUMMARY_LABELS.map(({ id, label }): ContentRow => ({ id, label: tp(label, summary[id]), value: String(summary[id]), tone: null })),
  ];
}

const hasSettings = (state: ReadyState): boolean => state.parsed.backup.data.settings !== null;

/** Fichier lu : fusion (recommandée), réglages décochés */
export const readyState = (fileName: string, parsed: ParsedBackup): ReadyState => ({
  kind: 'ready',
  fileName,
  parsed,
  mode: 'merge',
  includeSettings: false,
  confirming: false,
  applying: false,
  error: null,
});

/** Mode choisi : réglages cochés en remplacement (s'ils sont dans le fichier), décochés en fusion ; confirmation annulée */
export const withMode = (state: ReadyState, mode: ImportMode): ReadyState => ({ ...state, mode, includeSettings: mode === 'replace' && hasSettings(state), confirming: false });

export const withIncludeSettings = (state: ReadyState, include: boolean): ReadyState => ({ ...state, includeSettings: include && hasSettings(state), confirming: false });

export const withConfirming = (state: ReadyState, confirming: boolean): ReadyState => ({ ...state, confirming });
