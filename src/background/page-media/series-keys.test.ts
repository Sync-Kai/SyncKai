import { describe, expect, it } from 'vitest';
import { DISNEY_ARC_SEASON } from '../../shared/episode.types';
import type { PageMediaInfo } from '../../shared/page-media.types';
import type { MediaMapping } from '../../shared/sync.types';
import type { StreamingPlatform } from '../../platforms/registry';
import { exclusionKey, exclusionKeyCovers, mappingKey, seriesKey, seriesMappingPrefix } from '../../platforms/series-identity';
import { rememberedSeason } from './page-media-rules';

// Propriété 1-I7 : la lecture d'un épisode et la page de série de la MÊME série décrivent la même série. Trois clés en
// dépendent : le préfixe des correspondances (page) contre `mappingKey` (lecture), la clé de série ignorée / exclue
// (`seriesKey`), alimentée par les deux côtés. Le tableau couvre chaque plateforme, avec et sans identifiant de
// série en lecture, titres à accents et à ponctuation.

interface SameSeries {
  platform: StreamingPlatform;
  title: string;
  /** Identifiant de série vu par la lecture (null : aucun sur la page de lecture, Disney+ / Prime Video) */
  playbackSeriesId: string | null;
  /** Identifiant de série vu par la page de série (uuid d'entité Disney+, GTI compact Prime Video) */
  pageSeriesId: string | null;
}

const SERIES: SameSeries[] = [
  { platform: 'crunchyroll', title: 'One Piece', playbackSeriesId: 'GRMG8ZQZR', pageSeriesId: 'GRMG8ZQZR' },
  { platform: 'adn', title: 'Tougen Anki', playbackSeriesId: '1311', pageSeriesId: '1311' },
  { platform: 'adn', title: 'Tougen Anki', playbackSeriesId: null, pageSeriesId: null },
  { platform: 'netflix', title: 'Mushoku Tensei', playbackSeriesId: '80987039', pageSeriesId: '80987039' },
  { platform: 'disney', title: 'Undead Unluck', playbackSeriesId: null, pageSeriesId: '5d6e6a2f-8f4e-4c0b-9d7a-1c2b3a4d5e6f' },
  { platform: 'disney', title: 'Moi, quand je me réincarne en Slime', playbackSeriesId: null, pageSeriesId: '0a1b2c3d-0000-4000-8000-000000000001' },
  { platform: 'prime', title: 'BUMPKIN', playbackSeriesId: null, pageSeriesId: 'amzn1.dv.gti.0a1b2c3d-1111-2222-3333-444455556666' },
  { platform: 'prime', title: 'VINLAND SAGA: Season 2', playbackSeriesId: null, pageSeriesId: 'amzn1.dv.gti.aaaaaaaa-1111-2222-3333-444455556666' },
];

const episodeOf = (series: SameSeries, seasonNumber: number): Parameters<typeof mappingKey>[0] => ({
  platform: series.platform,
  seriesId: series.playbackSeriesId,
  animeTitle: series.title,
  seasonNumber,
});

const pageOf = (series: SameSeries, seasonNumber: number): Pick<PageMediaInfo, 'platform' | 'seriesId' | 'seriesTitle' | 'seasonNumber' | 'seasonTitle'> => ({
  platform: series.platform,
  seriesId: series.pageSeriesId,
  seriesTitle: series.title,
  seasonNumber,
  seasonTitle: null,
});

describe('clés d’une même série, lecture et page de série (1-I7)', () => {
  it('le préfixe des correspondances de la page préfixe la clé de chaque saison lue', () => {
    for (const series of SERIES) {
      for (const season of [1, 2, 24]) {
        const prefix = seriesMappingPrefix(pageOf(series, season));
        expect(mappingKey(episodeOf(series, season)).startsWith(prefix), `${series.platform} ${series.title} S${season}`).toBe(true);
      }
    }
  });

  it('la clé d’une saison lue = préfixe de la page + « s{n} » (aucune année : clé inchangée)', () => {
    for (const series of SERIES) {
      expect(mappingKey(episodeOf(series, 3)), series.title).toBe(`${seriesMappingPrefix(pageOf(series, 3))}s3`);
    }
  });

  it('arc Disney+ (saison 99) : préfixe par titre de l’arc, comme la clé en lecture', () => {
    const series = SERIES.find((s) => s.platform === 'disney');
    if (!series) throw new Error('série Disney+ manquante');
    const page = { ...pageOf(series, DISNEY_ARC_SEASON), seasonTitle: 'Winter Arc' };
    const episode = { ...episodeOf(series, DISNEY_ARC_SEASON), seasonTitle: 'Winter Arc' };
    expect(mappingKey(episode)).toBe(`${seriesMappingPrefix(page)}s${DISNEY_ARC_SEASON}`);
  });

  // M5 (audit 1) : la page de série connaît l'uuid / le GTI, la lecture n'a que le titre ; Disney+ et Prime Video sont
  // toujours désignés par leur titre, le verdict « hors anime » d'une page vaut pour la lecture
  it('la clé de série ignorée / exclue est la même côté page de série et côté lecture', () => {
    for (const series of SERIES) {
      const pageKey = seriesKey({ platform: series.platform, seriesId: series.pageSeriesId, animeTitle: series.title });
      const playbackKey = seriesKey({ platform: series.platform, seriesId: series.playbackSeriesId, animeTitle: series.title });
      expect(pageKey, `${series.platform} ${series.title}`).toBe(playbackKey);
    }
  });

  it('arc Disney+ (saison 99) choisi en lecture : retrouvé par la page de série qui affiche cet arc (L5)', () => {
    const series = SERIES[4];
    const episode = { ...episodeOf(series, DISNEY_ARC_SEASON), seasonTitle: 'Undead Unluck: Winter Arc' };
    const mapping: MediaMapping = { mediaId: 180745, numbering: 'season', offset: 0, episodes: 12, chosen: true };
    const mappings = { [mappingKey(episodeOf(series, 1))]: { ...mapping, mediaId: 154587 }, [mappingKey(episode)]: mapping };
    const page = { ...pageOf(series, DISNEY_ARC_SEASON), seasonTitle: 'Undead Unluck: Winter Arc' };
    expect(rememberedSeason(mappings, seriesMappingPrefix(page), DISNEY_ARC_SEASON)).toEqual({ mediaId: 180745, exact: true });
    // Saison ordinaire : jamais l'arc
    expect(rememberedSeason(mappings, seriesMappingPrefix(pageOf(series, 1)), 1)).toEqual({ mediaId: 154587, exact: true });
  });

  it('Berserk 1997 / 2016 (Prime Video) : même clé d’exclusion page de série et lecture, une par remake', () => {
    const berserk = (pageSeriesId: string | null, seasonYear: number) => ({ platform: 'prime' as const, seriesId: pageSeriesId, animeTitle: 'Berserk', seasonNumber: 1, signals: { seasonYear } });
    const page1997 = exclusionKey(berserk('0AAAAAAAAAAAAAAAAAAAAAAAAA', 1997));
    const page2016 = exclusionKey(berserk('0BBBBBBBBBBBBBBBBBBBBBBBBB', 2016));
    expect(page1997).toBe(exclusionKey(berserk(null, 1997)));
    expect(page2016).toBe(exclusionKey(berserk(null, 2016)));
    expect(page2016).toBe('prime:title:berserk:y2016');
    expect(exclusionKeyCovers(page1997, page2016)).toBe(false);
    // Même série ignorée (catalogue), sans année
    expect(seriesKey(berserk('0AAAAAAAAAAAAAAAAAAAAAAAAA', 1997))).toBe(seriesKey(berserk(null, 2016)));
  });
});
