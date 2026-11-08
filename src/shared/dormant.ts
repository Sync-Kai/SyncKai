import { episodesToCatchUp } from './remaining-time';
import type { WatchingEntry } from './watching.types';

const DAY_MS = 86_400_000;

/** Marque « Garder » d'une série (stockée côté navigateur) */
export interface KeepMark {
  keptAt: number;
}

/** Dernière activité connue : le plus récent de la mise à jour de la fiche et de la dernière synchro SyncKai (ms), null si aucune */
export function lastActivity(entry: WatchingEntry): number | null {
  const times: number[] = [];
  if (entry.updatedAt !== null) times.push(entry.updatedAt);
  if (entry.lastSync !== null) times.push(entry.lastSync.at);
  return times.length === 0 ? null : Math.max(...times);
}

/**
 * Série « en sommeil » : en cours (jamais REPEATING ni statut absent), seuil actif, dernière activité connue et plus
 * ancienne que le seuil, pas en attente de son prochain épisode (retard connu > 0 ; inconnu = éligible sur l'inactivité
 * seule, décision du propriétaire) et sans marque « Garder » valide (moins d'un seuil et aucune activité depuis la marque).
 */
export function isDormant(entry: WatchingEntry, opts: { now: number; thresholdDays: 30 | 60 | 90 | null; kept: KeepMark | null }): boolean {
  const { now, thresholdDays, kept } = opts;
  if (entry.listStatus !== 'CURRENT' || thresholdDays === null) return false;
  const activity = lastActivity(entry);
  if (activity === null) return false;
  const windowMs = thresholdDays * DAY_MS;
  if (now - activity <= windowMs) return false;
  const behind = episodesToCatchUp(entry, now);
  if (behind !== null && behind <= 0) return false;
  // Une activité postérieure à la marque l'annule : l'activité décide seule
  if (kept !== null && activity <= kept.keptAt && now - kept.keptAt < windowMs) return false;
  return true;
}
