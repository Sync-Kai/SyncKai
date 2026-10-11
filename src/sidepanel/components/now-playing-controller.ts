import { t } from '../../i18n';
import { createLogger } from '../../shared/logger';
import { sendMessage } from '../../shared/messages';
import type { StreamingPlatform } from '../../shared/episode.types';
import type { PageMediaInfo, PageMediaView } from '../../shared/page-media.types';
import type { PanelMedia } from '../../shared/panel-media.types';
import { DEFAULT_SETTINGS, getSettings, SETTINGS_STORAGE_KEY } from '../../shared/settings';
import type { ListStatusChange } from '../../shared/sync.types';
import type { InlineFeedback } from '../../popup/state';
import { mediaActionKey, runMediaAction, type MediaActionRequest } from '../../ui/media-action-requests';
import type { MediaActionsState } from '../../ui/media-actions';
import { isPartialEpisodePage, pageKey, shouldRedetect } from '../now-playing-view';
import { isCachedPageMedia, matchCachedPageMedia, pageMediaCacheKey, readCachedPageMedia, storeCachedPageMedia } from '../../shared/page-media-cache';
import { requestPageMedia } from '../presence';
import { createLiveProgress, type LiveProgress, type LiveTarget } from './live-progress';

const log = createLogger('sidepanel');

// Onglet « En lecture » : état de la fiche de l'onglet suivi (détection, résolution, actions), sans rendu.
// Le rendu (now-playing.ts) lit cet état à chaque `onChange`.

export type NowPlayingContent =
  /** Aucun onglet Crunchyroll / ADN suivi */
  | { status: 'idle' }
  /** Interrogation du script de contenu */
  | { status: 'detecting' }
  /** Page de la plateforme sans série (accueil, catalogue…) ; `unreachable` : script de contenu muet (orphelin) */
  | { status: 'no-page'; unreachable: boolean }
  | { status: 'loading'; page: PageMediaInfo }
  /** Aucune fiche AniList trouvée ; `untracked` : série ignorée (Netflix, pas un anime), rien à suivre ni à vérifier */
  | { status: 'not-found'; page: PageMediaInfo; message: string; untracked: boolean }
  | { status: 'error'; page: PageMediaInfo; message: string }
  /** `panel` null : détails AniList non chargés (`panelError` renseigné en cas d'échec) */
  | { status: 'ready'; page: PageMediaInfo; view: PageMediaView; panel: PanelMedia | null; panelError: string | null; refreshing: boolean };

/** Nouvelles tentatives quand la page n'est pas encore lisible (navigation SPA, chargement) */
const DETECT_RETRY_DELAYS_MS: readonly number[] = [0, 700, 1_800];
const FEEDBACK_MS = 4_000;
/** Page de lecture lue sans ses données structurées : nouvelles lectures en arrière-plan */
const PARTIAL_RECHECK_MS: readonly number[] = [2_500, 5_000, 10_000];
/** Relecture demandée pendant un chargement ou une action : réessayée après ce délai */
const FOLLOW_UP_RETRY_MS = 1_000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const NO_ACTIONS: MediaActionsState = { busy: null, confirm: null, feedback: null };

export interface NowPlayingController {
  readonly content: NowPlayingContent;
  readonly actions: MediaActionsState;
  /** Lecteur préféré (réglages) : plateforme du bouton « Regarder » des relations */
  readonly preferred: StreamingPlatform;
  /** Réglage « Afficher la progression en direct » */
  readonly liveEnabled: boolean;
  readonly live: LiveProgress;
  /** Synopsis déplié (remis à zéro à chaque nouvel épisode) */
  expanded: boolean;
  /** Onglet suivi (null hors Crunchyroll / ADN) ; rappelé à chaque navigation de l'onglet */
  setTab(tabId: number | null): void;
  /** Relit la page de l'onglet ; `force` : relecture demandée (bouton Actualiser), squelette compris */
  refresh(force: boolean): Promise<void>;
  /** Recharge la fiche de la page affichée sans cache (« Réessayer ») */
  retry(): void;
  runAction(request: MediaActionRequest): Promise<void>;
  /** Ouvre / ferme la confirmation Abandonner / Terminé ; false si rien n'a changé */
  setConfirm(status: ListStatusChange | null): boolean;
  pickSeason(mediaId: number): void;
}

/** Contrôleur de l'onglet : `onChange` redessine le panneau */
export function createNowPlayingController(onChange: () => void): NowPlayingController {
  let tabId: number | null = null;
  let content: NowPlayingContent = { status: 'idle' };
  let actions: MediaActionsState = NO_ACTIONS;
  let expanded = false;
  /** Saison choisie dans le sélecteur, pour la page affichée */
  let manualId: number | null = null;
  let run = 0;
  /** `run` de la détection de page en cours (refresh / redetect), null sinon */
  let detectingRun: number | null = null;
  /** Mode (`fresh`) de la dernière résolution lancée : repris si elle est relancée après avoir été annulée */
  let lastFresh = false;
  /**
   * Rechargement de la fiche dû même si la page relue n'a pas changé : `fresh` (action terminée pendant une
   * détection, cache ignoré) ou `cache` (fiche réécrite ailleurs). Consommé par la prochaine résolution.
   */
  let pendingReload: 'fresh' | 'cache' | null = null;
  /** Incrémenté à chaque remise à zéro des actions (autre onglet, autre page) : le retour d'une action plus ancienne est ignoré */
  let actionEpoch = 0;
  let feedbackTimer: ReturnType<typeof setTimeout> | undefined;
  let preferred: StreamingPlatform = DEFAULT_SETTINGS.preferredPlayer;
  /** Désactivé, aucun port n'est ouvert vers l'onglet (faux jusqu'à la lecture du réglage) */
  let liveEnabled = false;

  const loadSettings = (): void => {
    getSettings()
      .then((settings) => {
        const playerChanged = settings.preferredPlayer !== preferred;
        const liveChanged = settings.panelLiveProgress !== liveEnabled;
        preferred = settings.preferredPlayer;
        liveEnabled = settings.panelLiveProgress;
        if (liveChanged) live.follow(liveTarget());
        if (liveChanged || (playerChanged && content.status === 'ready' && content.panel?.relations.some((r) => r.platforms.length > 1))) onChange();
      })
      .catch((error: unknown) => {
        log.debug('Réglages illisibles :', error);
        // Réglages illisibles : comportement par défaut (progression en direct affichée)
        if (liveEnabled === DEFAULT_SETTINGS.panelLiveProgress) return;
        liveEnabled = DEFAULT_SETTINGS.panelLiveProgress;
        live.follow(liveTarget());
        onChange();
      });
  };
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && SETTINGS_STORAGE_KEY in changes) loadSettings();
  });

  /** Relectures d'une page partielle : épisode concerné et nombre d'essais déjà faits */
  let recheck: { episodeId: string | null; count: number } = { episodeId: null, count: 0 };
  let recheckTimer: ReturnType<typeof setTimeout> | undefined;
  let followUpTimer: ReturnType<typeof setTimeout> | undefined;

  /** Horodatage de la dernière fiche écrite par ce panneau dans le cache de l'onglet (son propre écho est ignoré) */
  let lastWrittenAt: number | null = null;

  // Progression en direct : nouvel épisode annoncé ou synchro terminée → page relue
  const live = createLiveProgress((event) => {
    if (shouldRedetect('page' in content ? content.page : null, event)) void redetect(false);
  });
  loadSettings();

  // Fiche de l'onglet réécrite ailleurs (synchro par le service worker, action dans le popup) : appliquée tout de suite
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'session' || tabId === null) return;
    const change = changes[pageMediaCacheKey(tabId)];
    const entry: unknown = change?.newValue;
    if (!isCachedPageMedia(entry) || entry.resolvedAt === lastWrittenAt) return;
    void redetect(true);
  });

  /** Épisode de la fiche à suivre en direct (page de lecture uniquement, réglage actif) */
  const liveTarget = (): LiveTarget | null => {
    if (!liveEnabled) return null;
    const page = 'page' in content ? content.page : null;
    return tabId !== null && page?.kind === 'episode' && page.episode ? { tabId, episodeId: page.episode.episodeId } : null;
  };

  const set = (next: NowPlayingContent): void => {
    content = next;
    live.follow(liveTarget());
    onChange();
  };
  const patchActions = (patch: Partial<MediaActionsState>): void => {
    actions = { ...actions, ...patch };
    onChange();
  };
  /** Autre onglet ou autre page : actions, confirmation et retour oubliés ; une action encore en vol ne touchera plus à rien */
  const resetActions = (): void => {
    actionEpoch++;
    clearTimeout(feedbackTimer);
    actions = NO_ACTIONS;
  };

  // ─── Données ──────────────────────────────────────────────────────────

  /** Série / épisode de l'onglet (quelques essais : la page peut être en cours de rendu) */
  async function detect(current: number, id: number): Promise<PageMediaInfo | null | 'unreachable'> {
    let reached = false;
    /** Lecture partielle (JSON-LD pas encore là) : gardée en dernier recours */
    let partial: PageMediaInfo | null = null;
    for (const wait of DETECT_RETRY_DELAYS_MS) {
      if (wait > 0) await delay(wait);
      if (current !== run) return null;
      const response = await requestPageMedia(id);
      if (response !== 'unreachable') reached = true;
      if (response === 'unreachable' || response === null) continue;
      if (!isPartialEpisodePage(response)) return response;
      partial = response;
    }
    return partial ?? (reached ? null : 'unreachable');
  }

  /**
   * Détection suivie : `detectingRun` reste posé jusqu'à la reprise de l'appelant, qui décide aussitôt
   * (sans attente) de la résolution à lancer ; une action qui se termine entre-temps ne peut pas s'intercaler.
   */
  async function detectTracked(current: number, id: number): Promise<PageMediaInfo | null | 'unreachable'> {
    detectingRun = current;
    const page = await detect(current, id);
    if (detectingRun === current) detectingRun = null;
    return page;
  }

  /** Page partielle : relue plus tard (essais limités par épisode) jusqu'à obtenir l'épisode complet */
  function scheduleRecheck(page: PageMediaInfo): void {
    clearTimeout(recheckTimer);
    const episodeId = page.episode?.episodeId ?? null;
    if (recheck.episodeId !== episodeId) recheck = { episodeId, count: 0 };
    if (!isPartialEpisodePage(page)) return;
    const wait = PARTIAL_RECHECK_MS[recheck.count];
    if (wait === undefined) return;
    recheck.count++;
    recheckTimer = setTimeout(() => void redetect(false), wait);
  }

  /**
   * Fiche stable : ni chargement de la fiche ni de ses détails en cours. Une résolution annulée par une
   * relecture laisse la fiche instable (squelette, « Actualisation » ou détails en attente) : elle doit être relancée.
   */
  const contentSettled = (): boolean =>
    content.status === 'not-found' ||
    content.status === 'error' ||
    (content.status === 'ready' && !content.refreshing && (content.panel !== null || content.panelError !== null));

  /** Fiche stable et aucune action en cours : une relecture peut la remplacer */
  const settled = (): boolean => actions.busy === null && contentSettled();

  /**
   * Relit la page de l'onglet sans repasser par le squelette ; recalcule la fiche si la page a changé,
   * ou toujours avec `reresolve` (synchro terminée : la correspondance mémorisée prime sur la saison devinée).
   */
  async function redetect(reresolve: boolean): Promise<void> {
    clearTimeout(followUpTimer);
    const id = tabId;
    if (id === null) return;
    if (!settled()) {
      // Chargement ou action en cours : la relecture est reportée, jamais perdue
      if (content.status !== 'idle' && content.status !== 'no-page') followUpTimer = setTimeout(() => void redetect(reresolve), FOLLOW_UP_RETRY_MS);
      return;
    }
    const current = ++run;
    // Rechargement dû même si cette relecture est annulée par une autre (refresh) : celle-ci le reprendra
    if (reresolve) pendingReload ??= 'cache';
    const page = await detectTracked(current, id);
    if (current !== run || !page || page === 'unreachable') return;
    const known = 'page' in content ? content.page : null;
    scheduleRecheck(page);
    const samePage = known !== null && pageKey(known) === pageKey(page);
    if (pendingReload === null && samePage) return;
    if (known?.episode?.episodeId !== page.episode?.episodeId) {
      manualId = null;
      expanded = false;
      resetActions();
    }
    await resolve(page, true, samePage && pendingReload === 'fresh');
  }

  async function loadDetails(current: number, page: PageMediaInfo, view: PageMediaView, refreshing: boolean): Promise<void> {
    const previous = content.status === 'ready' && content.view.media.mediaId === view.media.mediaId ? content.panel : null;
    set({ status: 'ready', page, view, panel: previous, panelError: null, refreshing });
    if (previous && !refreshing) return;
    let panel: PanelMedia | null = previous;
    let panelError: string | null = null;
    try {
      const result = await sendMessage('GET_PANEL_MEDIA', { mediaId: view.media.mediaId });
      if (result.ok) panel = result.data;
      else panelError = result.message;
    } catch (error: unknown) {
      log.warn('Service worker injoignable :', error);
      panelError = t('popup.swUnreachable');
    }
    if (current !== run) return;
    set({ status: 'ready', page, view, panel, panelError: panel ? null : panelError, refreshing: false });
  }

  /** Fiche de l'onglet en cache (popup, synchro, panneau) valable pour cette page */
  async function cachedView(id: number, page: PageMediaInfo): Promise<PageMediaView | null> {
    try {
      return matchCachedPageMedia(await readCachedPageMedia(id), page, Date.now())?.view ?? null;
    } catch (error: unknown) {
      log.debug('Cache de la fiche illisible :', error);
      return null;
    }
  }

  /**
   * Résout la fiche de la page : cache de l'onglet d'abord (même fiche que le popup et la synchro), sinon
   * RESOLVE_PAGE_MEDIA. `silent` : la fiche reste affichée ; `fresh` : cache ignoré (après une action, « Actualiser »).
   */
  async function resolve(page: PageMediaInfo, silent: boolean, fresh = false): Promise<void> {
    const current = ++run;
    const id = tabId;
    lastFresh = fresh;
    pendingReload = null;
    if (silent && content.status === 'ready') set({ ...content, refreshing: true });
    else set({ status: 'loading', page });
    if (!fresh && manualId === null && id !== null) {
      const view = await cachedView(id, page);
      if (current !== run) return;
      if (view) {
        await loadDetails(current, page, view, false);
        return;
      }
    }
    try {
      const result = await sendMessage('RESOLVE_PAGE_MEDIA', { page, mediaId: manualId });
      if (current !== run) return;
      if (result.ok && id !== null) {
        storeCachedPageMedia(id, page, result.data, 'resolve')
          .then((entry) => {
            if (entry) lastWrittenAt = entry.resolvedAt;
          })
          .catch((error: unknown) => log.debug('Fiche non mise en cache :', error));
      }
      if (result.ok) await loadDetails(current, page, result.data, false);
      else if (result.code === 'NOT_FOUND' || result.code === 'NOT_TRACKED') set({ status: 'not-found', page, message: result.message, untracked: result.code === 'NOT_TRACKED' });
      else set({ status: 'error', page, message: result.message });
    } catch (error: unknown) {
      log.warn('Service worker injoignable :', error);
      if (current === run) set({ status: 'error', page, message: t('popup.swUnreachable') });
    }
  }

  /** Lit la page de l'onglet et recharge la fiche si elle a changé (`force` : relecture demandée) */
  async function refresh(force: boolean): Promise<void> {
    const id = tabId;
    if (id === null) return;
    // Annule toute résolution en cours : relancée plus bas si la page n'a pas changé
    const current = ++run;
    const known = 'page' in content ? content.page : null;
    if (!known || force) set({ status: 'detecting' });
    const page = await detectTracked(current, id);
    if (current !== run) return;
    if (!page || page === 'unreachable') {
      set({ status: 'no-page', unreachable: page === 'unreachable' });
      return;
    }
    scheduleRecheck(page);
    const samePage = known !== null && pageKey(known) === pageKey(page);
    const stable = contentSettled() && content.status !== 'error' && pendingReload === null;
    // Même page déjà affichée et stable (fin de chargement, retour d'onglet) : rien à recharger
    if (!force && samePage && stable) return;
    if (!samePage) {
      manualId = null;
      expanded = false;
      resetActions();
      await resolve(page, false, force);
      return;
    }
    // Même page dont la résolution vient d'être annulée (ou rendue caduque par une action) : relancée, fiche gardée
    const fresh = force || pendingReload === 'fresh' || (!contentSettled() && lastFresh);
    await resolve(page, !force && content.status === 'ready', fresh);
  }

  // ─── Actions (mêmes messages que le popup) ────────────────────────────

  function showFeedback(feedback: InlineFeedback): void {
    clearTimeout(feedbackTimer);
    patchActions({ feedback });
    feedbackTimer = setTimeout(() => patchActions({ feedback: null }), feedback.tone === 'success' ? FEEDBACK_MS : FEEDBACK_MS * 2);
  }

  async function runAction(request: MediaActionRequest): Promise<void> {
    if (actions.busy !== null || content.status !== 'ready') return;
    const { page, view } = content;
    const epoch = actionEpoch;
    patchActions({ busy: mediaActionKey(request), confirm: null });
    const feedback = await runMediaAction(request, view, (error) => log.warn('Service worker injoignable :', error));
    // Onglet ou page changés pendant l'envoi : la fiche affichée n'est plus celle de l'action, son retour est ignoré
    if (epoch !== actionEpoch) return;
    patchActions({ busy: null });
    showFeedback(feedback);
    // Relecture de la page en cours (navigation dans l'onglet) : c'est elle qui rechargera la fiche, sans cache.
    // Une résolution de l'ancienne page l'annulerait et afficherait la fiche quittée.
    if (detectingRun === run) {
      pendingReload = 'fresh';
      return;
    }
    // Même onglet et même épisode (sinon `actionEpoch` aurait changé) : page affichée, éventuellement relue entre-temps
    await resolve('page' in content ? content.page : page, true, true);
  }

  return {
    get content() {
      return content;
    },
    get actions() {
      return actions;
    },
    get preferred() {
      return preferred;
    },
    get liveEnabled() {
      return liveEnabled;
    },
    live,
    get expanded() {
      return expanded;
    },
    set expanded(value: boolean) {
      expanded = value;
    },
    setTab(next: number | null): void {
      const changed = next !== tabId;
      tabId = next;
      if (changed || next === null) {
        clearTimeout(recheckTimer);
        clearTimeout(followUpTimer);
      }
      // Autre onglet : l'action en cours sur l'onglet quitté ne doit rien afficher ici
      if (changed) resetActions();
      if (next === null) {
        run++;
        content = { status: 'idle' };
        live.follow(null);
        return;
      }
      void refresh(changed);
    },
    refresh,
    retry(): void {
      if (!('page' in content)) return;
      void resolve(content.page, content.status === 'ready', true);
    },
    runAction,
    setConfirm(status: ListStatusChange | null): boolean {
      if (actions.busy !== null || actions.confirm === status) return false;
      patchActions({ confirm: status });
      return true;
    },
    pickSeason(mediaId: number): void {
      if (actions.busy !== null || content.status !== 'ready') return;
      manualId = mediaId;
      actions = { ...actions, confirm: null, feedback: null };
      void resolve(content.page, true);
    },
  };
}
