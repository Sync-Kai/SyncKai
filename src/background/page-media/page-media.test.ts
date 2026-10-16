import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale, t } from '../../i18n';
import type { EpisodeInfo } from '../../shared/episode.types';
import type { PageMediaDetails, PageMediaInfo, PageMediaView } from '../../shared/page-media.types';
import type { CandidateSummary } from '../../shared/review.types';
import { STORAGE_KEYS } from '../../protocol/storage-keys';
import { installFakeChrome } from '../../test/fake-chrome';
import type { AniListMedia } from '../anilist/media';
import {
  AOT_SEASON_IDS,
  AOT_SERIES,
  ATTACK_ON_TITAN_SEARCH,
  FINAL_SEASON_PART_2,
  LAST_ATTACK_MOVIE,
  LAST_ATTACK_MOVIE_ID,
  LAST_ATTACK_SEASON,
} from '../sync/__fixtures__/attack-on-titan-search';

// Fiche de la page : résolution simulée (séries ignorées, accès Netflix), et saison choisie dans le sélecteur
// enregistrée comme correspondance (ARCH-20), relue par la vraie résolution de la synchro.
const resolver = vi.hoisted(() => ({ resolveEpisode: vi.fn(), findSeriesSeasons: vi.fn(), toCandidateSummary: vi.fn() }));
vi.mock('../sync/resolver', () => resolver);
const access = vi.hoisted(() => ({ hasPlatformAccess: vi.fn() }));
vi.mock('../../browser/platform-access', () => access);
// Recherches du catalogue simulées : la vraie résolution (sync, ci-dessous) ne part jamais sur le réseau
const api = vi.hoisted(() => ({ getPageMediaDetails: vi.fn(), searchAnime: vi.fn(), getAnimeByIds: vi.fn() }));
vi.mock('../anilist/media', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../anilist/media')>()),
  getPageMediaDetails: api.getPageMediaDetails,
  searchAnime: api.searchAnime,
  getAnimeByIds: api.getAnimeByIds,
}));
// Aucun service connecté : pas de lecture des listes
vi.mock('../trackers', () => ({ getConnectedTrackers: async () => [] }));

const fake = installFakeChrome();

const { resolvePageMedia, forgetPageResolutions, refreshTabPageMedia } = await import('./page-media');
const { pageMediaCacheKey, toCachedPageMedia, PAGE_MEDIA_CACHE_TTL_MS } = await import('../../browser/storage/page-media-cache');
const { pageMediaFromEpisode } = await import('../../shared/page-media');
const { mappingKey } = await import('../../platforms/series-identity');
// Résolution réelle de la synchro (EPISODE_COMPLETED → syncEpisode → resolveEpisode), hors du simulacre ci-dessus
const sync = await vi.importActual<typeof import('../sync/resolver')>('../sync/resolver');

setLocale('fr');

function page(overrides: Partial<EpisodeInfo> = {}): PageMediaInfo {
  const episode: EpisodeInfo = {
    platform: 'netflix',
    episodeId: '81991750',
    seriesId: '81991749',
    seriesSlug: null,
    animeTitle: 'Comme un rat',
    seasonNumber: 1,
    seasonTitle: null,
    seasonEpisodeNumber: 1,
    displayedEpisodeNumber: 1,
    episodeTitle: null,
    url: 'https://www.netflix.com/watch/81991750',
    ...overrides,
  };
  return { platform: episode.platform, kind: 'episode', seriesId: episode.seriesId, seriesSlug: null, seriesTitle: episode.animeTitle, seasonNumber: 1, seasonTitle: null, episode };
}

beforeEach(() => {
  vi.clearAllMocks();
  fake.reset();
  forgetPageResolutions();
  access.hasPlatformAccess.mockResolvedValue(true);
  api.searchAnime.mockResolvedValue([]);
  api.getAnimeByIds.mockResolvedValue([]);
});

describe('resolvePageMedia — accès Netflix retiré', () => {
  it('onglet Netflix ouvert avant le retrait → NOT_TRACKED (Netflix désactivé), sans aucune recherche', async () => {
    access.hasPlatformAccess.mockResolvedValue(false);
    expect(await resolvePageMedia({ page: page({ episodeId: '81991799' }), mediaId: null })).toEqual({ ok: false, code: 'NOT_TRACKED', message: t('page.platformOff', { platform: 'Netflix' }) });
    expect(resolver.resolveEpisode).not.toHaveBeenCalled();
  });

  it('onglet Disney+ ouvert avant le retrait → NOT_TRACKED (Disney+ désactivé)', async () => {
    access.hasPlatformAccess.mockImplementation((platform: string) => Promise.resolve(platform !== 'disney'));
    const result = await resolvePageMedia({ page: page({ platform: 'disney', episodeId: '0580a81e-2408-48e8-a6e0-14da8ca0e87f', seriesId: null }), mediaId: null });
    expect(result).toEqual({ ok: false, code: 'NOT_TRACKED', message: t('page.platformOff', { platform: 'Disney+' }) });
    expect(resolver.resolveEpisode).not.toHaveBeenCalled();
  });
});

describe('resolvePageMedia — série ignorée', () => {
  it('Netflix sans fiche liée ni même titre → NOT_TRACKED, message neutre (pas « introuvable »)', async () => {
    resolver.resolveEpisode.mockResolvedValue({ result: { ok: false, reason: 'x', ignored: true }, candidates: [], seasons: [], seasonGroups: [] });
    expect(await resolvePageMedia({ page: page(), mediaId: null })).toEqual({ ok: false, code: 'NOT_TRACKED', message: t('page.notTracked', { platform: 'Netflix' }) });
    // Résultat mémorisé : une relecture du panneau ne relance pas la recherche
    await resolvePageMedia({ page: page(), mediaId: null });
    expect(resolver.resolveEpisode).toHaveBeenCalledTimes(1);
  });

  // M5 (audit 1) : la page de série connaît l'uuid de l'entité / le GTI compact, la lecture n'a que le titre ; le verdict
  // « hors anime » de la page vaut pour la lecture de la même série, sans nouvelle recherche AniList
  it.each([
    { platform: 'disney', seriesId: '5d6e6a2f-8f4e-4c0b-9d7a-1c2b3a4d5e6f', title: 'Bluey', extra: { catalogAnime: false } },
    { platform: 'prime', seriesId: '0GMSR5LDQCKJ3B0DQAYCSQIR2W', title: 'Invincible', extra: { primeAnime: 'animation-exact-only' } },
  ] as const)('$platform : page de série ignorée → lecture de la même série ignorée sans recherche', async ({ platform, seriesId, title, extra }) => {
    resolver.findSeriesSeasons.mockResolvedValue({ candidates: [], seasons: [], others: [], seasonGroups: [] });
    const series: PageMediaInfo = { platform, kind: 'series', seriesId, seriesSlug: null, seriesTitle: title, seasonNumber: 1, seasonTitle: null, ...extra, episode: null };
    expect(await resolvePageMedia({ page: series, mediaId: null })).toMatchObject({ ok: false, code: 'NOT_TRACKED' });
    api.searchAnime.mockClear();
    const episode: EpisodeInfo = {
      platform,
      episodeId: 'e1',
      seriesId: null,
      seriesSlug: null,
      animeTitle: title,
      seasonNumber: 1,
      seasonTitle: null,
      seasonEpisodeNumber: 1,
      displayedEpisodeNumber: 1,
      episodeTitle: null,
      url: platform === 'disney' ? 'https://www.disneyplus.com/play/e1' : 'https://www.primevideo.com/detail/e1',
      ...(platform === 'prime' ? { primeAnime: 'animation-exact-only' } : {}),
    };
    const { result } = await sync.resolveEpisode(episode, { persist: false });
    expect(result).toMatchObject({ ok: false, ignored: true });
    expect(api.searchAnime).not.toHaveBeenCalled();
  });

  it('aucune fiche sans série ignorée (titre seul introuvable) → NOT_FOUND, comme sur Crunchyroll', async () => {
    resolver.resolveEpisode.mockResolvedValue({ result: { ok: false, reason: 'x' }, candidates: [], seasons: [], seasonGroups: [] });
    const result = await resolvePageMedia({ page: page({ episodeId: '81991751', animeTitle: 'Autre série' }), mediaId: null });
    expect(result).toEqual({ ok: false, code: 'NOT_FOUND', message: t('page.notFound', { title: 'Autre série' }) });
  });
});

// ─── ARCH-20 : saison choisie dans le sélecteur ─────────────────────────────

/** Mushoku Tensei saison 2 sur Crunchyroll : deux fiches AniList de 12 épisodes (« II » puis « II Part 2 ») */
const PART1 = 146065;
const PART2 = 166873;

const summary = (id: number, title: string): CandidateSummary => ({ id, title, format: 'TV', episodes: 12, year: 2023, coverUrl: null });

function details(mediaId: number): PageMediaDetails {
  return {
    mediaId,
    idMal: null,
    title: mediaId === PART2 ? 'Mushoku Tensei II Part 2' : 'Mushoku Tensei II',
    coverUrl: null,
    episodes: 12,
    format: 'TV',
    year: 2023,
    airingStatus: 'FINISHED',
    nextEpisode: null,
    siteUrl: `https://anilist.co/anime/${mediaId}`,
  };
}

function mushokuEpisode(number: number): EpisodeInfo {
  return {
    platform: 'crunchyroll',
    episodeId: `GMUSHOKU-S2E${number}`,
    seriesId: 'GMUSHOKU',
    seriesSlug: 'mushoku-tensei',
    animeTitle: 'Mushoku Tensei: Jobless Reincarnation',
    seasonNumber: 2,
    seasonTitle: 'Mushoku Tensei: Jobless Reincarnation Season 2',
    seasonEpisodeNumber: number,
    displayedEpisodeNumber: number,
    episodeTitle: null,
    url: `https://www.crunchyroll.com/watch/GMUSHOKU-S2E${number}/`,
  };
}

function episodePage(episode: EpisodeInfo): PageMediaInfo {
  return { platform: 'crunchyroll', kind: 'episode', seriesId: episode.seriesId, seriesSlug: episode.seriesSlug, seriesTitle: episode.animeTitle, seasonNumber: episode.seasonNumber, seasonTitle: episode.seasonTitle, episode };
}

/** Résolution automatique de la page (sans correspondance) : fiche `auto`, saisons de la série regroupées en une saison 2 */
function autoResolution(auto: number, progress: number): void {
  resolver.resolveEpisode.mockResolvedValue({
    result: { ok: true, target: { mediaId: auto, numbering: 'season', offset: 0, episodes: 12, progress, confidence: 'low', reason: 'devinée', fromCache: false } },
    candidates: [],
    seasons: [summary(PART1, 'Mushoku Tensei II'), summary(PART2, 'Mushoku Tensei II Part 2')],
    seasonGroups: [[PART1, PART2]],
  });
}

const storedMappings = (): unknown => fake.local.peek(STORAGE_KEYS.mediaMappings);

describe('resolvePageMedia — saison choisie (ARCH-20)', () => {
  beforeEach(() => {
    api.getPageMediaDetails.mockImplementation(async (id: number) => details(id));
  });

  it('page de lecture : la saison choisie devient la correspondance de la saison, et la synchro de l’épisode l’utilise', async () => {
    const e14 = mushokuEpisode(14);
    // La synchro aurait retenu « II » (devinée) ; l'utilisateur choisit « II Part 2 » dans le sélecteur
    autoResolution(PART1, 12);
    const result = await resolvePageMedia({ page: episodePage(e14), mediaId: PART2 });

    expect(result).toMatchObject({ ok: true, data: { media: { mediaId: PART2 }, source: 'manual', confidence: 'certain', episodeProgress: 2 } });
    const key = mappingKey(e14);
    expect(storedMappings()).toEqual({
      [key]: { mediaId: PART2, numbering: 'displayed', offset: 12, episodes: 12, seriesLabel: 'Mushoku Tensei: Jobless Reincarnation · S2 (Mushoku Tensei: Jobless Reincarnation Season 2)', mediaTitle: 'Mushoku Tensei II Part 2', chosen: true },
    });

    // EPISODE_COMPLETED : la synchro résout l'épisode par la correspondance enregistrée, sans recherche
    const synced = await sync.resolveEpisode(e14);
    expect(synced.result).toMatchObject({ ok: true, target: { mediaId: PART2, progress: 2, confidence: 'high', fromCache: true } });
    // Épisode suivant de la même saison : même fiche, progression suivante
    expect((await sync.resolveEpisode(mushokuEpisode(15))).result).toMatchObject({ ok: true, target: { mediaId: PART2, progress: 3 } });
  });

  it('choix de la fiche que la synchro retenait : sa progression est reprise telle quelle', async () => {
    const e5 = mushokuEpisode(5);
    autoResolution(PART1, 5);
    await resolvePageMedia({ page: episodePage(e5), mediaId: PART1 });
    expect(storedMappings()).toMatchObject({ [mappingKey(e5)]: { mediaId: PART1, numbering: 'season', offset: 0 } });
  });

  it('relecture avec la même saison (après une action) : rien n’est réécrit', async () => {
    const e14 = mushokuEpisode(14);
    autoResolution(PART1, 12);
    await resolvePageMedia({ page: episodePage(e14), mediaId: PART2 });
    const set = vi.spyOn(fake.local, 'set');
    await resolvePageMedia({ page: episodePage(e14), mediaId: PART2 });
    expect(set).not.toHaveBeenCalled();
  });

  it('épisode hors de la saison choisie (E14 sur « II », 12 épisodes) : rien n’est enregistré, la carte le signale', async () => {
    const e14 = mushokuEpisode(14);
    autoResolution(PART2, 2);
    const result = await resolvePageMedia({ page: episodePage(e14), mediaId: PART1 });

    expect(result).toMatchObject({ ok: true, data: { media: { mediaId: PART1 }, source: 'manual', confidence: 'uncertain', episodeProgress: null } });
    expect(storedMappings()).toBeUndefined();
  });

  it('page de série : choix affiché seulement (aucun épisode pour fixer la numérotation), rien n’est enregistré', async () => {
    const series: PageMediaInfo = { ...episodePage(mushokuEpisode(1)), kind: 'series', episode: null };
    resolver.toCandidateSummary.mockImplementation((m: { id: number }) => summary(m.id, 'x'));
    resolver.findSeriesSeasons.mockResolvedValue({
      candidates: [],
      seasons: [{ id: PART1 }, { id: PART2 }],
      others: [],
      seasonGroups: [[PART1, PART2]],
    });
    const result = await resolvePageMedia({ page: series, mediaId: PART2 });
    expect(result).toMatchObject({ ok: true, data: { media: { mediaId: PART2 }, source: 'manual', confidence: 'certain' } });
    expect(storedMappings()).toBeUndefined();
  });
});

// ─── Pages de série Netflix / Disney+ : filtre « anime » ────────────────────

describe('resolvePageMedia — page de série Netflix / Disney+', () => {
  const ANIME = 170000;
  const ENTITY = '9a14d04d-01f2-40d0-be62-a6c8ffe24137';

  function anime(links: string[], title = 'Undead Unluck'): AniListMedia {
    return {
      id: ANIME,
      idMal: null,
      format: 'TV',
      episodes: 24,
      startDate: { year: 2023, month: 10, day: 7 },
      displayTitle: title,
      titles: [title],
      year: 2023,
      coverUrl: null,
      externalLinkUrls: links,
      relations: [],
    };
  }

  /** Recherche AniList simulée : une fiche, lien plateforme `link` (null : titre seul) */
  function found(link: 'id' | null, links: string[] = [], title = 'Undead Unluck'): void {
    const media = anime(links, title);
    resolver.findSeriesSeasons.mockResolvedValue({
      candidates: [{ id: ANIME, format: 'TV', episodes: 24, startDate: 20231007, titles: [title], link }],
      seasons: link ? [media] : [],
      others: [media],
      seasonGroups: link ? [[ANIME]] : [],
    });
  }

  function seriesPage(overrides: Partial<PageMediaInfo> = {}): PageMediaInfo {
    return { platform: 'netflix', kind: 'series', seriesId: '80987039', seriesSlug: null, seriesTitle: 'Undead Unluck', seasonNumber: 1, seasonTitle: null, seasonEpisodeCount: 24, episode: null, ...overrides };
  }

  beforeEach(() => {
    api.getPageMediaDetails.mockImplementation(async (id: number) => ({ ...details(id), mediaId: id, title: 'Undead Unluck' }));
    resolver.toCandidateSummary.mockImplementation((m: { id: number }) => summary(m.id, 'Undead Unluck'));
  });

  it('Netflix, fiche liée à /title/{showId} : saison de la page, certaine', async () => {
    found('id', ['https://www.netflix.com/title/80987039']);
    expect(await resolvePageMedia({ page: seriesPage(), mediaId: null })).toMatchObject({ ok: true, data: { media: { mediaId: ANIME }, confidence: 'certain' } });
  });

  it('Netflix, titre seul : fiche proposée, toujours à vérifier', async () => {
    found(null);
    expect(await resolvePageMedia({ page: seriesPage(), mediaId: null })).toMatchObject({ ok: true, data: { media: { mediaId: ANIME }, confidence: 'uncertain' } });
  });

  it('Netflix, ni fiche liée ni même titre : NOT_TRACKED, verdict mémorisé (pas de nouvelle recherche)', async () => {
    found(null, [], 'Autre chose');
    const expected = { ok: false, code: 'NOT_TRACKED', message: t('page.notTracked', { platform: 'Netflix' }) };
    expect(await resolvePageMedia({ page: seriesPage(), mediaId: null })).toEqual(expected);
    forgetPageResolutions();
    expect(await resolvePageMedia({ page: seriesPage(), mediaId: null })).toEqual(expected);
    expect(resolver.findSeriesSeasons).toHaveBeenCalledTimes(1);
  });

  it('Disney+, fiche liée à l’entité de la page : certaine, même sans genre « Anime »', async () => {
    found('id', [`https://www.disneyplus.com/fr-fr/browse/entity-${ENTITY}`]);
    const page = seriesPage({ platform: 'disney', seriesId: ENTITY, catalogAnime: false });
    expect(await resolvePageMedia({ page, mediaId: null })).toMatchObject({ ok: true, data: { media: { mediaId: ANIME }, confidence: 'certain' } });
  });

  it('Disney+ hors anime (pas de genre « Anime ») : NOT_TRACKED sans lien vers l’entité, même au même titre lié à Disney+', async () => {
    found('id', ['https://www.disneyplus.com/series/undead-unluck/4hmBWOLvAqm2']);
    const page = seriesPage({ platform: 'disney', seriesId: ENTITY, catalogAnime: false });
    expect(await resolvePageMedia({ page, mediaId: null })).toEqual({ ok: false, code: 'NOT_TRACKED', message: t('page.notTracked', { platform: 'Disney+' }) });
  });

  it('Disney+ anime, titre anglais + lien Disney+ (règle de la lecture) : retenue', async () => {
    found('id', ['https://www.disneyplus.com/series/undead-unluck/4hmBWOLvAqm2']);
    const page = seriesPage({ platform: 'disney', seriesId: ENTITY, catalogAnime: true });
    expect(await resolvePageMedia({ page, mediaId: null })).toMatchObject({ ok: true, data: { media: { mediaId: ANIME } } });
  });

  // Prime Video : filtre par le verdict de genre du script de contenu (aucun lien AniList exigé)
  const SEASON_GTI = '0GMSR5LDQCKJ3B0DQAYCSQIR2W';
  const primePage = (overrides: Partial<PageMediaInfo> = {}): PageMediaInfo => seriesPage({ platform: 'prime', seriesId: SEASON_GTI, primeAnime: 'anime', ...overrides });
  const primeNotTracked = { ok: false, code: 'NOT_TRACKED', message: t('page.notTracked', { platform: 'Prime Video' }) };

  it('Prime Video, genre anime, titre seul : fiche retenue (résolution normale, comme Crunchyroll)', async () => {
    found(null);
    expect(await resolvePageMedia({ page: primePage(), mediaId: null })).toMatchObject({ ok: true, data: { media: { mediaId: ANIME } } });
  });

  it('Prime Video, animation sans piste japonaise : retenue sur un titre exact, sinon NOT_TRACKED (jamais « introuvable »)', async () => {
    found(null, [], 'UNDEAD UNLUCK');
    expect(await resolvePageMedia({ page: primePage({ primeAnime: 'animation-exact-only' }), mediaId: null })).toMatchObject({ ok: true, data: { media: { mediaId: ANIME } } });
    forgetPageResolutions();
    found(null, [], 'Undead Unluck Season 2');
    expect(await resolvePageMedia({ page: primePage({ primeAnime: 'animation-exact-only', seriesId: '0ZZZZZZZZZZZZZZZZZZZZZZZZZ' }), mediaId: null })).toEqual(primeNotTracked);
  });

  it('Prime Video, animation sans piste japonaise : lien AniList vers le GTI compact de la page suffit', async () => {
    found('id', [`https://www.primevideo.com/detail/${SEASON_GTI}`], 'Autre titre');
    expect(await resolvePageMedia({ page: primePage({ primeAnime: 'animation-exact-only' }), mediaId: null })).toMatchObject({ ok: true, data: { media: { mediaId: ANIME } } });
  });

  it('Prime Video sans verdict (défensif) : NOT_TRACKED sans recherche ; sans la permission : Prime Video désactivé', async () => {
    expect(await resolvePageMedia({ page: primePage({ primeAnime: undefined }), mediaId: null })).toEqual(primeNotTracked);
    expect(resolver.findSeriesSeasons).not.toHaveBeenCalled();
    access.hasPlatformAccess.mockImplementation((platform: string) => Promise.resolve(platform !== 'prime'));
    expect(await resolvePageMedia({ page: primePage({ seriesTitle: 'Autre' }), mediaId: null })).toEqual({ ok: false, code: 'NOT_TRACKED', message: t('page.platformOff', { platform: 'Prime Video' }) });
    expect(access.hasPlatformAccess).toHaveBeenCalledWith('prime');
  });
});

describe('resolvePageMedia — page de série Crunchyroll sur la saison « Special »', () => {
  const TV = 153845;
  const SPECIAL = 170110;
  const TITLE = 'I Got a Cheat Skill in Another World and Became Unrivaled in The Real World, Too';

  function entry(id: number, format: string, episodes: number, titles: string[]): AniListMedia {
    return { id, idMal: null, format, episodes, startDate: null, displayTitle: titles[0] ?? '', titles, year: 2023, coverUrl: null, externalLinkUrls: [], relations: [] };
  }

  beforeEach(() => {
    const tv = entry(TV, 'TV', 13, [TITLE]);
    const special = entry(SPECIAL, 'SPECIAL', 1, [`${TITLE} (Special) - The Legendary Dragon—Awakens`]);
    resolver.findSeriesSeasons.mockResolvedValue({
      candidates: [
        { id: TV, format: 'TV', episodes: 13, startDate: 20230406, titles: [TITLE], link: 'id' },
        { id: SPECIAL, format: 'SPECIAL', episodes: 1, startDate: 20240301, titles: special.titles, link: 'relation' },
      ],
      seasons: [tv],
      others: [tv, special],
      seasonGroups: [[TV]],
    });
    resolver.toCandidateSummary.mockImplementation((m: { id: number }) => summary(m.id, 'x'));
    api.getPageMediaDetails.mockImplementation(async (id: number) => ({ ...details(id), mediaId: id }));
  });

  const special = (overrides: Partial<PageMediaInfo>): PageMediaInfo => ({
    platform: 'crunchyroll',
    kind: 'series',
    seriesId: 'GEXH3W49E',
    seriesSlug: null,
    seriesTitle: TITLE,
    seasonNumber: null,
    seasonTitle: 'Special',
    episode: null,
    ...overrides,
  });

  it('saison « Special » lue sur la page : fiche spéciale, certaine', async () => {
    expect(await resolvePageMedia({ page: special({}), mediaId: null })).toMatchObject({ ok: true, data: { media: { mediaId: SPECIAL }, confidence: 'certain' } });
  });
});

describe('resolvePageMedia — One Piece sur Netflix, page de série de l’arc « Elbaph Arc » (saison 40)', () => {
  const ONE_PIECE = 21;
  const MONSTERS = 167404;

  function entry(id: number, format: string, episodes: number | null, titles: string[]): AniListMedia {
    return { id, idMal: null, format, episodes, startDate: null, displayTitle: titles[0] ?? '', titles, year: 1999, coverUrl: null, externalLinkUrls: [], relations: [] };
  }

  beforeEach(() => {
    const onePiece = entry(ONE_PIECE, 'TV', null, ['ONE PIECE', 'One Piece']);
    resolver.findSeriesSeasons.mockResolvedValue({
      candidates: [
        { id: ONE_PIECE, format: 'TV', episodes: null, startDate: 19991020, titles: ['ONE PIECE', 'One Piece'], link: 'id', hasPrequel: true },
        { id: MONSTERS, format: 'ONA', episodes: 1, startDate: 20240121, titles: ['MONSTERS: Ippaku Sanjou Hiryuu Jigoku'], link: 'other' },
        { id: 141902, format: 'MOVIE', episodes: 1, startDate: 20220806, titles: ['ONE PIECE FILM: RED'], link: 'other' },
      ],
      seasons: [onePiece],
      others: [onePiece, entry(MONSTERS, 'ONA', 1, ['MONSTERS']), entry(141902, 'MOVIE', 1, ['ONE PIECE FILM: RED'])],
      seasonGroups: [[ONE_PIECE]],
    });
    resolver.toCandidateSummary.mockImplementation((m: { id: number }) => summary(m.id, 'One Piece'));
    api.getPageMediaDetails.mockImplementation(async (id: number) => ({ ...details(id), mediaId: id, title: 'One Piece', episodes: null }));
  });

  it('fiche unique liée, en cours de diffusion, qui couvre tous les arcs : certaine (pas « Saison devinée »)', async () => {
    const page: PageMediaInfo = {
      platform: 'netflix',
      kind: 'series',
      seriesId: '80107103',
      seriesSlug: null,
      seriesTitle: 'One Piece',
      seasonNumber: 40,
      seasonTitle: 'Elbaph Arc',
      seasonEpisodeCount: 25,
      platformSeasons: [61, 70, 25],
      episode: null,
    };
    expect(await resolvePageMedia({ page, mediaId: null })).toMatchObject({ ok: true, data: { media: { mediaId: ONE_PIECE }, confidence: 'certain' } });
  });
});

describe('resolvePageMedia — One Piece sur Crunchyroll, arc « Elbaph (1156-current) »', () => {
  const ONE_PIECE = 21;

  beforeEach(() => {
    const onePiece: AniListMedia = { id: ONE_PIECE, idMal: 21, format: 'TV', episodes: null, startDate: { year: 1999, month: 10, day: 20 }, displayTitle: 'ONE PIECE', titles: ['ONE PIECE', 'One Piece'], year: 1999, coverUrl: null, externalLinkUrls: [], relations: [] };
    resolver.findSeriesSeasons.mockResolvedValue({
      candidates: [{ id: ONE_PIECE, format: 'TV', episodes: null, startDate: 19991020, titles: ['ONE PIECE', 'One Piece'], link: 'id', hasPrequel: true }],
      seasons: [onePiece],
      others: [onePiece],
      seasonGroups: [[ONE_PIECE]],
    });
    resolver.toCandidateSummary.mockImplementation((m: { id: number }) => summary(m.id, 'ONE PIECE'));
    api.getPageMediaDetails.mockImplementation(async (id: number) => ({ ...details(id), mediaId: id, title: 'ONE PIECE', episodes: null }));
  });

  it('fiche unique One Piece, certaine, sans sélecteur (un seul choix)', async () => {
    const page: PageMediaInfo = { platform: 'crunchyroll', kind: 'series', seriesId: 'GRMG8ZQZR', seriesSlug: 'one-piece', seriesTitle: 'One Piece', seasonNumber: null, seasonTitle: 'Elbaph', seasonFirstEpisode: 1156, episode: null };
    const result = await resolvePageMedia({ page, mediaId: null });
    expect(result).toMatchObject({ ok: true, data: { media: { mediaId: ONE_PIECE }, confidence: 'certain' } });
    expect(result.ok && result.data.seasons.length).toBeLessThan(2);
  });
});

describe('resolvePageMedia — One Piece sur Crunchyroll, saison nommée « HEROINES » (spécial rangé en saison 30)', () => {
  // Identifiants AniList réels : ONE PIECE (21), ONE PIECE HEROINES (197178, voir matching-seasons.test.ts), MONSTERS (167404)
  const ONE_PIECE = 21;
  const HEROINES = 197178;
  const MONSTERS = 167404;

  const onePieceCandidate = { id: ONE_PIECE, format: 'TV', episodes: null, startDate: 19991020, titles: ['ONE PIECE', 'One Piece'], link: 'id', hasPrequel: true } as const;
  const monstersCandidate = { id: MONSTERS, format: 'ONA', episodes: 1, startDate: 20240121, titles: ['MONSTERS: Ippaku Sanjou Hiryuu Jigoku'], link: 'other' } as const;
  const heroinesCandidate = { id: HEROINES, format: 'SPECIAL', episodes: 1, startDate: 20260705, titles: ['ONE PIECE HEROINES'], link: null } as const;

  function entry(id: number, format: string, episodes: number | null, titles: string[]): AniListMedia {
    return { id, idMal: null, format, episodes, startDate: null, displayTitle: titles[0] ?? '', titles, year: 1999, coverUrl: null, externalLinkUrls: [], relations: [] };
  }

  function found(withHeroines: boolean): void {
    const onePiece = entry(ONE_PIECE, 'TV', null, ['ONE PIECE', 'One Piece']);
    const others = [onePiece, entry(MONSTERS, 'ONA', 1, ['MONSTERS']), ...(withHeroines ? [entry(HEROINES, 'SPECIAL', 1, ['ONE PIECE HEROINES'])] : [])];
    resolver.findSeriesSeasons.mockResolvedValue({
      candidates: [onePieceCandidate, monstersCandidate, ...(withHeroines ? [heroinesCandidate] : [])],
      seasons: [onePiece],
      others,
      seasonGroups: [[ONE_PIECE]],
    });
  }

  const seriesPage = (season: Partial<PageMediaInfo>): PageMediaInfo => ({
    platform: 'crunchyroll',
    kind: 'series',
    seriesId: 'GRMG8ZQZR',
    seriesSlug: 'one-piece',
    seriesTitle: 'One Piece',
    seasonNumber: null,
    seasonTitle: null,
    episode: null,
    ...season,
  });

  beforeEach(() => {
    resolver.toCandidateSummary.mockImplementation((m: { id: number }) => summary(m.id, 'ONE PIECE'));
    api.getPageMediaDetails.mockImplementation(async (id: number) => ({ ...details(id), mediaId: id, title: 'ONE PIECE', episodes: null }));
  });

  it('fiche ONE PIECE HEROINES trouvée (recherche « One Piece HEROINES ») : retenue, certaine, plutôt que la fiche principale', async () => {
    found(true);
    const result = await resolvePageMedia({ page: seriesPage({ seasonTitle: 'HEROINES' }), mediaId: null });
    expect(result).toMatchObject({ ok: true, data: { media: { mediaId: HEROINES }, confidence: 'certain' } });
    expect(resolver.findSeriesSeasons).toHaveBeenCalledWith(expect.objectContaining({ animeTitle: 'One Piece', seasonTitle: 'HEROINES' }));
  });

  it('fiche de la saison absente des résultats : la fiche principale n’est jamais certaine pour une saison nommée', async () => {
    found(false);
    expect(await resolvePageMedia({ page: seriesPage({ seasonTitle: 'HEROINES' }), mediaId: null })).toMatchObject({ ok: true, data: { media: { mediaId: ONE_PIECE }, confidence: 'uncertain' } });
  });

  it('non-régression : arc « Elbaph (1156-current) » → ONE PIECE certaine, même avec HEROINES dans les résultats', async () => {
    found(true);
    expect(await resolvePageMedia({ page: seriesPage({ seasonTitle: 'Elbaph', seasonFirstEpisode: 1156 }), mediaId: null })).toMatchObject({ ok: true, data: { media: { mediaId: ONE_PIECE }, confidence: 'certain' } });
  });
});

describe('resolvePageMedia — Attack on Titan sur Crunchyroll, saison nommée « Attack on Titan: Last Attack » (film)', () => {
  // Vraie résolution (findSeriesSeasons) sur les résultats AniList réels, voir sync/__fixtures__/attack-on-titan-search.ts
  const seriesPage: PageMediaInfo = {
    platform: 'crunchyroll',
    kind: 'series',
    seriesId: AOT_SERIES.seriesId,
    seriesSlug: AOT_SERIES.seriesSlug,
    seriesTitle: AOT_SERIES.animeTitle,
    seasonNumber: null,
    seasonTitle: LAST_ATTACK_SEASON,
    episode: null,
  };

  function searchResults(bySeason: AniListMedia[]): void {
    api.searchAnime.mockImplementation(async (search: string) => (search === AOT_SERIES.animeTitle ? ATTACK_ON_TITAN_SEARCH : search === LAST_ATTACK_SEASON ? bySeason : []));
  }

  beforeEach(() => {
    resolver.findSeriesSeasons.mockImplementation(sync.findSeriesSeasons);
    resolver.toCandidateSummary.mockImplementation(sync.toCandidateSummary);
    api.getPageMediaDetails.mockImplementation(async (id: number) => ({ ...details(id), mediaId: id, title: `#${id}`, episodes: 1, format: id === LAST_ATTACK_MOVIE_ID ? 'MOVIE' : 'TV' }));
  });

  it('AniList sans fiche du film (réel) : saison devinée parmi les saisons TV, jamais certaine ; 2 recherches seulement', async () => {
    searchResults([]);
    const result = await resolvePageMedia({ page: seriesPage, mediaId: null });
    expect(result).toMatchObject({ ok: true, data: { confidence: 'uncertain', source: 'progress' } });
    expect(result.ok && (AOT_SEASON_IDS as readonly number[]).includes(result.data.media.mediaId)).toBe(true);
    expect(api.searchAnime).toHaveBeenCalledTimes(2);
    expect(api.getAnimeByIds).not.toHaveBeenCalled();
  });

  it('fiche du film trouvée (fiche fictive) : retenue, certaine ; le sélecteur garde les saisons TV (la carte y ajoute le film)', async () => {
    searchResults([LAST_ATTACK_MOVIE]);
    const result = await resolvePageMedia({ page: seriesPage, mediaId: null });
    expect(result).toMatchObject({ ok: true, data: { media: { mediaId: LAST_ATTACK_MOVIE_ID }, confidence: 'certain', source: 'page' } });
    expect(result.ok && result.data.seasons.map((s) => s.id)).toEqual([...AOT_SEASON_IDS]);
  });

  it('première saison au libellé « Attack on Titan » (titre de la série, relevé le 2026-10-15) : saison 1, certaine, jamais la dernière partie mémorisée', async () => {
    searchResults([]);
    // Synchro précédente de la dernière partie : avant le correctif, aucune saison n'était lue et la carte la proposait
    await chrome.storage.local.set({ [STORAGE_KEYS.mediaMappings]: { [`crunchyroll:${AOT_SERIES.seriesId}:s4`]: { mediaId: FINAL_SEASON_PART_2, numbering: 'season', offset: 16, episodes: 12, learned: true } } });
    const result = await resolvePageMedia({ page: { ...seriesPage, seasonTitle: AOT_SERIES.animeTitle }, mediaId: null });
    expect(result).toMatchObject({ ok: true, data: { media: { mediaId: AOT_SEASON_IDS[0] }, confidence: 'certain', source: 'page' } });
    expect(api.searchAnime).toHaveBeenCalledTimes(1);
  });
});

describe('refreshTabPageMedia — fiche de l’onglet après la synchro (PERF-07)', () => {
  const TAB = 7;
  const episode: EpisodeInfo = {
    platform: 'crunchyroll',
    episodeId: 'GG1U2Q5VK',
    seriesId: 'GG5H5XQX4',
    seriesSlug: 'frieren',
    animeTitle: 'Frieren',
    seasonNumber: 1,
    seasonTitle: null,
    seasonEpisodeNumber: 3,
    displayedEpisodeNumber: 3,
    episodeTitle: null,
    url: 'https://www.crunchyroll.com/watch/GG1U2Q5VK/killing-magic',
  };
  const cached = (resolvedAt: number, override: Partial<EpisodeInfo> = {}): unknown =>
    toCachedPageMedia(
      pageMediaFromEpisode({ ...episode, ...override }),
      { media: { mediaId: 154587, title: 'Frieren' }, lists: [], confidence: 'certain', source: 'page', seasons: [], episodeProgress: 2 } as unknown as PageMediaView,
      'resolve',
      resolvedAt,
      {},
    );
  const NOW = 1_800_000_000_000;
  const runtime = chrome.runtime as unknown as { getContexts?: unknown };
  const withContexts = (contexts: { contextType: string; documentUrl?: string }[] | Error | null): void => {
    runtime.getContexts = contexts === null ? undefined : vi.fn(() => (contexts instanceof Error ? Promise.reject(contexts) : Promise.resolve(contexts)));
  };
  const entryKept = (): boolean => fake.session.data.has(pageMediaCacheKey(TAB));
  /** La fiche est recalculée : la résolution de l'épisode (simulée) est interrogée */
  const resolved = (): boolean => resolver.resolveEpisode.mock.calls.length > 0;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    withContexts(null);
  });
  afterEach(() => {
    vi.useRealTimers();
    delete runtime.getContexts;
  });

  it('aucune fiche en cache pour l’onglet : rien n’est recalculé', async () => {
    await refreshTabPageMedia(TAB, episode);
    expect(resolved()).toBe(false);
  });

  it('fiche valable et un popup ouvert : recalculée, entrée gardée jusqu’à sa réécriture', async () => {
    fake.session.seed({ [pageMediaCacheKey(TAB)]: cached(NOW - 60_000) });
    withContexts([{ contextType: 'POPUP', documentUrl: 'chrome-extension://x/src/popup/popup.html' }]);
    await refreshTabPageMedia(TAB, episode);
    expect(resolved()).toBe(true);
    expect(entryKept()).toBe(true);
  });

  it('page du panneau ouverte dans un onglet : compte comme un écran ouvert ; autre page de l’extension : non', async () => {
    fake.session.seed({ [pageMediaCacheKey(TAB)]: cached(NOW - 60_000) });
    withContexts([{ contextType: 'TAB', documentUrl: 'chrome-extension://x/src/sidepanel/sidepanel.html' }]);
    await refreshTabPageMedia(TAB, episode);
    expect(resolved()).toBe(true);

    vi.clearAllMocks();
    forgetPageResolutions();
    withContexts([{ contextType: 'TAB', documentUrl: 'chrome-extension://x/src/import-cr/import-cr.html' }]);
    await refreshTabPageMedia(TAB, episode);
    expect(resolved()).toBe(false);
    expect(entryKept()).toBe(false);
  });

  it('aucun écran ouvert : rien n’est recalculé, la fiche devenue fausse est oubliée (le prochain écran la résout)', async () => {
    fake.session.seed({ [pageMediaCacheKey(TAB)]: cached(NOW - 60_000) });
    withContexts([]);
    await refreshTabPageMedia(TAB, episode);
    expect(resolved()).toBe(false);
    expect(entryKept()).toBe(false);
  });

  it('écrans inconnus (runtime.getContexts absent, ou en échec) : comportement d’avant, fiche recalculée', async () => {
    fake.session.seed({ [pageMediaCacheKey(TAB)]: cached(NOW - 60_000) });
    await refreshTabPageMedia(TAB, episode);
    expect(resolved()).toBe(true);

    vi.clearAllMocks();
    forgetPageResolutions();
    withContexts(new Error('indisponible'));
    await refreshTabPageMedia(TAB, episode);
    expect(resolved()).toBe(true);
  });

  it('fiche expirée (plus de 10 min) ou d’une autre page : personne ne l’affiche, rien n’est recalculé même si un écran est ouvert', async () => {
    withContexts([{ contextType: 'SIDE_PANEL' }]);
    fake.session.seed({ [pageMediaCacheKey(TAB)]: cached(NOW - PAGE_MEDIA_CACHE_TTL_MS - 1) });
    await refreshTabPageMedia(TAB, episode);
    fake.session.seed({ [pageMediaCacheKey(TAB)]: cached(NOW - 1_000, { episodeId: 'GOTHER', url: 'https://www.crunchyroll.com/watch/GOTHER/x' }) });
    await refreshTabPageMedia(TAB, episode);
    expect(resolved()).toBe(false);
  });
});

// ─── L4 : correspondances modifiées pendant que la résolution de la page est gardée en mémoire ───

describe('resolvePageMedia — résolution oubliée quand les correspondances changent (L4)', () => {
  const ignored = { result: { ok: false, reason: 'x', ignored: true }, candidates: [], seasons: [], seasonGroups: [] };
  const mapping = { mediaId: 21, numbering: 'season' as const, offset: 0, episodes: 12 };
  const read = (): Promise<unknown> => resolvePageMedia({ page: page(), mediaId: null });

  beforeEach(() => resolver.resolveEpisode.mockResolvedValue(ignored));

  it('écriture faite dans le service worker (import, migration, apprentissage) : la page est résolue de nouveau', async () => {
    const { deleteMediaMappingsByPrefix, saveMediaMappingsIfAbsent } = await import('../../browser/storage/mappings');
    await read();
    await read();
    expect(resolver.resolveEpisode).toHaveBeenCalledTimes(1);
    // Aucune correspondance retirée : la résolution en mémoire reste
    await deleteMediaMappingsByPrefix('netflix:');
    await read();
    expect(resolver.resolveEpisode).toHaveBeenCalledTimes(1);
    await saveMediaMappingsIfAbsent([{ key: 'netflix:81991749:s1', mapping }]);
    await read();
    expect(resolver.resolveEpisode).toHaveBeenCalledTimes(2);
    await deleteMediaMappingsByPrefix('netflix:');
    await read();
    expect(resolver.resolveEpisode).toHaveBeenCalledTimes(3);
  });

  it('résolution partie avant l’écriture, finie après : jamais gardée (elle a pu lire l’ancienne correspondance)', async () => {
    const { saveMediaMappingsIfAbsent } = await import('../../browser/storage/mappings');
    let finish: (value: typeof ignored) => void = () => undefined;
    resolver.resolveEpisode.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    const pending = read();
    await vi.waitFor(() => expect(resolver.resolveEpisode).toHaveBeenCalledTimes(1));
    await saveMediaMappingsIfAbsent([{ key: 'netflix:81991749:s1', mapping }]);
    finish(ignored);
    await pending;
    await read();
    expect(resolver.resolveEpisode).toHaveBeenCalledTimes(2);
  });
});
