import { describe, expect, it } from 'vitest';
import { movieShow, ONE_PIECE_E1170, onePieceShow, RANMA_S1E5, ranmaShow } from '../../shared/__fixtures__/netflix-history';
import { toEpisodeInfo } from '../../shared/cr-import';
import { reduceNetflixShow } from '../../shared/netflix-import';
import type { NetflixShowMetadata } from '../../shared/netflix-metadata';
import { episodeInfoFromMetadata } from './netflix';

// Import de l'historique Netflix ↔ synchro en direct : l'épisode qu'analyse l'import (saison réduite → toEpisodeInfo) est
// exactement celui que lirait le script de contenu sur la page de lecture de cet épisode (episodeInfoFromMetadata) :
// même clé de correspondance, mêmes numéros, mêmes épisodes par saison, donc mêmes réponses du résolveur.

function parity(show: NetflixShowMetadata, movieId: string): void {
  const season = reduceNetflixShow(show, 85).find((s) => s.episodeId === movieId);
  if (!season) throw new Error(`saison de ${movieId} absente`);
  // Le point de lecture ne fait pas partie de l'épisode transmis au résolveur
  expect(toEpisodeInfo(season, 'netflix')).toEqual(episodeInfoFromMetadata(show, movieId));
}

describe('import Netflix : mêmes épisodes que la page de lecture', () => {
  it('Ranma ½ S1E5 (saisons relatives, épisodes par saison)', () => {
    parity(ranmaShow(), RANMA_S1E5);
  });

  it('One Piece E1170 (arc Elbaph, numérotation absolue)', () => {
    parity(onePieceShow(true), ONE_PIECE_E1170);
  });

  it('film (épisode 1, sans saison)', () => {
    parity(movieShow(7300), '60023642');
  });
});
