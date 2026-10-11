import { describe, expect, it } from 'vitest';
import { nextAnnouncement, type AnnouncerState } from './live-region';

const EMPTY: AnnouncerState = { shown: new Set(), text: '' };

describe('nextAnnouncement', () => {
  it('annonce un message nouvellement affiché', () => {
    expect(nextAnnouncement(EMPTY, ['Pas d’accès'])).toEqual({ shown: new Set(['Pas d’accès']), text: 'Pas d’accès' });
  });

  it('message toujours affiché (nouveau rendu) : rien de plus à annoncer, région inchangée', () => {
    const first = nextAnnouncement(EMPTY, ['Pas d’accès']);
    const again = nextAnnouncement(first, ['Pas d’accès']);
    expect(again.text).toBe(first.text);
    expect(nextAnnouncement(again, ['Pas d’accès']).text).toBe('Pas d’accès');
  });

  it('seuls les messages apparus sont annoncés', () => {
    const first = nextAnnouncement(EMPTY, ['A']);
    expect(nextAnnouncement(first, ['A', 'B']).text).toBe('B');
  });

  it('message retiré : région vidée, puis réannoncé s’il revient', () => {
    const shown = nextAnnouncement(EMPTY, ['A']);
    const gone = nextAnnouncement(shown, []);
    expect(gone).toEqual({ shown: new Set(), text: '' });
    expect(nextAnnouncement(gone, ['A']).text).toBe('A');
  });

  it('annonce conservée tant qu’un de ses messages reste affiché', () => {
    const both = nextAnnouncement(EMPTY, ['A', 'B']);
    expect(both.text).toBe('A B');
    expect(nextAnnouncement(both, ['B']).text).toBe('A B');
  });

  it('textes vides ignorés', () => {
    expect(nextAnnouncement(EMPTY, [''])).toEqual(EMPTY);
  });
});
