// Groupe « En sommeil » de « Mes séries » (spec 2.5.0 §5.3) : séries en cours sans activité depuis le seuil du réglage,
// hors de la série « Reprendre ». Pause et abandon écrits série par série sur les seuls services où l'entrée est encore
// « en cours » (`onlyFrom: 'CURRENT'`, relue par le service worker juste avant l'écriture), « Annuler » sur les seuls
// services réellement écrits, « Garder » mémorisé par service (browser/storage/dormant-keep.ts). Résultats dans le
// bandeau de l'écran, partagé avec la liste.
import { formatList, t, tp } from '../../i18n';
import { createLogger } from '../../browser/logger';
import { keepDormant as storeKeepMark, readKeepMarks } from '../../browser/storage/dormant-keep';
import { dormantEntries, dormantKey, type KeepMark } from '../../shared/dormant';
import type { DormantAfterDays } from '../../shared/settings';
import type { SyncOutcome } from '../../shared/sync.types';
import { TRACKER_IDS, TRACKER_LABELS, type TrackerId } from '../../shared/tracker.types';
import { toSafeImageUrl } from '../../shared/url';
import { entryKey, pickHeroEntry } from '../../shared/watching';
import type { WatchingEntry } from '../../shared/watching.types';
import { createStore, withMember, type AccountState, type InlineFeedback, type ReadonlyStore, type Store } from '../../ui/state';
import { callWorker, outcomeFailure } from '../../ui/worker-call';
import type { WatchingState } from '../state';
import type { NoticeBanner, WatchingNotice } from './notice';

const log = createLogger('popup');

/** Statuts écrits par le groupe (jamais d'abandon groupé) */
export type DormantStatus = 'PAUSED' | 'DROPPED';

export interface DormantState {
  /** Séries en sommeil (hors « Reprendre »), la plus longtemps inactive d'abord ; vide sans groupe à afficher */
  entries: WatchingEntry[];
  /** Seuil du réglage (jours) ; null : « Jamais » ou réglages pas encore lus */
  thresholdDays: DormantAfterDays;
  /** Séries (entryKey) dont une action est en cours */
  busy: ReadonlySet<string>;
  /** « Tout mettre en pause » ou « Annuler » en cours : tout le groupe attend */
  bulk: boolean;
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
  const single = written.length === 1 ? written[0] : undefined;
  const done =
    written.length === 0
      ? null
      : undo
        ? single
          ? t('watching.dormant.restored', { title: single.entry.title })
          : tp('watching.dormant.restoredMany', written.length)
        : single
          ? t(DONE_ONE[single.status], { title: single.entry.title })
          : tp('watching.dormant.pausedMany', written.length);
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

export function createDormantController(deps: DormantControllerDeps): DormantController {
  const { watching } = deps;
  const now = deps.now ?? Date.now;
  const store = createStore<DormantState>({ entries: [], thresholdDays: null, busy: new Set(), bulk: false });
  const unsubscribers: (() => void)[] = [];
  /** Marques « Garder » du service affiché ; null tant qu'elles ne sont pas lues (aucun groupe en attendant) */
  let marks: { service: TrackerId; marks: Record<string, KeepMark> } | null = null;
  /** Écritures que « Annuler » rétablit, tant que leur bandeau est affiché */
  let undoable: DormantWrite[] = [];
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
    const entries = ready && threshold !== null ? dormantEntries(shown.list.entries, { now: now(), thresholdDays: threshold, marks: marks?.marks ?? {}, hero: pickHeroEntry(shown.list.entries) }) : [];
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

  /** Liste affichée modifiée sans relecture : séries retirées (`remove`), séries rétablies ajoutées (`restore`) */
  function patchList(remove: ReadonlySet<string>, restore: readonly WatchingEntry[] = []): void {
    const shown = watching.store.get();
    if (shown.status !== 'ready' || (remove.size === 0 && restore.length === 0)) return;
    const restoredKeys = new Set(restore.map(entryKey));
    const kept = shown.list.entries.filter((e) => !remove.has(entryKey(e)) && !restoredKeys.has(entryKey(e)));
    watching.store.set({ ...shown, list: { ...shown.list, entries: [...kept, ...restore] } });
  }

  /** Statut du service affiché après l'écriture : la série n'y est plus « en cours » (écrite, déjà changée ailleurs, absente) */
  function leftShownList(outcome: SyncOutcome): boolean {
    const shown = watching.store.get();
    if (outcome.status !== 'synced' || shown.status !== 'ready') return false;
    const result = outcome.results.find((r) => r.service === shown.service)?.outcome;
    return result?.status === 'updated' || result?.status === 'up-to-date' || (result?.status === 'skipped' && result.code === 'not-in-list');
  }

  /** État de session d'un compte (connecté, déconnecté, expiré), sans le profil qui se recharge seul */
  const sessionOf = (service: TrackerId): string => {
    const account = deps.accounts.store(service).get();
    return account.status === 'logged-out' ? `logged-out:${account.expired}` : account.status;
  };
  const sessionsKey = (): string => TRACKER_IDS.map(sessionOf).join('|');

  /**
   * Une écriture par série, à la suite (jamais en parallèle : verrou des entrées et limite de débit du service worker).
   * Arrêt à la première limite de débit (`rest` : séries non envoyées, reprises par « Réessayer ») et dès qu'un compte
   * change entre deux séries (`sessionChanged` : la suite écrirait sur une autre session, comme « Annuler », retiré)
   */
  async function writeAll(
    items: readonly DormantItem[],
    status: (item: DormantItem) => 'CURRENT' | DormantStatus,
    onlyFrom: (item: DormantItem) => 'CURRENT' | DormantStatus,
  ): Promise<{ results: DormantResult[]; rest: DormantItem[]; sessionChanged: boolean }> {
    const results: DormantResult[] = [];
    const sessions = sessionsKey();
    for (const [index, item] of items.entries()) {
      if (sessionsKey() !== sessions) return { results, rest: items.slice(index), sessionChanged: true };
      const { entry } = item;
      patch({ busy: withMember(store.get().busy, entryKey(entry), true) });
      const payload = { mediaId: entry.mediaId, malId: entry.malId, status: status(item), onlyFrom: onlyFrom(item), ...(item.services ? { services: item.services } : {}), coverUrl: toSafeImageUrl(entry.coverUrl) };
      const outcome = await callWorker('SET_LIST_STATUS', payload, outcomeFailure);
      patch({ busy: withMember(store.get().busy, entryKey(entry), false) });
      results.push({ item, outcome });
      if (rateLimited(outcome)) return { results, rest: items.slice(index + 1), sessionChanged: sessionsKey() !== sessions };
    }
    return { results, rest: [], sessionChanged: sessionsKey() !== sessions };
  }

  /** Banderole avec « Annuler » (écritures de ce lot et des lots qu'il réessaie) et « Réessayer » (séries en échec) */
  function showResult(feedback: InlineFeedback, written: DormantWrite[], failed: DormantItem[]): void {
    const undo = written.length > 0 ? (deps.onUndo ?? (() => void controller.undoDormant())) : null;
    const retry = failed.length > 0 ? () => void run(failed, written) : null;
    watching.banner.show(feedback, { undo, retry });
    // Après l'affichage : l'abonnement au bandeau oublie les écritures d'un bandeau remplacé
    undoNotice = watching.banner.store.get();
    undoable = written;
    const shown = watching.store.get();
    undoService = shown.status === 'ready' ? shown.service : null;
  }

  /** Sessions ou liste affichée changées : « Annuler » écrirait ailleurs que là où la pause a été faite */
  function dropUndo(): void {
    if (undoable.length === 0) return;
    undoable = [];
    watching.banner.dropUndo();
  }

  /** Pause / abandon d'une ou plusieurs séries ; `previous` : écritures d'un essai précédent (« Réessayer ») */
  async function run(items: readonly DormantItem[], previous: readonly DormantWrite[] = []): Promise<void> {
    const pending = items.filter((item) => !store.get().busy.has(entryKey(item.entry)));
    if (pending.length === 0) return;
    if (items.length > 1) patch({ bulk: true });
    const { results, rest, sessionChanged } = await writeAll(pending, (item) => item.status, () => 'CURRENT');
    patch({ bulk: false });
    patchList(new Set(results.filter((r) => leftShownList(r.outcome)).map((r) => entryKey(r.item.entry))));
    const { feedback, written, failed } = dormantFeedback(results, false, rest);
    // Compte changé pendant le lot : ni « Annuler » ni « Réessayer » (ils écriraient sur l'autre session)
    if (sessionChanged) showResult(feedback, [], []);
    else showResult(feedback, mergeWrites(previous, written), failed);
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
          if (notice !== undoNotice) undoable = [];
        }),
      );
      syncMarks();
      recompute();
    },

    pauseDormant: (entry) => run([{ entry, status: 'PAUSED' }]),
    dropDormant: (entry) => run([{ entry, status: 'DROPPED' }]),
    pauseAllDormant: () => run(store.get().entries.map((entry) => ({ entry, status: 'PAUSED' as const }))),

    async keepDormant(entry) {
      const shown = watching.store.get();
      if (shown.status !== 'ready' || marks?.service !== shown.service) return;
      const key = dormantKey(entry);
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
      const writes = undoable;
      if (writes.length === 0) return [];
      undoable = [];
      watching.banner.hide();
      patch({ bulk: true });
      const { results, rest, sessionChanged } = await writeAll(
        writes.map(({ entry, status, services }) => ({ entry, status, services })),
        () => 'CURRENT',
        (item) => item.status,
      );
      patch({ bulk: false });
      // De retour dans la liste du service affiché, active pour un seuil entier (sa fiche vient d'être modifiée)
      const shown = watching.store.get();
      const restored = results.filter(({ outcome }) => outcome.status === 'synced' && shown.status === 'ready' && outcome.results.some((r) => r.service === shown.service && r.outcome.status === 'updated'));
      patchList(new Set(), restored.map(({ item }) => ({ ...item.entry, listStatus: 'CURRENT', updatedAt: now() })));
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
