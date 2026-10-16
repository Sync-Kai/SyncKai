import { describe, expect, it } from 'vitest';
import { PLATFORMS, STREAMING_PLATFORMS } from '../../../../platforms/registry';
import { seriesKey } from '../../../../platforms/series-identity';
import { filtersAnime, isTitleBoundLink, policyOf } from './registry';

// Politiques de correspondance (audit 1-§4.2) : cohérentes avec le registre des plateformes et l'identité des séries.

describe('politiques de correspondance par plateforme', () => {
  it('filtre « anime » : plateformes généralistes du registre (linkRequired), Prime Video selon son verdict de genre', () => {
    for (const platform of STREAMING_PLATFORMS.filter((p) => p !== 'prime')) expect(filtersAnime({ platform }), platform).toBe(PLATFORMS[platform].linkRequired);
    expect(filtersAnime({ platform: 'prime', primeAnime: 'anime' })).toBe(false);
    expect(filtersAnime({ platform: 'prime', primeAnime: 'animation-ja' })).toBe(true);
  });

  it('liens au titre de la série : exactement les plateformes désignées par le titre dans les clés (series-identity)', () => {
    for (const platform of STREAMING_PLATFORMS) {
      const titleKeyed = seriesKey({ platform, seriesId: 'X1', animeTitle: 'Foo' }).includes(':title:');
      expect(isTitleBoundLink(platform), platform).toBe(titleKeyed);
    }
  });

  it('présence sur la plateforme : tous les liens comptent, sauf ceux de Prime Video ; ignorée sans recherche : Prime Video sans verdict', () => {
    expect(STREAMING_PLATFORMS.filter((p) => !policyOf(p).countsAsPresence)).toEqual(['prime']);
    expect(STREAMING_PLATFORMS.filter((p) => policyOf(p).ignoredBeforeSearch({}))).toEqual(['prime']);
    expect(policyOf('prime').ignoredBeforeSearch({ primeAnime: 'anime' })).toBe(false);
  });

  it('règlement des liens entre fiches : Disney+ seulement', () => {
    expect(STREAMING_PLATFORMS.filter((p) => policyOf(p).settleLinks !== undefined)).toEqual(['disney']);
  });
});
