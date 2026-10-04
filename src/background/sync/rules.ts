import type { ListStatusChange } from '../../shared/sync.types';

export type ListStatus = 'CURRENT' | 'PLANNING' | 'COMPLETED' | 'DROPPED' | 'PAUSED' | 'REPEATING';

/** Statuts que SyncKai écrit lui-même */
export type WriteStatus = 'CURRENT' | 'COMPLETED' | 'REPEATING';

export interface ListEntryState {
  status: ListStatus;
  progress: number;
  /** Nombre de revisionnages terminés (AniList `repeat`, MAL `num_times_rewatched`), si connu */
  repeat?: number;
  /** Note brute du service (dans son format), présente seulement si l'entrée est notée (> 0) */
  score?: number;
}

export type UpdateDecision =
  /** `repeat` : nouveau nombre de revisionnages à écrire (fin d'un revisionnage) */
  | { action: 'update'; progress: number; status: WriteStatus; repeat?: number }
  | { action: 'skip'; reason: 'already-completed' | 'up-to-date' };

/**
 * Règles métier de mise à jour de la liste :
 * - ne jamais faire reculer la progression (retour en arrière)
 * - ne pas toucher à un anime déjà terminé (le revisionnage est proposé à part)
 * - revisionnage en cours (REPEATING) : la progression avance, et le dernier épisode le termine
 *   (COMPLETED + compteur de revisionnages incrémenté)
 * - sinon passer en COMPLETED au dernier épisode, en CURRENT avant
 *
 * `isCorrection` : l'utilisateur corrige une valeur écrite par SyncKai sur cette même fiche.
 * Il a vérifié le numéro : on écrit tel quel, même vers le bas ou sur une fiche terminée.
 */
export function decideListUpdate(
  entry: ListEntryState | null,
  progress: number,
  totalEpisodes: number | null,
  isCorrection = false,
): UpdateDecision {
  const isLastEpisode = totalEpisodes !== null && progress >= totalEpisodes;
  if (isCorrection) {
    return entry?.progress === progress
      ? { action: 'skip', reason: 'up-to-date' }
      : { action: 'update', progress, status: isLastEpisode ? 'COMPLETED' : 'CURRENT' };
  }

  if (entry?.status === 'COMPLETED') return { action: 'skip', reason: 'already-completed' };
  if (entry && progress <= entry.progress) return { action: 'skip', reason: 'up-to-date' };

  if (entry?.status === 'REPEATING') {
    return isLastEpisode
      ? { action: 'update', progress, status: 'COMPLETED', repeat: (entry.repeat ?? 0) + 1 }
      : { action: 'update', progress, status: 'REPEATING' };
  }

  return { action: 'update', progress, status: isLastEpisode ? 'COMPLETED' : 'CURRENT' };
}

export type StatusChangeDecision =
  /** `repeat` : nouveau nombre de revisionnages (un revisionnage marqué terminé compte comme achevé) */
  | { action: 'write'; status: ListStatusChange; progress: number; repeat?: number }
  | { action: 'skip'; reason: 'not-in-list' | 'unchanged' };

/**
 * Changement de statut manuel depuis le popup (pur, testable) :
 * - série absente de la liste : rien n'est écrit (on n'ajoute pas une série abandonnée à une liste)
 * - Terminé : progression portée au nombre total d'épisodes s'il est connu, sans jamais la baisser
 * - En pause / Abandonné : progression conservée
 * - revisionnage (REPEATING) marqué terminé : compteur de revisionnages incrémenté, comme à la fin
 *   naturelle d'un revisionnage (decideListUpdate) ; mis en pause / abandonné : compteur inchangé
 */
export function decideStatusChange(entry: ListEntryState | null, totalEpisodes: number | null, status: ListStatusChange): StatusChangeDecision {
  if (entry === null) return { action: 'skip', reason: 'not-in-list' };
  const progress = status === 'COMPLETED' && totalEpisodes !== null ? Math.max(entry.progress, totalEpisodes) : entry.progress;
  if (entry.status === status && entry.progress === progress) return { action: 'skip', reason: 'unchanged' };
  if (status === 'COMPLETED' && entry.status === 'REPEATING') return { action: 'write', status, progress, repeat: (entry.repeat ?? 0) + 1 };
  return { action: 'write', status, progress };
}
