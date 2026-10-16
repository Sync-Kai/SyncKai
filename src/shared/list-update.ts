import type { ListStatus } from './sync.types';

// Règle commune à toute écriture d'une progression sur une entrée de liste (pur, testé), partagée par la synchro en
// direct (background/sync/rules.ts › decideListUpdate) et l'import de l'historique (cr-import.ts › decideImport) : audit
// 1-D14 / 6-D3. Chacun y ajoute ses propres gardes (correction, revisionnage, découpage différent).

/** Effet d'une progression sur l'entrée : série terminée (jamais touchée), déjà à jour (jamais de recul), ou avance */
export type ProgressStep = 'completed' | 'up-to-date' | 'advance';

export function progressStep(entry: { status: ListStatus; progress: number } | null, progress: number): ProgressStep {
  if (entry?.status === 'COMPLETED') return 'completed';
  if (entry && progress <= entry.progress) return 'up-to-date';
  return 'advance';
}

/** Dernier épisode atteint : la série passe en Terminé (total inconnu : jamais) */
export function reachesLastEpisode(progress: number, totalEpisodes: number | null): boolean {
  return totalEpisodes !== null && progress >= totalEpisodes;
}
