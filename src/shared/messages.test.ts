import { describe, expect, it } from 'vitest';
import { EXTENSION_PAGE_ONLY, isRuntimeMessage } from './messages';

describe('SET_LIST_STATUS', () => {
  const valid = { mediaId: 21, malId: 21, status: 'DROPPED', coverUrl: 'https://s4.anilist.co/cover.jpg' };
  const message = (payload: unknown): unknown => ({ type: 'SET_LIST_STATUS', payload });

  it('accepte un payload valide (fiche MAL seule possible)', () => {
    expect(isRuntimeMessage(message(valid))).toBe(true);
    expect(isRuntimeMessage(message({ mediaId: null, malId: 5, status: 'PAUSED', coverUrl: null }))).toBe(true);
    expect(isRuntimeMessage(message({ ...valid, status: 'COMPLETED' }))).toBe(true);
  });

  it('refuse un statut non proposé par le popup', () => {
    for (const status of ['CURRENT', 'PLANNING', 'REPEATING', 'completed', null]) {
      expect(isRuntimeMessage(message({ ...valid, status }))).toBe(false);
    }
  });

  it('refuse des identifiants absents ou invalides', () => {
    expect(isRuntimeMessage(message({ ...valid, mediaId: null, malId: null }))).toBe(false);
    expect(isRuntimeMessage(message({ ...valid, mediaId: 0 }))).toBe(false);
    expect(isRuntimeMessage(message({ ...valid, malId: 1.5 }))).toBe(false);
  });

  it('refuse une affiche non https', () => {
    expect(isRuntimeMessage(message({ ...valid, coverUrl: 'http://example.com/a.jpg' }))).toBe(false);
    expect(isRuntimeMessage(message({ ...valid, coverUrl: 'javascript:alert(1)' }))).toBe(false);
    expect(isRuntimeMessage(message({ mediaId: 21, malId: null, status: 'PAUSED' }))).toBe(false);
  });

  it('est réservé aux pages de l’extension', () => {
    expect(EXTENSION_PAGE_ONLY.has('SET_LIST_STATUS')).toBe(true);
  });
});
