import type { WatchingEntry } from './watching.types';

// Épisodes sortis d'une série suivie (feuille : partagée par watching.ts et remaining-time.ts, sans cycle d'imports).

export const isFinished = (entry: WatchingEntry): boolean =>
  entry.airingStatus === 'FINISHED' || entry.airingStatus === 'CANCELLED';

/** Nombre d'épisodes déjà sortis, si on peut le déduire (prochain épisode annoncé ou série terminée). */
export function airedEpisodes(entry: WatchingEntry): number | null {
  if (entry.nextEpisode) return entry.nextEpisode.episode - 1;
  if (isFinished(entry) && entry.totalEpisodes) return entry.totalEpisodes;
  return null;
}

/**
 * Épisodes sortis à l'instant `now` (ms) : comme `airedEpisodes`, mais un épisode annoncé dont l'heure est passée (liste
 * en cache) compte comme sorti. null si inconnu (diffusion sans date, pause, pas encore sortie, total inconnu).
 */
export function releasedEpisodes(entry: WatchingEntry, now: number): number | null {
  const next = entry.nextEpisode;
  return next && next.airingAt <= now ? next.episode : airedEpisodes(entry);
}
