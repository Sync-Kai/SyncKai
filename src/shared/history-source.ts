import type { CompletionTrigger } from './content-settings';

// Historiques de visionnage (Crunchyroll, ADN, Netflix) : une seule règle « épisode vu » et un seul réducteur par saison
// (audit 6-P1, 6-D1, 6-D2), pour toutes les plateformes. Module pur, sûr pour les scripts de contenu (le lecteur
// Crunchyroll réduit dans l'onglet, avant de situer chaque saison) : chaque plateforme traduit ses éléments en
// événements, choisit sa clé de saison et son numéro d'épisode, puis met en forme les saisons réduites.

/** Visionnage d'un épisode tel que le rapporte la plateforme ; unités au choix de la source, les mêmes pour `position`, `duration` et `endMarks` */
export interface WatchEvent {
  /** Saison à laquelle l'épisode appartient (choisie par la source : VO / VF fusionnées, saison 0, numéro Netflix…) */
  seasonKey: string;
  episodeId: string;
  /** Classement dans la saison : l'épisode vu de plus grand rang est la progression */
  rank: number;
  /** Marqué terminé par la plateforme */
  fullyWatched?: boolean;
  /** Position de lecture (0 : jamais commencé) */
  position: number;
  /** Durée, null si inconnue */
  duration: number | null;
  /** Marques de fin connues (générique, « vu jusqu'au bout ») ; absentes, nulles ou ≤ 0 ignorées */
  endMarks?: readonly (number | null)[];
  /** Dernier visionnage (ms), null si inconnu */
  playedAt: number | null;
}

/** Réglages de fin d'épisode, les mêmes que la synchro en direct */
export interface WatchedRule {
  completionPercentage: number;
  /** « pourcentage » : seuil de la durée seulement, les marques ne servent que si la durée est inconnue */
  completionTrigger?: CompletionTrigger;
}

/**
 * Épisode compté comme vu (règle unique) : marqué terminé par la plateforme ; sinon commencé et, selon le réglage, arrivé
 * à la plus petite des marques de fin connues, ou au seuil de fin de la durée (sans marque, ou déclencheur
 * « pourcentage »). Commencé seulement, ou durée et marques inconnues : jamais.
 */
export function isEpisodeWatched(event: Pick<WatchEvent, 'fullyWatched' | 'position' | 'duration' | 'endMarks'>, rule: WatchedRule): boolean {
  if (event.fullyWatched === true) return true;
  if (event.position <= 0) return false;
  const byPercentage = event.duration !== null && event.duration > 0 ? event.position / event.duration >= rule.completionPercentage / 100 : null;
  if (rule.completionTrigger === 'percentage' && byPercentage !== null) return byPercentage;
  const marks = (event.endMarks ?? []).filter((mark): mark is number => mark !== null && mark > 0);
  if (marks.length > 0) return event.position >= Math.min(...marks);
  return byPercentage ?? false;
}

/** Saison réduite : l'épisode vu le plus avancé (premier rencontré à rang égal), le nombre d'épisodes vus et le dernier visionnage */
export interface WatchedSeason<E extends WatchEvent> {
  best: E;
  watchedCount: number;
  lastPlayedAt: number | null;
}

/**
 * Une ligne par saison où au moins un épisode est vu (réducteur unique). Tri : visionnage le plus récent d'abord (ordre
 * de rencontre à égalité, dates inconnues en dernier). `ignored` : événements non vus.
 */
export function reduceWatchEvents<E extends WatchEvent>(events: Iterable<E>, rule: WatchedRule): { seasons: WatchedSeason<E>[]; ignored: number } {
  const bySeason = new Map<string, { best: E; watched: Set<string>; lastPlayedAt: number | null }>();
  let ignored = 0;
  for (const event of events) {
    if (!isEpisodeWatched(event, rule)) {
      ignored++;
      continue;
    }
    const entry = bySeason.get(event.seasonKey);
    if (!entry) {
      bySeason.set(event.seasonKey, { best: event, watched: new Set([event.episodeId]), lastPlayedAt: event.playedAt });
      continue;
    }
    entry.watched.add(event.episodeId);
    if (event.rank > entry.best.rank) entry.best = event;
    if (event.playedAt !== null && (entry.lastPlayedAt === null || event.playedAt > entry.lastPlayedAt)) entry.lastPlayedAt = event.playedAt;
  }
  const seasons = [...bySeason.values()]
    .sort((a, b) => (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0))
    .map(({ best, watched, lastPlayedAt }): WatchedSeason<E> => ({ best, watchedCount: watched.size, lastPlayedAt }));
  return { seasons, ignored };
}
