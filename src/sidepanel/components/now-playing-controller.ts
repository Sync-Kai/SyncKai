import { createLogger } from '../../browser/logger';
import { getOpenSessions } from '../../browser/storage/sessions';
import { t } from '../../i18n';
import { sendMessage } from '../../protocol/messages';
import { STORAGE_KEYS } from '../../protocol/storage-keys';
import type { FranchiseGraph, ListStates } from '../../shared/franchise';
import type { SessionEpochs } from '../../shared/session-epochs';
import { sameSessions } from '../../shared/session-epochs';
import type { StreamingPlatform } from '../../shared/episode.types';
import type { PanelMedia } from '../../shared/panel-media.types';
import { DEFAULT_SETTINGS, effectivePlayer, SETTINGS_STORAGE_KEY } from '../../shared/settings';
import { getSettings } from '../../browser/storage/settings-access';
import type { TrackerId } from '../../shared/tracker.types';
import { createPageMediaController, type PageMediaContent, type PageMediaController } from '../../ui/page-media-controller';
import type { PlatformAccessStore } from '../../ui/platform-access-store';
import { liveEventRead } from '../now-playing-view';
import { createLiveProgress, type LiveProgress, type LiveTarget } from './live-progress';

const log = createLogger('sidepanel');

// Onglet « En lecture » : fiche de l'onglet suivi par le contrôleur commun (ui/page-media-controller.ts), complétée
// des extras du panneau : détails AniList (GET_PANEL_MEDIA), progression en direct, lecteur préféré, fiche ouverte par
// défaut. Sans rendu : `onChange` prévient l'hôte, qui publie un instantané pour l'arbre Preact (components/now-playing.tsx).

export type NowPlayingContent = PageMediaContent<PanelMedia>;

/** Ordre de visionnage de la franchise de la fiche affichée ; les états de liste restent en mémoire du contrôleur (rien n'est stocké) */
export type OrderState = { status: 'idle' | 'loading' | 'error'; message?: string } | { status: 'ready'; graph: FranchiseGraph; states: ListStates };

const NO_STATES: ListStates = { anilist: null, mal: null };

/** Entrée du graphe (chaîne principale ou extras) : la page change sans quitter la franchise chargée */
const inGraph = (graph: FranchiseGraph, id: number): boolean => graph.main.includes(id) || graph.extras.some((e) => e.id === id);

export interface NowPlayingController extends Omit<PageMediaController<PanelMedia>, 'open' | 'redetect' | 'navigated' | 'synced'> {
  /** Ordre de visionnage : chargé après les détails, publié avec eux */
  readonly order: OrderState;
  /** Relance le chargement après une erreur */
  retryOrder(): void;
  /** Lecteur préféré (réglages) : plateforme du bouton « Regarder » des relations */
  readonly preferred: StreamingPlatform;
  /** Réglage « Fiche ouverte par défaut » (avec les deux comptes connectés) : lien du titre, de la jaquette et des relations */
  readonly entryService: TrackerId;
  /** Réglage « Afficher la progression en direct » */
  readonly liveEnabled: boolean;
  readonly live: LiveProgress;
}

/** Contrôleur de l'onglet : `onChange` redessine le panneau ; `platformAccess` : accès optionnels de la page du panneau */
export function createNowPlayingController(onChange: () => void, platformAccess: PlatformAccessStore): NowPlayingController {
  let tabId: number | null = null;
  let preferred: StreamingPlatform = DEFAULT_SETTINGS.preferredPlayer;
  let entryService: TrackerId = DEFAULT_SETTINGS.entryService;
  /** Désactivé, aucun port n'est ouvert vers l'onglet (faux jusqu'à la lecture du réglage) */
  let liveEnabled = false;

  // ─── Ordre de visionnage ───
  let order: OrderState = { status: 'idle' };
  /** Incrémenté à chaque chargement : une réponse plus ancienne (autre franchise, compte changé) est ignorée */
  let orderRun = 0;
  /** Fiche pour laquelle l'ordre est chargé (ou en chargement) */
  let orderEntry: number | null = null;
  /** Fiche affichée en dernier pendant qu'un chargement de l'ordre est en cours (null : aucune page n'a changé depuis) */
  let latestEntry: number | null = null;
  /** Graphe dont les états sont en cours de lecture (compte changé pendant ce temps : lecture relancée) */
  let graphInHand: FranchiseGraph | null = null;
  /** Sessions avec lesquelles les derniers états ont été lus */
  let seenSessions: SessionEpochs | null = null;
  /** Fiche dont l'ordre a été vérifié (null : à revérifier à la prochaine fiche prête) */
  let settledView: object | null = null;
  /** Action de liste en cours : les relectures de la fiche qu'elle provoque sont regroupées en une lecture `fresh` */
  let actionRunning = false;
  let skippedDuringAction = false;
  /** Prochaine lecture des états après une action de liste : liste MAL relue (le service worker la garde 5 min sinon) */
  let freshNext = false;

  /** États de liste de l'utilisateur ; aucun compte connecté : aucune requête. Échec : pas d'états (l'ordre reste affiché) */
  const fetchStates = async (graph: FranchiseGraph, fresh: boolean): Promise<ListStates> => {
    try {
      const sessions = await getOpenSessions();
      seenSessions = sessions;
      if (sessions.anilist === undefined && sessions.mal === undefined) return NO_STATES;
      const ids = [...graph.main, ...graph.extras.map((e) => e.id)];
      const malIds = ids.flatMap((id) => graph.nodes[id]?.idMal ?? []);
      return await sendMessage('GET_LIST_STATES', fresh ? { mediaIds: ids, malIds, fresh } : { mediaIds: ids, malIds });
    } catch (error: unknown) {
      log.debug('États de liste illisibles :', error);
      return NO_STATES;
    }
  };

  const loadStates = async (run: number, graph: FranchiseGraph): Promise<void> => {
    const fresh = freshNext;
    freshNext = false;
    graphInHand = graph;
    const states = await fetchStates(graph, fresh);
    if (run !== orderRun) return;
    graphInHand = null;
    order = { status: 'ready', graph, states };
    onChange();
    const missing = settleLatest(graph);
    if (missing !== null) void loadOrder(missing);
  };

  /** Page changée pendant le chargement : gardée si le graphe reçu la contient, sinon renvoyée pour un nouveau chargement */
  const settleLatest = (graph: FranchiseGraph): number | null => {
    const latest = latestEntry;
    latestEntry = null;
    if (latest === null) return null;
    if (inGraph(graph, latest)) {
      orderEntry = latest;
      return null;
    }
    return latest;
  };

  /** Graphe déjà chargé : états relus seuls, l'ordre reste affiché pendant ce temps */
  const reloadStates = (graph: FranchiseGraph): Promise<void> => loadStates(++orderRun, graph);

  const loadOrder = async (mediaId: number): Promise<void> => {
    const run = ++orderRun;
    orderEntry = mediaId;
    latestEntry = null;
    graphInHand = null;
    order = { status: 'loading' };
    onChange();
    try {
      const result = await sendMessage('GET_FRANCHISE', { mediaId });
      if (run !== orderRun) return;
      if (result.ok) {
        const missing = settleLatest(result.graph);
        if (missing !== null) await loadOrder(missing);
        else await loadStates(run, result.graph);
      } else {
        order = { status: 'error', message: result.message };
        onChange();
      }
    } catch (error: unknown) {
      log.warn('Service worker injoignable :', error);
      if (run !== orderRun) return;
      order = { status: 'error', message: t('popup.swUnreachable') };
      onChange();
    }
  };

  const resetOrder = (): void => {
    orderRun++;
    orderEntry = null;
    latestEntry = null;
    graphInHand = null;
    settledView = null;
    order = { status: 'idle' };
  };

  /** Fiche affichée avec ses détails : ordre chargé s'il manque, états relus sinon (changement de page, Actualiser, action) */
  const syncOrder = (): void => {
    const { content } = ctl;
    if (content.status !== 'ready') {
      settledView = null;
      // Fiche en cours de lecture (chargement, détection) : l'ordre affiché reste ; plus de fiche : rien à garder
      if (content.status !== 'loading' && content.status !== 'detecting') resetOrder();
      return;
    }
    if (content.refreshing || (!content.details && !content.detailsError)) {
      settledView = null;
      return;
    }
    if (settledView === content.view) return;
    if (actionRunning) {
      skippedDuringAction = true;
      return;
    }
    settledView = content.view;
    const entry = content.view.media.mediaId;
    if (order.status === 'ready' && inGraph(order.graph, entry)) {
      orderEntry = entry;
      void reloadStates(order.graph);
    } else if (order.status === 'loading') {
      // Un chargement est en cours : pas de second parcours, la dernière fiche est tranchée à l'arrivée du graphe
      latestEntry = orderEntry === entry ? null : entry;
    } else void loadOrder(entry);
  };

  /** Connexion ou déconnexion : états relus (aucune requête sans session), jamais ceux de l'ancien compte */
  const onAccountsChange = async (): Promise<void> => {
    let sessions: SessionEpochs;
    try {
      sessions = await getOpenSessions();
    } catch (error: unknown) {
      log.debug('Sessions illisibles :', error);
      return;
    }
    if (seenSessions !== null && sameSessions(seenSessions, sessions)) return;
    const graph = order.status === 'ready' ? order.graph : graphInHand;
    if (graph) void reloadStates(graph);
  };

  const ctl = createPageMediaController<PanelMedia>({
    onChange,
    onContent: () => {
      live.follow(liveTarget());
      syncOrder();
    },
    loadDetails: (mediaId) => sendMessage('GET_PANEL_MEDIA', { mediaId }),
    platformAccess,
  });

  // Progression en direct : nouvel épisode annoncé, synchro terminée ou saison choisie dans la page → page relue
  const live = createLiveProgress((event) => {
    const { content } = ctl;
    const read = liveEventRead('page' in content ? content.page : null, event);
    if (read === 'navigate') ctl.navigated();
    else if (read === 'synced') ctl.synced();
    else if (read === 'redetect') void ctl.redetect(false);
  });

  /**
   * Port vers la page : épisode de la fiche à suivre en direct (page de lecture, réglage actif), ou page de série (saison
   * choisie dans le menu de la page, quel que soit le réglage : aucune progression n'y est affichée)
   */
  const liveTarget = (): LiveTarget | null => {
    const { content } = ctl;
    const page = 'page' in content ? content.page : null;
    if (tabId === null || !page) return null;
    if (page.kind === 'series') return { tabId, episodeId: null };
    return liveEnabled && page.episode ? { tabId, episodeId: page.episode.episodeId } : null;
  };

  const loadSettings = (): void => {
    getSettings()
      .then(async (settings) => {
        // Lecteur « Netflix » sans l'accès accordé : lecteur par défaut
        const player = effectivePlayer(settings.preferredPlayer, await platformAccess.read());
        const playerChanged = player !== preferred;
        const liveChanged = settings.panelLiveProgress !== liveEnabled;
        const entryChanged = settings.entryService !== entryService;
        preferred = player;
        entryService = settings.entryService;
        liveEnabled = settings.panelLiveProgress;
        if (liveChanged) live.follow(liveTarget());
        const { content } = ctl;
        const ready = content.status === 'ready';
        if (liveChanged || (entryChanged && ready) || (playerChanged && ready && order.status === 'ready')) onChange();
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
  const onStorageChange = (changes: Record<string, chrome.storage.StorageChange>, area: string): void => {
    if (area !== 'local') return;
    if (SETTINGS_STORAGE_KEY in changes) loadSettings();
    if (STORAGE_KEYS.anilistToken in changes || STORAGE_KEYS.malToken in changes || STORAGE_KEYS.sessionEpoch in changes) void onAccountsChange();
  };
  chrome.storage.onChanged.addListener(onStorageChange);
  loadSettings();

  return {
    get content() {
      return ctl.content;
    },
    get actions() {
      return ctl.actions;
    },
    get preferred() {
      return preferred;
    },
    get entryService() {
      return entryService;
    },
    get liveEnabled() {
      return liveEnabled;
    },
    get order() {
      return order;
    },
    retryOrder(): void {
      const { content } = ctl;
      if (order.status === 'error' && content.status === 'ready') void loadOrder(content.view.media.mediaId);
    },
    live,
    setTab(next: number | null): void {
      tabId = next;
      ctl.setTab(next);
    },
    refresh: (force) => ctl.refresh(force),
    retry: () => ctl.retry(),
    async runAction(request) {
      actionRunning = true;
      let feedback: Awaited<ReturnType<typeof ctl.runAction>> = null;
      try {
        feedback = await ctl.runAction(request);
      } finally {
        actionRunning = false;
      }
      // Action réussie : liste modifiée, états relus avec la liste MAL à jour ; sinon seulement les relectures reportées
      if (feedback?.tone === 'success' && request.kind !== 'rate' && request.kind !== 'notes') freshNext = true;
      if (feedback?.tone === 'success' || skippedDuringAction) {
        skippedDuringAction = false;
        settledView = null;
        syncOrder();
      }
      return feedback;
    },
    pickSeason: (mediaId) => ctl.pickSeason(mediaId),
    dispose(): void {
      chrome.storage.onChanged.removeListener(onStorageChange);
      ctl.dispose();
      resetOrder();
      tabId = null;
      live.follow(null);
    },
  };
}
