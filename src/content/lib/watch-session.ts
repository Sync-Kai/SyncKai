import { applyLanguageSetting, t } from '../../i18n';
import type { EpisodeInfo } from '../../shared/episode.types';
import { isExcluded, platformSeriesKey } from '../../shared/exclusions';
import { sendMessage } from '../../shared/messages';
import type { LiveOutcome, LiveState } from '../../shared/live.types';
import { failedServices } from '../../shared/sync.types';
import type { TrackerId } from '../../shared/tracker.types';
import { DEFAULT_SETTINGS, getSettings, type NotificationLevel, type SyncSettings } from '../../shared/settings';
import type { StreamingAdapter } from '../adapters/adapter';
import { showEngagementPrompt } from '../ui/engagement-prompt';
import { isAlertTone, promptForOutcome, showsProgress } from '../ui/notification-policy';
import { ALERT_TOAST_MS, NOTICE_TOAST_MS, PILL_TOAST_MS, RETRY_TOAST_MS, bubbleForOutcome, toastForOutcome } from '../ui/sync-toast';
import { showToast, type ToastContent, type ToastHandle, type ToastOptions } from '../ui/toast';
import { createLogger } from '../../shared/logger';
import { isExtensionContextInvalidated } from './extension-context';
import { liveOutcomeOf, type LiveSnapshot } from './live-stream';
import { trackVideoProgress, type VideoProgressTracker } from './video-tracker';
import { waitFor } from './wait-for';

const MIN_EPISODE_DURATION_S = 120;
/** Sans lecteur après ce délai, le panneau affiche « pas de vidéo » ; l'attente passive continue */
const VIDEO_WAIT_TIMEOUT_MS = 30_000;
const METADATA_WAIT_TIMEOUT_MS = 15_000;
/**
 * Événements média captés sur `document` (ils ne remontent pas, mais la phase de capture les voit passer) :
 * rares (un par chargement ou lecture), ils signalent un lecteur apparu ou remplacé sans observer le DOM.
 */
const MEDIA_EVENTS = ['loadstart', 'loadedmetadata', 'play', 'playing'] as const;

const log = createLogger('session');

/**
 * Séries ignorées par le service worker pendant la vie de la page (Netflix : pas un anime), par clé plateforme.
 * Leurs épisodes suivants (lecture automatique) ne sont plus envoyés ; vidé au rechargement de l'onglet.
 */
const ignoredSeries = new Set<string>();

/**
 * Réglages de la page d'options ; valeurs par défaut si le stockage est illisible. Applique au passage la
 * langue choisie : le script de contenu ne suit pas les réglages (PERF-03), il la relit à chaque lecture.
 */
async function loadSettings(): Promise<SyncSettings> {
  try {
    const settings = await getSettings();
    applyLanguageSetting(settings.language);
    return settings;
  } catch (error: unknown) {
    log.warn('Réglages illisibles, valeurs par défaut utilisées :', error);
    return DEFAULT_SETTINGS;
  }
}

/** Résumé lisible sur une ligne (la console tronque les objets) : "One Piece · S24 E25 (affiché E1180) · GE00376431JAJP" */
function formatEpisode(e: EpisodeInfo): string {
  const season = e.seasonNumber !== null ? `S${e.seasonNumber}` : 'S?';
  const episode = e.seasonEpisodeNumber !== null ? `E${e.seasonEpisodeNumber}` : 'E?';
  const displayed = e.displayedEpisodeNumber !== null ? ` (affiché E${e.displayedEpisodeNumber})` : '';
  return `${e.animeTitle} · ${season} ${episode}${displayed} · ${e.episodeId}`;
}

/** "One Piece · épisode 1180" pour le toast */
function formatEpisodeShort(e: EpisodeInfo): string {
  const number = e.displayedEpisodeNumber ?? e.seasonEpisodeNumber;
  return number !== null ? t('content.episodeShort', { title: e.animeTitle, number }) : e.animeTitle;
}

/** Changement d'état de la synchronisation (panneau latéral, progression en direct) */
export type WatchStateListener = (state: LiveState, outcome?: LiveOutcome) => void;

export interface WatchSession {
  readonly episodeId: string;
  /** État instantané (position lue sur la <video>, sans écouteur) pour la progression en direct */
  snapshot(): LiveSnapshot;
  /** Abonnement aux changements d'état ; retourne la fonction de désabonnement */
  onStateChange(listener: WatchStateListener): () => void;
  /** Raccourci « valider l'épisode en cours » : complétion immédiate, sans attendre le % ni le générique */
  forceComplete(): void;
  /** Retire tous les écouteurs/observers liés à cet épisode */
  destroy(): void;
}

/**
 * Envoi de la complétion : aucun (fin automatique encore possible), en cours, synchronisé, série hors périmètre
 * (Netflix), ou rien d'écrit (pause, série exclue, à vérifier, échec) : le raccourci renvoie alors l'épisode.
 */
type Delivery = 'none' | 'sending' | 'synced' | 'ignored' | 'retryable';

/** Origine de la complétion : fin de lecture détectée ou raccourci « valider l'épisode » */
type CompletionTrigger = 'auto' | 'shortcut';

/** Suit la lecture d'un épisode, de la détection du lecteur jusqu'à l'envoi de la complétion. */
export function startWatchSession(adapter: StreamingAdapter, episodeId: string): WatchSession {
  const controller = new AbortController();
  const { signal } = controller;
  let delivery: Delivery = 'none';
  /** Dernier épisode envoyé (toast « déjà synchronisé » du raccourci) */
  let sentEpisode: EpisodeInfo | null = null;
  /** Métadonnées obtenues au démarrage, en réserve si la relecture échoue à la complétion */
  let metadata: EpisodeInfo | null = null;
  /** Début du générique de fin, renseigné dès que la plateforme répond */
  let creditsStart: number | null = null;
  /** Lecteur suivi et point de complétion (null tant que la <video> n'est pas trouvée) */
  let video: HTMLVideoElement | null = null;
  let tracker: VideoProgressTracker | null = null;
  /** Écouteurs du tracker courant : un seul tracker à la fois, annulé quand le lecteur est remplacé */
  let trackerController: AbortController | null = null;
  /** Réglages fixés au démarrage (seuil de complétion) : null tant qu'ils ne sont pas lus */
  let startSettings: SyncSettings | null = null;
  let state: LiveState = 'idle';
  const stateListeners = new Set<WatchStateListener>();

  const setState = (next: LiveState, outcome?: LiveOutcome): void => {
    if (signal.aborted || (next === state && !outcome)) return;
    state = next;
    for (const listener of [...stateListeners]) listener(next, outcome);
  };

  log.info(`▶ Page de lecture détectée (${adapter.platform}, épisode ${episodeId})`);

  const isCurrentEpisode = (): boolean => adapter.getEpisodeId(new URL(location.href)) === episodeId;
  const extract = (): EpisodeInfo | null => (isCurrentEpisode() ? adapter.extractEpisodeInfo(new URL(location.href)) : null);

  /** Métadonnées asynchrones de l'adapter (Netflix) ; un échec inattendu vaut « introuvable » */
  async function load(): Promise<EpisodeInfo | null> {
    if (!adapter.loadEpisodeInfo) return null;
    try {
      return await adapter.loadEpisodeInfo(episodeId, signal);
    } catch (error: unknown) {
      log.warn('Métadonnées de la plateforme indisponibles :', error);
      return null;
    }
  }

  function destroy(): void {
    if (signal.aborted) return;
    controller.abort();
    stateListeners.clear();
    video = null;
    tracker = null;
    trackerController = null;
    log.info(`■ Session terminée (épisode ${episodeId})`);
  }

  /** Script orphelin (extension rechargée ou mise à jour) : averti tout de suite, plutôt qu'à la fin de l'épisode */
  function stopOrphan(): void {
    log.warn('Extension rechargée depuis l’ouverture de la page : recharge l’onglet pour réactiver SyncKai');
    showToast({ tone: 'warning', title: t('content.updated.title'), message: t('content.updated.message') }, { autoHideMs: ALERT_TOAST_MS });
    destroy();
  }

  /** Retour du raccourci quand il n'envoie rien (sinon l'utilisateur le croit cassé) */
  function showShortcutNotice(content: ToastContent): void {
    showToast(content, { variant: 'bubble', autoHideMs: NOTICE_TOAST_MS });
  }

  async function reportCompletion(trigger: CompletionTrigger): Promise<void> {
    if (signal.aborted || !isCurrentEpisode()) return;
    // Un seul envoi automatique par épisode, même si le lecteur recharge sa source ; jamais deux envois simultanés
    if (delivery === 'sending' || (trigger === 'auto' && delivery !== 'none')) return;

    if (isExtensionContextInvalidated()) {
      stopOrphan();
      return;
    }

    // Réservé avant toute attente : le raccourci et la fin de lecture ne doivent pas envoyer deux fois
    delivery = 'sending';
    // Relecture à la complétion (DOM complet), avec repli sur les métadonnées du démarrage,
    // puis nouvelle demande à la plateforme pour un adapter asynchrone
    let episode = extract() ?? metadata;
    if (!episode && adapter.loadEpisodeInfo && isCurrentEpisode()) episode = await load();
    if (signal.aborted) return;
    if (!episode) {
      delivery = 'none';
      // Catalogue généraliste : une vidéo non identifiée (bande-annonce, bonus…) n'est généralement pas un anime,
      // cas normal → rien d'affiché ni consigné au journal (info, pas warn)
      if (adapter.quiet) {
        log.info('Épisode terminé mais métadonnées introuvables : complétion non envoyée (plateforme discrète)');
        setState('idle');
        return;
      }
      log.error('Épisode terminé mais métadonnées introuvables : complétion non envoyée');
      setState('error', { status: 'error', message: t('content.unidentified.message') });
      showToast({ tone: 'error', title: t('content.unidentified.title'), message: t('content.unidentified.message') }, { autoHideMs: ALERT_TOAST_MS });
      return;
    }

    log.info(`✔ Épisode terminé : ${formatEpisode(episode)}`, episode);

    // Relus maintenant : une pause activée pendant l'épisode s'applique immédiatement.
    // Rien d'écrit (pause, série exclue) : le raccourci pourra renvoyer l'épisode après réactivation
    const settings = await loadSettings();
    if (!settings.autoSync) {
      log.info('Synchronisation en pause (options) : épisode non envoyé');
      delivery = 'retryable';
      setState('idle');
      if (trigger === 'shortcut') showShortcutNotice({ tone: 'info', title: t('content.shortcut.paused.title'), message: t('content.shortcut.paused.message') });
      return;
    }
    if (await isSeriesExcluded(episode)) {
      log.info(`Série exclue (Réglages › Séries exclues) : épisode non envoyé (${platformSeriesKey(episode)})`);
      delivery = 'retryable';
      setState('excluded', { status: 'excluded', message: null });
      if (trigger === 'shortcut') showShortcutNotice({ tone: 'info', title: t('common.excludedTitle'), message: t('popup.syncDisabledDetail') });
      return;
    }
    if (ignoredSeries.has(platformSeriesKey(episode))) {
      log.info(`Série déjà ignorée par SyncKai (pas un anime) : épisode non envoyé (${platformSeriesKey(episode)})`);
      delivery = 'ignored';
      setState('idle');
      return;
    }
    await syncWithFeedback(episode, settings.notificationLevel);
  }

  /** Exclusion côté plateforme ; stockage illisible → non exclu (le service worker revérifie après résolution) */
  async function isSeriesExcluded(episode: EpisodeInfo): Promise<boolean> {
    try {
      return await isExcluded({ platformKey: platformSeriesKey(episode) });
    } catch (error: unknown) {
      log.warn('Exclusions illisibles :', error);
      return false;
    }
  }

  function forceComplete(): void {
    if (signal.aborted) return;
    switch (delivery) {
      case 'sending':
        log.info('Raccourci « valider l’épisode » : envoi déjà en cours');
        return;
      case 'synced':
        log.info('Raccourci « valider l’épisode » : épisode déjà synchronisé');
        showToast(
          { tone: 'success', title: t('content.shortcut.alreadySynced'), message: sentEpisode ? formatEpisodeShort(sentEpisode) : undefined },
          { variant: 'pill', autoHideMs: PILL_TOAST_MS },
        );
        return;
      case 'ignored':
        // Série hors périmètre (Netflix, pas un anime) : rien d'affiché, comme à la fin de l'épisode
        log.info('Raccourci « valider l’épisode » : série ignorée par SyncKai');
        return;
      case 'none':
      case 'retryable':
        // Pas encore envoyé, ou rien d'écrit la dernière fois (pause, exclusion, à vérifier, échec) : envoi
        log.info('Raccourci « valider l’épisode » : complétion immédiate');
        void reportCompletion('shortcut');
    }
  }

  /**
   * Envoie l'épisode au service worker et affiche le résultat selon le niveau de notification
   * (voir notification-policy) : les alertes (à vérifier, erreurs) restent toujours affichées.
   * Une erreur (réseau, AniList indisponible, service worker injoignable…) propose "Réessayer" : l'épisode
   * n'est pas perdu.
   */
  async function syncWithFeedback(episode: EpisodeInfo, level: NotificationLevel, services: TrackerId[] | null = null): Promise<void> {
    delivery = 'sending';
    // Plateforme discrète : pas de toast de progression (la série n'est peut-être pas un anime)
    const toast = showsProgress(level) && !adapter.quiet
      ? showToast({ tone: 'info', title: t('common.syncing'), message: formatEpisodeShort(episode) })
      : null;
    setState('syncing');
    const notify = (content: ToastContent, options: ToastOptions): ToastHandle | null => {
      if (toast) {
        toast.update(content, options);
        return toast;
      }
      return isAlertTone(content.tone) ? showToast(content, options) : null;
    };
    /** Bulle d'échec avec « Réessayer » : un seul nouvel envoi à la fois, même après plusieurs clics */
    const notifyRetry = (content: ToastContent, options: ToastOptions, retry: TrackerId[] | null): void => {
      let bubble: ToastHandle | null = null;
      const onClick = (): void => {
        // Plateforme discrète : sans toast de progression, la bulle resterait affichée pendant l'envoi
        if (delivery === 'sending') return;
        bubble?.dismiss();
        // Nouvelle tentative explicite : mode détaillé forcé pour voir la progression et le résultat
        void syncWithFeedback(episode, 'detailed', retry);
      };
      bubble = notify({ ...content, action: { label: t('common.retry'), onClick } }, options);
    };

    try {
      const outcome = await sendMessage('EPISODE_COMPLETED', { episode, services });
      log.info('Résultat de la synchronisation :', outcome);
      sentEpisode = episode;
      // Série hors périmètre (Netflix, pas un anime) : rien d'affiché, épisodes suivants non renvoyés.
      // Accès Netflix retiré : rien d'affiché non plus, mais la série n'est pas retenue (accès accordé de nouveau)
      if (outcome.status === 'ignored') {
        const noAccess = outcome.noAccess === true;
        if (!noAccess) ignoredSeries.add(platformSeriesKey(episode));
        delivery = noAccess ? 'retryable' : 'ignored';
        toast?.dismiss();
        setState('idle');
        return;
      }
      const live = liveOutcomeOf(outcome);
      // Synchronisé partout : le raccourci n'a plus rien à envoyer ; sinon (à vérifier, échec, exclue…) il renvoie
      delivery = live.state === 'synced' ? 'synced' : 'retryable';
      if (!signal.aborted) setState(live.state, live.outcome);
      // Échec global → tout relancer ; échec partiel → seulement les services en erreur
      const retry = outcome.status === 'error' ? null : failedServices(outcome);
      if (retry === null || retry.length > 0) {
        notifyRetry(bubbleForOutcome(outcome), { variant: 'bubble', autoHideMs: RETRY_TOAST_MS }, retry);
        return;
      }
      // Note de fin de série / revisionnage : bulle à tous les niveaux (même en plein écran), à la place du résultat
      const prompt = promptForOutcome(outcome);
      if (prompt) {
        showEngagementPrompt(prompt);
        return;
      }
      const result = toastForOutcome(outcome, level, document.fullscreenElement !== null);
      if (result) {
        // Pas de toast de progression (discret) : la pastille de succès est créée ici
        if (toast) toast.update(result.content, { variant: result.variant, autoHideMs: result.autoHideMs });
        else showToast(result.content, { variant: result.variant, autoHideMs: result.autoHideMs });
      } else {
        toast?.dismiss();
      }
    } catch (error: unknown) {
      // Rien d'écrit : la fin de lecture peut de nouveau déclencher l'envoi (source rechargée), le raccourci aussi
      delivery = 'none';
      log.error('Service worker injoignable :', error);
      setState('error', { status: 'error', message: t('content.unreachable.message') });
      notifyRetry(
        { tone: 'error', title: t('content.unreachable.title'), message: t('content.unreachable.message') },
        { variant: 'bubble', autoHideMs: RETRY_TOAST_MS },
        services,
      );
    }
  }

  async function waitForMetadata(): Promise<void> {
    // Après une navigation SPA, le DOM/JSON-LD peut encore décrire l'épisode précédent :
    // l'adapter rejette ces données périmées, on attend donc qu'elles soient à jour
    // Adapter asynchrone (Netflix) : métadonnées demandées à la plateforme plutôt qu'attendues dans le DOM
    metadata = adapter.loadEpisodeInfo ? await load() : await waitFor(extract, { signal, timeoutMs: METADATA_WAIT_TIMEOUT_MS });
    if (signal.aborted) return;
    if (metadata) log.info(`Épisode identifié : ${formatEpisode(metadata)}`, metadata);
    // Catalogue généraliste (Netflix) : /watch/{id de série} avant redirection, bande-annonce… → cas normal, hors journal
    else if (adapter.quiet) log.info('Métadonnées indisponibles pour l’instant, nouvel essai à la fin de l’épisode');
    else log.warn('Métadonnées indisponibles pour l’instant, nouvel essai à la fin de l’épisode');
  }

  /** Suit `found` : le tracker précédent (lecteur remplacé) est annulé avec tous ses écouteurs */
  function attach(found: HTMLVideoElement, settings: SyncSettings): void {
    log.info(video ? 'Lecteur vidéo remplacé, suivi rattaché :' : 'Lecteur vidéo trouvé :', found.id || '(sans id)');
    trackerController?.abort();
    trackerController = new AbortController();
    video = found;
    tracker = trackVideoProgress(found, {
      fallbackRatio: settings.completionPercentage / 100,
      getCreditsStart: () => creditsStart,
      minDurationSeconds: MIN_EPISODE_DURATION_S,
      onCompleted: () => void reportCompletion('auto'),
      signal: AbortSignal.any([signal, trackerController.signal]),
      logger: log,
    });
    // Complétion déjà partie (raccourci pendant l'attente du lecteur) : l'état n'est pas écrasé
    if (state === 'idle' || state === 'no-video') setState(settings.autoSync ? 'watching' : 'idle');
  }

  /**
   * Lecteur désigné par l'adapter : suivi rattaché s'il a changé (lecteur apparu tard, remplacé après une
   * navigation SPA, ou première <video> trouvée qui n'était pas le lecteur).
   */
  function refreshVideo(): void {
    if (signal.aborted || !startSettings) return;
    const found = adapter.findVideo();
    if (found && found !== video) attach(found, startSettings);
  }

  /**
   * Attente passive du lecteur, sans limite de durée : chaque événement média capté sur `document` relit
   * `findVideo()`. Les écouteurs vivent autant que la session (retirés par son signal).
   */
  function watchVideo(): void {
    const onMediaEvent = (): void => {
      // Première lecture après une mise à jour de l'extension : averti tout de suite, pas à la fin de l'épisode
      if (isExtensionContextInvalidated()) stopOrphan();
      else refreshVideo();
    };
    for (const type of MEDIA_EVENTS) document.addEventListener(type, onMediaEvent, { capture: true, signal });
    refreshVideo();
    if (video) return;
    const timer = setTimeout(() => {
      if (video || signal.aborted) return;
      log.warn(`Aucune balise <video> trouvée après ${VIDEO_WAIT_TIMEOUT_MS / 1000} s : attente du lecteur`);
      setState('no-video');
    }, VIDEO_WAIT_TIMEOUT_MS);
    signal.addEventListener('abort', () => clearTimeout(timer), { once: true });
  }

  function snapshot(): LiveSnapshot {
    // Panneau ouvert : lecteur détaché du DOM sans nouvel événement capté → suivi rattaché au lecteur actuel
    if (video && !video.isConnected) refreshVideo();
    const duration = video && Number.isFinite(video.duration) && video.duration > 0 ? video.duration : null;
    return {
      episodeId,
      t: video && duration !== null ? video.currentTime : null,
      duration,
      paused: video?.paused ?? true,
      point: tracker?.completionPoint() ?? null,
      state,
    };
  }

  function onStateChange(listener: WatchStateListener): () => void {
    if (signal.aborted) return () => undefined;
    stateListeners.add(listener);
    return () => stateListeners.delete(listener);
  }

  async function init(): Promise<void> {
    // Déclenchement fixé pour l'épisode : un changement de réglage s'applique au suivant
    const settings = await loadSettings();
    if (signal.aborted) return;
    log.info(
      settings.completionTrigger === 'credits'
        ? `Déclenchement : générique de fin (repli à ${settings.completionPercentage} %)`
        : `Déclenchement : ${settings.completionPercentage} % de la vidéo`,
    );
    if (settings.completionTrigger === 'credits') {
      void adapter.getCreditsStart?.(episodeId, signal).then((start) => {
        creditsStart = start;
      });
    }
    startSettings = settings;
    watchVideo();
  }

  const session: WatchSession = { episodeId, snapshot, onStateChange, forceComplete, destroy };
  // Script orphelin (extension mise à jour depuis le chargement de la page) : averti dès l'ouverture de l'épisode
  if (isExtensionContextInvalidated()) {
    stopOrphan();
    return session;
  }
  void waitForMetadata();
  void init();
  return session;
}
