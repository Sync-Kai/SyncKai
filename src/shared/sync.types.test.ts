import { describe, expect, it } from 'vitest';
import { isMediaMapping, mappingOrigin, withOrigin, type MediaMapping } from './sync.types';

// Origine d'une correspondance (I1) : forme stockée inchangée (`learned?: true`, `chosen?: true`), lue et posée par un seul accesseur.

const base: MediaMapping = { mediaId: 21, numbering: 'season', offset: 0, episodes: 12 };

describe('origine d’une correspondance', () => {
  it('mappingOrigin : apprise, choisie ou inconnue', () => {
    expect(mappingOrigin({ ...base, learned: true })).toBe('learned');
    expect(mappingOrigin({ ...base, chosen: true })).toBe('chosen');
    expect(mappingOrigin(base)).toBe('unmarked');
  });

  it('withOrigin : pose un seul indicateur, retire l’autre', () => {
    expect(withOrigin({ ...base, chosen: true }, 'learned')).toEqual({ ...base, learned: true });
    expect(withOrigin({ ...base, learned: true }, 'chosen')).toEqual({ ...base, chosen: true });
    const unmarked = withOrigin({ ...base, learned: true }, 'unmarked');
    expect(unmarked).toEqual(base);
    expect(Object.keys(unmarked)).not.toContain('learned');
  });

  it('isMediaMapping : apprise ET choisie (sans signification) refusée', () => {
    expect(isMediaMapping({ ...base, learned: true })).toBe(true);
    expect(isMediaMapping({ ...base, chosen: true })).toBe(true);
    expect(isMediaMapping({ ...base, learned: true, chosen: true })).toBe(false);
  });
});
