import { t } from '../../i18n';
import {
  CR_IMPORT_KEYS,
  crImportJobFromLegacy,
  isCrImportInput,
  isCrImportJob,
  isCrImportPlan,
  isCrJobItem,
  type CrImportInput,
  type CrImportJob,
  type CrImportPlan,
} from '../../shared/cr-import';
import { createLogger } from '../../browser/logger';
import { withStorageLock } from '../../browser/storage/lock';
import type { TrackerId } from '../../shared/tracker.types';
import { ApiError } from '../errors';
import { createJobStore, isFatalError, transientKind, type StepResult, type TransientKind } from '../jobs/runner';

// Import de l'historique : stockage de la tâche, de l'historique et de l'aperçu, étapes communes à l'analyse
// (analyze.ts) et à l'application (apply.ts).

const log = createLogger('cr-import');

export const jobStore = createJobStore<CrImportJob>({ key: CR_IMPORT_KEYS.job, itemsKey: CR_IMPORT_KEYS.jobItems, isJob: isCrImportJob, isItem: isCrJobItem, fromLegacy: crImportJobFromLegacy });

// ─── Stockage ─────────────────────────────────────────────────────────────

export async function readKey(key: string): Promise<unknown> {
  return (await chrome.storage.local.get(key))[key];
}

export async function readInput(): Promise<CrImportInput | null> {
  const value = await readKey(CR_IMPORT_KEYS.input);
  return isCrImportInput(value) ? value : null;
}

export async function readPlan(): Promise<CrImportPlan | null> {
  const value = await readKey(CR_IMPORT_KEYS.plan);
  return isCrImportPlan(value) ? value : null;
}

export function updatePlan(update: (plan: CrImportPlan) => CrImportPlan): Promise<void> {
  return withStorageLock(async () => {
    const plan = await readPlan();
    if (plan) await chrome.storage.local.set({ [CR_IMPORT_KEYS.plan]: update(plan) });
  });
}

/**
 * Historique réduit et correspondances intermédiaires sans analyse en cours (arrêt, échec, déconnexion d'une version
 * précédente) : effacés, comme le promet PRIVACY.md (CRI-04). Tâche relue sous verrou : une nouvelle analyse lancée
 * entre-temps garde les siens. Sans lecture préalable des clés (jusqu'à quelques centaines de Ko).
 */
export function purgeOrphanImportData(): Promise<void> {
  return withStorageLock(async () => {
    const job = await jobStore.read();
    if (job?.kind === 'cr-analyze' && job.status === 'running') return;
    await chrome.storage.local.remove([CR_IMPORT_KEYS.input, CR_IMPORT_KEYS.resolutions]);
  });
}

// ─── Étapes de tâche ──────────────────────────────────────────────────────

export const itemEvent = (outcome: 'updated' | 'skipped' | 'failed', message?: string): StepResult => ({
  kind: 'event',
  event: { type: 'item', outcome, ...(message ? { message } : {}), at: Date.now() },
  stop: null,
});
export const stopStep = (message: string): StepResult => ({ kind: 'event', event: { type: 'stop', message, at: Date.now() }, stop: message });

/** Erreur → nouvelle tentative (passagère) ou message définitif */
export function errorStep(error: unknown, service: TrackerId | null, isLastAttempt: (reason: TransientKind) => boolean): { retry: StepResult } | { message: string; fatal: boolean } {
  const message = error instanceof ApiError ? error.message : t('error.unexpected');
  const transient = transientKind(error);
  if (transient !== null && !isLastAttempt(transient)) return { retry: { kind: 'retry', reason: transient, service, error: message } };
  if (!(error instanceof ApiError)) log.error('Erreur inattendue (import de l’historique) :', error);
  return { message, fatal: isFatalError(error) };
}
