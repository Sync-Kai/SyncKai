import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale, t } from '../i18n';
import type { EpisodeInfo } from '../shared/episode.types';
import type { PageMediaInfo } from '../shared/page-media.types';

// Fiche de la page sur une série ignorée par la synchro (Netflix, pas un anime) : résolution simulée.
const resolver = vi.hoisted(() => ({ resolveEpisode: vi.fn(), findSeriesSeasons: vi.fn(), toCandidateSummary: vi.fn() }));
vi.mock('./sync/resolver', () => resolver);
const access = vi.hoisted(() => ({ hasNetflixAccess: vi.fn() }));
vi.mock('../shared/netflix-access', () => access);

const { resolvePageMedia } = await import('./page-media');

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
