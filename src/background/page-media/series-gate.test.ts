import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EpisodeInfo } from '../../shared/episode.types';
import type { PageMediaInfo } from '../../shared/page-media.types';
import { installFakeChrome } from '../../test/fake-chrome';

// Audit 1-M4 (« Bubble ») : la page de série refait la porte gateByPlatformLink sans la règle « fiche non liée à côté
// d'une fiche liée ». Film lié au titre Netflix (« Bubble Movie », MOVIE) et série TV au titre exact « Bubble », sans lien :
// la lecture passe la série TV « à vérifier » (low), la page de série la donne pour certaine. Situation absente du
// catalogue AniList réel (corpus : nf-bubble-series-page, nf-okkos-inn-*, nf-hxh-*, tous déjà corrects) : données
// SUPPOSÉES, reprises du cas T3 de l'audit (signals.audit.test.ts) et de matching-netflix.test.ts. Vraie résolution
// (resolver, page-media) ; seule l'API publique AniList est simulée. Aucun compte connecté.

const SHOW_ID = '81345945';
const FILM = 136430;
const TV = 999001;

/** Fiche brute de l'API (champs de MEDIA_FIELDS) */
function media(id: number, format: string, episodes: number, romaji: string, links: string[]): Record<string, unknown> {
  return {
    id,
    idMal: null,
    format,
    episodes,
    startDate: { year: 2022, month: 4, day: 28 },
    seasonYear: 2022,
    coverImage: null,
    title: { romaji, english: null, native: null, userPreferred: romaji },
    synonyms: [],
    externalLinks: links.map((url) => ({ url })),
    relations: { edges: [] },
    duration: format === 'MOVIE' ? 100 : 24,
    countryOfOrigin: 'JP',
    status: 'FINISHED',
    endDate: { year: 2022, month: 7, day: 1 },
  };
}

const CATALOG = new Map<number, Record<string, unknown>>([
  [FILM, media(FILM, 'MOVIE', 1, 'Bubble Movie', [`https://www.netflix.com/title/${SHOW_ID}`])],
  [TV, media(TV, 'TV', 12, 'Bubble', [])],
]);

const withPage = (entry: Record<string, unknown>): Record<string, unknown> => ({ ...entry, siteUrl: `https://anilist.co/anime/${String(entry.id)}`, nextAiringEpisode: null });

function answer(query: string, variables: Record<string, unknown>): unknown {
  if (typeof variables.search === 'string') return { Page: { media: variables.search === 'Bubble' ? [...CATALOG.values()] : [] } };
  const ids = Array.isArray(variables.ids) ? variables.ids.filter((id): id is number => typeof id === 'number') : [];
  if (/query PageMediaBatch\b/.test(query)) return { Page: { media: ids.flatMap((id) => { const entry = CATALOG.get(id); return entry ? [withPage(entry)] : []; }) } };
  if (ids.length > 0) return { Page: { media: ids.flatMap((id) => CATALOG.get(id) ?? []) } };
  if (typeof variables.id === 'number') {
    const entry = CATALOG.get(variables.id);
    if (entry) return { Media: withPage(entry) };
  }
  throw new Error(`Requête AniList inattendue : ${JSON.stringify(variables)}`);
}

vi.mock('../anilist/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../anilist/client')>()),
  anilistPublicQuery: (query: string, isData: (data: unknown) => boolean, variables: Record<string, unknown> = {}): Promise<unknown> => {
    const data = answer(query, variables);
    return isData(data) ? Promise.resolve(data) : Promise.reject(new Error(`Réponse simulée refusée : ${JSON.stringify(variables)}`));
  },
}));
vi.mock('../trackers', () => ({ getConnectedTrackers: () => Promise.resolve([]) }));
vi.mock('../../browser/platform-access', () => ({ hasPlatformAccess: () => Promise.resolve(true) }));

const fake = installFakeChrome();
const { resolveEpisode } = await import('../sync/resolver');
const { resolvePageMedia, forgetPageResolutions } = await import('./page-media');
const { clearCatalogCache } = await import('../anilist/media');

/** Lecture de S1E1 (saison 1 affichée par Netflix) */
const EPISODE: EpisodeInfo = {
  platform: 'netflix',
  episodeId: '81345946',
  seriesId: SHOW_ID,
  seriesSlug: null,
  animeTitle: 'Bubble',
  seasonNumber: 1,
  seasonTitle: null,
  seasonEpisodeNumber: 1,
  displayedEpisodeNumber: 1,
  episodeTitle: null,
  url: 'https://www.netflix.com/watch/81345946',
};
/** Page /title/{showId}, saison 1 lue dans le menu des saisons */
const SERIES_PAGE: PageMediaInfo = { platform: 'netflix', kind: 'series', seriesId: SHOW_ID, seriesSlug: null, seriesTitle: 'Bubble', seasonNumber: 1, seasonTitle: null, episode: null };

beforeEach(() => {
  fake.reset();
  clearCatalogCache();
  forgetPageResolutions();
});

describe('Netflix « Bubble » : film lié + série TV homonyme non liée (audit 1-M4)', () => {
  it('lecture S1E1 : la série TV au titre exact passe « à vérifier » (fiche non liée à côté d’une fiche liée)', async () => {
    const { result } = await resolveEpisode(EPISODE);
    expect(result).toMatchObject({ ok: true, target: { mediaId: TV, confidence: 'low' } });
  });

  it('page du film (sans saison) : le film lié, certain', async () => {
    const result = await resolvePageMedia({ page: { ...SERIES_PAGE, seasonNumber: null }, mediaId: null });
    expect(result).toMatchObject({ ok: true, data: { media: { mediaId: FILM }, confidence: 'certain' } });
  });

  // BOGUE 1-M4 (correction prévue par e4 `refactor/judge`) : la page de série ne repasse pas par gateByPlatformLink ; la
  // série TV non liée y est « certaine » (relevé : mediaId 999001, confidence 'certain'), et learnableSeriesLink
  // apprendrait le lien Netflix sur la mauvaise fiche. Passe au vert avec e4 : retirer `.fails`.
  it.fails('page de série, saison 1 : même verdict que la lecture (série TV non liée « à vérifier », jamais « certaine »)', async () => {
    const result = await resolvePageMedia({ page: SERIES_PAGE, mediaId: null });
    expect(result).toMatchObject({ ok: true, data: { media: { mediaId: TV }, confidence: 'uncertain' } });
  });
});
