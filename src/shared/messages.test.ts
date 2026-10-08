import { describe, expect, it } from 'vitest';
import { EXTENSION_PAGE_ONLY, isExtensionPageSender, isRuntimeMessage } from './messages';

describe('GET_AGENDA', () => {
  it('clé de semaine validée, réservé aux pages de l’extension', () => {
    expect(isRuntimeMessage({ type: 'GET_AGENDA', payload: { weekStart: '2026-10-05' } })).toBe(true);
    expect(isRuntimeMessage({ type: 'GET_AGENDA', payload: { weekStart: '2026-10-32' } })).toBe(false);
    expect(isRuntimeMessage({ type: 'GET_AGENDA', payload: null })).toBe(false);
    expect(EXTENSION_PAGE_ONLY.has('GET_AGENDA')).toBe(true);
  });
});

describe('SET_LIST_STATUS', () => {
  const valid = { mediaId: 21, malId: 21, status: 'DROPPED', coverUrl: 'https://s4.anilist.co/cover.jpg' };
  const message = (payload: unknown): unknown => ({ type: 'SET_LIST_STATUS', payload });

  it('accepte un payload valide (fiche MAL seule possible)', () => {
    expect(isRuntimeMessage(message(valid))).toBe(true);
    expect(isRuntimeMessage(message({ mediaId: null, malId: 5, status: 'PAUSED', coverUrl: null }))).toBe(true);
    expect(isRuntimeMessage(message({ ...valid, status: 'COMPLETED' }))).toBe(true);
  });

  it('refuse un statut non proposé par le popup', () => {
    for (const status of ['CURRENT', 'PLANNING', 'REPEATING', 'completed', null]) {
      expect(isRuntimeMessage(message({ ...valid, status }))).toBe(false);
    }
  });

  it('refuse des identifiants absents ou invalides', () => {
    expect(isRuntimeMessage(message({ ...valid, mediaId: null, malId: null }))).toBe(false);
    expect(isRuntimeMessage(message({ ...valid, mediaId: 0 }))).toBe(false);
    expect(isRuntimeMessage(message({ ...valid, malId: 1.5 }))).toBe(false);
  });

  it('refuse une affiche non https', () => {
    expect(isRuntimeMessage(message({ ...valid, coverUrl: 'http://example.com/a.jpg' }))).toBe(false);
    expect(isRuntimeMessage(message({ ...valid, coverUrl: 'javascript:alert(1)' }))).toBe(false);
    expect(isRuntimeMessage(message({ mediaId: 21, malId: null, status: 'PAUSED' }))).toBe(false);
  });

  it('est réservé aux pages de l’extension', () => {
    expect(EXTENSION_PAGE_ONLY.has('SET_LIST_STATUS')).toBe(true);
  });
});

const seriesPage = {
  platform: 'crunchyroll',
  kind: 'series',
  seriesId: 'GRVN8MNQY',
  seriesSlug: 'black-clover',
  seriesTitle: 'Black Clover',
  seasonNumber: 1,
  seasonTitle: null,
  episode: null,
};

const episode = {
  platform: 'crunchyroll',
  episodeId: 'GE00376431JAJP',
  seriesId: 'GRMG8ZQZR',
  seriesSlug: 'one-piece',
  animeTitle: 'One Piece',
  seasonNumber: 24,
  seasonTitle: 'Elbaph',
  seasonEpisodeNumber: 25,
  displayedEpisodeNumber: 1180,
  episodeTitle: 'Titre',
  url: 'https://www.crunchyroll.com/fr/watch/GE00376431JAJP/titre',
};

describe('RESOLVE_PAGE_MEDIA', () => {
  const message = (payload: unknown): unknown => ({ type: 'RESOLVE_PAGE_MEDIA', payload });

  it('accepte une page de série ou d’épisode, avec ou sans saison choisie', () => {
    expect(isRuntimeMessage(message({ page: seriesPage, mediaId: null }))).toBe(true);
    expect(isRuntimeMessage(message({ page: seriesPage, mediaId: 97940 }))).toBe(true);
    const episodePage = { ...seriesPage, kind: 'episode', seriesId: 'GRMG8ZQZR', seriesTitle: 'One Piece', seasonNumber: 24, seasonTitle: 'Elbaph', episode };
    expect(isRuntimeMessage(message({ page: episodePage, mediaId: null }))).toBe(true);
  });

  it('refuse une page incohérente ou invalide', () => {
    expect(isRuntimeMessage(message({ page: { ...seriesPage, kind: 'episode' }, mediaId: null }))).toBe(false);
    expect(isRuntimeMessage(message({ page: { ...seriesPage, episode }, mediaId: null }))).toBe(false);
    expect(isRuntimeMessage(message({ page: { ...seriesPage, platform: 'netflix' }, mediaId: null }))).toBe(false);
    expect(isRuntimeMessage(message({ page: { ...seriesPage, seriesTitle: '' }, mediaId: null }))).toBe(false);
    expect(isRuntimeMessage(message({ page: { ...seriesPage, seriesTitle: 'x'.repeat(301) }, mediaId: null }))).toBe(false);
    expect(isRuntimeMessage(message({ page: { ...seriesPage, seasonNumber: 1.5 }, mediaId: null }))).toBe(false);
    expect(isRuntimeMessage(message({ page: seriesPage, mediaId: 0 }))).toBe(false);
    expect(isRuntimeMessage(message({ page: seriesPage }))).toBe(false);
  });

  it('est réservé aux pages de l’extension', () => {
    expect(EXTENSION_PAGE_ONLY.has('RESOLVE_PAGE_MEDIA')).toBe(true);
  });
});

describe('ADD_TO_LIST', () => {
  const message = (payload: unknown): unknown => ({ type: 'ADD_TO_LIST', payload });

  it('accepte À regarder / En cours', () => {
    expect(isRuntimeMessage(message({ mediaId: 21, malId: 21, status: 'PLANNING' }))).toBe(true);
    expect(isRuntimeMessage(message({ mediaId: 21, malId: null, status: 'CURRENT' }))).toBe(true);
  });

  it('refuse les autres statuts et une fiche AniList absente', () => {
    for (const status of ['COMPLETED', 'DROPPED', 'PAUSED', 'REPEATING', 'planning', null]) {
      expect(isRuntimeMessage(message({ mediaId: 21, malId: 21, status }))).toBe(false);
    }
    expect(isRuntimeMessage(message({ mediaId: null, malId: 21, status: 'PLANNING' }))).toBe(false);
    expect(isRuntimeMessage(message({ mediaId: 21, malId: -1, status: 'PLANNING' }))).toBe(false);
  });

  it('est réservé aux pages de l’extension', () => {
    expect(EXTENSION_PAGE_ONLY.has('ADD_TO_LIST')).toBe(true);
  });
});

describe('COMPARE_LISTS / APPLY_DIFFS', () => {
  it('payloads validés et réservés aux pages de l’extension', () => {
    expect(isRuntimeMessage({ type: 'COMPARE_LISTS', payload: null })).toBe(true);
    expect(isRuntimeMessage({ type: 'COMPARE_LISTS', payload: {} })).toBe(false);
    expect(isRuntimeMessage({ type: 'APPLY_DIFFS', payload: { items: [{ mediaId: 1, malId: 2 }], source: 'anilist' } })).toBe(true);
    expect(isRuntimeMessage({ type: 'APPLY_DIFFS', payload: { items: [{ mediaId: 1, malId: 2 }] } })).toBe(false);
    expect(EXTENSION_PAGE_ONLY.has('COMPARE_LISTS')).toBe(true);
    expect(EXTENSION_PAGE_ONLY.has('APPLY_DIFFS')).toBe(true);
  });
});

describe('GET_PANEL_MEDIA', () => {
  const message = (payload: unknown): unknown => ({ type: 'GET_PANEL_MEDIA', payload });

  it('accepte un identifiant AniList positif', () => {
    expect(isRuntimeMessage(message({ mediaId: 146065 }))).toBe(true);
  });

  it('refuse un identifiant absent ou invalide', () => {
    for (const payload of [null, {}, { mediaId: 0 }, { mediaId: -3 }, { mediaId: 1.5 }, { mediaId: '21' }]) {
      expect(isRuntimeMessage(message(payload))).toBe(false);
    }
  });

  it('est réservé aux pages de l’extension', () => {
    expect(EXTENSION_PAGE_ONLY.has('GET_PANEL_MEDIA')).toBe(true);
  });
});

describe('import Crunchyroll', () => {
  const history = { seasons: [], stats: { items: 0, pages: 1, partial: false } };

  it('payloads validés, réservés aux pages de l’extension', () => {
    expect(isRuntimeMessage({ type: 'CR_IMPORT_ANALYZE', payload: { history } })).toBe(true);
    expect(isRuntimeMessage({ type: 'CR_IMPORT_ANALYZE', payload: { history: { seasons: 'x', stats: history.stats } } })).toBe(false);
    expect(isRuntimeMessage({ type: 'CR_IMPORT_APPLY', payload: { ids: ['m:21'] } })).toBe(true);
    expect(isRuntimeMessage({ type: 'CR_IMPORT_APPLY', payload: { ids: [21] } })).toBe(false);
    expect(isRuntimeMessage({ type: 'CR_IMPORT_CANCEL', payload: null })).toBe(true);
    expect(isRuntimeMessage({ type: 'CR_IMPORT_REVIEWS', payload: { keys: ['crunchyroll:GR:s1'] } })).toBe(true);
    for (const type of ['CR_IMPORT_ANALYZE', 'CR_IMPORT_APPLY', 'CR_IMPORT_CANCEL', 'CR_IMPORT_REVIEWS'] as const) expect(EXTENSION_PAGE_ONLY.has(type)).toBe(true);
  });
});

describe('isExtensionPageSender', () => {
  const origin = 'chrome-extension://khokcmigioggannjoojambdgioigdceb/';

  it('accepte les pages de l’extension, même ouvertes dans un onglet (page d’import)', () => {
    expect(isExtensionPageSender({ url: `${origin}src/import-cr/import-cr.html` }, origin)).toBe(true);
    expect(isExtensionPageSender({ url: `${origin}src/popup/popup.html` }, origin)).toBe(true);
    expect(isExtensionPageSender({ url: 'moz-extension://abc/src/sidepanel/sidepanel.html' }, 'moz-extension://abc/')).toBe(true);
  });

  it('refuse les content scripts (URL de la page web) et un expéditeur sans URL', () => {
    expect(isExtensionPageSender({ url: 'https://www.crunchyroll.com/watch/X' }, origin)).toBe(false);
    expect(isExtensionPageSender({ url: 'chrome-extension://autre-extension/page.html' }, origin)).toBe(false);
    expect(isExtensionPageSender({}, origin)).toBe(false);
  });
});
