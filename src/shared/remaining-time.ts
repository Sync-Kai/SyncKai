import { getLocale, t, tp } from '../i18n/core';
import { releasedEpisodes } from './released-episodes';
import type { WatchingEntry } from './watching.types';

// Temps restant pour rattraper une série (valeur de la ligne, total de la liste, tri « Temps restant »). Fonctions pures.

/**
 * Épisodes sortis pas encore vus : série terminée = total − progression ; en diffusion = épisodes sortis − progression
 * (même règle que la pastille « Ép. N disponible »). 0 si à jour ou en avance ; null si les épisodes sortis sont inconnus
 * ou si rien n'est encore sorti (épisode 1 à venir, série pas encore sortie).
 */
export function episodesToCatchUp(entry: WatchingEntry, now: number): number | null {
  if (entry.airingStatus === 'NOT_YET_RELEASED') return null;
  const released = releasedEpisodes(entry, now);
  return released === null || released <= 0 ? null : Math.max(0, released - entry.progress);
}

/** Minutes à regarder pour rattraper la série ; null si inconnu ou s'il ne reste rien (à jour ou en avance). */
export function remainingMinutes(entry: WatchingEntry, now: number): number | null {
  const minutes = entry.episodeMinutes;
  const episodes = episodesToCatchUp(entry, now);
  if (episodes === null || typeof minutes !== 'number' || !(minutes > 0)) return null;
  const total = episodes * minutes;
  return total > 0 ? total : null;
}

/** Durée affichée : valeur courte (« ≈ 6,5 h ») et phrase pour les lecteurs d'écran (« Environ 6,5 heures pour finir »). */
export interface DurationText {
  text: string;
  spoken: string;
}

/** Temps restant d'une série : durée affichée et détail de l'infobulle (« 16 épisodes × 24 min »). */
export interface RemainingText extends DurationText {
  detail: string;
}

/**
 * Durée arrondie : moins d'une heure → minutes multiples de 5 (5 au moins) ; moins de 10 h → demi-heure ; sinon heures
 * entières. Seuils décidés sur la valeur arrondie : 58 min → 1 h (jamais « 60 min »), 585 min → 10 h.
 */
function roundDuration(minutes: number): { unit: 'minute' | 'hour'; value: number } {
  const byFive = Math.max(5, Math.round(minutes / 5) * 5);
  if (byFive < 60) return { unit: 'minute', value: byFive };
  const byHalfHour = Math.round(minutes / 30) / 2;
  if (byHalfHour < 10) return { unit: 'hour', value: byHalfHour };
  return { unit: 'hour', value: Math.round(minutes / 60) };
}

const formatNumber = (value: number): string => new Intl.NumberFormat(getLocale(), { maximumFractionDigits: 1 }).format(value);

/** Unité longue pour la lecture à voix haute (« 6,5 heures », « 45 minutes ») */
const formatLong = (value: number, unit: 'minute' | 'hour'): string =>
  new Intl.NumberFormat(getLocale(), { style: 'unit', unit, unitDisplay: 'long', maximumFractionDigits: 1 }).format(value);

/** Unité abrégée des comptes à rebours (« 6,5 h », « 45 min », « 6.5時間 ») */
const formatShort = (value: number, unit: 'minute' | 'hour'): string =>
  t(unit === 'minute' ? 'time.countdown.minutes' : 'time.countdown.hours', { count: formatNumber(value) });

/** Durée (minutes, > 0) arrondie dans la langue active : ligne d'une série et total de la liste. */
export function formatDuration(minutes: number): DurationText {
  const { unit, value } = roundDuration(minutes);
  return {
    text: t('watching.remaining.short', { duration: formatShort(value, unit) }),
    spoken: t('watching.remaining.spoken', { duration: formatLong(value, unit) }),
  };
}

/** Temps restant d'une série dans la langue active, null si rien à afficher (voir remainingMinutes). */
export function formatRemaining(entry: WatchingEntry, now: number): RemainingText | null {
  const minutes = remainingMinutes(entry, now);
  const episodes = episodesToCatchUp(entry, now);
  if (minutes === null || episodes === null || typeof entry.episodeMinutes !== 'number') return null;
  // En diffusion, le compte vient du prochain épisode annoncé : seuls les épisodes déjà sortis sont comptés
  const detailKey = entry.nextEpisode ? 'watching.remaining.detailAiring' : 'watching.remaining.detail';
  return {
    ...formatDuration(minutes),
    detail: tp(detailKey, episodes, { duration: formatShort(entry.episodeMinutes, 'minute') }),
  };
}
