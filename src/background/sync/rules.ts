import type { AddListStatus, ListStatus, ListStatusChange } from '../../shared/sync.types';

export type { ListStatus };

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

/** Statut à écrire avec une progression ; `repeat` seulement à la fin d'un revisionnage */
export interface ProgressWrite {
  status: WriteStatus;
  repeat?: number;
}

/**
 * Statut qui accompagne l'écriture d'une progression (pur, testable), commun à la synchro, à la correction
 * et aux contrôles +1 / −1 :
 * - dernier épisode atteint : COMPLETED ; si l'entrée était en revisionnage (REPEATING), compteur de revisionnages + 1
 * - avant le dernier épisode : le revisionnage continue (REPEATING), sinon CURRENT
 */
export function progressWrite(entry: ListEntryState | null, progress: number, totalEpisodes: number | null): ProgressWrite {
  const isLastEpisode = totalEpisodes !== null && progress >= totalEpisodes;
  const repeating = entry?.status === 'REPEATING';
  if (isLastEpisode) return repeating ? { status: 'COMPLETED', repeat: (entry.repeat ?? 0) + 1 } : { status: 'COMPLETED' };
  return { status: repeating ? 'REPEATING' : 'CURRENT' };
}

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
 * Un revisionnage corrigé reste un revisionnage (et se termine au dernier épisode, compteur compris).
 */
export function decideListUpdate(
  entry: ListEntryState | null,
  progress: number,
  totalEpisodes: number | null,
  isCorrection = false,
): UpdateDecision {
  if (isCorrection) {
    return entry?.progress === progress
      ? { action: 'skip', reason: 'up-to-date' }
      : { action: 'update', progress, ...progressWrite(entry, progress, totalEpisodes) };
  }

  if (entry?.status === 'COMPLETED') return { action: 'skip', reason: 'already-completed' };
  if (entry && progress <= entry.progress) return { action: 'skip', reason: 'up-to-date' };
  return { action: 'update', progress, ...progressWrite(entry, progress, totalEpisodes) };
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

export type AddDecision = { action: 'write'; status: AddListStatus; progress: 0 } | { action: 'skip'; reason: 'already-in-list' };

/**
 * Ajout depuis la fiche de la page (pur, testable) : seulement si la série est absente de la liste
 * de ce service. Une entrée existante (quel que soit son statut) n'est jamais écrasée ni rétrogradée.
 */
export function decideAddToList(entry: ListEntryState | null, status: AddListStatus): AddDecision {
  return entry === null ? { action: 'write', status, progress: 0 } : { action: 'skip', reason: 'already-in-list' };
}
