import { describe, expect, it } from 'vitest';
import type { MediaCandidate, EpisodeNumbers } from './model';
import { provenBySignals } from './signal-groups';

// Groupe de saison prouvé par les signaux de la plateforme (proposé à la place d'une correspondance en cache mise en
// doute, voir resolver.ts › questionMapping) : Berserk 1997 / 2016, deux franchises au même titre, Prime Video.

function candidate(id: number, year: number, episodes: number): MediaCandidate {
  return { id, format: 'TV', episodes, startDate: year * 10_000 + 1001, titles: ['Berserk'], link: null, endYear: year, status: 'FINISHED', duration: 24, country: 'JP' };
}

const BERSERK_1997 = candidate(33, 1997, 25);
const BERSERK_2016 = candidate(21560, 2016, 12);
const CANDIDATES = [BERSERK_1997, BERSERK_2016];

function episode(signals: EpisodeNumbers['signals']): EpisodeNumbers {
  return { platform: 'prime', animeTitle: 'Berserk', seasonTitle: null, seasonNumber: 1, seasonEpisodeNumber: 3, displayedEpisodeNumber: 3, ...(signals ? { signals } : {}) };
}

describe('provenBySignals', () => {
  it('année de la saison concordante avec un seul groupe : sa fiche est prouvée, pas celle du remake', () => {
    expect(provenBySignals(episode({ seasonYear: 2016 }), CANDIDATES, 21560)).toBe(true);
    expect(provenBySignals(episode({ seasonYear: 2016 }), CANDIDATES, 33)).toBe(false);
    expect(provenBySignals(episode({ seasonYear: 1997 }), CANDIDATES, 33)).toBe(true);
  });

  it('sans signal, ou signal qui ne départage rien (durée seule) : rien de prouvé', () => {
    expect(provenBySignals(episode(undefined), CANDIDATES, 21560)).toBe(false);
    expect(provenBySignals(episode({ episodeMinutes: 24 }), CANDIDATES, 21560)).toBe(false);
  });

  it('signaux contredisant tous les groupes : aucun groupe gardé, rien de prouvé', () => {
    expect(provenBySignals(episode({ seasonYear: 2008 }), CANDIDATES, 21560)).toBe(false);
  });
});
