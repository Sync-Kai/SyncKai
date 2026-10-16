import { describe, expect, it } from 'vitest';
import { PLATFORMS, STREAMING_PLATFORMS } from '../../../../platforms/registry';
import { seriesKey } from '../../../../platforms/series-identity';
import { filtersAnime, isTitleBoundLink, legacySeriesSlugInLink, linksToOtherSeries, linksToOtherSeriesBySlug, policyOf } from './registry';

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

  it('Disney+ et Prime Video (aucun identifiant de série en lecture) : un lien n’exclut jamais une fiche comme autre série, aucun ancien slug', () => {
    const links: Record<'disney' | 'prime', string> = {
      disney: 'https://www.disneyplus.com/series/bleach/2Vf0GnBdyiK9',
      prime: 'https://www.primevideo.com/detail/0QWERTY1234567',
    };
    for (const platform of ['disney', 'prime'] as const) {
      expect(linksToOtherSeries(links[platform], platform, 'X1'), platform).toBe(false);
      expect(linksToOtherSeriesBySlug(links[platform], platform, 'autre-slug'), platform).toBe(false);
      expect(legacySeriesSlugInLink(links[platform], platform), platform).toBeNull();
    }
    // Témoin : Crunchyroll reconnaît une autre série par son identifiant
    expect(linksToOtherSeries('https://www.crunchyroll.com/series/GAUTRE/naruto', 'crunchyroll', 'GY9PJ5KWR')).toBe(true);
  });

  it('règlement des liens entre fiches : Disney+ seulement', () => {
    expect(STREAMING_PLATFORMS.filter((p) => policyOf(p).settleLinks !== undefined)).toEqual(['disney']);
  });
});
