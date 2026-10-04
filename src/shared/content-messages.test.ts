import { describe, expect, it } from 'vitest';
import { isContentMessage, isPageMediaResponse } from './content-messages';

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
