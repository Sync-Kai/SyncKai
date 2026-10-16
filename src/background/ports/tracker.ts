import type { TrackerId } from '../../shared/tracker.types';
import type { Score10 } from '../../shared/engagement.types';
import type { ManualListStatus } from '../../shared/sync.types';
import type { ListEntryState, ListStatus, WriteStatus } from '../sync/rules';
import type { EntryWrite } from '../../shared/compare';
import type { RequestLane } from '../rate-limit';

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
  /** Commentaire de l'entrée (AniList `notes`, MAL `comments`), null s'il est vide ou si l'anime n'est pas dans la liste */
  notes: string | null;
}

/** Entrée de la liste complète de l'utilisateur, identifiée par la fiche de CE service */
export interface ListedEntry {
  id: number;
  status: ListStatus;
  progress: number;
}

/**
 * Contrat commun aux services de suivi (pattern Adapter, comme les plateformes de streaming).
 * Les règles métier (jamais de recul, statuts) restent dans sync-service / rules.
 */
export interface TrackerService {
  readonly id: TrackerId;
  isConnected(): Promise<boolean>;
  /** Identifiant de la fiche du catalogue sur ce service, null s'il n'a pas d'équivalent (règle commune : entryIdOn) */
  resolveId(media: CatalogMedia): number | null;
  /** Liste complète de l'utilisateur (import de l'historique), requêtes de fond */
  fullList(): Promise<ListedEntry[]>;
  /** `lane` : 'background' pour une tâche de fond (import, alignement), place réservée avant (waitReadSlot) ; ignoré par MAL */
  getEntry(id: number, lane?: RequestLane): Promise<TrackerEntry>;
  /** `repeat` : nouveau nombre de revisionnages à écrire (fin d'un revisionnage, statut COMPLETED) ; `lane` : voir getEntry */
  saveProgress(id: number, progress: number, status: WriteStatus, repeat?: number, lane?: RequestLane): Promise<ListEntryState>;
  /** Note SyncKai (sur 10), convertie dans le format du service */
  saveScore(id: number, score: Score10): Promise<ListEntryState>;
  /** Démarre un revisionnage (REPEATING) à la progression donnée */
  startRewatch(id: number, progress: number): Promise<ListEntryState>;
  /**
   * Statut manuel (En pause, Abandonné, Terminé, ou ajout À regarder / En cours) à la progression donnée.
   * `repeat` : nouveau nombre de revisionnages (revisionnage marqué terminé), sinon inchangé.
   */
  saveStatus(id: number, status: ManualListStatus, progress: number, repeat?: number): Promise<ListEntryState>;
  /** Alignement (comparaison des listes) : écrit ou crée l'entrée avec les seuls champs fournis, en une requête */
  saveEntry(id: number, write: EntryWrite, lane?: RequestLane): Promise<ListEntryState>;
  /** Retire l'anime de la liste ; déjà absent = succès (rien à retirer) */
  deleteEntry(id: number): Promise<void>;
  /** Commentaire de l'entrée (déjà normalisé, "" l'efface) ; l'appelant vérifie que l'anime est dans la liste */
  saveNotes(id: number, notes: string): Promise<ListEntryState>;
}
