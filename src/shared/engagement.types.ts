import { isRecord } from './guards';
import type { SessionEpochs } from './session-epochs';

// Contrats v1.6 : note de fin de série, revisionnage, alertes de nouveaux épisodes.

/** Note saisie dans SyncKai : sur 10, par pas de 0,5 (10 étoiles avec demi-étoiles). Convertie par service. */
export type Score10 = number;

export function isScore10(value: unknown): value is Score10 {
  return typeof value === 'number' && value >= 0.5 && value <= 10 && Number.isInteger(value * 2);
}

/** Série à identifier pour noter / revisionner (fiche AniList du catalogue ; malId seul possible côté MAL) */
export interface MediaRef {
  mediaId: number | null;
  malId: number | null;
  title: string;
}

export function isMediaRef(value: unknown): value is MediaRef {
  return (
    isRecord(value) &&
    (value.mediaId === null || (typeof value.mediaId === 'number' && Number.isInteger(value.mediaId) && value.mediaId > 0)) &&
    (value.malId === null || (typeof value.malId === 'number' && Number.isInteger(value.malId) && value.malId > 0)) &&
    (value.mediaId !== null || value.malId !== null) &&
    typeof value.title === 'string' &&
    value.title.length <= 300
  );
}

/** Note en attente (« Plus tard » ou bulle fermée) : carte « À noter » dans Activité. Clé de stockage `pendingRatings`. */
export interface PendingRating extends MediaRef {
  /** Identifiant stable : `anilist:${mediaId}` ou `mal:${malId}` */
  id: string;
  coverUrl: string | null;
  completedAt: number;
  /** Sessions ouvertes à la création de la carte : la note n'est écrite que sur elles (absent : antérieure à la 2.2.0) */
  epochs?: SessionEpochs;
}

export function mediaRefId(ref: Pick<MediaRef, 'mediaId' | 'malId'>): string {
  return ref.mediaId !== null ? `anilist:${ref.mediaId}` : `mal:${ref.malId ?? 0}`;
}

/** Revisionnage refusé : ne plus demander pendant 30 jours. Clé de stockage `rewatchDeclined` (id → timestamp ms). */
export const REWATCH_DECLINE_MS = 30 * 24 * 60 * 60 * 1000;

/** Demandes à afficher sur la page après une synchro (portées par SyncOutcome 'synced'). */
export interface SyncPrompts {
  /** La série vient de passer en Terminé et la note est activée dans les réglages */
  rate?: MediaRef;
  /** Épisode vu sur une fiche Terminée : proposer un revisionnage (non refusé depuis 30 j) */
  rewatch?: MediaRef & { progress: number };
}

/** Délais possibles avant de notifier une sortie (heures après la diffusion japonaise) */
export const AIRING_DELAYS = [0, 1, 3, 6] as const;
export type AiringDelayHours = (typeof AIRING_DELAYS)[number];
