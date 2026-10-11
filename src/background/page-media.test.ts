import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale, t } from '../i18n';
import type { EpisodeInfo } from '../shared/episode.types';
import type { PageMediaDetails, PageMediaInfo } from '../shared/page-media.types';
import type { CandidateSummary } from '../shared/review.types';
import { STORAGE_KEYS } from '../shared/storage-keys';
import { installFakeChrome } from '../test/fake-chrome';

// Fiche de la page : résolution simulée (séries ignorées, accès Netflix), et saison choisie dans le sélecteur
// enregistrée comme correspondance (ARCH-20), relue par la vraie résolution de la synchro.
const resolver = vi.hoisted(() => ({ resolveEpisode: vi.fn(), findSeriesSeasons: vi.fn(), toCandidateSummary: vi.fn() }));
vi.mock('./sync/resolver', () => resolver);
const access = vi.hoisted(() => ({ hasNetflixAccess: vi.fn() }));
vi.mock('../shared/netflix-access', () => access);
const api = vi.hoisted(() => ({ getPageMediaDetails: vi.fn() }));
vi.mock('./api/media', async (importOriginal) => ({ ...(await importOriginal<typeof import('./api/media')>()), getPageMediaDetails: api.getPageMediaDetails }));
// Aucun service connecté : pas de lecture des listes
vi.mock('./trackers', () => ({ getConnectedTrackers: async () => [] }));

const fake = installFakeChrome();

const { resolvePageMedia, forgetPageResolutions } = await import('./page-media');
const { mappingKey } = await import('./sync/matching');
// Résolution réelle de la synchro (EPISODE_COMPLETED → syncEpisode → resolveEpisode), hors du simulacre ci-dessus
const sync = await vi.importActual<typeof import('./sync/resolver')>('./sync/resolver');

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
  access.hasNetflixAccess.mockResolvedValue(true);
});

describe('resolvePageMedia — accès Netflix retiré', () => {
  it('onglet Netflix ouvert avant le retrait → NOT_TRACKED (Netflix désactivé), sans aucune recherche', async () => {
    access.hasNetflixAccess.mockResolvedValue(false);
    expect(await resolvePageMedia({ page: page({ episodeId: '81991799' }), mediaId: null })).toEqual({ ok: false, code: 'NOT_TRACKED', message: t('page.netflixOff') });
    expect(resolver.resolveEpisode).not.toHaveBeenCalled();
  });
});

describe('resolvePageMedia — série ignorée', () => {
  it('Netflix sans fiche liée ni même titre → NOT_TRACKED, message neutre (pas « introuvable »)', async () => {
    resolver.resolveEpisode.mockResolvedValue({ result: { ok: false, reason: 'x', ignored: true }, candidates: [], seasons: [], seasonGroups: [] });
    expect(await resolvePageMedia({ page: page(), mediaId: null })).toEqual({ ok: false, code: 'NOT_TRACKED', message: t('page.notTracked') });
    // Résultat mémorisé : une relecture du panneau ne relance pas la recherche
    await resolvePageMedia({ page: page(), mediaId: null });
    expect(resolver.resolveEpisode).toHaveBeenCalledTimes(1);
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
      [key]: { mediaId: PART2, numbering: 'displayed', offset: 12, episodes: 12, seriesLabel: 'Mushoku Tensei: Jobless Reincarnation · S2 (Mushoku Tensei: Jobless Reincarnation Season 2)', mediaTitle: 'Mushoku Tensei II Part 2' },
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
