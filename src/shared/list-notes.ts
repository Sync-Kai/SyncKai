import type { AniListErrorCode } from './anilist.types';
import type { Result } from './result';

// Commentaire d'une entrée de liste (AniList `notes`, MyAnimeList `comments`) : limite, normalisation et validation,
// communes au service worker (message SET_LIST_NOTES) et aux écrans (compteur de l'éditeur). Module pur.

/**
 * Longueur maximale d'un commentaire. AniList documente « Max: 6000 » (SaveMediaListEntry › notes) ; MyAnimeList ne
 * documente aucune limite pour `comments` : la limite d'AniList, seule connue, vaut pour les deux.
 */
export const LIST_NOTES_MAX = 6000;

/** Texte saisi → texte enregistré : fins de ligne unifiées, espaces de début et de fin retirés ("" = aucun commentaire) */
export function normalizeListNotes(text: string): string {
  return text.replace(/\r\n?/g, '\n').trim();
}

/** Commentaire lu sur un service : chaîne non vide, sinon null (absent, vide ou illisible) */
export function readListNotes(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const notes = normalizeListNotes(value);
  return notes.length > 0 ? notes : null;
}

/** Commentaire à écrire (payload SET_LIST_NOTES) : chaîne bornée ; "" efface le commentaire */
export function isListNotesText(value: unknown): value is string {
  return typeof value === 'string' && value.length <= LIST_NOTES_MAX;
}

/** Première ligne du commentaire (aperçu replié) */
export function notesPreview(notes: string): string {
  return notes.split('\n', 1)[0] ?? '';
}

/** Commentaire affiché (GET_LIST_NOTES) : celui d'AniList si l'anime y est, sinon celui de MyAnimeList */
export interface ListNotesInfo {
  /** L'anime est dans la liste d'au moins un service connecté (sinon le commentaire ne peut pas être écrit) */
  inList: boolean;
  notes: string | null;
}

export type ListNotesResult = Result<ListNotesInfo, AniListErrorCode>;
