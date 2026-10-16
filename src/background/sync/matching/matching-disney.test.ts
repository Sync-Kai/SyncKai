import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withOrigin, type MappingOrigin, type MediaMapping } from '../../../shared/sync.types';
import { setLocale } from '../../../i18n';
import type { EpisodeInfo } from '../../../shared/episode.types';
import type { AniListMedia } from '../../anilist/media';

// Disney+ (catalogue généraliste, aucun identifiant de série sur la page de lecture) : correspondance par le titre
// anglais de la série, fiable seulement si la fiche AniList au même titre est liée à Disney+ (toute forme de lien).
const storage = vi.hoisted(() => {
  const mock = { getMediaMapping: vi.fn(), saved: vi.fn(), forgotten: vi.fn() };
  // Écritures conditionnelles (voir browser/storage/mappings.ts) relayées aux simulations ci-dessus, origine posée comme saveLearned
  return {
    ...mock,
    saveLearned: vi.fn((key: string, _expected: unknown, mapping: MediaMapping, origin: MappingOrigin = 'learned') => mock.saved(key, withOrigin(mapping, origin))),
    forgetIfUnchanged: vi.fn((key: string) => mock.forgotten(key)),
  };
});
const api = vi.hoisted(() => ({ searchAnime: vi.fn(), getAnimeByIds: vi.fn() }));
vi.mock('../../../browser/storage/mappings', () => storage);
vi.mock('../../anilist/media', () => api);

const { findSeriesSeasons, resolveEpisode } = await import('../resolver');
const { disneyEntityInLink, isDisneyEntityLink, matchDisneyLink } = await import('./policies/disney');
const { isTitleBoundLink, matchPlatformLink, platformLinkVerdict } = await import('./policies/registry');
const { hasSeriesTitle } = await import('./season-titles');
const { mappingKey } = await import('../../../platforms/series-identity');

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
  storage.saved.mockResolvedValue(undefined);
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
    expect(storage.saved).toHaveBeenCalledWith('disney:title:ishura:s1', expect.objectContaining({ mediaId: 163024 }));
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
    expect(storage.saved).not.toHaveBeenCalled();
  });

  it('ni lien ni titre identique : série ignorée en silence (live action japonais…)', async () => {
    searchResults({ Gannibal: [media({ id: 1, titles: ['Gantz'], externalLinkUrls: [ENTITY_LINK] })] });
    const { result } = await resolveEpisode(disneyEpisode({ animeTitle: 'Gannibal' }));
    expect(result).toMatchObject({ ok: false, ignored: true });
    expect(storage.saved).not.toHaveBeenCalled();
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
    expect(storage.saved).toHaveBeenCalledWith('disney:title:ishura:s2', expect.objectContaining({ mediaId: 178000 }));
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
    expect(storage.saved).toHaveBeenCalledWith('disney:title:undead unluck winter arc:s99', expect.objectContaining({ mediaId: 185000 }));
  });
});

// ─── Page de série (/browse/entity-{uuid}) : uuid de l'entité connu ───────

describe('page de série Disney+ : lien vers l’entité', () => {
  const ENTITY = '5e2c1a3b-0000-4000-8000-0123456789ab';
  const OTHER_ENTITY_LINK = 'https://www.disneyplus.com/browse/entity-00000000-0000-4000-8000-000000000000';

  it('disneyEntityInLink / isDisneyEntityLink : uuid de /browse/entity-{uuid} (préfixe de langue, casse ignorés)', () => {
    expect(disneyEntityInLink(ENTITY_LINK)).toBe(ENTITY);
    expect(disneyEntityInLink(ENTITY_LINK.toUpperCase().replace('HTTPS://WWW.DISNEYPLUS.COM', 'https://www.disneyplus.com'))).toBe(ENTITY);
    expect(disneyEntityInLink(LEGACY_LINK)).toBeNull();
    expect(disneyEntityInLink(`https://evil.example/browse/entity-${ENTITY}`)).toBeNull();
    expect(isDisneyEntityLink(ENTITY_LINK, ENTITY)).toBe(true);
    expect(isDisneyEntityLink(ENTITY_LINK, null)).toBe(false);
    expect(isDisneyEntityLink(OTHER_ENTITY_LINK, ENTITY)).toBe(false);
  });

  it('matchDisneyLink : lien vers une autre entité refusé sur la page de série, accepté en lecture (uuid inconnu)', () => {
    expect(matchDisneyLink(OTHER_ENTITY_LINK, ENTITY)).toBeNull();
    expect(matchDisneyLink(OTHER_ENTITY_LINK)).toBe('id');
    expect(matchDisneyLink(ENTITY_LINK, ENTITY)).toBe('id');
    expect(matchDisneyLink(LEGACY_LINK, ENTITY)).toBe('id');
  });

  it('fiche liée à l’entité : saison de la série même sans titre identique (titre localisé ou différent)', async () => {
    searchResults({ 'Time Shadows': [media({ id: 1, titles: ['Summer Time Rendering', 'Summertime Render'], externalLinkUrls: [ENTITY_LINK] })] });
    const { candidates, seasons } = await findSeriesSeasons({ platform: 'disney', seriesId: ENTITY, seriesSlug: null, animeTitle: 'Time Shadows', seasonTitle: null });
    expect(candidates.map((c) => c.link)).toEqual(['id']);
    expect(seasons.map((m) => m.id)).toEqual([1]);
    expect(platformLinkVerdict({ platform: 'disney', animeTitle: 'Time Shadows' }, candidates)).toBe('linked');
  });

  it('fiche au même titre liée à une AUTRE entité : non rattachée ; même fiche en lecture (sans uuid) : rattachée par le titre', async () => {
    searchResults({ Ishura: [media({ id: 2, titles: ['Ishura'], externalLinkUrls: [OTHER_ENTITY_LINK] })] });
    const series = await findSeriesSeasons({ platform: 'disney', seriesId: ENTITY, seriesSlug: null, animeTitle: 'Ishura', seasonTitle: null });
    expect(series.candidates.map((c) => c.link)).toEqual([null]);
    expect(platformLinkVerdict({ platform: 'disney', animeTitle: 'Ishura' }, series.candidates)).toBe('title');
    const playback = await findSeriesSeasons({ platform: 'disney', seriesId: null, seriesSlug: null, animeTitle: 'Ishura', seasonTitle: null });
    expect(playback.candidates.map((c) => c.link)).toEqual(['platform']);
  });

  it('platformLinkVerdict : rien de lié ni au même titre → none ; plateforme spécialisée → open', () => {
    expect(platformLinkVerdict({ platform: 'disney', animeTitle: 'Andor' }, [{ id: 3, format: 'TV', episodes: 12, startDate: null, titles: ['Ishura'], link: null }])).toBe('none');
    expect(platformLinkVerdict({ platform: 'crunchyroll', animeTitle: 'Andor' }, [])).toBe('open');
  });
});

describe('remakes au même titre liés chacun à Disney+ (audit H2)', () => {
  const remakes = (): void =>
    searchResults({
      Foo: [
        media({ id: 1, titles: ['Foo'], episodes: 25, startDate: { year: 1997, month: 10, day: 8 }, externalLinkUrls: ['https://www.disneyplus.com/series/foo/aaaaaaaa1'] }),
        media({ id: 2, titles: ['Foo'], episodes: 12, startDate: { year: 2016, month: 7, day: 1 }, externalLinkUrls: ['https://www.disneyplus.com/series/foo-2016/bbbbbbbb2'] }),
      ],
    });

  it('sans signal : à vérifier, jamais mis en cache', async () => {
    remakes();
    const { result } = await resolveEpisode(disneyEpisode({ animeTitle: 'Foo' }));
    expect(result).toMatchObject({ ok: true, target: { mediaId: 1, progress: 3, confidence: 'low' } });
    expect(storage.saved).not.toHaveBeenCalled();
  });

  it('année de la série : le remake prouvé par les signaux, synchronisé', async () => {
    remakes();
    const { result } = await resolveEpisode(disneyEpisode({ animeTitle: 'Foo', signals: { seriesYear: 2016 } }));
    expect(result).toMatchObject({ ok: true, target: { mediaId: 2, progress: 3, confidence: 'high' } });
  });
});
