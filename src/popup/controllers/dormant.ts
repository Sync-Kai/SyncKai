// Groupe « En sommeil » de « Mes séries » (spec 2.5.0 §5.3) : séries en cours sans activité depuis le seuil du réglage,
// hors de la série « Reprendre ». Pause et abandon écrits série par série sur les seuls services où l'entrée est encore
// « en cours » (`onlyFrom: 'CURRENT'`, relue par le service worker juste avant l'écriture), « Annuler » sur les seuls
// services réellement écrits, « Garder » mémorisé par service (browser/storage/dormant-keep.ts). Résultats dans le
// bandeau de l'écran, partagé avec la liste ; écritures à annuler gardées brièvement (browser/storage/dormant-undo.ts).
import { formatList, t, tp } from '../../i18n';
import { createLogger } from '../../browser/logger';
import { keepDormant as storeKeepMark, readKeepMarks } from '../../browser/storage/dormant-keep';
import { clearDormantUndo, readDormantUndo, saveDormantUndo } from '../../browser/storage/dormant-undo';
import { dormantEntries, dormantKey, keepMarkOf, type KeepMark } from '../../shared/dormant';
import type { DormantAfterDays } from '../../shared/settings';
import type { SyncOutcome } from '../../shared/sync.types';
import { TRACKER_IDS, TRACKER_LABELS, type TrackerId } from '../../shared/tracker.types';
import { toSafeImageUrl } from '../../shared/url';
import { entryKey, pickHeroEntry } from '../../shared/watching';
import type { WatchingEntry } from '../../shared/watching.types';
import { createStore, withMember, type AccountState, type InlineFeedback, type ReadonlyStore, type Store } from '../../ui/state';
import { callWorker, outcomeFailure } from '../../ui/worker-call';
import type { WatchingState } from '../state';
import { popupTimeouts } from '../timeouts';
import type { NoticeBanner, WatchingNotice } from './notice';

const log = createLogger('popup');

/** Statuts écrits par le groupe (jamais d'abandon groupé) */
export type DormantStatus = 'PAUSED' | 'DROPPED';

export interface DormantState {
  /** Séries en sommeil (hors « Reprendre »), la plus longtemps inactive d'abord ; vide sans groupe à afficher */
  entries: WatchingEntry[];
  /** Seuil du réglage (jours) ; null : « Jamais » ou réglages pas encore lus */
  thresholdDays: DormantAfterDays;
  /** Séries (entryKey) dont une écriture est en cours ou attend son tour dans un lot */
  busy: ReadonlySet<string>;
  /** « Tout mettre en pause », son « Réessayer » ou « Annuler » en cours : tout le groupe attend */
  bulk: boolean;
  /** « Tout mettre en pause » en cours : séries traitées sur le total (« Réessayer », « Annuler » : sur le bandeau) ; null sinon */
  progress: { done: number; total: number } | null;
}

/** Écriture d'une série : statut et services visés (absent : tous les services connectés) */
interface DormantItem {
  entry: WatchingEntry;
  status: DormantStatus;
  services?: TrackerId[];
}

/** Services réellement écrits pour une série (seuls ceux-là sont rétablis par « Annuler ») */
export interface DormantWrite {
  entry: WatchingEntry;
  status: DormantStatus;
  services: TrackerId[];
}

/** Résultat d'une écriture, par série */
export interface DormantResult {
  item: DormantItem;
  outcome: SyncOutcome;
}

/** Issue d'un lot d'écritures : résultats par série, séries jamais envoyées, compte changé pendant le lot */
interface BatchOutcome {
  results: DormantResult[];
  rest: DormantItem[];
  sessionChanged: boolean;
}

export interface DormantControllerDeps {
  watching: { store: Store<WatchingState>; banner: NoticeBanner; scheduleRevalidation(): void };
  /** Réglage « Séries en sommeil » ; undefined tant que les réglages ne sont pas lus (aucun groupe) */
  threshold: ReadonlyStore<DormantAfterDays | undefined>;
  /** Comptes : une connexion ou une déconnexion retire « Annuler » (il écrirait sur une autre session) */
  accounts: { store(service: TrackerId): ReadonlyStore<AccountState<unknown>> };
  /** « Annuler » du bandeau porté par l'hôte (qui appelle `undoDormant` puis place le focus) ; absent : appel direct */
  onUndo?: () => void;
  now?: () => number;
}

export interface DormantController {
  readonly store: ReadonlyStore<DormantState>;
  start(): void;
  /** « Pause » : sans confirmation, bandeau avec « Annuler » */
  pauseDormant(entry: WatchingEntry): Promise<void>;
  /** « Abandonner », après la confirmation en ligne */
  dropDormant(entry: WatchingEntry): Promise<void>;
  /** « Garder » : marque enregistrée, la série quitte le groupe pour un seuil */
  keepDormant(entry: WatchingEntry): Promise<void>;
  /** « Tout mettre en pause », après la confirmation : une écriture par série, résultat regroupé */
  pauseAllDormant(): Promise<void>;
  /**
   * « Annuler » du bandeau : CURRENT sur les seuls services écrits, `onlyFrom` = le statut écrit ; renvoie les séries
   * (entryKey) remises en cours sur le service affiché (focus de l'hôte)
   */
  undoDormant(): Promise<string[]>;
  dispose(): void;
}

const DONE_ONE = { PAUSED: 'watching.dormant.paused', DROPPED: 'watching.dormant.dropped' } as const;

/**
 * Services d'un résultat selon leur issue ; un refus global (hors « synced ») compte comme un échec de la série entière
 * (`whole` : aucun service à nommer, le bandeau compte alors les séries en échec)
 */
function splitResult({ item, outcome }: DormantResult): { written: TrackerId[]; failed: TrackerId[] | null; message: string | null; whole: boolean } {
  if (outcome.status !== 'synced') return { written: [], failed: item.services ?? [], message: outcome.status === 'error' ? outcome.message : null, whole: true };
  const written = outcome.results.filter((r) => r.outcome.status === 'updated').map((r) => r.service);
  const errors = outcome.results.filter((r) => r.outcome.status === 'error');
  const message = errors.flatMap((r) => (r.outcome.status === 'error' ? [t('common.serviceMessage', { service: TRACKER_LABELS[r.service], message: r.outcome.message })] : [])).join('\n');
  return { written, failed: errors.length > 0 ? errors.map((r) => r.service) : null, message: message || null, whole: false };
}

/** Limite de débit atteinte (refus global ou d'un service) : la suite du lot attend « Réessayer » */
function rateLimited(outcome: SyncOutcome): boolean {
  if (outcome.status === 'error') return outcome.code === 'RATE_LIMITED';
  return outcome.status === 'synced' && outcome.results.some((r) => r.outcome.status === 'error' && r.outcome.code === 'RATE_LIMITED');
}

/**
 * Bandeau d'un lot d'écritures (une série ou « Tout mettre en pause ») ; `undo` : texte de « remise en cours ». Une série
 * absente d'une liste ou déjà sortie de « en cours » ailleurs est inchangée (R8) : jamais un avertissement ; seul un échec
 * réel en est un (partiel) ou une erreur (rien d'écrit). `notDone` : séries d'un lot interrompu, jamais envoyées (limite
 * de débit, compte changé), comptées en échec comme une série refusée en entier.
 */
export function dormantFeedback(results: readonly DormantResult[], undo = false, notDone: readonly DormantItem[] = []): { feedback: InlineFeedback; written: DormantWrite[]; failed: DormantItem[] } {
  const written: DormantWrite[] = [];
  const failed: DormantItem[] = [];
  const details: string[] = [];
  let whole = notDone.length;
  for (const result of results) {
    const { written: services, failed: failing, message, whole: wholeFailure } = splitResult(result);
    const { entry, status } = result.item;
    if (services.length > 0) written.push({ entry, status, services });
    if (failing !== null) failed.push(failing.length > 0 ? { entry, status, services: failing } : { entry, status });
    if (wholeFailure) whole += 1;
    if (message !== null) details.push(results.length + notDone.length > 1 ? `${entry.title} · ${message}` : message);
  }
  failed.push(...notDone);
  const done = doneText(written, undo);
  const failedServices = [...new Set(failed.flatMap((item) => item.services ?? []))].map((service) => TRACKER_LABELS[service]);
  const detail = details.join('\n');
  let feedback: InlineFeedback;
  if (done === null) feedback = failed.length > 0 ? { tone: 'error', text: t('inline.updateFailed'), detail } : { tone: 'info', text: t('inline.nothingChanged'), detail: t('inline.nothingChanged') };
  // Série refusée en entier ou jamais envoyée : le nombre de séries en échec, jamais le seul « N séries mises en pause »
  else if (whole > 0) feedback = { tone: 'warning', text: tp('watching.dormant.partial', failed.length, { text: done }), detail };
  else if (failed.length > 0) feedback = { tone: 'warning', text: failedServices.length > 0 ? t('inline.partial', { text: done, services: formatList(failedServices) }) : done, detail };
  else feedback = { tone: 'success', text: done, detail: done };
  return { feedback, written, failed };
}

/** « Frieren mise en pause », « 3 séries mises en pause » (`undo` : « remise(s) en cours ») ; null sans écriture */
function doneText(written: readonly DormantWrite[], undo = false): string | null {
  const single = written.length === 1 ? written[0] : undefined;
  if (written.length === 0) return null;
  if (undo) return single ? t('watching.dormant.restored', { title: single.entry.title }) : tp('watching.dormant.restoredMany', written.length);
  return single ? t(DONE_ONE[single.status], { title: single.entry.title }) : tp('watching.dormant.pausedMany', written.length);
}

/** Écritures d'un essai et de son « Réessayer » réunies par série : un seul « Annuler » par série, services cumulés */
function mergeWrites(previous: readonly DormantWrite[], next: readonly DormantWrite[]): DormantWrite[] {
  const merged = new Map<string, DormantWrite>();
  for (const write of [...previous, ...next]) {
    const key = `${entryKey(write.entry)}:${write.status}`;
    const known = merged.get(key);
    merged.set(key, known ? { ...known, services: [...new Set([...known.services, ...write.services])] } : write);
  }
  return [...merged.values()];
}

/** Rythme des lots : un tour au plus toutes les `dormantPaceMs`, commun aux lots en parallèle (« Annuler » pendant un nouveau lot) */
interface Pacer {
  /** null : à toi (le tour suivant attend le rythme) ; sinon attendre la promesse puis redemander */
  turn(): Promise<void> | null;
}

function createPacer(): Pacer {
  let gate: Promise<void> | null = null;
  return {
    turn() {
      if (gate) return gate;
      const pace = popupTimeouts.dormantPaceMs;
      if (pace > 0) gate = new Promise<void>((resolve) => setTimeout(() => ((gate = null), resolve()), pace));
      return null;
    },
  };
}

/** Ce que les écritures d'un lot lisent du contrôleur */
interface WriteContext {
  setBusy(items: readonly DormantItem[], busy: boolean): void;
  sessionsKey(): string;
  /** Date de la marque « Garder » de la série sur le service affiché, null sans marque */
  keptAt(entry: WatchingEntry): number | null;
  disposed(): boolean;
  pacer: Pacer;
  now(): number;
}

interface WriteSteps {
  status(item: DormantItem): 'CURRENT' | DormantStatus;
  onlyFrom(item: DormantItem): 'CURRENT' | DormantStatus;
  /** Séries traitées, 0 au départ */
  onDone?: (done: number) => void;
  /** Après chaque réponse : résultats jusque-là (jeu d'annulation gardé, POP-05) */
  onResult?: (results: readonly DormantResult[]) => void;
}

/**
 * Une écriture par série, à la suite (jamais en parallèle : verrou des entrées et limite de débit du service worker), et
 * dans un lot une série par tour du rythme (`Pacer`). Tout le lot est occupé dès le départ, chaque série libérée après son
 * tour ; une série gardée pendant une pause n'est pas écrite (le dernier choix l'emporte ; « Annuler » l'écrit). Arrêt à
 * la première limite de débit (`rest` : séries non envoyées, reprises par « Réessayer »), dès qu'un compte change entre
 * deux séries (`sessionChanged` : la suite écrirait sur une autre session, comme « Annuler », retiré) et quand le
 * contrôleur est libéré
 */
async function writeAll(ctx: WriteContext, items: readonly DormantItem[], steps: WriteSteps): Promise<BatchOutcome> {
  const results: DormantResult[] = [];
  const sessions = ctx.sessionsKey();
  const startedAt = ctx.now();
  // Séries jamais envoyées (limite de débit, compte changé) libérées à la sortie
  const finish = (rest: DormantItem[], sessionChanged: boolean): BatchOutcome => {
    ctx.setBusy(rest, false);
    return { results, rest, sessionChanged };
  };
  ctx.setBusy(items, true);
  steps.onDone?.(0);
  for (const [index, item] of items.entries()) {
    if (items.length > 1) for (let wait = ctx.pacer.turn(); wait; wait = ctx.pacer.turn()) await wait;
    if (ctx.disposed() || ctx.sessionsKey() !== sessions) return finish(items.slice(index), ctx.sessionsKey() !== sessions);
    const { entry } = item;
    const status = steps.status(item);
    const kept = status !== 'CURRENT' && (ctx.keptAt(entry) ?? 0) >= startedAt;
    const payload = { mediaId: entry.mediaId, malId: entry.malId, status, onlyFrom: steps.onlyFrom(item), ...(item.services ? { services: item.services } : {}), coverUrl: toSafeImageUrl(entry.coverUrl) };
    const outcome = kept ? null : await callWorker('SET_LIST_STATUS', payload, outcomeFailure);
    ctx.setBusy([item], false);
    steps.onDone?.(index + 1);
    if (outcome === null) continue;
    results.push({ item, outcome });
    steps.onResult?.(results);
    if (rateLimited(outcome)) return finish(items.slice(index + 1), ctx.sessionsKey() !== sessions);
  }
  return finish([], ctx.sessionsKey() !== sessions);
}

/** État de session d'un compte (connecté, déconnecté, expiré), sans le profil qui se recharge seul */
function accountSession(accounts: DormantControllerDeps['accounts'], service: TrackerId): string {
  const account = accounts.store(service).get();
  return account.status === 'logged-out' ? `logged-out:${account.expired}` : account.status;
}

/** Date de la marque « Garder » de la série sur le service affiché (marques lues pour lui), null sans marque */
function keptAt(marks: { service: TrackerId; marks: Record<string, KeepMark> } | null, shown: WatchingState, entry: WatchingEntry): number | null {
  return marks !== null && shown.status === 'ready' && marks.service === shown.service ? (keepMarkOf(marks.marks, entry, shown.service)?.keptAt ?? null) : null;
}

/** Liste affichée modifiée sans relecture : séries retirées (`remove`), séries rétablies ajoutées (`restore`) */
function patchList(watching: Store<WatchingState>, remove: ReadonlySet<string>, restore: readonly WatchingEntry[] = []): void {
  const shown = watching.get();
  if (shown.status !== 'ready' || (remove.size === 0 && restore.length === 0)) return;
  const restoredKeys = new Set(restore.map(entryKey));
  const kept = shown.list.entries.filter((e) => !remove.has(entryKey(e)) && !restoredKeys.has(entryKey(e)));
  watching.set({ ...shown, list: { ...shown.list, entries: [...kept, ...restore] } });
}

/** Statut du service affiché après l'écriture : la série n'y est plus « en cours » (écrite, déjà changée ailleurs, absente) */
function leftShownList(shown: WatchingState, outcome: SyncOutcome): boolean {
  if (outcome.status !== 'synced' || shown.status !== 'ready') return false;
  const result = outcome.results.find((r) => r.service === shown.service)?.outcome;
  return result?.status === 'updated' || result?.status === 'up-to-date' || (result?.status === 'skipped' && result.code === 'not-in-list');
}

/**
 * Jeu d'annulation gardé dans storage.session (POP-05) : `keep(id, writes)` le remplace par les écritures du lot `id`
 * (liste affichée), ou le retire (`writes` vide) s'il vient de ce lot ou d'un lot plus ancien (jamais celui d'un lot plus
 * récent, encore en cours) ; écritures dans l'ordre des appels
 */
function createUndoKeeper(watching: ReadonlyStore<WatchingState>, now: () => number): (id: number, writes: readonly DormantWrite[]) => void {
  /** Lot dont les écritures sont gardées (0 : aucun) */
  let savedRun = 0;
  let saving = Promise.resolve();
  const queue = (op: () => Promise<void>): void => {
    saving = saving.then(op).catch((error: unknown) => log.warn('Annulation non gardée :', error));
  };
  return (id, writes) => {
    const shown = watching.get();
    if (writes.length > 0 && shown.status === 'ready') {
      savedRun = id;
      const copy = [...writes];
      queue(() => saveDormantUndo({ service: shown.service, writes: copy }, now()));
    } else if (writes.length === 0 && savedRun !== 0 && savedRun <= id) {
      savedRun = 0;
      queue(clearDormantUndo);
    }
  };
}

/**
 * Liste affichée en cours de relecture, ou relecture en échec (POP-03) : la liste relue décide (séries encore en sommeil,
 * sous leur fiche relue, `entries`) ; en échec, rien n'est écrit (bandeau d'échec)
 */
async function stillDormant(ctx: WriteContext, watching: DormantControllerDeps['watching'], entries: () => readonly WatchingEntry[], items: readonly DormantItem[]): Promise<DormantItem[]> {
  ctx.setBusy(items, true);
  let unsubscribe = (): void => undefined;
  const shown = await new Promise<WatchingState>((resolve) => {
    unsubscribe = watching.store.subscribe((state) => {
      if (state.status !== 'ready' || !state.refreshing) resolve(state);
    });
  });
  unsubscribe();
  ctx.setBusy(items, false);
  if (shown.status !== 'ready' || shown.error !== null) {
    if (shown.status === 'ready') watching.banner.show({ tone: 'error', text: t('inline.updateFailed'), detail: shown.error ?? t('inline.updateFailed') });
    return [];
  }
  const fresh = new Map(entries().map((entry) => [entryKey(entry), entry]));
  return items.flatMap((item) => {
    const entry = fresh.get(entryKey(item.entry));
    return entry ? [{ ...item, entry }] : [];
  });
}

export function createDormantController(deps: DormantControllerDeps): DormantController {
  const { watching } = deps;
  const now = deps.now ?? Date.now;
  const store = createStore<DormantState>({ entries: [], thresholdDays: null, busy: new Set(), bulk: false, progress: null });
  const unsubscribers: (() => void)[] = [];
  /** Marques « Garder » du service affiché ; null tant qu'elles ne sont pas lues (aucun groupe en attendant) */
  let marks: { service: TrackerId; marks: Record<string, KeepMark> } | null = null;
  /** Écritures que « Annuler » rétablit, tant que leur bandeau est affiché, et le lot qui les a faites */
  let undoable: DormantWrite[] = [];
  let undoRun = 0;
  /** Bandeau qui porte ce « Annuler » (un autre bandeau l'efface) et service affiché lors des écritures */
  let undoNotice: WatchingNotice | null = null;
  let undoService: TrackerId | null = null;
  let disposed = false;
  /** Lecture des marques après une attente (sans le rétrécissement de type d'avant l'`await`) */
  const currentMarks = (): typeof marks => marks;

  function recompute(): void {
    const shown = watching.store.get();
    const threshold = deps.threshold.get() ?? null;
    const ready = shown.status === 'ready' && marks !== null && marks.service === shown.service;
    const entries =
      ready && threshold !== null ? dormantEntries(shown.list.entries, { now: now(), thresholdDays: threshold, marks: marks?.marks ?? {}, hero: pickHeroEntry(shown.list.entries), service: shown.service }) : [];
    const current = store.get();
    const same = current.thresholdDays === threshold && current.entries.length === entries.length && current.entries.every((entry, index) => entry === entries[index]);
    if (!same) store.set({ ...current, entries, thresholdDays: threshold });
  }

  /** Marques relues à chaque changement du service affiché */
  function syncMarks(): void {
    const shown = watching.store.get();
    if (shown.status !== 'ready' || marks?.service === shown.service) return;
    const service = shown.service;
    marks = null;
    readKeepMarks(service).then(
      (read) => {
        const current = watching.store.get();
        if (disposed || current.status !== 'ready' || current.service !== service) return;
        marks = { service, marks: read };
        recompute();
      },
      (error: unknown) => log.warn('Séries gardées illisibles :', error),
    );
  }

  const patch = (next: Partial<DormantState>): void => store.set({ ...store.get(), ...next });
  /** Séries marquées occupées, ou libérées */
  const setBusy = (items: readonly DormantItem[], busy: boolean): void => patch({ busy: items.reduce((set, { entry }) => withMember(set, entryKey(entry), busy), store.get().busy) });
  /** Lots en cours : le groupe attend tant qu'il en reste un (une pause seule finie pendant un lot ne le libère pas) */
  let bulkRuns = 0;
  const bulkRun = (delta: 1 | -1, next: Partial<DormantState> = {}): void => {
    bulkRuns += delta;
    patch({ ...next, bulk: bulkRuns > 0 });
  };

  const sessionOf = (service: TrackerId): string => accountSession(deps.accounts, service);
  const sessionsKey = (): string => TRACKER_IDS.map(sessionOf).join('|');

  const ctx: WriteContext = {
    setBusy,
    sessionsKey,
    keptAt: (entry) => keptAt(marks, watching.store.get(), entry),
    disposed: () => disposed,
    pacer: createPacer(),
    now,
  };

  /** Lots numérotés (jeu d'annulation gardé) */
  let runs = 0;
  const keepUndo = createUndoKeeper(watching.store, now);

  /** Banderole avec « Annuler » (écritures de ce lot et des lots qu'il réessaie) et « Réessayer » (séries en échec) */
  function showResult(feedback: InlineFeedback, written: DormantWrite[], failed: DormantItem[], id: number): void {
    const undo = written.length > 0 ? (deps.onUndo ?? (() => void controller.undoDormant())) : null;
    const retry = failed.length > 0 ? () => void run(failed, written) : null;
    watching.banner.show(feedback, { undo, retry });
    // Après l'affichage : l'abonnement au bandeau oublie les écritures d'un bandeau remplacé
    undoNotice = watching.banner.store.get();
    setUndoable(written, id);
    const shown = watching.store.get();
    undoService = shown.status === 'ready' ? shown.service : null;
  }

  /** « Annuler » du lot `id`, aussi dans storage.session ; `writes` vide : aucun (celui affiché et ceux d'avant retirés) */
  function setUndoable(writes: DormantWrite[], id = undoRun): void {
    keepUndo(writes.length === 0 ? Math.max(undoRun, id) : id, writes);
    undoable = writes;
    undoRun = id;
  }

  /** Sessions ou liste affichée changées : « Annuler » écrirait ailleurs que là où la pause a été faite */
  function dropUndo(): void {
    if (undoable.length === 0) return;
    setUndoable([]);
    watching.banner.dropUndo();
  }

  /** Popup rouvert peu après un lot (fermé pendant, ou pendant son bandeau) : son « Annuler » est encore proposé */
  let saved: { service: TrackerId; writes: DormantWrite[] } | null = null;
  function offerSaved(): void {
    const shown = watching.store.get();
    if (saved === null || shown.status !== 'ready' || shown.service !== saved.service) return;
    const text = doneText(saved.writes) ?? '';
    const { writes } = saved;
    saved = null;
    showResult({ tone: 'success', text, detail: text }, writes, [], ++runs);
  }

  /**
   * Pause / abandon d'une ou plusieurs séries ; `previous` : écritures d'un essai précédent, donné par « Réessayer » (son
   * bandeau reste pendant l'essai, ses boutons inactifs : jamais « Annuler » en même temps)
   */
  async function run(items: readonly DormantItem[], previous?: readonly DormantWrite[]): Promise<void> {
    let pending = items.filter((item) => !store.get().busy.has(entryKey(item.entry)));
    if (pending.length === 0) return;
    const id = ++runs;
    const bulk = items.length > 1;
    if (bulk) bulkRun(1);
    // Pause, abandon ou lot décidés sur une liste pas encore relue (cache), ou dont la relecture a échoué (POP-03)
    const shown = watching.store.get();
    if (previous === undefined && shown.status === 'ready' && (shown.refreshing || shown.error !== null)) pending = await stillDormant(ctx, watching, () => store.get().entries, pending);
    // « Réessayer » : l'« Annuler » de l'essai précédent revient avec le résultat (écritures réunies)
    if (previous !== undefined) setUndoable([]);
    if (pending.length === 0) {
      if (bulk) bulkRun(-1);
      return;
    }
    // Progression sur le bouton qui a lancé l'écriture : « Réessayer » du bandeau, sinon « Tout mettre en pause »
    const onDone = previous ? watching.banner.track('retry', pending.length) : bulk ? (done: number) => patch({ progress: { done, total: pending.length } }) : undefined;
    // Popup fermé pendant le lot : les séries déjà écrites restent à annuler à la réouverture (POP-05)
    const onResult = (results: readonly DormantResult[]): void => keepUndo(id, mergeWrites(previous ?? [], dormantFeedback(results).written));
    const { results, rest, sessionChanged } = await writeAll(ctx, pending, { status: (item) => item.status, onlyFrom: () => 'CURRENT', onDone, onResult });
    if (bulk) bulkRun(-1, { progress: null });
    patchList(watching.store, new Set(results.filter((r) => leftShownList(watching.store.get(), r.outcome)).map((r) => entryKey(r.item.entry))));
    const { feedback, written, failed } = dormantFeedback(results, false, rest);
    // Compte changé pendant le lot : ni « Annuler » ni « Réessayer » (ils écriraient sur l'autre session)
    if (sessionChanged) showResult(feedback, [], [], id);
    else showResult(feedback, mergeWrites(previous ?? [], written), failed, id);
    watching.scheduleRevalidation();
  }

  const controller: DormantController = {
    store,

    start() {
      if (unsubscribers.length > 0) return;
      const sessions = new Map(TRACKER_IDS.map((service) => [service, sessionOf(service)]));
      unsubscribers.push(
        watching.store.subscribe((shown) => {
          syncMarks();
          recompute();
          if (undoService !== null && (shown.status !== 'ready' || shown.service !== undoService)) dropUndo();
          offerSaved();
        }),
        ...TRACKER_IDS.map((service) =>
          deps.accounts.store(service).subscribe(() => {
            const next = sessionOf(service);
            if (next === sessions.get(service)) return;
            sessions.set(service, next);
            dropUndo();
          }),
        ),
        deps.threshold.subscribe(recompute),
        // « Annuler » disparaît avec son bandeau (délai écoulé, autre retour affiché)
        watching.banner.store.subscribe((notice) => {
          if (notice !== undoNotice && undoable.length > 0) setUndoable([]);
        }),
      );
      syncMarks();
      recompute();
      readDormantUndo(now()).then(
        (read) => {
          if (disposed || read === null) return;
          saved = read;
          offerSaved();
        },
        (error: unknown) => log.warn('Annulation gardée illisible :', error),
      );
    },

    pauseDormant: (entry) => run([{ entry, status: 'PAUSED' }]),
    dropDormant: (entry) => run([{ entry, status: 'DROPPED' }]),
    pauseAllDormant: () => run(store.get().entries.map((entry) => ({ entry, status: 'PAUSED' as const }))),

    async keepDormant(entry) {
      const shown = watching.store.get();
      if (shown.status !== 'ready' || marks?.service !== shown.service) return;
      const key = dormantKey(entry, shown.service);
      const at = now();
      const previous = marks.marks[key];
      // Affichage immédiat : la série retourne dans la liste principale
      marks = { service: shown.service, marks: { ...marks.marks, [key]: { keptAt: at } } };
      recompute();
      try {
        await storeKeepMark(shown.service, key, at);
      } catch (error: unknown) {
        log.error('Série non gardée :', error);
        // Relues pendant l'écriture (service affiché changé) : `syncMarks` a pu les remettre à null
        const latest = currentMarks();
        if (latest?.service === shown.service) {
          const rest = { ...latest.marks };
          if (previous) rest[key] = previous;
          else delete rest[key];
          marks = { service: shown.service, marks: rest };
          recompute();
        }
        watching.banner.show({ tone: 'error', text: t('inline.updateFailed'), detail: t('inline.updateFailed') });
      }
    },

    async undoDormant() {
      // Série en cours d'écriture (un autre lot) : sautée, sa marque d'occupation reste à ce lot
      const writes = undoable.filter(({ entry }) => !store.get().busy.has(entryKey(entry)));
      if (undoable.length === 0) return [];
      setUndoable([]);
      // Bandeau gardé, ses boutons inactifs : progression sur « Annuler », ou sur le « Réessayer » d'un « Annuler » en échec
      const onDone = watching.banner.track(watching.banner.store.get()?.undo ? 'undo' : 'retry', writes.length);
      bulkRun(1);
      const { results, rest, sessionChanged } = await writeAll(
        ctx,
        writes.map(({ entry, status, services }) => ({ entry, status, services })),
        { status: () => 'CURRENT', onlyFrom: (item) => item.status, onDone },
      );
      bulkRun(-1);
      // De retour dans la liste du service affiché, active pour un seuil entier (sa fiche vient d'être modifiée)
      const shown = watching.store.get();
      const restored = results.filter(({ outcome }) => outcome.status === 'synced' && shown.status === 'ready' && outcome.results.some((r) => r.service === shown.service && r.outcome.status === 'updated'));
      patchList(watching.store, new Set(), restored.map(({ item }) => ({ ...item.entry, listStatus: 'CURRENT', updatedAt: now() })));
      const { feedback, failed } = dormantFeedback(results, true, rest);
      watching.banner.show(feedback, { retry: failed.length > 0 && !sessionChanged ? () => void retryUndo(failed) : null });
      watching.scheduleRevalidation();
      return restored.map(({ item }) => entryKey(item.entry));
    },

    dispose() {
      disposed = true;
      for (const unsubscribe of unsubscribers.splice(0)) unsubscribe();
    },
  };

  /** « Réessayer » d'un « Annuler » en échec partiel : mêmes séries, seuls les services en échec */
  function retryUndo(failed: readonly DormantItem[]): Promise<string[]> {
    undoable = failed.map(({ entry, status, services }) => ({ entry, status, services: services ?? [] })).filter((write) => write.services.length > 0);
    return controller.undoDormant();
  }

  return controller;
}
