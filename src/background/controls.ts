import { t } from '../i18n';
import { COMPLETE_EPISODE_COMMAND } from '../protocol/commands';
import type { ContentMessage } from '../protocol/content-messages';
import type { AddToListPayload, AdjustProgressPayload, AdjustRetryTarget, SetListStatusPayload } from '../protocol/messages';
import type { MediaRef } from '../shared/engagement.types';
import { getSettings } from '../browser/storage/settings-access';
import { getOpenSessions } from '../browser/storage/sessions';
import type { AddListStatus, ListStatusChange, ServiceResult, SyncOutcome } from '../shared/sync.types';
import { TRACKER_LABELS } from '../shared/tracker.types';
import { ApiError } from './errors';
import { deferRating } from './engagement';
import { entryTargets, runOnServices, type EntryCommand, type ServiceRun } from './entry-commands';
import { decideAddToList, decideStatusChange, progressWrite, type ListEntryState, type WriteStatus } from './sync/rules';
import { getCatalogMedia } from './sync/sync-service';
import { getConnectedTrackers } from './trackers';
import type { CatalogMedia } from './ports/tracker';
import { createLogger } from '../browser/logger';
import { trace } from '../browser/debug-trace-client';
import { decisionTraceData, entryTraceData } from '../shared/debug-trace';

// Contrôles manuels (service worker) : +1 / −1 depuis le popup et raccourci « valider l'épisode ».

const log = createLogger('controls');

export type AdjustDecision =
  /** `repeat` : nouveau compteur de revisionnages (revisionnage terminé par ce +1) */
  | { action: 'write'; progress: number; status: WriteStatus; repeat?: number }
  /** Déjà à la progression visée (nouvel essai : écriture passée malgré l'erreur, ou synchro entre-temps) */
  | { action: 'up-to-date'; progress: number }
  | { action: 'skip'; reason: string; notInList?: true };

/** Série absente de la liste de ce service : +1 / −1 ne l'y ajoute jamais (boutons « Ajouter » réservés à ça) */
const notInList = (): AdjustDecision => ({ action: 'skip', reason: t('engagement.notInList'), notInList: true });

/**
 * Nouvelle progression après un ajustement manuel (pur, testable).
 * −1 contourne volontairement « jamais de recul » ; +1 au-delà du total est refusé.
 * Statut et compteur de revisionnages : mêmes règles que la synchro (progressWrite).
 */
export function decideAdjustment(entry: ListEntryState | null, total: number | null, delta: 1 | -1): AdjustDecision {
  if (entry === null) return notInList();
  const current = entry.progress;
  if (delta === -1 && current <= 0) return { action: 'skip', reason: t('controls.nothingToRemove') };
  if (delta === 1 && total !== null && current >= total) return { action: 'skip', reason: t('controls.alreadyLast') };
  const progress = Math.max(0, current + delta);
  // Revisionnage : il continue, et le dernier épisode le termine (compteur + 1) ; −1 sur une entrée terminée la repasse « en cours »
  return { action: 'write', progress, ...progressWrite(entry, progress, total) };
}

/**
 * Nouvel essai d'un +1 / −1 en échec partiel (pur, testable) : progression ABSOLUE `target` (celle du service
 * qui a réussi), sans jamais aller au-delà dans le sens de l'ajustement (+1 ne recule pas, −1 n'avance pas).
 */
export function decideRetryAdjustment(entry: ListEntryState | null, total: number | null, delta: 1 | -1, target: number): AdjustDecision {
  if (entry === null) return notInList();
  if (total !== null && target > total) return { action: 'skip', reason: t('controls.alreadyLast') };
  if (delta === 1 ? entry.progress >= target : entry.progress <= target) return { action: 'up-to-date', progress: entry.progress };
  return { action: 'write', progress: target, ...progressWrite(entry, target, total) };
}

/**
 * Ajustement d'UN service : delta relatif, ou progression absolue `retry` (nouvel essai). La progression de référence
 * est celle de CE service (relue sous le verrou de sa fiche).
 */
function adjustCommand(fallbackTotal: number | null, delta: 1 | -1, retry: AdjustRetryTarget | null): EntryCommand {
  return {
    name: 'ajustement',
    decide: (current, { tracker, id }) => {
      const total = current.episodes ?? fallbackTotal;
      const decision = retry ? decideRetryAdjustment(current.entry, total, delta, retry.progress) : decideAdjustment(current.entry, total, delta);
      if (__SYNCKAI_DEBUG__) trace('ui', 'adjust-decision', { service: tracker.id, id, delta, retry: retry !== null, before: entryTraceData(current.entry), total, ...decisionTraceData(decision) });
      if (decision.action === 'skip') return { status: 'skipped', reason: decision.reason, ...(decision.notInList ? { code: 'not-in-list' as const } : {}) };
      if (decision.action === 'up-to-date') return { status: 'up-to-date', progress: decision.progress };
      return async () => {
        const saved = await tracker.saveProgress(id, decision.progress, decision.status, decision.repeat);
        log.info(`${TRACKER_LABELS[tracker.id]} : ${current.title} → épisode ${saved.progress} (${saved.status}, ${retry ? 'nouvel essai' : `ajustement ${delta > 0 ? '+1' : '−1'}`})`);
        return { status: 'updated', progress: saved.progress, completed: saved.status === 'COMPLETED' };
      };
    },
  };
}

/** Titre de la série : catalogue, sinon le premier titre lu sur un service, sinon le titre de secours */
function seriesTitle(catalog: CatalogMedia | null, runs: readonly ServiceRun[]): string {
  return catalog?.title ?? runs.find((r) => r.title !== null)?.title ?? t('sync.seriesFallback');
}

/**
 * +1 / −1 manuel : écrit sur tous les services connectés où la série est dans la liste.
 * `retry` (après un échec partiel) : la progression absolue est écrite sur les seuls services indiqués.
 * N'alimente pas les « dernières synchros » (action manuelle, le popup affiche le résultat).
 */
export async function adjustProgress(payload: AdjustProgressPayload): Promise<SyncOutcome> {
  try {
    const retry = payload.retry ?? null;
    // Sessions relevées avant toute requête : rien n'est écrit sur un compte connecté entre-temps
    const epochs = await getOpenSessions();
    const trackers = await getConnectedTrackers(retry?.services ?? null);
    if (trackers.length === 0) return { status: 'not-connected' };

    const catalog: CatalogMedia | null = payload.mediaId !== null ? await getCatalogMedia(payload.mediaId) : null;
    const targets = entryTargets(trackers, payload, catalog);
    if (targets.length === 0) return { status: 'error', message: t('sync.noServiceFollows') };

    const adjusted = await runOnServices(targets, adjustCommand(catalog?.episodes ?? null, payload.delta, retry), epochs);
    return { status: 'synced', mediaTitle: seriesTitle(catalog, adjusted), results: adjusted.map((a) => a.result) };
  } catch (error: unknown) {
    if (error instanceof ApiError) return { status: 'error', message: error.message, code: error.code };
    log.error('Erreur inattendue :', error);
    return { status: 'error', message: t('error.unexpectedAdjust') };
  }
}

// ─── Statut (En pause, Abandonné, Terminé) ───────────────────────────────

/** Changement de statut sur UN service (entrée relue, puis règle decideStatusChange) */
function statusCommand(fallbackTotal: number | null, status: ListStatusChange): EntryCommand {
  return {
    name: 'changement de statut',
    decide: (current, { tracker, id }) => {
      const decision = decideStatusChange(current.entry, current.episodes ?? fallbackTotal, status);
      if (decision.action === 'skip') {
        return decision.reason === 'not-in-list'
          ? { status: 'skipped', reason: t('engagement.notInList'), code: 'not-in-list' }
          : { status: 'up-to-date', progress: current.entry?.progress ?? 0 };
      }
      return async () => {
        const saved = await tracker.saveStatus(id, decision.status, decision.progress, decision.repeat);
        log.info(`${TRACKER_LABELS[tracker.id]} : ${current.title} → ${saved.status}, épisode ${saved.progress}`);
        return { status: 'updated', progress: saved.progress, completed: saved.status === 'COMPLETED' };
      };
    },
  };
}

/** Écriture de statut vue par la règle de la carte « À noter » */
export interface StatusWrite {
  result: ServiceResult;
  /** L'entrée de ce service porte déjà une note */
  scored: boolean;
  /** L'entrée était en revisionnage : sa fin ne demande pas de note (comme la synchro, shouldPromptRating) */
  wasRepeating?: boolean;
}

function statusWrite({ result, entry }: ServiceRun): StatusWrite {
  return { result, scored: entry?.score !== undefined, wasRepeating: entry?.status === 'REPEATING' };
}

/**
 * Carte « À noter » après « Terminé » (pur, testable) : la série vient de passer en Terminé sur au moins un service,
 * aucun service n'a déjà de note ni n'était en revisionnage, et la proposition de note est activée dans les réglages.
 */
export function shouldQueueRating(status: ListStatusChange, writes: readonly StatusWrite[], ratingPrompt: boolean): boolean {
  if (status !== 'COMPLETED' || !ratingPrompt || writes.some((w) => w.scored || w.wasRepeating === true)) return false;
  return writes.some(({ result }) => result.outcome.status === 'updated' && result.outcome.completed);
}

/** Réglage « Proposer de noter en fin de série » ; illisible → pas de carte (facultative) */
async function isRatingPromptEnabled(): Promise<boolean> {
  try {
    return (await getSettings()).ratingPrompt;
  } catch (error: unknown) {
    log.warn('Réglages illisibles, pas de carte « À noter » :', error);
    return false;
  }
}

/**
 * En pause / Abandonné / Terminé depuis le popup : écrit sur tous les services connectés où la série
 * est dans la liste. N'alimente pas les « dernières synchros » (action manuelle, comme +1 / −1).
 * Après « Terminé », la carte « À noter » est créée (comme « Plus tard ») ; `prompts.rate` le signale au popup.
 */
export async function setListStatus(payload: SetListStatusPayload): Promise<SyncOutcome> {
  try {
    const epochs = await getOpenSessions();
    const trackers = await getConnectedTrackers();
    if (trackers.length === 0) return { status: 'not-connected' };

    const catalog: CatalogMedia | null = payload.mediaId !== null ? await getCatalogMedia(payload.mediaId) : null;
    const targets = entryTargets(trackers, payload, catalog);
    if (targets.length === 0) return { status: 'error', message: t('sync.noServiceFollows') };

    const runs = await runOnServices(targets, statusCommand(catalog?.episodes ?? null, payload.status), epochs);
    const mediaTitle = seriesTitle(catalog, runs);
    const outcome: SyncOutcome = { status: 'synced', mediaTitle, results: runs.map((r) => r.result) };

    if (shouldQueueRating(payload.status, runs.map(statusWrite), await isRatingPromptEnabled())) {
      const media: MediaRef = { mediaId: catalog?.mediaId ?? payload.mediaId, malId: catalog?.idMal ?? payload.malId, title: mediaTitle.slice(0, 300) };
      const queued = await deferRating(media, payload.coverUrl);
      if (queued.ok) outcome.prompts = { rate: media };
    }
    return outcome;
  } catch (error: unknown) {
    if (error instanceof ApiError) return { status: 'error', message: error.message, code: error.code };
    log.error('Erreur inattendue :', error);
    return { status: 'error', message: t('error.unexpectedStatus') };
  }
}

// ─── Ajout à la liste (fiche « Sur cette page ») ──────────────────────────

/** Ajout de la série sur UN service si elle n'y est pas (une synchro concurrente n'est jamais écrasée par l'ajout) */
function addCommand(status: AddListStatus): EntryCommand {
  return {
    name: 'ajout à la liste',
    decide: (current, { tracker, id }) => {
      const decision = decideAddToList(current.entry, status);
      if (decision.action === 'skip') return { status: 'skipped', reason: t('page.alreadyInList') };
      return async () => {
        const saved = await tracker.saveStatus(id, decision.status, decision.progress);
        log.info(`${TRACKER_LABELS[tracker.id]} : ${current.title} ajouté (${saved.status})`);
        return { status: 'updated', progress: saved.progress, completed: false };
      };
    },
  };
}

/**
 * « Ajouter à À regarder / En cours » depuis la fiche de la page : écrit sur chaque service connecté
 * où la fiche existe et où la série n'est pas déjà dans la liste (une entrée existante n'est jamais modifiée).
 */
export async function addToList(payload: AddToListPayload): Promise<SyncOutcome> {
  try {
    const epochs = await getOpenSessions();
    const trackers = await getConnectedTrackers();
    if (trackers.length === 0) return { status: 'not-connected' };

    const catalog = await getCatalogMedia(payload.mediaId);
    // idMal du catalogue prioritaire ; celui du popup en secours (même fiche, lu juste avant)
    const targets = entryTargets(trackers, payload, catalog);
    if (targets.length === 0) return { status: 'error', message: t('sync.noServiceFollows') };

    const added = await runOnServices(targets, addCommand(payload.status), epochs);
    // Service sans équivalent (ex : pas d'idMal) : signalé plutôt qu'omis
    const missing: ServiceResult[] = trackers
      .filter((tracker) => !targets.some((target) => target.tracker.id === tracker.id))
      .map((tracker) => ({ service: tracker.id, outcome: { status: 'skipped', reason: t('sync.noEquivalent') } }));
    return { status: 'synced', mediaTitle: catalog.title, results: [...added.map((a) => a.result), ...missing] };
  } catch (error: unknown) {
    if (error instanceof ApiError) return { status: 'error', message: error.message, code: error.code };
    log.error('Erreur inattendue :', error);
    return { status: 'error', message: t('error.unexpectedAdd') };
  }
}

/** Onglet hors Crunchyroll/ADN : aucun content script pour répondre */
function isNoReceiverError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('Receiving end does not exist');
}

/** chrome.commands : « valider l'épisode en cours » → FORCE_COMPLETE au content script de l'onglet actif. */
export async function handleCommand(command: string): Promise<void> {
  if (command !== COMPLETE_EPISODE_COMMAND) return;
  try {
    // L'id de l'onglet ne requiert pas la permission "tabs"
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab?.id === undefined) {
      if (__SYNCKAI_DEBUG__) trace('shortcut', 'command', { command, delivered: false, reason: 'no-tab' });
      return;
    }
    const message: ContentMessage = { type: 'FORCE_COMPLETE' };
    await chrome.tabs.sendMessage(tab.id, message);
    // Trace de débogage (builds de développement seulement) : la décision vient ensuite du script de contenu
    if (__SYNCKAI_DEBUG__) trace('shortcut', 'command', { command, delivered: true }, { tabId: tab.id });
  } catch (error: unknown) {
    if (__SYNCKAI_DEBUG__) trace('shortcut', 'command', { command, delivered: false, reason: isNoReceiverError(error) ? 'no-content-script' : 'error' });
    if (!isNoReceiverError(error)) log.warn('Raccourci « valider l’épisode » :', error);
  }
}
