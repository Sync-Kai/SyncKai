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

const { resolveEpisode } = await import('./resolver');
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
