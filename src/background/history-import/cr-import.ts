import { t } from '../../i18n';
import { refreshReviewBadge } from '../../browser/badge';
import {
  CR_IMPORT_ALARM,
  CR_IMPORT_KEYS,
  importPlatformOf,
  startAnalyzeJob,
  startApplyJob,
  withReviewsCreated,
  type CrImportAnalyzePayload,
  type CrImportApplyPayload,
  type CrImportErrorCode,
  type CrImportInput,
  type CrImportJob,
  type CrImportJobResult,
  type CrImportReviewsPayload,
  type CrImportReviewsResult,
} from '../../shared/cr-import';
import { reduceJob } from '../../shared/job';
import { createLogger } from '../../browser/logger';
import type { Result } from '../../shared/result';
import { getPendingReviews, MAX_PENDING_REVIEWS, savePendingReview } from '../../browser/storage/reviews';
import { PLATFORMS } from '../../platforms/registry';
import { ensureResumeAlarm, RESUME_ALARM_PERIOD_MIN, reserveJob } from '../jobs/runner';
import { getConnectedTrackers } from '../trackers';
import { ensureAnalyzeLoop, startAnalyzeMemory } from './analyze';
import { ensureApplyLoop, startApplyMemory } from './apply';
import { jobStore, purgeOrphanImportData, readPlan, updatePlan } from './import-job';

// Import de l'historique Crunchyroll, ADN ou Netflix : analyse (correspondance de chaque saison, sans rien écrire,
// analyze.ts) puis application des éléments choisis dans l'aperçu (apply.ts). Deux tâches reprenables
// (src/background/jobs/runner.ts), lancées par les messages de la page d'import ci-dessous.
// L'historique lui-même est lu par le script de contenu de l'onglet de la plateforme : aucun jeton de la plateforme ici.

const log = createLogger('cr-import');

function ensureLoop(job: CrImportJob | null): void {
  if (job?.kind === 'cr-analyze') ensureAnalyzeLoop();
  else if (job?.kind === 'cr-apply') ensureApplyLoop();
}

// ─── Messages de la page d'import ─────────────────────────────────────────

const failure = (code: CrImportErrorCode, key: Parameters<typeof t>[0], params?: Parameters<typeof t>[1]): { ok: false; code: CrImportErrorCode; message: string } => ({
  ok: false,
  code,
  message: t(key, params),
});

/** CR_IMPORT_ANALYZE : historique lu dans l'onglet Crunchyroll, ADN ou Netflix → tâche d'analyse en arrière-plan */
export async function startCrAnalyze({ history, platform = 'crunchyroll' }: CrImportAnalyzePayload): Promise<CrImportJobResult> {
  try {
    if ((await getConnectedTrackers()).length === 0) return failure('NOT_CONNECTED', 'crImport.error.notConnected');
    if (history.seasons.length === 0) return failure('EMPTY', 'crImport.error.empty', { platform: PLATFORMS[platform].label });
    const job = await reserveJob(jobStore, () => startAnalyzeJob(history.seasons.length, Date.now()));
    if (job === null) return failure('BUSY', 'crImport.error.busy');
    const input: CrImportInput = { ...history, createdAt: Date.now(), platform };
    await chrome.storage.local.set({ [CR_IMPORT_KEYS.input]: input, [CR_IMPORT_KEYS.resolutions]: {} });
    await chrome.storage.local.remove(CR_IMPORT_KEYS.plan);
    startAnalyzeMemory(job, input);
    startApplyMemory(null);
    await chrome.alarms.create(CR_IMPORT_ALARM, { periodInMinutes: RESUME_ALARM_PERIOD_MIN });
    log.info(`Analyse de l’historique ${PLATFORMS[platform].label} : ${history.seasons.length} saisons (${history.stats.items} éléments lus)`);
    ensureAnalyzeLoop();
    return { ok: true, data: job };
  } catch (error: unknown) {
    log.error('Erreur inattendue (analyse de l’historique) :', error);
    return failure('API_ERROR', 'crImport.error.unexpected');
  }
}

/** CR_IMPORT_APPLY : éléments cochés dans l'aperçu → tâche d'application en arrière-plan */
export async function startCrApply({ ids }: CrImportApplyPayload): Promise<CrImportJobResult> {
  try {
    if ((await getConnectedTrackers()).length === 0) return failure('NOT_CONNECTED', 'crImport.error.notConnected');
    const plan = await readPlan();
    if (!plan) return failure('NO_PLAN', 'crImport.error.noPlan');
    const known = new Set(plan.items.map((i) => i.id));
    const selected = [...new Set(ids)].filter((id) => known.has(id));
    if (selected.length === 0) return failure('EMPTY', 'crImport.error.nothingSelected');
    const job = await reserveJob(jobStore, () => startApplyJob(selected, Date.now()));
    if (job === null) return failure('BUSY', 'crImport.error.busy');
    startApplyMemory(job, plan);
    await chrome.alarms.create(CR_IMPORT_ALARM, { periodInMinutes: RESUME_ALARM_PERIOD_MIN });
    log.info(`Import ${PLATFORMS[importPlatformOf(plan)].label} : ${selected.length} séries`);
    ensureApplyLoop();
    return { ok: true, data: job };
  } catch (error: unknown) {
    log.error('Erreur inattendue (import) :', error);
    return failure('API_ERROR', 'crImport.error.unexpected');
  }
}

/** CR_IMPORT_CANCEL : « Arrêter » ; l'élément en cours se termine */
export async function cancelCrImport(): Promise<Result<null, 'NOT_FOUND'>> {
  const job = await jobStore.update((j) => j && reduceJob(j, { type: 'cancel', at: Date.now() }));
  if (!job || job.status !== 'running') return { ok: false, code: 'NOT_FOUND', message: t('crImport.error.noJob') };
  // Service worker redémarré : la boucle relancée constate l'arrêt et clôt la tâche
  ensureLoop(job);
  return { ok: true, data: null };
}

/**
 * CR_IMPORT_REVIEWS : crée les cartes « À vérifier » (même flux que la synchro en direct) des saisons choisies.
 * Dans la limite des places libres (MAX_PENDING_REVIEWS) : les vérifications existantes ne sont jamais évincées, et une
 * correction en attente (« Corriger ») pour la même saison n'est jamais remplacée (voir savePendingReview).
 */
export async function createCrReviews({ keys }: CrImportReviewsPayload): Promise<CrImportReviewsResult> {
  try {
    const plan = await readPlan();
    if (!plan) return failure('NO_PLAN', 'crImport.error.noPlan');
    const wanted = new Set(keys);
    const pending = await getPendingReviews();
    const pendingKeys = new Set(pending.map((r) => r.key));
    const items = plan.review.filter((r) => wanted.has(r.key) && !r.created);
    // Carte existante pour la même saison : remplacée (aucune place consommée)
    let free = MAX_PENDING_REVIEWS - pending.length;
    const created = new Set<string>();
    const now = Date.now();
    for (const [i, item] of items.entries()) {
      if (!pendingKeys.has(item.key)) {
        if (free <= 0) continue;
        free--;
      }
      const saved = await savePendingReview({ key: item.key, episode: item.episode, reason: item.reason, suggestion: item.suggestion, candidates: item.candidates, previous: null, createdAt: now - i });
      if (saved) created.add(item.key);
    }
    if (created.size > 0) {
      await updatePlan((p) => withReviewsCreated(p, created));
      await refreshReviewBadge();
    }
    return { ok: true, data: { created: created.size, limited: created.size < items.length } };
  } catch (error: unknown) {
    log.error('Erreur inattendue (vérifications de l’import) :', error);
    return failure('API_ERROR', 'crImport.error.unexpected');
  }
}

/**
 * Alarme de reprise, démarrage du navigateur et mise à jour de l'extension : relance la tâche interrompue (alarme
 * recréée si elle a disparu), sinon retire l'alarme. Hors analyse en cours, l'historique réduit laissé par un arrêt,
 * un échec ou une version précédente est effacé (CRI-04).
 */
export async function resumeCrImport(): Promise<void> {
  const job = await jobStore.read();
  if (job?.status === 'running') {
    await ensureResumeAlarm(CR_IMPORT_ALARM);
    ensureLoop(job);
  } else {
    await chrome.alarms.clear(CR_IMPORT_ALARM);
  }
  if (job?.kind !== 'cr-analyze' || job.status !== 'running') await purgeOrphanImportData();
}
