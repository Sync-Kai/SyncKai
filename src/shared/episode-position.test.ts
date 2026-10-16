import { describe, expect, it } from 'vitest';
import { seasonPosition } from './episode-position';

describe('seasonPosition (M6)', () => {
  it('numéro de la numérotation demandée, jamais l’un pour l’autre', () => {
    const kaiju = { seasonEpisodeNumber: 11, displayedEpisodeNumber: 23 };
    expect(seasonPosition(kaiju, 'season')).toBe(11);
    expect(seasonPosition(kaiju, 'displayed')).toBe(23);
    // Position dans la saison inconnue (JSON-LD sans `episodeNumber`, repli DOM, saison retirée du catalogue)
    expect(seasonPosition({ seasonEpisodeNumber: null, displayedEpisodeNumber: 23 }, 'season')).toBeNull();
    expect(seasonPosition({ seasonEpisodeNumber: 11, displayedEpisodeNumber: null }, 'displayed')).toBeNull();
    // Film (Disney+, Netflix, Prime Video) : épisode 1 des deux numérotations
    expect(seasonPosition({ seasonEpisodeNumber: 1, displayedEpisodeNumber: 1 }, 'season')).toBe(1);
  });
});
