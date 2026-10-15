// Liste « En cours » : source et tri (préférences du popup), cache affiché puis revalidé par le service worker
// (délai d'attente, réponse tardive, requête obsolète ignorée), actions sur une série (+1, −1, statut, exclusion,
// retrait de la liste, commentaire) et bandeau de retour.
import { t } from '../../i18n';
import { excludeSeries, includeSeries } from '../../shared/exclusions';
import { createLogger } from '../../shared/logger';
import { sendMessage } from '../../protocol/messages';
import { parsePlatformLinkStore, PLATFORM_LINKS_KEY, withLearnedLinks } from '../../platforms/links';
import { getCachedWatching } from '../../browser/storage/watching-cache';
import { STORAGE_KEYS } from '../../protocol/storage-keys';
import type { AdjustRetry, ListStatusChange, SyncOutcome } from '../../shared/sync.types';
import { isTrackerId, TRACKER_IDS, type TrackerId } from '../../shared/tracker.types';
import { toSafeImageUrl } from '../../shared/url';
import { DEFAULT_WATCHING_SORT, isWatchingSort, type WatchingEntry, type WatchingList, type WatchingResult, type WatchingSort } from '../../shared/watching.types';
import { AUTH_ERRORS, type AccountsController } from '../../ui/accounts';
import { adjustFeedback, errorFeedback, notesFeedback, removeFeedback, statusFeedback } from '../../ui/feedback';
import type { MediaRef } from '../../shared/engagement.types';
import { normalizeListNotes, type ListNotesResult } from '../../shared/list-notes';
import { adjustPayload } from '../../ui/media-action-requests';
import { createStore, patchStore, withEntry, type ExclusionsState, type InlineFeedback, type Store } from '../../ui/state';
import { entryKey } from '../components/watching-screen';
import type { EntryAction, WatchingPrefs, WatchingState } from '../state';
import { popupTimeouts } from '../timeouts';
import { NOTICE_MS } from './notice';

const log = createLogger('popup');

const PREFS_KEY = 'popupPrefs';
/** Durée d'affichage du retour d'une action sur une série (+1, −1, exclusion) */
const ENTRY_FEEDBACK_MS = 3_000;
const REVALIDATE_DEBOUNCE_MS = 1_000;

/** Bandeau en haut de la liste ; `retry` : « Réessayer » d'un +1 / −1 en échec partiel */
export interface WatchingNotice {
  feedback: InlineFeedback;
  retry: (() => void) | null;
}

/** Éditeur de commentaire ouvert sous une série (un seul à la fois) : lecture du commentaire, puis édition */
export type NotesSession =
  | { key: string; entry: WatchingEntry; phase: 'loading' }
  /** `inList` faux : série absente de toutes les listes connectées (rien ne peut être écrit) */
  | { key: string; entry: WatchingEntry; phase: 'ready'; inList: boolean; notes: string | null }
  | { key: string; entry: WatchingEntry; phase: 'error'; message: string };

export interface WatchingControllerDeps {
  accounts: Pick<AccountsController, 'store' | 'markExpired'>;
  /** Séries exclues (pastille « Exclue », réactivation) et leur relecture après une exclusion */
  exclusions: Store<ExclusionsState>;
  reloadExclusions(): Promise<void>;
  /** Un service est affiché (connexion, choix de source) */
  onServiceShown(service: TrackerId): void;
  /** Bandeau affiché : à ramener dans la zone visible */
  onNoticeShown(): void;
}

export interface WatchingController {
  readonly store: Store<WatchingState>;
  readonly prefs: Store<WatchingPrefs>;
  /** Action en cours ou retour bref, par série (entryKey) */
  readonly entryActions: Store<ReadonlyMap<string, EntryAction>>;
  readonly notice: Store<WatchingNotice | null>;
  /** Éditeur de commentaire ouvert (null : aucun) */
  readonly notes: Store<NotesSession | null>;
  /** Suit les comptes et la source : la liste est chargée dès que le service affiché est connu */
  start(): void;
  /** Service affiché : la source choisie si elle est connectée, sinon le seul service connecté */
  activeService(): TrackerId | null;
  /** Préférences enregistrées (source, tri), lues avant les comptes : évite de charger la mauvaise liste */
  loadPrefs(): Promise<void>;
  pickSource(source: TrackerId): Promise<void>;
  pickSort(sort: WatchingSort): Promise<void>;
  /** « Réessayer », fin d'un alignement : relit la liste même si le service worker en a une récente */
  reload(): Promise<void>;
  /** Revalidation silencieuse (liste actuelle conservée, pas de skeleton), regroupée sur ~1 s */
  scheduleRevalidation(): void;
  /** +1 / −1 ; `retry` : nouvel essai après un échec partiel (progression absolue sur les seuls services en échec) */
  adjust(entry: WatchingEntry, delta: 1 | -1, retry?: AdjustRetry): Promise<void>;
  /** En pause / Abandonner / Terminé : écrit sur tous les services connectés, la série quitte « En cours » */
  setStatus(entry: WatchingEntry, status: ListStatusChange): Promise<void>;
  exclude(entry: WatchingEntry): Promise<void>;
  include(entry: WatchingEntry): Promise<void>;
  /** « Retirer de la liste » (confirmé) : retirée de chaque service connecté, la série quitte « En cours » */
  remove(entry: WatchingEntry): Promise<void>;
  /** « Commentaire… » : ouvre l'éditeur sous la série et lit le commentaire (AniList d'abord) */
  openNotes(entry: WatchingEntry): void;
  closeNotes(): void;
  /** Enregistre le commentaire ; true si c'est fait partout où la série est (l'éditeur se ferme) */
  saveNotes(entry: WatchingEntry, text: string): Promise<boolean>;
  dispose(): void;
}

export function createWatchingController(deps: WatchingControllerDeps): WatchingController {
  const { accounts } = deps;
  const store = createStore<WatchingState>({ status: 'idle' });
  const prefs = createStore<WatchingPrefs>({ source: 'anilist', sort: DEFAULT_WATCHING_SORT });
  const entryActions = createStore<ReadonlyMap<string, EntryAction>>(new Map());
  const notice = createStore<WatchingNotice | null>(null);
  const notes = createStore<NotesSession | null>(null);
  const swUnreachable = (): string => t('popup.swUnreachable');
  const unsubscribers: (() => void)[] = [];

  // ─── Chargement (stale-while-revalidate) ───────────────────────────────────

  let loadedService: TrackerId | null = null;
  /** Jeton de requête : une réponse arrivée après un changement de source est ignorée */
  let request = 0;

  function activeService(): TrackerId | null {
    const connected = TRACKER_IDS.filter((service) => accounts.store(service).get().status === 'logged-in');
    const { source } = prefs.get();
    return connected.includes(source) ? source : (connected[0] ?? null);
  }

  /** `force` : relit la liste même si le service worker en a une de moins de 90 s (« Réessayer », synchro, import) */
  async function load(service: TrackerId, force = false): Promise<void> {
    const current = ++request;
    const shown = store.get();

    // 1. Cache immédiat (ou liste déjà affichée pour ce service), sinon skeleton
    const cached = shown.status === 'ready' && shown.service === service ? shown.list : await getCachedWatching(service).catch(() => null);
    if (current !== request) return;
    store.set(cached ? { status: 'ready', service, list: cached, refreshing: true, error: null } : { status: 'loading', service });

    // 2. Revalidation par le service worker
    const response = sendMessage('GET_WATCHING', force ? { service, force } : { service }).catch((error: unknown): WatchingResult => {
      log.error('Service worker injoignable :', error);
      return { ok: false, code: 'NETWORK', message: swUnreachable() };
    });
    // Service worker lent ou bloqué (verrou du stockage…) : erreur affichée au bout du délai, mais la réponse
    // reste attendue et s'applique si elle arrive (sauf requête plus récente : « Réessayer », autre source)
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), popupTimeouts.watchingMs);
    });
    const first = await Promise.race([response, timedOut]);
    clearTimeout(timer);
    if (first) {
      apply(current, service, cached, first);
      return;
    }
    log.warn('GET_WATCHING sans réponse après', popupTimeouts.watchingMs, 'ms');
    apply(current, service, cached, { ok: false, code: 'NETWORK', message: t('popup.swTimeout') });
    apply(current, service, cached, await response);
  }

  /** Affiche une réponse GET_WATCHING (ou l'erreur du délai), sauf si une requête plus récente est partie */
  function apply(current: number, service: TrackerId, cached: WatchingList | null, result: WatchingResult): void {
    if (current !== request) return;
    if (result.ok) {
      store.set({ status: 'ready', service, list: result.data, refreshing: false, error: null });
      return;
    }
    if (AUTH_ERRORS.has(result.code)) {
      // markExpired re-résout la source (nouvelle requête) : cette réponse devient obsolète
      accounts.markExpired(service);
      if (current !== request) return;
    }
    store.set(cached ? { status: 'ready', service, list: cached, refreshing: false, error: result.message } : { status: 'error', service, message: result.message });
  }

  function reload(): Promise<void> {
    const service = activeService();
    return service ? load(service, true) : Promise.resolve();
  }

  /** Recharge la liste quand le service affiché change (connexion, déconnexion, choix de source) */
  function syncSource(): void {
    // Comptes encore en lecture : attendre les deux évite de charger (et d'afficher) la mauvaise liste
    if (TRACKER_IDS.some((id) => accounts.store(id).get().status === 'loading')) return;
    const service = activeService();
    if (service === loadedService) return;
    loadedService = service;
    if (service) {
      deps.onServiceShown(service);
      void load(service);
    } else {
      request++;
      store.set({ status: 'idle' });
    }
  }

  let revalidateTimer: ReturnType<typeof setTimeout> | undefined;

  function scheduleRevalidation(): void {
    clearTimeout(revalidateTimer);
    revalidateTimer = setTimeout(() => {
      revalidateTimer = undefined;
      const shown = store.get();
      if (shown.status === 'ready' && shown.service === activeService()) void load(shown.service, true);
    }, REVALIDATE_DEBOUNCE_MS);
  }

  // ─── Préférences ──────────────────────────────────────────────────────────

  async function savePrefs(): Promise<void> {
    const { source, sort } = prefs.get();
    try {
      await chrome.storage.local.set({ [PREFS_KEY]: { source, sort } satisfies WatchingPrefs });
    } catch (error: unknown) {
      log.warn('Préférences du popup non enregistrées :', error);
    }
  }

  // ─── Liste affichée ───────────────────────────────────────────────────────

  /** Liens de séries appris pendant que le popup est ouvert : ajoutés aux séries affichées */
  function applyLearnedLinks(value: unknown): void {
    const shown = store.get();
    if (shown.status !== 'ready') return;
    const entries = withLearnedLinks(shown.list.entries, parsePlatformLinkStore(value));
    if (entries) store.set({ ...shown, list: { ...shown.list, entries } });
  }

  /** Mise à jour optimiste de la progression affichée (avant la revalidation de la liste) */
  function patchProgress(entry: WatchingEntry, outcome: SyncOutcome): void {
    const shown = store.get();
    if (shown.status !== 'ready' || outcome.status !== 'synced') return;
    const result = outcome.results.find((r) => r.service === shown.service)?.outcome;
    if (result?.status !== 'updated' && result?.status !== 'up-to-date') return;
    const key = entryKey(entry);
    const entries = shown.list.entries.map((e) => (entryKey(e) === key ? { ...e, progress: result.progress } : e));
    store.set({ ...shown, list: { ...shown.list, entries } });
  }

  /** Retire la série de la liste affichée (elle n'est plus « en cours » sur ce service) */
  function removeEntry(key: string): void {
    const shown = store.get();
    if (shown.status !== 'ready') return;
    store.set({ ...shown, list: { ...shown.list, entries: shown.list.entries.filter((e) => entryKey(e) !== key) } });
  }

  // ─── Retours (pastille d'une série, bandeau) ─────────────────────────────────

  const entryTimers = new Map<string, ReturnType<typeof setTimeout>>();

  function setEntryAction(key: string, action: EntryAction | null): void {
    entryActions.set(withEntry(entryActions.get(), key, action));
  }

  /** Action en cours sur la série : un second clic est sans effet ; sinon le retour précédent s'efface */
  function beginEntryAction(key: string, kind: 'adjust' | 'status'): boolean {
    if (entryActions.get().get(key)?.phase === 'pending') return false;
    clearTimeout(entryTimers.get(key));
    setEntryAction(key, { phase: 'pending', kind });
    return true;
  }

  /** Retour bref (~3 s) à la place de la pastille d'état de la série */
  function flashEntryFeedback(key: string, feedback: InlineFeedback): void {
    clearTimeout(entryTimers.get(key));
    setEntryAction(key, { phase: 'done', feedback });
    entryTimers.set(
      key,
      setTimeout(() => {
        entryTimers.delete(key);
        setEntryAction(key, null);
      }, ENTRY_FEEDBACK_MS),
    );
  }

  let noticeTimer: ReturnType<typeof setTimeout> | undefined;

  function hideNotice(): void {
    clearTimeout(noticeTimer);
    notice.set(null);
  }

  function showNotice(feedback: InlineFeedback, retry: (() => void) | null = null): void {
    clearTimeout(noticeTimer);
    notice.set({ feedback, retry });
    deps.onNoticeShown();
    // Un échec reste affiché plus longtemps (texte à lire)
    noticeTimer = setTimeout(hideNotice, feedback.tone === 'success' ? NOTICE_MS : NOTICE_MS * 2);
  }

  // ─── Stockage ─────────────────────────────────────────────────────────────

  const onStorageChanged = (changes: Record<string, chrome.storage.StorageChange>, areaName: string): void => {
    if (areaName !== 'local') return;
    // Lien de série appris (page visitée) : « Ouvrir » et la pastille de plateforme suivent sans requête
    const linksChange = changes[PLATFORM_LINKS_KEY];
    if (linksChange) applyLearnedLinks(linksChange.newValue);
    // Synchro dans un onglet : le service worker ne met pas le cache « En cours » à jour → revalidation
    if (changes[STORAGE_KEYS.recentSyncs]) scheduleRevalidation();
  };

  /** Série telle que le service worker l'attend (titre borné par la validation du message) */
  const mediaRef = (entry: WatchingEntry): MediaRef => ({ mediaId: entry.mediaId, malId: entry.malId, title: entry.title.slice(0, 300) });

  const controller: WatchingController = {
    store,
    prefs,
    entryActions,
    notice,
    notes,
    activeService,
    reload,
    scheduleRevalidation,

    start() {
      if (unsubscribers.length > 0) return;
      for (const id of TRACKER_IDS) unsubscribers.push(accounts.store(id).subscribe(syncSource));
      unsubscribers.push(prefs.subscribe(syncSource));
      chrome.storage.onChanged.addListener(onStorageChanged);
      unsubscribers.push(() => chrome.storage.onChanged.removeListener(onStorageChanged));
    },

    async loadPrefs() {
      try {
        const stored = await chrome.storage.local.get(PREFS_KEY);
        const raw: unknown = stored[PREFS_KEY];
        if (typeof raw !== 'object' || raw === null) return;
        // Chaque champ est validé séparément : une valeur inconnue retombe sur la valeur par défaut
        const current = prefs.get();
        prefs.set({
          source: 'source' in raw && isTrackerId(raw.source) ? raw.source : current.source,
          sort: 'sort' in raw && isWatchingSort(raw.sort) ? raw.sort : DEFAULT_WATCHING_SORT,
        });
      } catch (error: unknown) {
        log.warn('Préférences du popup illisibles :', error);
      }
    },

    async pickSource(source) {
      patchStore(prefs, { source });
      await savePrefs();
    },

    async pickSort(sort) {
      patchStore(prefs, { sort });
      await savePrefs();
    },

    async adjust(entry, delta, retry) {
      const key = entryKey(entry);
      if (!beginEntryAction(key, 'adjust')) return;
      if (retry) hideNotice();

      let outcome: SyncOutcome;
      try {
        outcome = await sendMessage('ADJUST_PROGRESS', adjustPayload(entry.mediaId, entry.malId, delta, retry));
      } catch (error: unknown) {
        log.error('Service worker injoignable :', error);
        outcome = { status: 'error', message: swUnreachable() };
      }
      patchProgress(entry, outcome);
      const feedback = adjustFeedback(outcome, delta, retry);
      flashEntryFeedback(key, feedback);
      // Un échec partiel ouvre le bandeau avec « Réessayer » : la pastille seule disparaît trop vite
      const next = feedback.retry;
      if (next) showNotice({ ...feedback, text: `${entry.title} · ${feedback.text}` }, () => void controller.adjust(entry, next.delta, next));
      // Revalidation silencieuse : la liste reflète ensuite l'état réel des services
      scheduleRevalidation();
    },

    async setStatus(entry, status) {
      const key = entryKey(entry);
      if (!beginEntryAction(key, 'status')) return;

      let outcome: SyncOutcome;
      try {
        // Affiche de la carte « À noter » : hôte d'images autorisé uniquement (refusée sinon par la validation du message)
        const coverUrl = toSafeImageUrl(entry.coverUrl);
        outcome = await sendMessage('SET_LIST_STATUS', { mediaId: entry.mediaId, malId: entry.malId, status, coverUrl });
      } catch (error: unknown) {
        log.error('Service worker injoignable :', error);
        outcome = { status: 'error', message: swUnreachable() };
      }

      const feedback = statusFeedback(outcome, status);
      // La série quitte la liste si le service affiché a bien changé de statut (ou l'avait déjà)
      const shown = store.get();
      const shownResult = outcome.status === 'synced' && shown.status === 'ready' ? outcome.results.find((r) => r.service === shown.service)?.outcome : undefined;
      if (shownResult?.status === 'updated' || shownResult?.status === 'up-to-date') removeEntry(key);
      // Bandeau en haut de l'écran (texte complet, y compris les erreurs) : la ligne a pu disparaître
      setEntryAction(key, null);
      showNotice(feedback);
      scheduleRevalidation();
    },

    async exclude(entry) {
      if (entry.mediaId === null) return;
      const key = entryKey(entry);
      try {
        // Aucune clé plateforme dérivable depuis la liste : l'exclusion porte sur la fiche AniList
        await excludeSeries({ platformKey: null, mediaId: entry.mediaId, label: entry.title });
        flashEntryFeedback(key, { tone: 'info', text: t('popup.syncDisabled'), detail: t('popup.syncDisabledDetail') });
      } catch (error: unknown) {
        log.error('Exclusion de la série impossible :', error);
        flashEntryFeedback(key, errorFeedback(t('popup.excludeFailed')));
      }
      await deps.reloadExclusions();
    },

    async include(entry) {
      const exclusions = deps.exclusions.get();
      if (exclusions.status !== 'ready' || entry.mediaId === null) return;
      const key = entryKey(entry);
      try {
        const matches = exclusions.items.filter((e) => e.mediaId === entry.mediaId);
        for (const match of matches) await includeSeries(match.id);
        flashEntryFeedback(key, { tone: 'success', text: t('popup.syncEnabled'), detail: t('popup.syncEnabledDetail') });
      } catch (error: unknown) {
        log.error('Réactivation de la série impossible :', error);
        flashEntryFeedback(key, errorFeedback(t('popup.includeFailed')));
      }
      await deps.reloadExclusions();
    },

    async remove(entry) {
      const key = entryKey(entry);
      if (!beginEntryAction(key, 'status')) return;
      if (notes.get()?.key === key) notes.set(null);

      let outcome: SyncOutcome;
      try {
        outcome = await sendMessage('REMOVE_FROM_LIST', { media: mediaRef(entry) });
      } catch (error: unknown) {
        log.error('Service worker injoignable :', error);
        outcome = { status: 'error', message: swUnreachable() };
      }

      // La série quitte la liste si le service affiché l'a retirée (ou ne l'avait déjà plus)
      const shown = store.get();
      const shownResult = outcome.status === 'synced' && shown.status === 'ready' ? outcome.results.find((r) => r.service === shown.service)?.outcome : undefined;
      if (shownResult?.status === 'updated' || (shownResult?.status === 'skipped' && shownResult.code === 'not-in-list')) removeEntry(key);
      // Bandeau en haut de l'écran (texte complet, y compris les erreurs : session expirée, limite…) : la ligne a pu disparaître
      setEntryAction(key, null);
      showNotice(removeFeedback(outcome));
      scheduleRevalidation();
    },

    openNotes(entry) {
      const key = entryKey(entry);
      if (notes.get()?.key === key) return;
      notes.set({ key, entry, phase: 'loading' });
      // Une réponse arrivée après la fermeture (ou l'ouverture sur une autre série) est ignorée
      const apply = (result: ListNotesResult): void => {
        if (notes.get()?.key !== key) return;
        notes.set(result.ok ? { key, entry, phase: 'ready', inList: result.data.inList, notes: result.data.notes } : { key, entry, phase: 'error', message: result.message });
      };
      sendMessage('GET_LIST_NOTES', { media: mediaRef(entry) })
        .catch((error: unknown): ListNotesResult => {
          log.error('Service worker injoignable :', error);
          return { ok: false, code: 'NETWORK', message: swUnreachable() };
        })
        .then(apply)
        .catch((error: unknown) => log.error('Commentaire non affiché :', error));
    },

    closeNotes() {
      notes.set(null);
    },

    async saveNotes(entry, text) {
      const key = entryKey(entry);
      let outcome: SyncOutcome;
      try {
        outcome = await sendMessage('SET_LIST_NOTES', { media: mediaRef(entry), notes: text });
      } catch (error: unknown) {
        log.error('Service worker injoignable :', error);
        outcome = { status: 'error', message: swUnreachable() };
      }
      const feedback = notesFeedback(outcome, normalizeListNotes(text) === '');
      if (feedback.tone !== 'success') {
        // Échec ou échec partiel : bandeau (texte complet), l'éditeur reste ouvert pour réessayer
        showNotice({ ...feedback, text: `${entry.title} · ${feedback.text}` });
        return false;
      }
      flashEntryFeedback(key, feedback);
      return true;
    },

    dispose() {
      for (const unsubscribe of unsubscribers.splice(0)) unsubscribe();
      request++;
      clearTimeout(revalidateTimer);
      clearTimeout(noticeTimer);
      for (const timer of entryTimers.values()) clearTimeout(timer);
      entryTimers.clear();
    },
  };
  return controller;
}
