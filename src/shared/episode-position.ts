// Position d'un épisode pour une numérotation de correspondance (audit M6, invariant I4) : partagée par la synchro en
// direct (background/sync/matching/mapping.ts › applyMapping, resolver.ts) et l'analyse d'un import (cr-import.ts).
// Module pur.
import type { MediaMapping } from './sync.types';

/**
 * Numéro de l'épisode pour la numérotation `numbering` : numéro affiché (`displayed`) ou numéro dans la saison (`season`),
 * jamais l'un pour l'autre. Null si la plateforme ne l'a pas donné : un numéro affiché peut être absolu (Kaiju No. 8 S3 :
 * E23 affiché = 11e de la saison), le prendre pour le numéro dans la saison écrirait une progression fausse sur une fiche
 * en cours de diffusion (aucun nombre d'épisodes pour la borner).
 */
export function seasonPosition(
  episode: { seasonEpisodeNumber: number | null; displayedEpisodeNumber: number | null },
  numbering: MediaMapping['numbering'],
): number | null {
  return numbering === 'displayed' ? episode.displayedEpisodeNumber : episode.seasonEpisodeNumber;
}
