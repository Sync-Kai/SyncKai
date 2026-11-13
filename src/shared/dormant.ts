import { releasedEpisodes } from './released-episodes';
import { episodesToCatchUp } from './remaining-time';
import type { TrackerId } from './tracker.types';
import type { WatchingEntry } from './watching.types';

const DAY_MS = 86_400_000;

/** Marque « Garder » d'une série (stockée côté navigateur) */
export interface KeepMark {
  keptAt: number;
}

/**
 * Dernière activité connue : le plus récent de la mise à jour de la fiche et de la dernière synchro SyncKai (ms), null si
 * aucune. Un horodatage non fini (NaN, Infinity : cache altéré) est ignoré, jamais pris pour une date ancienne
 */
export function lastActivity(entry: WatchingEntry): number | null {
  const times = [entry.updatedAt, entry.lastSync?.at ?? null].filter((time): time is number => time !== null && Number.isFinite(time));
  return times.length === 0 ? null : Math.max(...times);
}

/**
 * Clé d'une série dans les marques « Garder » du service affiché : son propre identifiant, « mal:<id> » sur la liste MAL
 * (l'identifiant AniList y manque quand le catalogue ne répond pas, POP-08), l'identifiant AniList sur la liste AniList
 */
export function dormantKey(entry: Pick<WatchingEntry, 'mediaId' | 'malId'>, service: TrackerId): string {
  return (service === 'mal' && entry.malId !== null) || entry.mediaId === null ? `mal:${entry.malId}` : String(entry.mediaId);
}

/** Marque « Garder » de la série ; liste MAL : aussi sous l'identifiant AniList (marques posées par la 2.5.0) */
export function keepMarkOf(marks: Readonly<Record<string, KeepMark>>, entry: Pick<WatchingEntry, 'mediaId' | 'malId'>, service: TrackerId): KeepMark | null {
  return marks[dormantKey(entry, service)] ?? (service === 'mal' && entry.mediaId !== null ? marks[String(entry.mediaId)] : undefined) ?? null;
}

/**
 * Série « en sommeil » : en cours (jamais REPEATING ni statut absent), seuil actif, dernière activité connue et plus
 * ancienne que le seuil, pas en attente de son prochain épisode (retard connu > 0, ou épisode 1 daté et rien de sorti ;
 * inconnu = éligible sur l'inactivité seule, décision du propriétaire) et sans marque « Garder » valide (moins d'un
 * seuil et aucune activité depuis la marque).
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
  // Épisode 1 daté, rien de sorti : à jour sur son calendrier (spec §5.3), jamais un retard « inconnu »
  if (releasedEpisodes(entry, now) === 0) return false;
  // Une activité postérieure à la marque l'annule : l'activité décide seule
  if (kept !== null && activity <= kept.keptAt && now - kept.keptAt < windowMs) return false;
  return true;
}

/**
 * Groupe « En sommeil » : séries en sommeil hors de la série « Reprendre » (`hero`, jamais affichée deux fois), la plus
 * longtemps inactive d'abord (titre à égalité), quel que soit le tri de la liste
 */
export function dormantEntries(
  entries: readonly WatchingEntry[],
  opts: { now: number; thresholdDays: 30 | 60 | 90 | null; marks: Readonly<Record<string, KeepMark>>; hero: WatchingEntry | null; service: TrackerId },
): WatchingEntry[] {
  const { now, thresholdDays, marks, hero, service } = opts;
  const dormant = entries.filter((entry) => entry !== hero && isDormant(entry, { now, thresholdDays, kept: keepMarkOf(marks, entry, service) }));
  // lastActivity est connue pour toute série en sommeil (isDormant l'exige)
  return dormant.sort((a, b) => (lastActivity(a) ?? 0) - (lastActivity(b) ?? 0) || a.title.localeCompare(b.title));
}
