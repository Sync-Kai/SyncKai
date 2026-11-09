// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setLocale } from '../../i18n';
import type { PageMediaView } from '../../shared/page-media.types';
import type { PanelMedia } from '../../shared/panel-media.types';
import { NowPlayingHero } from './now-playing-hero';

// Puces de genres de l'en-tête : libellé traduit pour un genre AniList connu, nom AniList tel quel sinon

let container: HTMLElement;
const view = { media: { mediaId: 1, idMal: null, title: 'T1', siteUrl: 'https://anilist.co/anime/1', episodes: 12, coverUrl: null, nextEpisode: null }, lists: [], confidence: 'certain', source: 'cache', seasons: [], episodeProgress: null } as unknown as PageMediaView;
const details = (genres: string[]): PanelMedia => ({ mediaId: 1, idMal: null, siteUrl: 'https://anilist.co/anime/1', title: 'T1', romajiTitle: null, englishTitle: null, bannerUrl: null, coverUrl: null, coverColor: null, description: null, genres, averageScore: null, season: null, seasonYear: null, format: null, episodes: 12, airingStatus: null, nextEpisode: null, studio: null, relations: [] });

async function show(genres: string[]): Promise<string[]> {
  await act(() => render(<NowPlayingHero view={view} details={details(genres)} entry={null} refreshing={false} busy={false} now={0} onRefresh={() => undefined} />, container));
  return [...container.querySelectorAll('ul li')].map((li) => li.textContent ?? '');
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
});
afterEach(() => {
  render(null, container);
  container.remove();
  setLocale('en');
});

describe('NowPlayingHero › genres', () => {
  it('« Slice of Life » est traduit en français', async () => {
    setLocale('fr');
    expect(await show(['Slice of Life'])).toEqual(['Tranche de vie']);
  });

  it('un genre inconnu garde le nom AniList', async () => {
    setLocale('fr');
    expect(await show(['Slice of Life', 'Zorglub'])).toEqual(['Tranche de vie', 'Zorglub']);
  });
});
