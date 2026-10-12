import { describe, expect, it } from 'vitest';
import { isListNotesText, LIST_NOTES_MAX, normalizeListNotes, notesPreview, readListNotes } from './list-notes';

describe('commentaire de l’entrée', () => {
  it('normalise les fins de ligne et retire les espaces de début et de fin', () => {
    expect(normalizeListNotes('  Ligne 1\r\nLigne 2\r  ')).toBe('Ligne 1\nLigne 2');
    expect(normalizeListNotes('   ')).toBe('');
  });

  it('lecture : vide ou illisible = aucun commentaire', () => {
    expect(readListNotes('')).toBeNull();
    expect(readListNotes('  \n ')).toBeNull();
    expect(readListNotes(null)).toBeNull();
    expect(readListNotes(12)).toBeNull();
    expect(readListNotes(' À revoir ')).toBe('À revoir');
  });

  it('limite : celle d’AniList (6000), seule documentée', () => {
    expect(LIST_NOTES_MAX).toBe(6000);
    expect(isListNotesText('x'.repeat(LIST_NOTES_MAX))).toBe(true);
    expect(isListNotesText('x'.repeat(LIST_NOTES_MAX + 1))).toBe(false);
  });

  it('aperçu : première ligne', () => {
    expect(notesPreview('Première\nSeconde')).toBe('Première');
  });
});
