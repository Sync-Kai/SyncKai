import { describe, expect, it } from 'vitest';
import {
  BUMPKIN_S1_COMPACT,
  BUMPKIN_S1_GTI,
  BUMPKIN_S2_COMPACT,
  BUMPKIN_S2_GTI,
  BUMPKIN_TITLE,
  bumpkinDetailBody,
  bumpkinDetailWidgets,
  bumpkinEpisodeCompact,
  bumpkinEpisodeGti,
  hydrationDocument,
  spaDetailResponse,
} from './__fixtures__/prime-detail';
import {
  isPrimeDetailWidgets,
  isPrimeTitle,
  parsePrimeDetailId,
  primeAnimeVerdict,
  primeIdInLink,
  primeSignals,
  primeTitleHas,
  reducePrimeDetail,
  reducePrimeDetailWidgets,
  withPrimeWidgets,
} from './prime-metadata';

describe('reducePrimeDetail', () => {
  it('hydratation du premier chargement : saison, épisodes, saisons, genres, piste japonaise', () => {
    const title = reducePrimeDetail(hydrationDocument());
    expect(title).toMatchObject({
      seasonGti: BUMPKIN_S1_GTI,
      compactGTI: BUMPKIN_S1_COMPACT,
      seriesTitle: BUMPKIN_TITLE,
      titleType: 'season',
      seasonNumber: 1,
      episodeCount: 4,
      releaseYear: 2025,
      seasons: [
        { gti: BUMPKIN_S1_GTI, compactGTI: BUMPKIN_S1_COMPACT, seasonNumber: 1 },
        { gti: BUMPKIN_S2_GTI, compactGTI: BUMPKIN_S2_COMPACT, seasonNumber: 2 },
      ],
      genres: ['av_genre_animation_adult_interest', 'av_genre_action', 'av_genre_adventure', 'av_genre_comedy'],
      japaneseAudio: true,
    });
    expect(title?.episodes.map((episode) => [episode.episodeNumber, episode.durationS])).toEqual([
      [1, 1440],
      [2, 1440],
      [3, 1440],
      [4, 1440],
    ]);
    expect(title?.episodes[0]).toEqual({
      gti: bumpkinEpisodeGti(1),
      compactGTI: bumpkinEpisodeCompact(1),
      episodeNumber: 1,
      title: 'The Old Country Bumpkin Goes to the Capital',
      durationS: 1440,
    });
    expect(isPrimeTitle(title)).toBe(true);
  });

  it('réponse JSON de /detail/ (navigation SPA) : même réduction, enveloppe quelconque', () => {
    expect(reducePrimeDetail(spaDetailResponse())).toEqual(reducePrimeDetail(hydrationDocument()));
    expect(reducePrimeDetail({ body: bumpkinDetailBody() })).toEqual(reducePrimeDetail(hydrationDocument()));
  });

  it('titre de série : parentTitle, mention de version retirée ; titre de saison en repli', () => {
    expect(reducePrimeDetail(hydrationDocument(bumpkinDetailBody({ title: 'Tokyo Ghoul Season 1', parentTitle: 'Tokyo Ghoul' })))?.seriesTitle).toBe('Tokyo Ghoul');
    expect(reducePrimeDetail(hydrationDocument(bumpkinDetailBody({ parentTitle: 'Attack on Titan (English Dubbed)' })))?.seriesTitle).toBe('Attack on Titan');
  });

  it('genres du titre préférés aux suggestions ; sans genre dans le détail, tout le document', () => {
    const anime = reducePrimeDetail(hydrationDocument(bumpkinDetailBody({ genres: ['av_genre_anime', 'av_genre_international'], audioTracks: [] })));
    expect(anime?.genres).toEqual(['av_genre_anime', 'av_genre_international']);
    // Liste vide dans le détail : piste japonaise des suggestions jamais retenue
    expect(anime?.japaneseAudio).toBe(false);
    const unscoped = reducePrimeDetail(hydrationDocument(bumpkinDetailBody({ genres: [] })));
    expect(unscoped?.genres).toEqual(['av_genre_anime']);
  });

  it('année de la saison : nombre `releaseYear` de headerDetail, sinon du détail btf ; jamais une chaîne ni les suggestions', () => {
    const body = bumpkinDetailBody({ releaseYear: null });
    // Suggestions (containers) : années en chaîne d'autres titres, jamais retenues
    expect(reducePrimeDetail(hydrationDocument(body))?.releaseYear).toBeNull();
    const detail = Reflect.get(Reflect.get(Reflect.get(Reflect.get(body, 'btf') as object, 'state') as object, 'detail') as object, 'detail') as Record<string, Record<string, unknown>>;
    const own = detail[BUMPKIN_S1_GTI];
    if (!own) throw new Error('fixture invalide');
    own.releaseYear = 2016;
    expect(reducePrimeDetail(hydrationDocument(body))?.releaseYear).toBe(2016);
    own.releaseYear = '2016';
    expect(reducePrimeDetail(hydrationDocument(body))?.releaseYear).toBeNull();
    expect(reducePrimeDetail(hydrationDocument(bumpkinDetailBody({ releaseYear: 1997 })))?.releaseYear).toBe(1997);
  });

  it('signaux : saison (année, épisodes, durée médiane, série) ; film : année et format', () => {
    const season = reducePrimeDetail(hydrationDocument(bumpkinDetailBody({ releaseYear: 2016 })));
    if (!season) throw new Error('fixture invalide');
    expect(primeSignals(season)).toEqual({ seasonYear: 2016, seasonEpisodeCount: 4, episodeMinutes: 24, format: 'series' });
    const movie = reducePrimeDetail(hydrationDocument(bumpkinDetailBody({ releaseYear: 2010, titleType: 'movie', episodes: 0 })));
    if (!movie) throw new Error('fixture invalide');
    expect(primeSignals(movie)).toEqual({ seasonYear: 2010, format: 'movie' });
  });

  it('forme inconnue : null, sans exception', () => {
    for (const raw of [null, undefined, 42, 'x', [], {}, { init: {} }, { atf: { state: {} } }, { atf: { state: { pageTitleId: 'nope' } } }]) {
      expect(reducePrimeDetail(raw)).toBeNull();
    }
    const body = bumpkinDetailBody();
    Reflect.deleteProperty(Reflect.get(Reflect.get(Reflect.get(body, 'atf') as object, 'state') as object, 'detail') as object, 'headerDetail');
    const detail = Reflect.get(Reflect.get(Reflect.get(Reflect.get(body, 'btf') as object, 'state') as object, 'detail') as object, 'detail') as Record<string, unknown>;
    detail[BUMPKIN_S1_GTI] = { titleType: 'season' };
    expect(reducePrimeDetail(hydrationDocument(body))).toBeNull();
  });

  it('types inattendus ignorés champ par champ', () => {
    const body = bumpkinDetailBody();
    const detail = Reflect.get(Reflect.get(Reflect.get(Reflect.get(body, 'btf') as object, 'state') as object, 'detail') as object, 'detail') as Record<string, unknown>;
    detail[bumpkinEpisodeGti(2)] = { title: 42, duration: 'long', episodeNumber: -1, titleType: 'episode' };
    const title = reducePrimeDetail(hydrationDocument(body));
    expect(title?.episodes.find((episode) => episode.gti === bumpkinEpisodeGti(2))).toEqual({
      gti: bumpkinEpisodeGti(2),
      compactGTI: null,
      episodeNumber: null,
      title: null,
      durationS: null,
    });
    expect(isPrimeTitle(title)).toBe(true);
  });
});

describe('reducePrimeDetailWidgets', () => {
  it('épisode en lecture (bestSelf), liste des épisodes, saisons', () => {
    const widgets = reducePrimeDetailWidgets(bumpkinDetailWidgets(2));
    expect(widgets?.seasonGti).toBe(BUMPKIN_S1_GTI);
    expect(widgets?.bestSelf).toEqual({ gti: bumpkinEpisodeGti(2), compactGTI: bumpkinEpisodeCompact(2), sequenceNumber: 2 });
    expect(widgets?.episodes).toHaveLength(4);
    expect(widgets?.seasons.map((season) => season.compactGTI)).toEqual([BUMPKIN_S1_COMPACT, BUMPKIN_S2_COMPACT]);
    expect(isPrimeDetailWidgets(widgets)).toBe(true);
  });

  it('bestSelf qui n’est pas un épisode : ignoré ; sans widgets : null', () => {
    const raw = bumpkinDetailWidgets(1);
    Reflect.set(Reflect.get(Reflect.get(Reflect.get(raw, 'widgets') as object, 'buybox') as object, 'bestSelf') as object, 'titleType', 'season');
    expect(reducePrimeDetailWidgets(raw)?.bestSelf).toBeNull();
    expect(reducePrimeDetailWidgets({})).toBeNull();
    expect(reducePrimeDetailWidgets({ widgets: [] })).toBeNull();
  });

  it('titre complété par les widgets de la même saison seulement', () => {
    const title = reducePrimeDetail(hydrationDocument(bumpkinDetailBody({ episodes: 2 })));
    const widgets = reducePrimeDetailWidgets(bumpkinDetailWidgets(3));
    if (!title || !widgets) throw new Error('fixtures');
    const merged = withPrimeWidgets(title, widgets);
    expect(merged.episodes.map((episode) => episode.episodeNumber)).toEqual([1, 2, 3, 4]);
    expect(merged.episodes[1]?.compactGTI).toBe(bumpkinEpisodeCompact(2));
    expect(primeTitleHas(merged, bumpkinEpisodeGti(4))).toBe(true);
    expect(withPrimeWidgets(title, { ...widgets, seasonGti: BUMPKIN_S2_GTI })).toBe(title);
  });
});

describe('identifiants et liens', () => {
  it('chemin de détail : préfixe de région ou de langue, ASIN, GTI', () => {
    expect(parsePrimeDetailId(`/region/eu/detail/${BUMPKIN_S1_COMPACT}`)).toBe(BUMPKIN_S1_COMPACT);
    expect(parsePrimeDetailId(`/detail/${BUMPKIN_S1_COMPACT.toLowerCase()}/ref=atv_sr`)).toBe(BUMPKIN_S1_COMPACT);
    expect(parsePrimeDetailId('/-/fr/detail/B0ABCDEF12')).toBe('B0ABCDEF12');
    expect(parsePrimeDetailId(`/detail/${BUMPKIN_S1_GTI.toUpperCase()}`)).toBe(BUMPKIN_S1_GTI);
    expect(parsePrimeDetailId('/region/eu/storefront')).toBeNull();
    expect(parsePrimeDetailId('/detail/abc')).toBeNull();
  });

  it('liens AniList : primevideo.com et amazon.<tld>, autres sites refusés', () => {
    expect(primeIdInLink(`https://www.primevideo.com/detail/${BUMPKIN_S1_COMPACT}`)).toBe(BUMPKIN_S1_COMPACT);
    expect(primeIdInLink('https://www.amazon.com/gp/video/detail/B0ABCDEF12/ref=atv_dp')).toBe('B0ABCDEF12');
    expect(primeIdInLink('https://www.amazon.de/Attack-on-Titan/dp/B0ABCDEF12/')).toBe('B0ABCDEF12');
    expect(primeIdInLink(`https://www.amazon.co.jp/gp/video/detail/x?gti=${BUMPKIN_S1_GTI}`)).toBe(BUMPKIN_S1_GTI);
    expect(primeIdInLink('https://www.amazon.evil.example/dp/B0ABCDEF12')).toBeNull();
    expect(primeIdInLink('https://www.netflix.com/title/81402901')).toBeNull();
    expect(primeIdInLink('not a url')).toBeNull();
  });
});

describe('primeAnimeVerdict (tableau G du relevé du 2026-10-14)', () => {
  const ja = true;
  it.each<[string, string[], boolean, ReturnType<typeof primeAnimeVerdict>]>([
    ['Invincible S1 (occidental)', ['av_genre_animation_adult_interest', 'av_genre_action'], false, 'animation-exact-only'],
    ['Hazbin Hotel S1 (occidental)', ['av_genre_animation_adult_interest', 'av_genre_comedy'], false, 'animation-exact-only'],
    ['The Legend of Vox Machina S1 (occidental)', ['av_genre_animation_adult_interest', 'av_genre_adventure'], false, 'animation-exact-only'],
    ['The Legend of Korra Book 1 (occidental)', ['av_genre_animation_adult_interest'], false, 'animation-exact-only'],
    ['Dororo', ['av_genre_anime', 'av_genre_international'], ja, 'anime'],
    ['VINLAND SAGA', ['av_genre_anime', 'av_genre_international'], ja, 'anime'],
    ['Tokyo Ghoul S1', ['av_genre_anime', 'av_genre_animation_adult_interest'], ja, 'anime'],
    ['Tokyo Ghoul √A S2 (Original Japanese Version), piste anglaise seulement', ['av_genre_anime', 'av_genre_animation_adult_interest'], false, 'anime'],
    ['Attack on Titan (English Dubbed) S1 P1', ['av_genre_anime', 'av_genre_animation_adult_interest'], false, 'anime'],
    ['VINLAND SAGA S2 Pt. 1 (Original Japanese Version)', ['av_genre_animation_adult_interest'], ja, 'animation-ja'],
    ['VINLAND SAGA S2 Pt. 1 (Simuldub)', ['av_genre_animation_adult_interest'], false, 'animation-exact-only'],
    ['From Old Country Bumpkin to Master Swordsman S1', ['av_genre_animation_adult_interest', 'av_genre_action', 'av_genre_adventure', 'av_genre_comedy'], ja, 'animation-ja'],
    ['A Star Brighter Than the Sun S1 (pistes inconnues)', ['av_genre_anime'], false, 'anime'],
    ['série sans animation', ['av_genre_action', 'av_genre_drama'], ja, 'ignored'],
    ['genres illisibles', [], ja, 'ignored'],
  ])('%s', (_title, genres, audio, verdict) => {
    expect(primeAnimeVerdict(genres, audio)).toBe(verdict);
  });
});
