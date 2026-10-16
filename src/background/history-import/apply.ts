import { t } from '../../i18n';
import {
  CR_IMPORT_ALARM,
  CR_IMPORT_KEYS,
  decideImport,
  importPlatformOf,
  withItemResults,
  withItemWritten,
  type CrImportDecision,
  type CrImportJob,
  type CrImportPlan,
  type CrItemResult,
  type CrPlanItem,
  type PlanMapping,
} from '../../shared/cr-import';
import { createLogger } from '../../browser/logger';
import { saveLearned, saveMediaMappingsIfAbsent } from '../../browser/storage/mappings';
import { getOpenSessions } from '../../browser/storage/sessions';
import { withStorageLock } from '../../browser/storage/lock';
import { TRACKER_LABELS, type TrackerId } from '../../shared/tracker.types';
import { PLATFORMS } from '../../platforms/registry';
import { createJobLoop, waitReadSlot, waitWriteSlot, type StepResult, type TransientKind } from '../jobs/runner';
import { entryTargetId, runGuarded } from '../entry-commands';
import { getConnectedTrackers } from '../trackers';
import type { TrackerService } from '../ports/tracker';
import { createWriteBatch, type WriteBatch } from './batch-writer';
import { errorStep, itemEvent, jobStore, readPlan, stopStep, updatePlan } from './import-job';

// Import de l'historique, application : écrit les éléments choisis dans l'aperçu sur chaque service prévu.

const log = createLogger('cr-import');

interface ApplyMemory {
  /** Tâche d'application (startedAt) */
  jobId: number;
  plan: CrImportPlan | null;
  /** Résultats pas encore inscrits dans l'aperçu */
  results: WriteBatch<CrItemResult>;
  /** Correspondances sûres à mémoriser (si la saison n'en a pas encore, ou à la place de celle que l'analyse a contredite) */
  mappings: PlanMapping[];
}

let applyMemory: ApplyMemory | null = null;

function applyMemoryFor(job: CrImportJob): ApplyMemory {
  if (applyMemory?.jobId !== job.startedAt) applyMemory = { jobId: job.startedAt, plan: null, results: createWriteBatch(), mappings: [] };
  return applyMemory;
}

/**
 * Inscrit les résultats en attente dans l'aperçu relu sous verrou (cartes « À vérifier » créées entre-temps conservées),
 * s'il est toujours celui de la tâche, puis mémorise les correspondances apprises en une seule écriture.
 */
async function flushApply(memory: ApplyMemory): Promise<void> {
  const results = memory.results.take();
  const { mappings } = memory;
  memory.mappings = [];
  const builtAt = memory.plan?.builtAt;
  if (results.size > 0) {
    await withStorageLock(async () => {
      const plan = await readPlan();
      if (plan && plan.builtAt === builtAt) await chrome.storage.local.set({ [CR_IMPORT_KEYS.plan]: withItemResults(plan, results) });
    });
  }
  await saveItemMappings(mappings);
}

/** Correspondances d'éléments appliqués : ajoutées si la clé n'en a pas, ou à la place de celle que l'analyse a contredite */
async function saveItemMappings(mappings: readonly PlanMapping[]): Promise<void> {
  await saveMediaMappingsIfAbsent(mappings.filter((m) => m.replaces === undefined));
  // Correspondance apprise contredite par l'analyse (1-D10) : remplacée si elle n'a pas changé depuis, jamais un choix ;
  // la remplaçante est toujours apprise (resolveSeason)
  for (const { key, mapping, replaces } of mappings) if (replaces) await saveLearned(key, replaces, mapping);
}

/** Correspondances sûres de l'élément, avec le titre de la fiche (Réglages › Correspondances) */
const itemMappings = (item: CrPlanItem): PlanMapping[] => item.mappings.map((m) => ({ ...m, mapping: { ...m.mapping, mediaTitle: item.title } }));

// ─── Application ──────────────────────────────────────────────────────────

/** Élément abandonné : la session du service a été fermée (déconnexion, autre compte) depuis le début de l'élément */
export type ImportOnServiceResult = CrImportDecision | { action: 'session-closed' };

/**
 * Écrit l'élément sur UN service ; lève les erreurs d'API. Créneaux (espacement, budget AniList de fond) pris AVANT
 * la relecture : aucune attente ne sépare la lecture de l'écriture, et la fiche n'est jamais verrouillée pendant une
 * attente de quota. Relecture, décision et écriture sous le verrou de la fiche : une synchro en direct concurrente
 * (12/12 Terminé) n'est jamais remplacée par la valeur décidée sur l'état d'avant (11 En cours).
 * `epoch` : session du service au début de l'élément, revérifiée juste avant l'écriture (une attente de quota peut
 * durer : un autre compte connecté entre-temps ne reçoit jamais la valeur décidée sur la liste de l'ancien).
 */
export async function importOnService(
  tracker: TrackerService,
  targetId: number,
  item: Pick<CrPlanItem, 'progress' | 'episodes'>,
  epoch: number | undefined,
): Promise<ImportOnServiceResult> {
  await waitWriteSlot(tracker.id);
  await waitReadSlot(tracker.id);
  // Écriture gardée (entry-commands.ts) ; lecture fraîche : la liste a pu changer depuis l'aperçu (autre appareil,
  // synchro en direct). File de fond : places réservées ci-dessus, consommées sans attente (B9 : jamais le budget du
  // popup et du panneau)
  return runGuarded<ImportOnServiceResult>({ tracker, id: targetId }, {
    epoch,
    lane: 'background',
    sessionClosed: () => ({ action: 'session-closed' }),
    decide: (current, bound) => {
      const decision = decideImport(current.entry, item.progress, current.episodes ?? item.episodes);
      if (decision.action !== 'update') return { done: decision };
      return {
        write: async () => {
          await bound.saveProgress(targetId, decision.progress, decision.status, undefined, 'background');
          return decision;
        },
      };
    },
  });
}

/**
 * Nouvelle tentative de l'élément après un échec passager : les services déjà écrits sont inscrits dans l'aperçu (seul
 * le service en échec sera retenté, même après un réveil du service worker) et ses correspondances apprises (CRI-05).
 */
async function keepWritten(memory: ApplyMemory, item: CrPlanItem, written: ReadonlySet<TrackerId>): Promise<void> {
  if (written.size === (item.written?.length ?? 0)) return;
  const services = [...written];
  const builtAt = memory.plan?.builtAt;
  if (memory.plan) memory.plan = withItemWritten(memory.plan, item.id, services);
  await updatePlan((plan) => (plan.builtAt === builtAt ? withItemWritten(plan, item.id, services) : plan));
  await saveItemMappings(itemMappings(item));
}

/** Écrit UN élément du plan sur chaque service prévu (état relu juste avant : jamais de recul). Ne lève jamais. */
async function applyItem(job: CrImportJob, id: string, isLastAttempt: (reason: TransientKind) => boolean): Promise<StepResult> {
  // Sessions relevées AVANT l'aperçu : une déconnexion ensuite efface l'aperçu ou rend la session caduque (CRI-03)
  const epochs = await getOpenSessions();
  const memory = applyMemoryFor(job);
  // Aperçu lu une fois par tâche (relu après un réveil du service worker) ; seuls ses éléments servent ici
  memory.plan ??= await readPlan();
  const plan = memory.plan;
  if (!plan) return stopStep(t('crImport.error.noPlan'));
  const item = plan.items.find((i) => i.id === id);
  if (!item) return itemEvent('skipped');

  const trackers = await getConnectedTrackers();
  const outcomes: { service: TrackerId; result: 'updated' | 'skipped' | 'failed'; message: string | null }[] = [];
  /** Services écrits pour cet élément, y compris par un essai précédent */
  const written = new Set<TrackerId>(item.written ?? []);
  let fatal: string | null = null;
  for (const planned of item.services) {
    if (planned.action !== 'update') continue;
    if (written.has(planned.service)) {
      // Écrit par un essai précédent (l'autre service avait échoué) : compté, jamais relu ni réécrit
      outcomes.push({ service: planned.service, result: 'updated', message: null });
      continue;
    }
    const label = TRACKER_LABELS[planned.service];
    const tracker = trackers.find((tr) => tr.id === planned.service);
    const targetId = entryTargetId(planned.service, item);
    if (!tracker || targetId === null) {
      outcomes.push({ service: planned.service, result: 'skipped', message: t('crImport.skip.notConnected', { service: label }) });
      continue;
    }
    try {
      const decision = await importOnService(tracker, targetId, item, epochs[planned.service]);
      if (decision.action === 'session-closed') {
        // Compte déconnecté ou changé pendant l'élément : rien n'est écrit, et l'import s'arrête (aperçu de l'ancien compte)
        const message = t('crImport.skip.sessionClosed', { service: label });
        log.warn(message, item.title);
        outcomes.push({ service: planned.service, result: 'skipped', message });
        fatal = message;
        break;
      }
      if (decision.action === 'skip') {
        outcomes.push({ service: planned.service, result: 'skipped', message: t('common.serviceMessage', { service: label, message: t(`crImport.skipReason.${decision.reason}`) }) });
        continue;
      }
      log.info(`${label} : ${item.title} → épisode ${decision.progress} (${decision.status}, import ${PLATFORMS[importPlatformOf(plan)].label})`);
      outcomes.push({ service: planned.service, result: 'updated', message: null });
      written.add(planned.service);
    } catch (error: unknown) {
      const step = errorStep(error, planned.service, isLastAttempt);
      if ('retry' in step) {
        // Nouvelle tentative : seuls les services pas encore écrits (CRI-05)
        await keepWritten(memory, item, written);
        return step.retry;
      }
      log.warn(`${label} : échec de l’import de ${item.title} :`, step.message);
      outcomes.push({ service: planned.service, result: 'failed', message: t('common.serviceMessage', { service: label, message: step.message }) });
      if (step.fatal) {
        fatal = step.message;
        break;
      }
    }
  }

  const updated = outcomes.some((o) => o.result === 'updated');
  const failed = outcomes.find((o) => o.result === 'failed');
  const result: CrItemResult = {
    outcome: updated ? 'updated' : failed ? 'failed' : 'skipped',
    message: failed?.message ?? outcomes.find((o) => o.message !== null)?.message ?? null,
  };
  // Correspondances sûres mémorisées si la saison n'en a pas encore (la synchro en direct s'en sert)
  if (updated) memory.mappings.push(...itemMappings(item));
  memory.results.set(id, result);
  // Dernier élément ou arrêt : résultat publié tout de suite (bilan complet dans la page)
  if (job.cursor + 1 >= job.itemCount || fatal !== null || memory.results.full()) await flushApply(memory);
  return { kind: 'event', event: { type: 'item', outcome: result.outcome, ...(result.message ? { message: result.message } : {}), at: Date.now() }, stop: fatal };
}

const applyLoop = createJobLoop<CrImportJob>({
  label: 'import de l’historique',
  log,
  store: jobStore,
  alarm: CR_IMPORT_ALARM,
  accepts: (job) => job.kind === 'cr-apply',
  itemKey: (item) => item,
  process: (job, item, isLastAttempt) => applyItem(job, item, isLastAttempt),
  onEnd: async (job) => {
    log.info(`Import ${job.status} : ${job.updated} mises à jour, ${job.skipped} ignorées, ${job.failed} échecs`);
    // « Arrêter » : résultats encore en attente publiés
    if (applyMemory?.jobId === job.startedAt) {
      const memory = applyMemory;
      applyMemory = null;
      await flushApply(memory);
    }
  },
});

/** Nouvelle application : son aperçu gardé en mémoire (il vient d'être lu) ; null : mémoire oubliée (nouvelle analyse) */
export function startApplyMemory(job: CrImportJob | null, plan: CrImportPlan | null = null): void {
  applyMemory = job && { jobId: job.startedAt, plan, results: createWriteBatch(), mappings: [] };
}

/** Démarre la boucle d'application si aucune boucle vivante ne tourne dans ce service worker */
export function ensureApplyLoop(): void {
  applyLoop.ensure();
}
