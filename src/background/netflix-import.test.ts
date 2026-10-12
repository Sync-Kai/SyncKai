import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale, t } from '../i18n';
import type { AniListMedia } from './api/media';
import { ApiError } from './api/errors';

// Filtre « anime » de l'import Netflix : une recherche AniList par titre (réunies par paquets), verdict par titre.

const fakes = vi.hoisted(() => ({
  connected: true,
  search: vi.fn<(titles: readonly string[], lane?: string) => Promise<Map<string, Pick<AniListMedia, 'titles' | 'externalLinkUrls'>[]>>>(),
}));
vi.mock('./api/media', () => ({ searchAnimeBatch: fakes.search }));
vi.mock('./trackers', () => ({ getConnectedTrackers: async () => (fakes.connected ? [{ id: 'anilist' }] : []) }));

const { checkNetflixTitles, titleVerdict } = await import('./netflix-import');
setLocale('fr');

const RANMA = { titles: ['Ranma 1/2 (2024)', 'Ranma ½', 'らんま1/2'], externalLinkUrls: ['https://www.netflix.com/title/81301833', 'https://www.crunchyroll.com/series/G1'] };
const RANMA_S3 = { titles: ['Ranma 1/2 (2024) Season 3'], externalLinkUrls: ['https://www.netflix.com/be-fr/title/81171925'] };
const WEDNESDAY_DOUJIN = { titles: ['Mercredi'], externalLinkUrls: [] };
const UNRELATED = { titles: ['Dark Gathering'], externalLinkUrls: ['https://www.netflix.com/watch/81000001', 'https://example.com/title/1'] };

beforeEach(() => {
  fakes.connected = true;
  fakes.search.mockReset();
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('verdict d’un titre de l’historique', () => {
  it('séries Netflix liées par les fiches trouvées (/title/{id}, pays toléré) ; pages de lecture et autres sites ignorés', () => {
    expect(titleVerdict('Ranma ½', [RANMA, RANMA_S3, UNRELATED])).toEqual({ title: 'Ranma ½', showIds: ['81301833', '81171925'], titleMatch: true });
  });

  it('même titre sans lien Netflix : gardé pour vérification ; ni lien ni titre : pas un anime', () => {
    expect(titleVerdict('Mercredi', [WEDNESDAY_DOUJIN])).toEqual({ title: 'Mercredi', showIds: [], titleMatch: true });
    expect(titleVerdict('Dark', [UNRELATED])).toEqual({ title: 'Dark', showIds: [], titleMatch: false });
    expect(titleVerdict('Breaking Bad', [])).toEqual({ title: 'Breaking Bad', showIds: [], titleMatch: false });
  });
});

describe('NETFLIX_IMPORT_TITLES', () => {
  it('un verdict par titre, recherches réunies dans la file de fond', async () => {
    fakes.search.mockResolvedValue(new Map([['Ranma ½', [RANMA]], ['Dark', [UNRELATED]]]));
    expect(await checkNetflixTitles({ titles: ['Ranma ½', 'Dark'] })).toEqual({
      ok: true,
      data: [
        { title: 'Ranma ½', showIds: ['81301833'], titleMatch: true },
        { title: 'Dark', showIds: [], titleMatch: false },
      ],
    });
    expect(fakes.search).toHaveBeenCalledWith(['Ranma ½', 'Dark'], 'background');
  });

  it('aucun compte connecté : refusé sans recherche ; erreur AniList : message de l’API', async () => {
    fakes.connected = false;
    expect(await checkNetflixTitles({ titles: ['Ranma ½'] })).toEqual({ ok: false, code: 'NOT_CONNECTED', message: t('crImport.error.notConnected') });
    expect(fakes.search).not.toHaveBeenCalled();
    fakes.connected = true;
    fakes.search.mockRejectedValue(new ApiError('RATE_LIMITED', 'Trop de requêtes'));
    expect(await checkNetflixTitles({ titles: ['Ranma ½'] })).toEqual({ ok: false, code: 'API_ERROR', message: 'Trop de requêtes' });
  });
});
