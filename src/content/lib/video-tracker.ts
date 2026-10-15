import { canComplete, formatTimecode, resolveCompletionPoint, type CompletionPoint } from './completion';
import type { Logger } from '../../shared/logger';
import type { PlaybackTime } from './adapter';

interface VideoTrackerOptions {
  /** Seuil de repli (0 à 1) si le début du générique de fin est inconnu */
  fallbackRatio: number;
  /** Début du générique de fin (s), lu à chaque tick : la donnée peut arriver après le démarrage */
  getCreditsStart: () => number | null;
  /** Durée minimale (s) pour considérer la vidéo comme un épisode : ignore pubs et bandes-annonces */
  minDurationSeconds: number;
  onCompleted: () => void;
  /**
   * Position et durée propres à la plateforme (StreamingAdapter.readPlayback), lues à chaque tick ; null : inconnues
   * pour l'instant. Absente : `currentTime` et `duration` de la vidéo.
   */
  readPlayback?: (video: HTMLVideoElement) => PlaybackTime | null;
  /** Annuler ce signal retire tous les écouteurs posés sur la vidéo */
  signal: AbortSignal;
  logger: Logger;
}

/** Relecture de la position fournie par la plateforme (readPlayback), en plus de `timeupdate` */
export const PLAYBACK_POLL_MS = 1_000;

export interface VideoProgressTracker {
  /** Point de complétion pour la durée actuelle ; null si la vidéo n'est pas (encore) un épisode */
  completionPoint(): CompletionPoint | null;
}

/**
 * Suit la progression d'une <video> et déclenche `onCompleted` une seule fois par source,
 * au début du générique de fin (ou au seuil de repli).
 * Le listener `timeupdate` (~4 appels/s) est retiré dès la complétion, puis réarmé
 * si le lecteur charge une nouvelle source (`loadstart`, ex : épisode suivant en autoplay).
 */
export function trackVideoProgress(video: HTMLVideoElement, options: VideoTrackerOptions): VideoProgressTracker {
  const { fallbackRatio, getCreditsStart, minDurationSeconds, onCompleted, readPlayback, signal, logger } = options;
  let progressController: AbortController | null = null;
  let lastLoggedDecile = -1;
  let lastLoggedPoint = '';
  /** Lecture observée avant le point de fin depuis l'armement */
  let seenBeforePoint = false;
  /** Source chargée (loadstart) après le début du suivi : elle appartient forcément à cet épisode */
  let hasFreshSource = false;

  /** Position et durée : celles de la plateforme si elle les fournit (Disney+), sinon celles de la vidéo */
  const readTime = (): PlaybackTime | null => (readPlayback ? readPlayback(video) : { currentTime: video.currentTime, duration: video.duration });

  /** Point de complétion pour une durée donnée ; null si la vidéo n'est pas (encore) un épisode */
  const pointFor = (duration: number): CompletionPoint | null => {
    if (!Number.isFinite(duration) || duration <= 0) return null; // Métadonnées pas encore chargées
    if (duration < minDurationSeconds) return null; // Pub ou vidéo trop courte pour être un épisode
    return resolveCompletionPoint(duration, getCreditsStart(), fallbackRatio);
  };

  /** Même calcul que la complétion : relu par le panneau (progression en direct), sans écouteur supplémentaire */
  const completionPoint = (): CompletionPoint | null => {
    const time = readTime();
    return time ? pointFor(time.duration) : null;
  };

  const onTimeUpdate = (): void => {
    const time = readTime();
    const point = time ? pointFor(time.duration) : null;
    if (!time || !point) return;
    const { currentTime, duration } = time;
    const pointLabel =
      point.source === 'credits'
        ? `générique de fin à ${formatTimecode(point.seconds)}`
        : `${Math.round(fallbackRatio * 100)} % (${formatTimecode(point.seconds)}, pas de données de générique)`;
    if (pointLabel !== lastLoggedPoint) {
      lastLoggedPoint = pointLabel;
      logger.info(`Fin d’épisode : ${pointLabel}`);
    }

    const decile = Math.floor((currentTime / duration) * 10);
    if (decile !== lastLoggedDecile) {
      lastLoggedDecile = decile;
      logger.debug(`Progression : ${Math.round((currentTime / duration) * 100)} % (${formatTimecode(currentTime)})`);
    }

    if (currentTime < point.seconds) seenBeforePoint = true;
    if (canComplete(currentTime, point.seconds, seenBeforePoint, hasFreshSource)) {
      logger.info(`Fin d’épisode atteinte (${pointLabel})`);
      disarm();
      onCompleted();
    }
  };

  const arm = (): void => {
    disarm();
    lastLoggedDecile = -1;
    lastLoggedPoint = '';
    seenBeforePoint = false;
    progressController = new AbortController();
    // Le signal combiné garantit le nettoyage même si la session est détruite
    const combined = AbortSignal.any([signal, progressController.signal]);
    video.addEventListener('timeupdate', onTimeUpdate, { signal: combined });
    // Position fournie par la plateforme (Disney+) : la <video> suivie peut ne jamais émettre `timeupdate`, la position
    // est donc aussi relue chaque seconde, tant que le suivi est armé (même calcul que `timeupdate`)
    if (readPlayback) {
      const timer = setInterval(onTimeUpdate, PLAYBACK_POLL_MS);
      combined.addEventListener('abort', () => clearInterval(timer), { once: true });
    }
  };

  const disarm = (): void => {
    progressController?.abort();
    progressController = null;
  };

  video.addEventListener(
    'loadstart',
    () => {
      logger.info('Nouvelle source vidéo : suivi réarmé');
      hasFreshSource = true;
      arm();
    },
    { signal },
  );
  signal.addEventListener('abort', disarm, { once: true });

  arm();
  return { completionPoint };
}
