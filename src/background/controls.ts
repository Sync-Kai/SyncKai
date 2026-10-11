import { t } from '../i18n';
import type { ContentMessage } from '../shared/content-messages';
import type { AddToListPayload, AdjustProgressPayload, AdjustRetryTarget, SetListStatusPayload } from '../shared/messages';
import type { MediaRef } from '../shared/engagement.types';
import { getSettings } from '../shared/settings';
import type { AddListStatus, ListStatusChange, ServiceOutcome, ServiceResult, SyncOutcome } from '../shared/sync.types';
import { TRACKER_LABELS } from '../shared/tracker.types';
import { ApiError } from './api/errors';
import { deferRating } from './engagement';
import { withEntryLock } from './sync/entry-lock';
import { decideAddToList, decideStatusChange, progressWrite, type ListEntryState, type WriteStatus } from './sync/rules';
import { getCatalogMedia } from './sync/sync-service';
import { getConnectedTrackers } from './trackers';
import type { CatalogMedia, TrackerService } from './trackers/tracker';
import { createLogger } from '../shared/logger';

// Contrôles manuels (service worker) : +1 / −1 depuis le popup et raccourci « valider l'épisode ».

const log = createLogger('controls');

/** Identifiant de la commande déclarée dans manifest.json (`commands`) */
export const COMPLETE_EPISODE_COMMAND = 'complete-episode';

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

function toServiceError(error: unknown): ServiceOutcome {
  return error instanceof ApiError ? { status: 'error', message: error.message, code: error.code } : { status: 'error', message: t('error.unexpected') };
}

interface Target {
  tracker: TrackerService;
  id: number;
}

/**
 * Services connectés où la série a un identifiant. Catalogue AniList si connu (idMal, total) ;
 * sinon MAL seul avec son propre identifiant (entrée MAL sans équivalent AniList).
 */
function resolveTargets(trackers: readonly TrackerService[], catalog: CatalogMedia | null, malId: number | null): Target[] {
  return trackers.flatMap((tracker) => {
    const id = catalog ? tracker.resolveId(catalog) : tracker.id === 'mal' ? malId : null;
    return id !== null ? [{ tracker, id }] : [];
  });
}

/** Ajuste UN service : delta relatif, ou progression absolue `retry` (nouvel essai). Ne lève jamais : l'échec est un résultat. */
async function adjustOnService(
  { tracker, id }: Target,
  fallbackTotal: number | null,
  delta: 1 | -1,
  retry: AdjustRetryTarget | null,
): Promise<{ result: ServiceResult; title: string | null }> {
  const label = TRACKER_LABELS[tracker.id];
  try {
    // Sous le verrou de la fiche : deux +1 simultanés (panneau et popup) ou un −1 pendant une synchro ne se perdent pas
    return await withEntryLock(tracker.id, id, async (): Promise<{ result: ServiceResult; title: string | null }> => {
      // Lecture fraîche : la progression de référence est celle de CE service
      const current = await tracker.getEntry(id);
      const total = current.episodes ?? fallbackTotal;
      const decision = retry ? decideRetryAdjustment(current.entry, total, delta, retry.progress) : decideAdjustment(current.entry, total, delta);
      if (decision.action === 'skip') {
        const outcome: ServiceOutcome = { status: 'skipped', reason: decision.reason, ...(decision.notInList ? { code: 'not-in-list' as const } : {}) };
        return { result: { service: tracker.id, outcome }, title: current.title };
      }
      if (decision.action === 'up-to-date') {
        return { result: { service: tracker.id, outcome: { status: 'up-to-date', progress: decision.progress } }, title: current.title };
      }
      const saved = await tracker.saveProgress(id, decision.progress, decision.status, decision.repeat);
      log.info(`${label} : ${current.title} → épisode ${saved.progress} (${saved.status}, ${retry ? 'nouvel essai' : `ajustement ${delta > 0 ? '+1' : '−1'}`})`);
      const outcome: ServiceOutcome = { status: 'updated', progress: saved.progress, completed: saved.status === 'COMPLETED' };
      return { result: { service: tracker.id, outcome }, title: current.title };
    });
  } catch (error: unknown) {
    log.error(`${label} : échec de l’ajustement`, error);
    return { result: { service: tracker.id, outcome: toServiceError(error) }, title: null };
  }
}

/**
 * +1 / −1 manuel : écrit sur tous les services connectés où la série est dans la liste.
 * `retry` (après un échec partiel) : la progression absolue est écrite sur les seuls services indiqués.
 * N'alimente pas les « dernières synchros » (action manuelle, le popup affiche le résultat).
 */
export async function adjustProgress(payload: AdjustProgressPayload): Promise<SyncOutcome> {
  try {
    const retry = payload.retry ?? null;
    const trackers = await getConnectedTrackers(retry?.services ?? null);
    if (trackers.length === 0) return { status: 'not-connected' };

    const catalog: CatalogMedia | null = payload.mediaId !== null ? await getCatalogMedia(payload.mediaId) : null;
    const targets = resolveTargets(trackers, catalog, payload.malId);
    if (targets.length === 0) return { status: 'error', message: t('sync.noServiceFollows') };

    const adjusted = await Promise.all(targets.map((target) => adjustOnService(target, catalog?.episodes ?? null, payload.delta, retry)));
    const mediaTitle = catalog?.title ?? adjusted.find((a) => a.title !== null)?.title ?? t('sync.seriesFallback');
    return { status: 'synced', mediaTitle, results: adjusted.map((a) => a.result) };
  } catch (error: unknown) {
    if (error instanceof ApiError) return { status: 'error', message: error.message, code: error.code };
    log.error('Erreur inattendue :', error);
    return { status: 'error', message: t('error.unexpectedAdjust') };
  }
}

// ─── Statut (En pause, Abandonné, Terminé) ───────────────────────────────

interface StatusWrite {
  result: ServiceResult;
  title: string | null;
  /** L'entrée de ce service porte déjà une note */
  scored: boolean;
}

/** Change le statut sur UN service (lecture fraîche, puis règle decideStatusChange). Ne lève jamais. */
async function statusOnService({ tracker, id }: Target, fallbackTotal: number | null, status: ListStatusChange): Promise<StatusWrite> {
  const label = TRACKER_LABELS[tracker.id];
  try {
    // Lecture et écriture sous le verrou de la fiche (synchro ou +1 concurrents)
    return await withEntryLock(tracker.id, id, async (): Promise<StatusWrite> => {
      const current = await tracker.getEntry(id);
      const scored = current.entry?.score !== undefined;
      const decision = decideStatusChange(current.entry, current.episodes ?? fallbackTotal, status);
      if (decision.action === 'skip') {
        const outcome: ServiceOutcome =
          decision.reason === 'not-in-list'
            ? { status: 'skipped', reason: t('engagement.notInList'), code: 'not-in-list' }
            : { status: 'up-to-date', progress: current.entry?.progress ?? 0 };
        return { result: { service: tracker.id, outcome }, title: current.title, scored };
      }
      const saved = await tracker.saveStatus(id, decision.status, decision.progress, decision.repeat);
      log.info(`${label} : ${current.title} → ${saved.status}, épisode ${saved.progress}`);
      const outcome: ServiceOutcome = { status: 'updated', progress: saved.progress, completed: saved.status === 'COMPLETED' };
      return { result: { service: tracker.id, outcome }, title: current.title, scored };
    });
  } catch (error: unknown) {
    log.error(`${label} : échec du changement de statut`, error);
    return { result: { service: tracker.id, outcome: toServiceError(error) }, title: null, scored: false };
  }
}

/**
 * Carte « À noter » après « Terminé » (pur, testable) : la série vient de passer en Terminé sur au moins
 * un service, aucun service n'a déjà de note, et la proposition de note est activée dans les réglages.
 */
export function shouldQueueRating(status: ListStatusChange, writes: readonly Pick<StatusWrite, 'result' | 'scored'>[], ratingPrompt: boolean): boolean {
  if (status !== 'COMPLETED' || !ratingPrompt || writes.some((w) => w.scored)) return false;
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
    const trackers = await getConnectedTrackers();
    if (trackers.length === 0) return { status: 'not-connected' };

    const catalog: CatalogMedia | null = payload.mediaId !== null ? await getCatalogMedia(payload.mediaId) : null;
    const targets = resolveTargets(trackers, catalog, payload.malId);
    if (targets.length === 0) return { status: 'error', message: t('sync.noServiceFollows') };

    const writes = await Promise.all(targets.map((target) => statusOnService(target, catalog?.episodes ?? null, payload.status)));
    const mediaTitle = catalog?.title ?? writes.find((w) => w.title !== null)?.title ?? t('sync.seriesFallback');
    const outcome: SyncOutcome = { status: 'synced', mediaTitle, results: writes.map((w) => w.result) };

    if (shouldQueueRating(payload.status, writes, await isRatingPromptEnabled())) {
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

/** Ajoute la série sur UN service si elle n'y est pas (lecture fraîche). Ne lève jamais. */
async function addOnService({ tracker, id }: Target, status: AddListStatus): Promise<{ result: ServiceResult; title: string | null }> {
  const label = TRACKER_LABELS[tracker.id];
  try {
    // Sous le verrou de la fiche : une synchro concurrente ne peut pas être écrasée par l'ajout
    return await withEntryLock(tracker.id, id, async (): Promise<{ result: ServiceResult; title: string | null }> => {
      const current = await tracker.getEntry(id);
      const decision = decideAddToList(current.entry, status);
      if (decision.action === 'skip') {
        return { result: { service: tracker.id, outcome: { status: 'skipped', reason: t('page.alreadyInList') } }, title: current.title };
      }
      const saved = await tracker.saveStatus(id, decision.status, decision.progress);
      log.info(`${label} : ${current.title} ajouté (${saved.status})`);
      return { result: { service: tracker.id, outcome: { status: 'updated', progress: saved.progress, completed: false } }, title: current.title };
    });
  } catch (error: unknown) {
    log.error(`${label} : échec de l’ajout à la liste`, error);
    return { result: { service: tracker.id, outcome: toServiceError(error) }, title: null };
  }
}

/**
 * « Ajouter à À regarder / En cours » depuis la fiche de la page : écrit sur chaque service connecté
 * où la fiche existe et où la série n'est pas déjà dans la liste (une entrée existante n'est jamais modifiée).
 */
export async function addToList(payload: AddToListPayload): Promise<SyncOutcome> {
  try {
    const trackers = await getConnectedTrackers();
    if (trackers.length === 0) return { status: 'not-connected' };

    const fetched = await getCatalogMedia(payload.mediaId);
    // idMal du catalogue prioritaire ; celui du popup en secours (même fiche, lu juste avant)
    const catalog: CatalogMedia = { ...fetched, idMal: fetched.idMal ?? payload.malId };
    const targets = resolveTargets(trackers, catalog, null);
    if (targets.length === 0) return { status: 'error', message: t('sync.noServiceFollows') };

    const added = await Promise.all(targets.map((target) => addOnService(target, payload.status)));
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
    if (tab?.id === undefined) return;
    const message: ContentMessage = { type: 'FORCE_COMPLETE' };
    await chrome.tabs.sendMessage(tab.id, message);
  } catch (error: unknown) {
    if (!isNoReceiverError(error)) log.warn('Raccourci « valider l’épisode » :', error);
  }
}
