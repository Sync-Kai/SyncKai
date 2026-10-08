import { describe, expect, it } from 'vitest';
import { pageMediaFromEpisode } from '../content/lib/page-media';
import type { EpisodeInfo } from './episode.types';
import type { PageMediaView } from './page-media.types';
import {
  isCachedPageMedia,
  matchCachedPageMedia,
  PAGE_MEDIA_CACHE_TTL_MS,
  pageMediaCacheKey,
  shouldReplaceCachedPageMedia,
  toCachedPageMedia,
} from './page-media-cache';

// Régression : Black Butler -Public School Arc- E1. Le panneau lisait la page avant son JSON-LD (repli DOM sans
// saison) et devinait « Kuroshitsuji » (2008) ; la synchro et le popup retenaient « Kishuku Gakkou-hen » (2024).
const complete: EpisodeInfo = {
  platform: 'crunchyroll',
  episodeId: 'GJWU2W1N5',
  seriesId: 'GRDKJZ81Y',
  seriesSlug: 'black-butler',
  animeTitle: 'Black Butler',
  seasonNumber: 5,
  seasonTitle: 'Black Butler -Public School Arc-',
  seasonEpisodeNumber: 1,
  displayedEpisodeNumber: 1,
  episodeTitle: 'His Butler, at School',
  url: 'https://www.crunchyroll.com/watch/GJWU2W1N5/his-butler-at-school',
};
const completePage = pageMediaFromEpisode(complete);
const partialPage = pageMediaFromEpisode({ ...complete, seasonNumber: null, seasonTitle: null, seasonEpisodeNumber: null });

const view = (mediaId: number, title: string): PageMediaView =>
  ({ media: { mediaId, title }, lists: [], confidence: 'certain', source: 'page', seasons: [], episodeProgress: 1 }) as unknown as PageMediaView;
const SCHOOL = view(170_000, 'Kuroshitsuji: Kishuku Gakkou-hen');
const GUESS = view(4_898, 'Kuroshitsuji');
const NOW = 1_800_000_000_000;

describe('cache de la fiche par onglet', () => {
  it('clé de stockage par onglet', () => {
    expect(pageMediaCacheKey(42)).toBe('pageMedia:42');
  });

  it('la fiche complète (synchro) sert aussi une lecture partielle du même épisode', () => {
    const synced = toCachedPageMedia(completePage, SCHOOL, 'sync', NOW);
    expect(matchCachedPageMedia(synced, completePage, NOW)?.view).toBe(SCHOOL);
    expect(matchCachedPageMedia(synced, partialPage, NOW)?.view).toBe(SCHOOL);
  });

  it('une fiche devinée sur une lecture partielle ne sert pas la page complète', () => {
    const guessed = toCachedPageMedia(partialPage, GUESS, 'resolve', NOW);
    expect(guessed.partial).toBe(true);
    expect(matchCachedPageMedia(guessed, completePage, NOW)).toBeNull();
    expect(matchCachedPageMedia(guessed, partialPage, NOW)?.view).toBe(GUESS);
  });

  it('autre épisode ou fiche expirée : ignorée', () => {
    const synced = toCachedPageMedia(completePage, SCHOOL, 'sync', NOW);
    expect(matchCachedPageMedia(synced, pageMediaFromEpisode({ ...complete, episodeId: 'GOTHER' }), NOW)).toBeNull();
    expect(matchCachedPageMedia(synced, completePage, NOW + PAGE_MEDIA_CACHE_TTL_MS + 1)).toBeNull();
    expect(matchCachedPageMedia(null, completePage, NOW)).toBeNull();
  });

  it('une lecture partielle n’écrase jamais la fiche complète du même épisode', () => {
    const synced = toCachedPageMedia(completePage, SCHOOL, 'sync', NOW);
    expect(shouldReplaceCachedPageMedia(synced, toCachedPageMedia(partialPage, GUESS, 'resolve', NOW + 1))).toBe(false);
    // Complète sur partielle, complète sur complète, autre épisode, cache vide : remplacée
    expect(shouldReplaceCachedPageMedia(toCachedPageMedia(partialPage, GUESS, 'resolve', NOW), synced)).toBe(true);
    expect(shouldReplaceCachedPageMedia(synced, toCachedPageMedia(completePage, SCHOOL, 'resolve', NOW + 1))).toBe(true);
    const other = pageMediaFromEpisode({ ...complete, episodeId: 'GOTHER', seasonNumber: null, seasonTitle: null, seasonEpisodeNumber: null });
    expect(shouldReplaceCachedPageMedia(synced, toCachedPageMedia(other, GUESS, 'resolve', NOW + 1))).toBe(true);
    expect(shouldReplaceCachedPageMedia(null, toCachedPageMedia(partialPage, GUESS, 'resolve', NOW))).toBe(true);
  });

  it('valide une entrée relue du stockage', () => {
    expect(isCachedPageMedia(toCachedPageMedia(completePage, SCHOOL, 'sync', NOW))).toBe(true);
    expect(isCachedPageMedia({ ...toCachedPageMedia(completePage, SCHOOL, 'sync', NOW), source: 'popup' })).toBe(false);
    expect(isCachedPageMedia({ pageKey: 'x' })).toBe(false);
    expect(isCachedPageMedia(null)).toBe(false);
  });
});
