import type { TrackerId } from '../../shared/tracker.types';
import type { Score10 } from '../../shared/engagement.types';
import type { ListStatusChange } from '../../shared/sync.types';
import type { ListEntryState, WriteStatus } from '../sync/rules';

/**
 * Fiche du catalogue (AniList) choisie par la correspondance.
 * Chaque service de suivi la traduit vers son propre identifiant (ex : idMal).
 */
export interface CatalogMedia {
  mediaId: number;
  idMal: number | null;
  title: string;
  episodes: number | null;
}

export interface TrackerEntry {
  title: string;
  episodes: number | null;
  /** Entrée de la liste de l'utilisateur, null si l'anime n'y est pas */
  entry: ListEntryState | null;
}

/**
 * Contrat commun aux services de suivi (pattern Adapter, comme les plateformes de streaming).
 * Les règles métier (jamais de recul, statuts) restent dans sync-service / rules.
 */
export interface TrackerService {
  readonly id: TrackerId;
  isConnected(): Promise<boolean>;
  /** Identifiant de la fiche sur ce service, null s'il n'a pas d'équivalent */
  resolveId(media: CatalogMedia): number | null;
  getEntry(id: number): Promise<TrackerEntry>;
  /** `repeat` : nouveau nombre de revisionnages à écrire (fin d'un revisionnage, statut COMPLETED) */
  saveProgress(id: number, progress: number, status: WriteStatus, repeat?: number): Promise<ListEntryState>;
  /** Note SyncKai (sur 10), convertie dans le format du service */
  saveScore(id: number, score: Score10): Promise<ListEntryState>;
  /** Démarre un revisionnage (REPEATING) à la progression donnée */
  startRewatch(id: number, progress: number): Promise<ListEntryState>;
  /**
   * Changement de statut manuel (En pause, Abandonné, Terminé) à la progression donnée.
   * `repeat` : nouveau nombre de revisionnages (revisionnage marqué terminé), sinon inchangé.
   */
  saveStatus(id: number, status: ListStatusChange, progress: number, repeat?: number): Promise<ListEntryState>;
}
