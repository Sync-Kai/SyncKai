import { describe, expect, it } from 'vitest';
import { anilistEntryVariables } from './list';

describe('SaveMediaListEntry (AniList)', () => {
  it('envoie les statuts du popup tels quels (énumération MediaListStatus)', () => {
    expect(anilistEntryVariables(21, 5, 'PAUSED')).toEqual({ mediaId: 21, progress: 5, status: 'PAUSED' });
    expect(anilistEntryVariables(21, 5, 'DROPPED')).toEqual({ mediaId: 21, progress: 5, status: 'DROPPED' });
    expect(anilistEntryVariables(21, 12, 'COMPLETED')).toEqual({ mediaId: 21, progress: 12, status: 'COMPLETED' });
  });

  it('ajoute le compteur de revisionnages seulement s’il est fourni', () => {
    expect(anilistEntryVariables(21, 12, 'COMPLETED', 2)).toEqual({ mediaId: 21, progress: 12, status: 'COMPLETED', repeat: 2 });
  });
});
