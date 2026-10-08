import { t } from '../../i18n';
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
import { ALERT_TOAST_MS, RETRY_TOAST_MS, bubbleForOutcome, toastForOutcome } from '../ui/sync-toast';
import { showToast, type ToastContent, type ToastOptions } from '../ui/toast';
import { createLogger } from '../../shared/logger';
import { liveOutcomeOf, type LiveSnapshot } from './live-stream';
import { trackVideoProgress, type VideoProgressTracker } from './video-tracker';
import { waitFor } from './wait-for';

const MIN_EPISODE_DURATION_S = 120;
const VIDEO_WAIT_TIMEOUT_MS = 30_000;
const METADATA_WAIT_TIMEOUT_MS = 15_000;

const log = createLogger('session');

/**
 * Séries ignorées par le service worker pendant la vie de la page (Netflix : pas un anime), par clé plateforme.
 * Leurs épisodes suivants (lecture automatique) ne sont plus envoyés ; vidé au rechargement de l'onglet.
 */
const ignoredSeries = new Set<string>();

/** Réglages de la page d'options ; valeurs par défaut si le stockage est illisible */
async function loadSettings(): Promise<SyncSettings> {
  try {
    return await getSettings();
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

/** Vrai si l'extension a été rechargée/mise à jour : ce content script est alors orphelin. */
function isExtensionContextInvalidated(): boolean {
  return typeof chrome.runtime?.id !== 'string';
}

/** Suit la lecture d'un épisode, de la détection du lecteur jusqu'à l'envoi de la complétion. */
export function startWatchSession(adapter: StreamingAdapter, episodeId: string): WatchSession {
  const controller = new AbortController();
  const { signal } = controller;
  let completionReported = false;
  /** Métadonnées obtenues au démarrage, en réserve si la relecture échoue à la complétion */
  let metadata: EpisodeInfo | null = null;
  /** Début du générique de fin, renseigné dès que la plateforme répond */
  let creditsStart: number | null = null;
  /** Lecteur suivi et point de complétion (null tant que la <video> n'est pas trouvée) */
  let video: HTMLVideoElement | null = null;
  let tracker: VideoProgressTracker | null = null;
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
    log.info(`■ Session terminée (épisode ${episodeId})`);
  }

  async function reportCompletion(): Promise<void> {
    // Un seul envoi par épisode, même si le lecteur recharge sa source
    if (completionReported || signal.aborted || !isCurrentEpisode()) return;

    if (isExtensionContextInvalidated()) {
      log.warn('Extension rechargée depuis l’ouverture de la page : recharge l’onglet pour réactiver SyncKai');
      showToast({ tone: 'warning', title: t('content.updated.title'), message: t('content.updated.message') }, { autoHideMs: ALERT_TOAST_MS });
      destroy();
      return;
    }

    // Réservé avant toute attente : le raccourci et la fin de lecture ne doivent pas envoyer deux fois
    completionReported = true;
    // Relecture à la complétion (DOM complet), avec repli sur les métadonnées du démarrage,
    // puis nouvelle demande à la plateforme pour un adapter asynchrone
    let episode = extract() ?? metadata;
    if (!episode && adapter.loadEpisodeInfo && isCurrentEpisode()) episode = await load();
    if (signal.aborted) return;
    if (!episode) {
      completionReported = false;
      // Catalogue généraliste : une vidéo non identifiée n'est généralement pas un anime, rien n'est affiché
      if (adapter.quiet) {
        log.warn('Épisode terminé mais métadonnées introuvables : complétion non envoyée (plateforme discrète)');
        setState('idle');
        return;
      }
      log.error('Épisode terminé mais métadonnées introuvables : complétion non envoyée');
      setState('error', { status: 'error', message: t('content.unidentified.message') });
      showToast({ tone: 'error', title: t('content.unidentified.title'), message: t('content.unidentified.message') }, { autoHideMs: ALERT_TOAST_MS });
      return;
    }

    log.info(`✔ Épisode terminé : ${formatEpisode(episode)}`, episode);

    // Relus maintenant : une pause activée pendant l'épisode s'applique immédiatement
    const settings = await loadSettings();
    if (!settings.autoSync) {
      log.info('Synchronisation en pause (options) : épisode non envoyé');
      setState('idle');
      return;
    }
    if (await isSeriesExcluded(episode)) {
      log.info(`Série exclue (Réglages › Séries exclues) : épisode non envoyé (${platformSeriesKey(episode)})`);
      setState('excluded', { status: 'excluded', message: null });
      return;
    }
    if (ignoredSeries.has(platformSeriesKey(episode))) {
      log.info(`Série déjà ignorée par SyncKai (pas un anime) : épisode non envoyé (${platformSeriesKey(episode)})`);
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
    if (completionReported) {
      log.info('Raccourci « valider l’épisode » : épisode déjà synchronisé');
      return;
    }
    log.info('Raccourci « valider l’épisode » : complétion immédiate');
    void reportCompletion();
  }

  /**
   * Envoie l'épisode au service worker et affiche le résultat selon le niveau de notification
   * (voir notification-policy) : les alertes (à vérifier, erreurs) restent toujours affichées.
   * Une erreur (réseau, AniList indisponible…) propose "Réessayer" : l'épisode n'est pas perdu.
   */
  async function syncWithFeedback(episode: EpisodeInfo, level: NotificationLevel, services: TrackerId[] | null = null): Promise<void> {
    // Plateforme discrète : pas de toast de progression (la série n'est peut-être pas un anime)
    const toast = showsProgress(level) && !adapter.quiet
      ? showToast({ tone: 'info', title: t('common.syncing'), message: formatEpisodeShort(episode) })
      : null;
    setState('syncing');
    const notify = (content: ToastContent, options: ToastOptions): void => {
      if (toast) toast.update(content, options);
      else if (isAlertTone(content.tone)) showToast(content, options);
    };

    try {
      const outcome = await sendMessage('EPISODE_COMPLETED', { episode, services });
      log.info('Résultat de la synchronisation :', outcome);
      // Série hors périmètre (Netflix, pas un anime) : rien d'affiché, épisodes suivants non renvoyés
      if (outcome.status === 'ignored') {
        ignoredSeries.add(platformSeriesKey(episode));
        toast?.dismiss();
        setState('idle');
        return;
      }
      if (!signal.aborted) {
        const live = liveOutcomeOf(outcome);
        setState(live.state, live.outcome);
      }
      // Échec global → tout relancer ; échec partiel → seulement les services en erreur
      const retry = outcome.status === 'error' ? null : failedServices(outcome);
      if (retry === null || retry.length > 0) {
        // Nouvelle tentative explicite : mode détaillé forcé pour voir la progression et le résultat
        const action = { label: t('common.retry'), onClick: () => void syncWithFeedback(episode, 'detailed', retry) };
        notify({ ...bubbleForOutcome(outcome), action }, { variant: 'bubble', autoHideMs: RETRY_TOAST_MS });
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
      completionReported = false;
      log.error('Service worker injoignable :', error);
      setState('error', { status: 'error', message: t('content.unreachable.message') });
      notify({ tone: 'error', title: t('content.unreachable.title'), message: t('content.unreachable.message') }, { variant: 'bubble', autoHideMs: ALERT_TOAST_MS });
    }
  }

  async function waitForMetadata(): Promise<void> {
    // Après une navigation SPA, le DOM/JSON-LD peut encore décrire l'épisode précédent :
    // l'adapter rejette ces données périmées, on attend donc qu'elles soient à jour
    // Adapter asynchrone (Netflix) : métadonnées demandées à la plateforme plutôt qu'attendues dans le DOM
    metadata = adapter.loadEpisodeInfo ? await load() : await waitFor(extract, { signal, timeoutMs: METADATA_WAIT_TIMEOUT_MS });
    if (signal.aborted) return;
    if (metadata) log.info(`Épisode identifié : ${formatEpisode(metadata)}`, metadata);
    else log.warn('Métadonnées indisponibles pour l’instant, nouvel essai à la fin de l’épisode');
  }

  async function waitForVideo(settings: SyncSettings): Promise<void> {
    const found = await waitFor(() => adapter.findVideo(), { signal, timeoutMs: VIDEO_WAIT_TIMEOUT_MS });
    if (signal.aborted) return;
    if (!found) {
      log.warn(`Aucune balise <video> trouvée après ${VIDEO_WAIT_TIMEOUT_MS / 1000} s`);
      setState('no-video');
      return;
    }
    log.info('Lecteur vidéo trouvé :', found.id || '(sans id)');

    video = found;
    tracker = trackVideoProgress(found, {
      fallbackRatio: settings.completionPercentage / 100,
      getCreditsStart: () => creditsStart,
      minDurationSeconds: MIN_EPISODE_DURATION_S,
      onCompleted: () => void reportCompletion(),
      signal,
      logger: log,
    });
    // Complétion déjà partie (raccourci pendant l'attente du lecteur) : l'état n'est pas écrasé
    if (state === 'idle') setState(settings.autoSync ? 'watching' : 'idle');
  }

  function snapshot(): LiveSnapshot {
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
    await waitForVideo(settings);
  }

  void waitForMetadata();
  void init();

  return { episodeId, snapshot, onStateChange, forceComplete, destroy };
}
