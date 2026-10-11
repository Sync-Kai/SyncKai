import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n';
import type { EpisodeInfo } from '../../shared/episode.types';
import type { AniListMedia } from '../api/media';

// Mise en cache des correspondances selon le filtre Netflix (stockage et API AniList simulés).
const storage = vi.hoisted(() => ({
  getMediaMapping: vi.fn(),
  saveMediaMapping: vi.fn(),
  deleteMediaMapping: vi.fn(),
}));
const api = vi.hoisted(() => ({ searchAnime: vi.fn(), getAnimeByIds: vi.fn() }));

vi.mock('../../shared/storage', () => storage);
vi.mock('../api/media', () => api);

const { findSeriesSeasons, resolveEpisode } = await import('./resolver');
const { IGNORED_SERIES_TTL_MS } = await import('./ignored-series');

/** Faux chrome.storage.session (verdicts « série ignorée » du service worker) */
const session = new Map<string, unknown>();
const sessionArea = {
  get: (key: string): Promise<Record<string, unknown>> => Promise.resolve(session.has(key) ? { [key]: session.get(key) } : {}),
  set: (items: Record<string, unknown>): Promise<void> => {
    for (const [key, value] of Object.entries(items)) session.set(key, value);
    return Promise.resolve();
  },
};

setLocale('fr');

const SHOW_ID = '80987039';

function media(overrides: Partial<AniListMedia> & Pick<AniListMedia, 'id' | 'titles'>): AniListMedia {
  return {
    idMal: null,
    format: 'TV',
    episodes: 12,
    startDate: { year: 2021, month: 1, day: 11 },
    displayTitle: overrides.titles[0] ?? '',
    year: 2021,
    coverUrl: null,
    externalLinkUrls: [],
    relations: [],
    ...overrides,
  };
}

function netflixEpisode(overrides: Partial<EpisodeInfo> = {}): EpisodeInfo {
  return {
    platform: 'netflix',
    episodeId: '81402901',
    seriesId: SHOW_ID,
    seriesSlug: null,
    animeTitle: 'Frieren',
    seasonNumber: 1,
    seasonTitle: null,
    seasonEpisodeNumber: 3,
    displayedEpisodeNumber: 3,
    episodeTitle: null,
    url: 'https://www.netflix.com/watch/81402901',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  session.clear();
  vi.stubGlobal('chrome', { storage: { session: sessionArea } });
  storage.getMediaMapping.mockResolvedValue(null);
  storage.saveMediaMapping.mockResolvedValue(undefined);
  api.getAnimeByIds.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('resolveEpisode — Netflix', () => {
  it('fiche liée à /title/{showId} : correspondance sûre, mise en cache', async () => {
    api.searchAnime.mockResolvedValue([media({ id: 154587, titles: ['Sousou no Frieren', 'Frieren'], externalLinkUrls: [`https://www.netflix.com/be-fr/title/${SHOW_ID}`] })]);
    const { result } = await resolveEpisode(netflixEpisode());
    expect(result).toMatchObject({ ok: true, target: { mediaId: 154587, progress: 3, confidence: 'high' } });
    expect(storage.saveMediaMapping).toHaveBeenCalledWith(`netflix:${SHOW_ID}:s1`, expect.objectContaining({ mediaId: 154587 }));
  });

  it('titre seul (même titre, aucun lien Netflix) : à vérifier, jamais mis en cache', async () => {
    api.searchAnime.mockResolvedValue([media({ id: 154587, titles: ['Sousou no Frieren', 'Frieren'], externalLinkUrls: ['https://www.crunchyroll.com/series/GG5H5XQX4'] })]);
    const { result } = await resolveEpisode(netflixEpisode());
    expect(result).toMatchObject({ ok: true, target: { mediaId: 154587, confidence: 'low' } });
    expect(storage.saveMediaMapping).not.toHaveBeenCalled();
  });

  it('ni lien ni titre identique : série ignorée, rien en cache', async () => {
    api.searchAnime.mockResolvedValue([media({ id: 1, titles: ['Wednesday Addams Special'] })]);
    const { result } = await resolveEpisode(netflixEpisode({ animeTitle: 'Wednesday' }));
    expect(result).toMatchObject({ ok: false, ignored: true });
    expect(storage.saveMediaMapping).not.toHaveBeenCalled();
  });

  it('Crunchyroll : titre seul fiable (saison 1) toujours mis en cache', async () => {
    api.searchAnime.mockResolvedValue([media({ id: 154587, titles: ['Frieren'] })]);
    const { result } = await resolveEpisode(netflixEpisode({ platform: 'crunchyroll', seriesId: 'GG5H5XQX4' }));
    expect(result).toMatchObject({ ok: true, target: { mediaId: 154587, confidence: 'high' } });
    expect(storage.saveMediaMapping).toHaveBeenCalledOnce();
  });

  describe('verdict « série ignorée » mémorisé par le service worker', () => {
    const wednesday = (overrides: Partial<EpisodeInfo> = {}): EpisodeInfo => netflixEpisode({ animeTitle: 'Wednesday', ...overrides });

    beforeEach(() => {
      api.searchAnime.mockResolvedValue([media({ id: 1, titles: ['Wednesday Addams Special'] })]);
    });

    it('nouvel onglet ou épisode de la même série : ignorée sans nouvelle recherche AniList', async () => {
      expect((await resolveEpisode(wednesday())).result).toMatchObject({ ok: false, ignored: true });
      const searches = api.searchAnime.mock.calls.length;
      expect(searches).toBeGreaterThan(0);

      // Autre épisode, autre saison : même série (netflix:{showId})
      const again = await resolveEpisode(wednesday({ episodeId: '81402999', seasonNumber: 2, seasonEpisodeNumber: 1 }));
      expect(again.result).toMatchObject({ ok: false, ignored: true });
      // Lecture seule (fiche de la page) : même verdict, sans recherche
      expect((await resolveEpisode(wednesday(), { persist: false })).result).toMatchObject({ ok: false, ignored: true });
      expect(api.searchAnime).toHaveBeenCalledTimes(searches);

      // Une autre série reste recherchée
      await resolveEpisode(wednesday({ seriesId: '80000001' }));
      expect(api.searchAnime.mock.calls.length).toBeGreaterThan(searches);
    });

    it('verdict écrit aussi par une résolution en lecture seule (fiche de la page)', async () => {
      await resolveEpisode(wednesday(), { persist: false });
      const searches = api.searchAnime.mock.calls.length;
      expect((await resolveEpisode(wednesday())).result).toMatchObject({ ok: false, ignored: true });
      expect(api.searchAnime).toHaveBeenCalledTimes(searches);
    });

    it('après 24 h : nouvelle recherche (un lien AniList a pu être ajouté)', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-10-09T12:00:00Z'));
      await resolveEpisode(wednesday());
      const searches = api.searchAnime.mock.calls.length;

      vi.setSystemTime(Date.now() + IGNORED_SERIES_TTL_MS - 1);
      await resolveEpisode(wednesday());
      expect(api.searchAnime).toHaveBeenCalledTimes(searches);

      vi.setSystemTime(Date.now() + 2);
      api.searchAnime.mockResolvedValue([media({ id: 2, titles: ['Wednesday'], externalLinkUrls: [`https://www.netflix.com/title/${SHOW_ID}`] })]);
      const { result } = await resolveEpisode(wednesday());
      expect(api.searchAnime.mock.calls.length).toBeGreaterThan(searches);
      expect(result).toMatchObject({ ok: true, target: { mediaId: 2, confidence: 'high' } });
    });

    it('correspondance enregistrée (choix manuel) : prioritaire sur le verdict mémorisé', async () => {
      await resolveEpisode(wednesday());
      api.searchAnime.mockClear();
      storage.getMediaMapping.mockResolvedValue({ mediaId: 42, numbering: 'season', offset: 0, episodes: 12 });
      const { result } = await resolveEpisode(wednesday());
      expect(result).toMatchObject({ ok: true, target: { mediaId: 42, progress: 3, confidence: 'high' } });
      expect(api.searchAnime).not.toHaveBeenCalled();
    });

    it('titre seul (à vérifier) : jamais mémorisé comme ignoré', async () => {
      api.searchAnime.mockResolvedValue([media({ id: 154587, titles: ['Frieren'] })]);
      await resolveEpisode(netflixEpisode());
      await resolveEpisode(netflixEpisode());
      expect(api.searchAnime).toHaveBeenCalledTimes(2);
    });

    it('stockage de session absent : pas de mémoire, recherche à chaque fois', async () => {
      vi.stubGlobal('chrome', { storage: {} });
      await resolveEpisode(wednesday());
      await resolveEpisode(wednesday());
      expect(api.searchAnime).toHaveBeenCalledTimes(2);
    });
  });
});

/** Épisode Crunchyroll (aucun filtre « anime », aucun verdict mémorisé) */
function crunchyrollEpisode(overrides: Partial<EpisodeInfo> = {}): EpisodeInfo {
  return netflixEpisode({ platform: 'crunchyroll', episodeId: 'GR3VWXP96', seriesId: 'GG5H5XQX4', url: 'https://www.crunchyroll.com/watch/GR3VWXP96', ...overrides });
}

describe('resolveEpisode — correspondance en cache', () => {
  const KEY = 'crunchyroll:GG5H5XQX4:s1';
  const cached = { mediaId: 154587, numbering: 'season', offset: 0, episodes: 12 } as const;

  beforeEach(() => {
    storage.getMediaMapping.mockResolvedValue(cached);
    api.searchAnime.mockResolvedValue([media({ id: 154587, titles: ['Frieren'], episodes: 28, externalLinkUrls: ['https://www.crunchyroll.com/series/GG5H5XQX4'] })]);
  });

  it('correspondance valide : confiance haute, aucune recherche AniList ni écriture', async () => {
    const { result } = await resolveEpisode(crunchyrollEpisode());
    expect(storage.getMediaMapping).toHaveBeenCalledWith(KEY);
    expect(result).toMatchObject({ ok: true, target: { mediaId: 154587, progress: 3, confidence: 'high', reason: 'Correspondance en cache', fromCache: true } });
    expect(api.searchAnime).not.toHaveBeenCalled();
    expect(api.getAnimeByIds).not.toHaveBeenCalled();
    expect(storage.deleteMediaMapping).not.toHaveBeenCalled();
    expect(storage.saveMediaMapping).not.toHaveBeenCalled();
  });

  it('épisode au-delà de la fiche en cache (persist) : correspondance supprimée puis nouvelle résolution', async () => {
    const { result } = await resolveEpisode(crunchyrollEpisode({ seasonEpisodeNumber: 13, displayedEpisodeNumber: 13 }));
    expect(storage.deleteMediaMapping).toHaveBeenCalledWith(KEY);
    expect(api.searchAnime).toHaveBeenCalled();
    expect(storage.deleteMediaMapping.mock.invocationCallOrder[0]).toBeLessThan(api.searchAnime.mock.invocationCallOrder[0] ?? 0);
    expect(result).toMatchObject({ ok: true, target: { mediaId: 154587, progress: 13 } });
    expect(storage.saveMediaMapping).toHaveBeenCalledWith(KEY, expect.objectContaining({ mediaId: 154587, episodes: 28 }));
  });

  it('même cas en lecture seule (persist: false) : ni suppression ni écriture', async () => {
    const { result } = await resolveEpisode(crunchyrollEpisode({ seasonEpisodeNumber: 13, displayedEpisodeNumber: 13 }), { persist: false });
    expect(api.searchAnime).toHaveBeenCalled();
    expect(result).toMatchObject({ ok: true, target: { mediaId: 154587, progress: 13 } });
    expect(storage.deleteMediaMapping).not.toHaveBeenCalled();
    expect(storage.saveMediaMapping).not.toHaveBeenCalled();
  });
});

describe('resolveEpisode — propagation des relations SEQUEL / PREQUEL', () => {
  it('suite absente de la recherche : récupérée par getAnimeByIds et marquée « relation »', async () => {
    api.searchAnime.mockResolvedValue([
      media({
        id: 154587,
        titles: ['Frieren'],
        episodes: 28,
        externalLinkUrls: ['https://www.crunchyroll.com/series/GG5H5XQX4/frieren'],
        relations: [{ relationType: 'SEQUEL', id: 182255, type: 'ANIME', format: 'TV' }],
      }),
    ]);
    api.getAnimeByIds.mockResolvedValue([media({ id: 182255, titles: ['Frieren Season 2'], startDate: { year: 2026, month: 1, day: 16 } })]);

    const { candidates, seasons } = await findSeriesSeasons(crunchyrollEpisode());
    expect(api.getAnimeByIds).toHaveBeenCalledWith([182255], 'interactive');
    expect(candidates.find((c) => c.id === 182255)?.link).toBe('relation');
    expect(seasons.map((m) => m.id)).toEqual([154587, 182255]);

    const { result } = await resolveEpisode(crunchyrollEpisode({ seasonNumber: 2, seasonEpisodeNumber: 3, displayedEpisodeNumber: 3 }));
    expect(result).toMatchObject({ ok: true, target: { mediaId: 182255, progress: 3, confidence: 'high' } });
  });

  describe('préquelle / suite liée à une autre série Crunchyroll (Naruto ← Naruto Shippuden)', () => {
    const SHIPPUDEN = 'GYQ4MW246';
    const shippudenEpisode = (overrides: Partial<EpisodeInfo> = {}): EpisodeInfo =>
      crunchyrollEpisode({ seriesId: SHIPPUDEN, seriesSlug: 'naruto-shippuden', animeTitle: 'Naruto Shippuden', seasonTitle: 'Naruto Shippuden', ...overrides });

    beforeEach(() => {
      api.searchAnime.mockResolvedValue([
        media({
          id: 1735,
          titles: ['Naruto: Shippuuden', 'Naruto Shippuden'],
          episodes: 500,
          startDate: { year: 2007, month: 2, day: 15 },
          externalLinkUrls: [`https://www.crunchyroll.com/series/${SHIPPUDEN}/naruto-shippuden`],
          relations: [
            { relationType: 'PREQUEL', id: 20, type: 'ANIME', format: 'TV' },
            { relationType: 'SEQUEL', id: 97938, type: 'ANIME', format: 'TV' },
          ],
        }),
        // Dérivé sans lien, suite de Naruto : jamais rattaché à travers Naruto
        media({ id: 12679, format: 'ONA', titles: ['Naruto SD: Rock Lee no Seishun Full-Power Ninden'], episodes: 51, startDate: { year: 2012, month: 4, day: 3 } }),
      ]);
      api.getAnimeByIds.mockResolvedValue([
        media({
          id: 20,
          titles: ['NARUTO', 'Naruto'],
          episodes: 220,
          startDate: { year: 2002, month: 10, day: 3 },
          externalLinkUrls: ['https://www.crunchyroll.com/series/GY9VWW3XY/naruto'],
          relations: [
            { relationType: 'SEQUEL', id: 12679, type: 'ANIME', format: 'ONA' },
            { relationType: 'SEQUEL', id: 555, type: 'ANIME', format: 'TV' },
          ],
        }),
        media({
          id: 97938,
          titles: ['BORUTO: NARUTO NEXT GENERATIONS'],
          episodes: 293,
          startDate: { year: 2017, month: 4, day: 5 },
          externalLinkUrls: ['https://www.crunchyroll.com/series/GR4WG7G7R/boruto'],
        }),
      ]);
    });

    it('S1 E5 → Shippuden épisode 5, jamais Naruto (ni en cache)', async () => {
      const { result } = await resolveEpisode(shippudenEpisode({ seasonNumber: 1, seasonEpisodeNumber: 5, displayedEpisodeNumber: 5 }));
      expect(result).toMatchObject({ ok: true, target: { mediaId: 1735, progress: 5 } });
      expect(storage.saveMediaMapping).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ mediaId: 20 }));
    });

    it('S2 E3 affiché E35 → Shippuden épisode 35', async () => {
      const { result } = await resolveEpisode(shippudenEpisode({ seasonNumber: 2, seasonEpisodeNumber: 3, displayedEpisodeNumber: 35 }));
      expect(result).toMatchObject({ ok: true, target: { mediaId: 1735, progress: 35 } });
    });

    it('Naruto et Boruto (identifiants explicites) marqués « other », rien n’est propagé à travers eux', async () => {
      const { candidates, seasons } = await findSeriesSeasons(shippudenEpisode());
      const linkOf = (id: number): string | null | undefined => candidates.find((c) => c.id === id)?.link;
      expect(linkOf(20)).toBe('other');
      expect(linkOf(97938)).toBe('other');
      expect(linkOf(12679)).toBeNull();
      expect(seasons.map((m) => m.id)).toEqual([1735]);
      // Les suites de Naruto (dont 555, absente de la recherche) ne sont jamais récupérées
      expect(api.getAnimeByIds).toHaveBeenCalledOnce();
    });
  });

  describe('liens réels AniList (anciens slugs Crunchyroll, sans identifiant)', () => {
    // Données AniList relevées : Naruto (20) → http://www.crunchyroll.com/naruto ; Shippuden (1735) → …/naruto-shippuden
    const shippudenEpisode = (overrides: Partial<EpisodeInfo> = {}): EpisodeInfo =>
      crunchyrollEpisode({ seriesId: 'GYQ4MW246', seriesSlug: 'naruto-shippuden', animeTitle: 'Naruto Shippuden', seasonTitle: 'Naruto Shippuden', ...overrides });

    beforeEach(() => {
      api.searchAnime.mockResolvedValue([
        media({
          id: 1735,
          titles: ['Naruto: Shippuuden', 'Naruto Shippuden'],
          episodes: 500,
          startDate: { year: 2007, month: 2, day: 15 },
          externalLinkUrls: ['http://www.crunchyroll.com/naruto-shippuden'],
          relations: [{ relationType: 'PREQUEL', id: 20, type: 'ANIME', format: 'TV' }],
        }),
      ]);
      api.getAnimeByIds.mockResolvedValue([
        media({
          id: 20,
          titles: ['NARUTO', 'Naruto'],
          episodes: 220,
          startDate: { year: 2002, month: 10, day: 3 },
          externalLinkUrls: ['http://www.crunchyroll.com/naruto'],
          relations: [{ relationType: 'SEQUEL', id: 1735, type: 'ANIME', format: 'TV' }],
        }),
      ]);
    });

    it('S1 E5 → Shippuden (liée par son slug), confiance haute, jamais Naruto', async () => {
      const { result } = await resolveEpisode(shippudenEpisode({ seasonNumber: 1, seasonEpisodeNumber: 5, displayedEpisodeNumber: 5 }));
      expect(result).toMatchObject({ ok: true, target: { mediaId: 1735, progress: 5, confidence: 'high' } });
      expect(storage.saveMediaMapping).toHaveBeenCalledWith('crunchyroll:GYQ4MW246:s1', expect.objectContaining({ mediaId: 1735 }));
    });

    it('S2 E3 affiché E35 → Shippuden épisode 35, jamais Naruto', async () => {
      const { result } = await resolveEpisode(shippudenEpisode({ seasonNumber: 2, seasonEpisodeNumber: 3, displayedEpisodeNumber: 35 }));
      expect(result).toMatchObject({ ok: true, target: { mediaId: 1735, progress: 35, confidence: 'high' } });
    });

    it('Naruto marqué « other-slug », hors des saisons', async () => {
      const { candidates, seasons } = await findSeriesSeasons(shippudenEpisode());
      expect(candidates.find((c) => c.id === 20)?.link).toBe('other-slug');
      expect(seasons.map((m) => m.id)).toEqual([1735]);
    });
  });

  it('vraie saison écartée sur un ancien slug renommé : jamais de confiance haute (décalage possible)', async () => {
    // Série « foo » : S1 liée, S2 liée à son ancienne page « foo-season-2 », S3 sans lien
    api.searchAnime.mockResolvedValue([
      media({ id: 1, titles: ['Foo'], startDate: { year: 2018, month: 1, day: 1 }, externalLinkUrls: ['http://www.crunchyroll.com/foo'], relations: [{ relationType: 'SEQUEL', id: 2, type: 'ANIME', format: 'TV' }] }),
      media({
        id: 2,
        titles: ['Foo Season 2'],
        startDate: { year: 2020, month: 1, day: 1 },
        externalLinkUrls: ['http://www.crunchyroll.com/foo-season-2'],
        relations: [
          { relationType: 'PREQUEL', id: 1, type: 'ANIME', format: 'TV' },
          { relationType: 'SEQUEL', id: 3, type: 'ANIME', format: 'TV' },
        ],
      }),
      media({ id: 3, titles: ['Foo Season 3'], startDate: { year: 2022, month: 1, day: 1 }, relations: [{ relationType: 'PREQUEL', id: 2, type: 'ANIME', format: 'TV' }] }),
    ]);
    const fooEpisode = (season: number): EpisodeInfo =>
      crunchyrollEpisode({ seriesId: 'GFOO00001', seriesSlug: 'foo', animeTitle: 'Foo', seasonTitle: null, seasonNumber: season, seasonEpisodeNumber: 4, displayedEpisodeNumber: 4 });

    for (const season of [2, 3]) {
      const { result } = await resolveEpisode(fooEpisode(season));
      expect(result).not.toMatchObject({ ok: true, target: { confidence: 'high' } });
    }
    expect(storage.saveMediaMapping).not.toHaveBeenCalled();
  });

  it('Bleach TYBW (aucun lien Crunchyroll, relations seules) : inchangé, fiche au titre de la série', async () => {
    api.searchAnime.mockResolvedValue([
      media({ id: 116674, titles: ['BLEACH: Sennen Kessen-hen', 'Bleach: Thousand-Year Blood War'], relations: [{ relationType: 'PREQUEL', id: 269, type: 'ANIME', format: 'TV' }] }),
      media({ id: 269, titles: ['BLEACH', 'Bleach'], episodes: 366, startDate: { year: 2004, month: 10, day: 5 }, relations: [{ relationType: 'SEQUEL', id: 116674, type: 'ANIME', format: 'TV' }] }),
    ]);
    const { result } = await resolveEpisode(
      crunchyrollEpisode({ seriesId: 'GYQ4MKX6Y', seriesSlug: 'bleach-thousand-year-blood-war', animeTitle: 'Bleach: Thousand-Year Blood War', seasonTitle: null, seasonNumber: 1, seasonEpisodeNumber: 5, displayedEpisodeNumber: 5 }),
    );
    expect(result).toMatchObject({ ok: true, target: { mediaId: 116674, progress: 5, confidence: 'high' } });
    expect(api.getAnimeByIds).not.toHaveBeenCalled();
  });
});
