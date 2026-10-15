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
  readCachedPageMedia,
  shouldReplaceCachedPageMedia,
  storeCachedPageMedia,
  toCachedPageMedia,
} from './page-media-cache';
import { STORAGE_KEYS } from '../protocol/storage-keys';
import type { SessionEpochs } from './session-epochs';
import { PANEL_MEDIA_CACHE_TTL_MS, panelMediaCacheKey, purgeStaleSessionCaches } from './session-cache';

const fake = installFakeChrome();
const { clearAniListSession, clearMalSession, clearUserSyncData, getOpenSessions } = await import('./storage');

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
/** Sessions AniList et MAL ouvertes, jamais déconnectées (génération 0) */
const OPEN: SessionEpochs = { anilist: 0, mal: 0 };

describe('cache de la fiche par onglet', () => {
  it('clé de stockage par onglet', () => {
    expect(pageMediaCacheKey(42)).toBe('pageMedia:42');
  });

  it('la fiche complète (synchro) sert aussi une lecture partielle du même épisode', () => {
    const synced = toCachedPageMedia(completePage, SCHOOL, 'sync', NOW, OPEN);
    expect(matchCachedPageMedia(synced, completePage, NOW)?.view).toBe(SCHOOL);
    expect(matchCachedPageMedia(synced, partialPage, NOW)?.view).toBe(SCHOOL);
  });

  it('une fiche devinée sur une lecture partielle ne sert pas la page complète', () => {
    const guessed = toCachedPageMedia(partialPage, GUESS, 'resolve', NOW, OPEN);
    expect(guessed.partial).toBe(true);
    expect(matchCachedPageMedia(guessed, completePage, NOW)).toBeNull();
    expect(matchCachedPageMedia(guessed, partialPage, NOW)?.view).toBe(GUESS);
  });

  it('autre épisode ou fiche expirée : ignorée', () => {
    const synced = toCachedPageMedia(completePage, SCHOOL, 'sync', NOW, OPEN);
    expect(matchCachedPageMedia(synced, pageMediaFromEpisode({ ...complete, episodeId: 'GOTHER' }), NOW)).toBeNull();
    expect(matchCachedPageMedia(synced, completePage, NOW + PAGE_MEDIA_CACHE_TTL_MS + 1)).toBeNull();
    expect(matchCachedPageMedia(null, completePage, NOW)).toBeNull();
  });

  it('une lecture partielle n’écrase jamais la fiche complète du même épisode', () => {
    const synced = toCachedPageMedia(completePage, SCHOOL, 'sync', NOW, OPEN);
    expect(shouldReplaceCachedPageMedia(synced, toCachedPageMedia(partialPage, GUESS, 'resolve', NOW + 1, OPEN))).toBe(false);
    // Complète sur partielle, complète sur complète, autre épisode, cache vide : remplacée
    expect(shouldReplaceCachedPageMedia(toCachedPageMedia(partialPage, GUESS, 'resolve', NOW, OPEN), synced)).toBe(true);
    expect(shouldReplaceCachedPageMedia(synced, toCachedPageMedia(completePage, SCHOOL, 'resolve', NOW + 1, OPEN))).toBe(true);
    const other = pageMediaFromEpisode({ ...complete, episodeId: 'GOTHER', seasonNumber: null, seasonTitle: null, seasonEpisodeNumber: null });
    expect(shouldReplaceCachedPageMedia(synced, toCachedPageMedia(other, GUESS, 'resolve', NOW + 1, OPEN))).toBe(true);
    expect(shouldReplaceCachedPageMedia(null, toCachedPageMedia(partialPage, GUESS, 'resolve', NOW, OPEN))).toBe(true);
  });

  it('valide une entrée relue du stockage', () => {
    expect(isCachedPageMedia(toCachedPageMedia(completePage, SCHOOL, 'sync', NOW, OPEN))).toBe(true);
    expect(isCachedPageMedia({ ...toCachedPageMedia(completePage, SCHOOL, 'sync', NOW, OPEN), source: 'popup' })).toBe(false);
    expect(isCachedPageMedia({ pageKey: 'x' })).toBe(false);
    expect(isCachedPageMedia(null)).toBe(false);
  });
});

describe('caches de session : purge et déconnexion (DATA-04, PERF-05, SEC-03)', () => {
  const FAR = Number.MAX_SAFE_INTEGER;
  const entry = (resolvedAt: number): unknown => toCachedPageMedia(completePage, SCHOOL, 'resolve', resolvedAt, OPEN);
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
    await storeCachedPageMedia(4, completePage, SCHOOL, 'resolve', {});
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

describe('fiche de la page liée aux sessions (DATA-04, SEC-03)', () => {
  const FAR = Number.MAX_SAFE_INTEGER;
  const TOKENS = { [STORAGE_KEYS.anilistToken]: { accessToken: 'a', expiresAt: FAR }, [STORAGE_KEYS.malToken]: { accessToken: 'm', refreshToken: 'r', expiresAt: FAR } };
  const pageKeys = (): string[] => [...fake.session.data.keys()].filter((key) => key.startsWith('pageMedia:'));

  beforeEach(() => fake.reset(TOKENS));

  it('flux normal : fiche écrite sous les sessions relevées avant la résolution, puis relue', async () => {
    const epochs = await getOpenSessions();
    expect(epochs).toEqual(OPEN);
    const written = await storeCachedPageMedia(1, completePage, SCHOOL, 'resolve', epochs);
    expect(written?.epochs).toEqual(OPEN);
    expect((await readCachedPageMedia(1))?.view).toEqual(SCHOOL);
  });

  it('sans compte connecté : fiche écrite et relue (aucun état de liste)', async () => {
    fake.reset();
    expect(await storeCachedPageMedia(1, completePage, SCHOOL, 'resolve', await getOpenSessions())).not.toBeNull();
    expect(await readCachedPageMedia(1)).not.toBeNull();
  });

  it('déconnexion pendant une résolution en vol : rien n’est réécrit après l’effacement', async () => {
    const epochs = await getOpenSessions();
    fake.session.seed({ 'pageMedia:1': toCachedPageMedia(completePage, SCHOOL, 'resolve', Date.now(), epochs) });
    // La résolution (états des listes du compte) se termine après la déconnexion
    await clearAniListSession();
    expect(await storeCachedPageMedia(1, completePage, SCHOOL, 'resolve', epochs)).toBeNull();
    expect(pageKeys()).toEqual([]);
  });

  it('écriture demandée pendant la déconnexion (verrou détenu) : refusée une fois la déconnexion faite', async () => {
    const epochs = await getOpenSessions();
    const clearing = clearMalSession();
    const storing = storeCachedPageMedia(2, completePage, SCHOOL, 'resolve', epochs);
    await clearing;
    expect(await storing).toBeNull();
    expect(pageKeys()).toEqual([]);
  });

  it('connexion d’un compte pendant la résolution : fiche non écrite (état de sa liste absent)', async () => {
    fake.reset({ [STORAGE_KEYS.anilistToken]: TOKENS[STORAGE_KEYS.anilistToken] });
    const epochs = await getOpenSessions();
    await chrome.storage.local.set({ [STORAGE_KEYS.malToken]: TOKENS[STORAGE_KEYS.malToken] });
    expect(await storeCachedPageMedia(1, completePage, SCHOOL, 'resolve', epochs)).toBeNull();
    expect(pageKeys()).toEqual([]);
  });

  it.each<[string, SessionEpochs | undefined]>([
    ['une session précédente (AniList déconnecté puis reconnecté)', { anilist: 0, mal: 0 }],
    ['une session sans MAL (connecté depuis)', { anilist: 1 }],
    ['aucune session (avant la connexion des comptes)', {}],
    ['un format précédent, sans sessions', undefined],
  ])('fiche écrite sous %s : ignorée à la relecture', async (_name, epochs) => {
    // Sessions courantes : AniList reconnecté une fois (génération 1), MAL ouvert (génération 0)
    const current: SessionEpochs = { anilist: 1, mal: 0 };
    fake.reset({ ...TOKENS, [STORAGE_KEYS.sessionEpoch]: { anilist: 1 } });
    expect(await getOpenSessions()).toEqual(current);
    const { epochs: _omitted, ...legacy } = toCachedPageMedia(completePage, SCHOOL, 'resolve', Date.now(), current);
    fake.session.seed({ 'pageMedia:1': { ...legacy, epochs: current } });
    expect(await readCachedPageMedia(1)).not.toBeNull();
    fake.session.seed({ 'pageMedia:1': epochs === undefined ? legacy : { ...legacy, epochs } });
    expect(await readCachedPageMedia(1)).toBeNull();
  });
});
