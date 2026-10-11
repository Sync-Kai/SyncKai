import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n';
import type { EpisodeInfo } from '../../shared/episode.types';
import type { AniListMedia } from '../api/media';

// Disney+ (catalogue généraliste, aucun identifiant de série sur la page de lecture) : correspondance par le titre
// anglais de la série, fiable seulement si la fiche AniList au même titre est liée à Disney+ (toute forme de lien).
const storage = vi.hoisted(() => ({ getMediaMapping: vi.fn(), saveMediaMapping: vi.fn(), deleteMediaMapping: vi.fn() }));
const api = vi.hoisted(() => ({ searchAnime: vi.fn(), getAnimeByIds: vi.fn() }));
vi.mock('../../shared/storage', () => storage);
vi.mock('../api/media', () => api);

const { resolveEpisode } = await import('./resolver');
const { hasSeriesTitle, isTitleBoundLink, mappingKey, matchDisneyLink, matchPlatformLink } = await import('./matching');

setLocale('fr');

/** Formes réelles des liens « Disney Plus » d'AniList */
const LEGACY_LINK = 'https://www.disneyplus.com/series/ishura/4hmBWOLvAqm2';
const ENTITY_LINK = 'https://www.disneyplus.com/fr-fr/browse/entity-5e2c1a3b-0000-4000-8000-0123456789ab';

function media(overrides: Partial<AniListMedia> & Pick<AniListMedia, 'id' | 'titles'>): AniListMedia {
  return {
    idMal: null,
    format: 'TV',
    episodes: 12,
    startDate: { year: 2024, month: 4, day: 3 },
    displayTitle: overrides.titles[0] ?? '',
    year: 2024,
    coverUrl: null,
    externalLinkUrls: [],
    relations: [],
    ...overrides,
  };
}

/** Épisode Disney+ tel que le produit l'adapter (titre anglais de internalTitle, numérotation par saison) */
function disneyEpisode(overrides: Partial<EpisodeInfo> = {}): EpisodeInfo {
  return {
    platform: 'disney',
    episodeId: 'eaccaafa-cf43-4d6a-b85f-f9add5b6cf41',
    seriesId: null,
    seriesSlug: null,
    animeTitle: 'Ishura',
    seasonNumber: 1,
    seasonTitle: null,
    seasonEpisodeNumber: 3,
    displayedEpisodeNumber: 3,
    episodeTitle: null,
    url: 'https://www.disneyplus.com/play/eaccaafa-cf43-4d6a-b85f-f9add5b6cf41',
    ...overrides,
  };
}

/** Recherche AniList simulée : résultats par requête */
function searchResults(byQuery: Record<string, AniListMedia[]>): void {
  api.searchAnime.mockImplementation((query: string) => Promise.resolve(byQuery[query] ?? []));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('chrome', {});
  storage.getMediaMapping.mockResolvedValue(null);
  storage.saveMediaMapping.mockResolvedValue(undefined);
  api.getAnimeByIds.mockResolvedValue([]);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('matchDisneyLink', () => {
  it('tout lien Disney+ (ancien /series/…, /browse/entity-…, préfixe de langue) prouve la présence sur la plateforme', () => {
    expect(matchDisneyLink(LEGACY_LINK)).toBe('id');
    expect(matchDisneyLink(ENTITY_LINK)).toBe('id');
    expect(matchDisneyLink('https://disneyplus.com/browse/entity-5e2c1a3b-0000-4000-8000-0123456789ab')).toBe('id');
  });

  it('autre site, hôte piégé ou URL invalide : aucun lien', () => {
    expect(matchDisneyLink('https://www.netflix.com/title/80987039')).toBeNull();
    expect(matchDisneyLink('https://disneyplus.com.evil.example/series/x/1')).toBeNull();
    expect(matchDisneyLink('pas une url')).toBeNull();
  });

  it('matchPlatformLink : règle Disney+ pour un épisode Disney+ uniquement', () => {
    expect(matchPlatformLink(LEGACY_LINK, 'disney', null, null)).toBe('id');
    expect(matchPlatformLink(LEGACY_LINK, 'netflix', '80987039', null)).toBeNull();
    expect(matchPlatformLink('https://www.netflix.com/title/80987039', 'disney', null, null)).toBeNull();
  });

  it('lien lié au titre : Disney+ seulement ; titres de la série, de ses saisons et parties', () => {
    expect(isTitleBoundLink('disney')).toBe(true);
    expect(isTitleBoundLink('netflix')).toBe(false);
    expect(hasSeriesTitle(['Ishura'], 'Ishura')).toBe(true);
    expect(hasSeriesTitle(['Ishura Season 2'], 'ISHURA')).toBe(true);
    expect(hasSeriesTitle(['Synduality: Noir'], 'Ishura')).toBe(false);
  });
});

describe('mappingKey — Disney+', () => {
  it('clé par titre normalisé et saison ; arc (saison 99) par titre de l’arc', () => {
    expect(mappingKey(disneyEpisode())).toBe('disney:title:ishura:s1');
    expect(mappingKey(disneyEpisode({ animeTitle: 'Undead Unluck', seasonNumber: 99, seasonTitle: 'Undead Unluck: Winter Arc' }))).toBe(
      'disney:title:undead unluck winter arc:s99',
    );
    // Arc illisible : saison spéciale
    expect(mappingKey(disneyEpisode({ animeTitle: 'Undead Unluck', seasonNumber: 0 }))).toBe('disney:title:undead unluck:s0');
    // Saison 99 hors Disney+ : clé inchangée
    expect(mappingKey({ platform: 'crunchyroll', seriesId: 'GRMG8ZQZR', animeTitle: 'One Piece', seasonNumber: 99, seasonTitle: 'Arc' })).toBe('crunchyroll:GRMG8ZQZR:s99');
  });
});

describe('resolveEpisode — Disney+', () => {
  it('fiche au titre de la série et liée à Disney+ (ancien lien) : correspondance sûre, mise en cache par titre', async () => {
    searchResults({ Ishura: [media({ id: 163024, titles: ['Ishura'], externalLinkUrls: [LEGACY_LINK] })] });
    const { result } = await resolveEpisode(disneyEpisode());
    expect(result).toMatchObject({ ok: true, target: { mediaId: 163024, progress: 3, confidence: 'high' } });
    expect(storage.saveMediaMapping).toHaveBeenCalledWith('disney:title:ishura:s1', expect.objectContaining({ mediaId: 163024 }));
  });

  it('fiche liée à Disney+ mais d’un autre titre (résultat de recherche voisin) : jamais une saison de la série', async () => {
    searchResults({
      Ishura: [
        media({ id: 163024, titles: ['Ishura'] }),
        media({ id: 170000, titles: ['Synduality: Noir'], externalLinkUrls: [ENTITY_LINK] }),
      ],
    });
    const { result } = await resolveEpisode(disneyEpisode());
    // Titre seul (la fiche « Ishura » n'est pas liée à Disney+) : à vérifier, jamais mis en cache
    expect(result).toMatchObject({ ok: true, target: { mediaId: 163024, confidence: 'low', reason: 'Trouvée par le titre seul (aucune fiche AniList liée à cette série Disney+)' } });
    expect(storage.saveMediaMapping).not.toHaveBeenCalled();
  });

  it('ni lien ni titre identique : série ignorée en silence (live action japonais…)', async () => {
    searchResults({ Gannibal: [media({ id: 1, titles: ['Gantz'], externalLinkUrls: [ENTITY_LINK] })] });
    const { result } = await resolveEpisode(disneyEpisode({ animeTitle: 'Gannibal' }));
    expect(result).toMatchObject({ ok: false, ignored: true });
    expect(storage.saveMediaMapping).not.toHaveBeenCalled();
  });

  it('saison 2 (numérotation par saison) : fiche de la saison 2, liée par son titre « Season 2 »', async () => {
    searchResults({
      Ishura: [
        media({ id: 163024, titles: ['Ishura'], externalLinkUrls: [LEGACY_LINK], startDate: { year: 2024, month: 1, day: 3 } }),
        media({ id: 178000, titles: ['Ishura Season 2'], externalLinkUrls: [ENTITY_LINK], startDate: { year: 2026, month: 1, day: 7 } }),
      ],
    });
    const { result } = await resolveEpisode(disneyEpisode({ seasonNumber: 2, seasonEpisodeNumber: 1, displayedEpisodeNumber: 1 }));
    expect(result).toMatchObject({ ok: true, target: { mediaId: 178000, progress: 1, confidence: 'high' } });
    expect(storage.saveMediaMapping).toHaveBeenCalledWith('disney:title:ishura:s2', expect.objectContaining({ mediaId: 178000 }));
  });

  it('arc en saison 99 : fiche distincte de l’arc (suite de la série), clé par arc', async () => {
    const series = media({
      id: 154966,
      titles: ['Undead Unluck'],
      episodes: 24,
      externalLinkUrls: [LEGACY_LINK],
      startDate: { year: 2023, month: 10, day: 7 },
      relations: [{ id: 185000, type: 'ANIME', relationType: 'SEQUEL', format: 'TV' }],
    });
    const arc = media({ id: 185000, titles: ['Undead Unluck: Winter Arc'], episodes: 12, startDate: { year: 2025, month: 12, day: 1 } });
    searchResults({ 'Undead Unluck': [series], 'Undead Unluck: Winter Arc': [arc, series] });
    const episode = disneyEpisode({
      animeTitle: 'Undead Unluck',
      seasonNumber: 99,
      seasonTitle: 'Undead Unluck: Winter Arc',
      seasonEpisodeNumber: 1,
      displayedEpisodeNumber: 1,
    });
    const { result } = await resolveEpisode(episode);
    expect(result).toMatchObject({ ok: true, target: { mediaId: 185000, progress: 1, confidence: 'high' } });
    expect(storage.saveMediaMapping).toHaveBeenCalledWith('disney:title:undead unluck winter arc:s99', expect.objectContaining({ mediaId: 185000 }));
  });
});
