import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pageMediaFromEpisode } from './page-media';
import { installFakeChrome } from '../test/fake-chrome';
import type { EpisodeInfo } from './episode.types';
import type { PageMediaView } from './page-media.types';
import {
  isCachedPageMedia,
  matchCachedPageMedia,
  PAGE_MEDIA_CACHE_TTL_MS,
  pageMediaCacheKey,
  shouldReplaceCachedPageMedia,
  storeCachedPageMedia,
  toCachedPageMedia,
} from './page-media-cache';
import { STORAGE_KEYS } from './storage-keys';
import { PANEL_MEDIA_CACHE_TTL_MS, panelMediaCacheKey, purgeStaleSessionCaches } from './session-cache';

const fake = installFakeChrome();
const { clearAniListSession, clearMalSession, clearUserSyncData } = await import('./storage');

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

describe('caches de session : purge et déconnexion (DATA-04, PERF-05, SEC-03)', () => {
  const FAR = Number.MAX_SAFE_INTEGER;
  const entry = (resolvedAt: number): unknown => toCachedPageMedia(completePage, SCHOOL, 'resolve', resolvedAt);
  const panel = (at: number): unknown => ({ at, value: { mediaId: 1 } });
  const sessionKeys = (): string[] => [...fake.session.data.keys()].sort();

  beforeEach(() => {
    fake.reset();
    vi.useFakeTimers({ toFake: ['Date'] });
  });
  afterEach(() => vi.useRealTimers());

  it('écriture d’une fiche : purge des pageMedia:* et panelMedia:* expirés, illisibles ou d’un format précédent', async () => {
    vi.setSystemTime(NOW);
    fake.session.seed({
      'pageMedia:1': entry(NOW - 60_000),
      'pageMedia:2': entry(NOW - PAGE_MEDIA_CACHE_TTL_MS - 1),
      'pageMedia:3': 'illisible',
      [panelMediaCacheKey(10)]: panel(NOW - 3_600_000),
      [panelMediaCacheKey(11)]: panel(NOW - PANEL_MEDIA_CACHE_TTL_MS - 1),
      'panelMedia:v1:12': panel(NOW),
      ignoredSeries: { 'netflix:1': NOW },
    });
    await storeCachedPageMedia(4, completePage, SCHOOL, 'resolve');
    expect(sessionKeys()).toEqual(['ignoredSeries', 'pageMedia:1', 'pageMedia:4', panelMediaCacheKey(10)].sort());
  });

  it('au plus une purge par intervalle (une par réveil du service worker)', async () => {
    const later = NOW + 3_600_000;
    expect(await purgeStaleSessionCaches(later)).toBe(0);
    fake.session.seed({ 'pageMedia:5': entry(later - PAGE_MEDIA_CACHE_TTL_MS - 1) });
    expect(await purgeStaleSessionCaches(later + 60_000)).toBe(0);
    expect(await purgeStaleSessionCaches(later + PAGE_MEDIA_CACHE_TTL_MS)).toBe(1);
    expect(sessionKeys()).toEqual([]);
  });

  it.each([
    ['clearAniListSession', clearAniListSession],
    ['clearMalSession', clearMalSession],
    ['clearUserSyncData', clearUserSyncData],
  ])('%s : fiches de page (états des listes) et du panneau effacées, séries Netflix ignorées gardées', async (_name, clear) => {
    fake.reset({ [STORAGE_KEYS.anilistToken]: { accessToken: 'a', expiresAt: FAR }, [STORAGE_KEYS.malToken]: { accessToken: 'm', refreshToken: 'r', expiresAt: FAR } });
    fake.session.seed({ 'pageMedia:1': entry(Date.now()), [panelMediaCacheKey(10)]: panel(Date.now()), ignoredSeries: {} });
    await clear();
    expect(sessionKeys()).toEqual(['ignoredSeries']);
  });
});
