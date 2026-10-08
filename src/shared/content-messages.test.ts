import { describe, expect, it } from 'vitest';
import { isContentMessage, isCrHistoryPortMessage, isCrHistoryRequest, isPageMediaResponse } from './content-messages';

describe('messages au content script', () => {
  it('reconnaît FORCE_COMPLETE et GET_PAGE_MEDIA uniquement', () => {
    expect(isContentMessage({ type: 'FORCE_COMPLETE' })).toBe(true);
    expect(isContentMessage({ type: 'GET_PAGE_MEDIA' })).toBe(true);
    expect(isContentMessage({ type: 'OTHER' })).toBe(false);
    expect(isContentMessage(null)).toBe(false);
  });

  it('valide la réponse de GET_PAGE_MEDIA', () => {
    expect(isPageMediaResponse(null)).toBe(true);
    expect(
      isPageMediaResponse({ platform: 'adn', kind: 'series', seriesId: '1311', seriesSlug: 'tougen-anki', seriesTitle: 'TOUGEN ANKI', seasonNumber: null, seasonTitle: null, episode: null }),
    ).toBe(true);
    expect(isPageMediaResponse(undefined)).toBe(false);
    expect(isPageMediaResponse({ platform: 'adn', kind: 'series' })).toBe(false);
  });
});

describe('port de lecture de l’historique Crunchyroll', () => {
  const season = {
    seriesId: 'GRMG8ZQZR',
    seriesTitle: 'One Piece',
    seriesSlug: 'one-piece',
    seasonId: 'GSOP24',
    seasonNumber: 24,
    seasonTitle: 'Elbaph',
    episodeId: 'GEOP1180',
    episodeTitle: null,
    episodeNumber: 1180,
    seasonEpisodeNumber: 25,
    watchedCount: 3,
    lastPlayedAt: 1,
  };

  it('seule la demande READ_CR_HISTORY est acceptée', () => {
    expect(isCrHistoryRequest({ type: 'READ_CR_HISTORY' })).toBe(true);
    expect(isCrHistoryRequest({ type: 'FORCE_COMPLETE' })).toBe(false);
    expect(isCrHistoryRequest(null)).toBe(false);
  });

  it('valide progression, résultat et erreur renvoyés par le script de contenu', () => {
    expect(isCrHistoryPortMessage({ type: 'progress', pages: 2, items: 200, lookups: 0, lookupsTotal: 0 })).toBe(true);
    expect(isCrHistoryPortMessage({ type: 'progress', pages: -1, items: 0, lookups: 0, lookupsTotal: 0 })).toBe(false);
    expect(isCrHistoryPortMessage({ type: 'done', result: { seasons: [season], stats: { items: 1, pages: 1, partial: false } } })).toBe(true);
    expect(isCrHistoryPortMessage({ type: 'done', result: { seasons: [{ ...season, seriesId: '<img>' }], stats: { items: 1, pages: 1, partial: false } } })).toBe(false);
    expect(isCrHistoryPortMessage({ type: 'done', result: { seasons: [{ ...season, seriesSlug: '<b>' }], stats: { items: 1, pages: 1, partial: false } } })).toBe(false);
    expect(isCrHistoryPortMessage({ type: 'done', result: { seasons: [{ ...season, episodeNumber: 0 }], stats: { items: 1, pages: 1, partial: false } } })).toBe(false);
    expect(isCrHistoryPortMessage({ type: 'error', code: 'logged-out' })).toBe(true);
    expect(isCrHistoryPortMessage({ type: 'error', code: 'teapot' })).toBe(false);
    expect(isCrHistoryPortMessage({ type: 'token', token: 'x' })).toBe(false);
  });
});
