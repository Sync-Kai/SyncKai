import { describe, expect, it } from 'vitest';
import type { MessageType } from '../protocol/messages';
import { layerFiles, reachableFrom, SOURCES } from '../test/import-graph';
import { isAllowedOrigin, isExtensionPageSender, isRuntimeMessage, MESSAGE_ORIGINS } from './message-guards';

describe('GET_AGENDA', () => {
  it('clé de semaine validée, réservé aux pages de l’extension', () => {
    expect(isRuntimeMessage({ type: 'GET_AGENDA', payload: { weekStart: '2026-10-05' } })).toBe(true);
    expect(isRuntimeMessage({ type: 'GET_AGENDA', payload: { weekStart: '2026-10-32' } })).toBe(false);
    expect(isRuntimeMessage({ type: 'GET_AGENDA', payload: null })).toBe(false);
    expect(MESSAGE_ORIGINS['GET_AGENDA']).toBe('extension');
  });
});

describe('GET_WATCHING', () => {
  it('`force` facultatif et booléen (PERF-04)', () => {
    expect(isRuntimeMessage({ type: 'GET_WATCHING', payload: { service: 'mal' } })).toBe(true);
    expect(isRuntimeMessage({ type: 'GET_WATCHING', payload: { service: 'anilist', force: true } })).toBe(true);
    expect(isRuntimeMessage({ type: 'GET_WATCHING', payload: { service: 'anilist', force: 'oui' } })).toBe(false);
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
    expect(MESSAGE_ORIGINS['SET_LIST_STATUS']).toBe('extension');
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
    expect(isRuntimeMessage(message({ page: { ...seriesPage, platform: 'hidive' }, mediaId: null }))).toBe(false);
    expect(isRuntimeMessage(message({ page: { ...seriesPage, seriesTitle: '' }, mediaId: null }))).toBe(false);
    expect(isRuntimeMessage(message({ page: { ...seriesPage, seriesTitle: 'x'.repeat(301) }, mediaId: null }))).toBe(false);
    expect(isRuntimeMessage(message({ page: { ...seriesPage, seasonNumber: 1.5 }, mediaId: null }))).toBe(false);
    expect(isRuntimeMessage(message({ page: seriesPage, mediaId: 0 }))).toBe(false);
    expect(isRuntimeMessage(message({ page: seriesPage }))).toBe(false);
  });

  it('est réservé aux pages de l’extension', () => {
    expect(MESSAGE_ORIGINS['RESOLVE_PAGE_MEDIA']).toBe('extension');
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
    expect(MESSAGE_ORIGINS['ADD_TO_LIST']).toBe('extension');
  });
});

describe('COMPARE_LISTS / APPLY_DIFFS', () => {
  it('payloads validés et réservés aux pages de l’extension', () => {
    expect(isRuntimeMessage({ type: 'COMPARE_LISTS', payload: null })).toBe(true);
    expect(isRuntimeMessage({ type: 'COMPARE_LISTS', payload: {} })).toBe(false);
    expect(isRuntimeMessage({ type: 'APPLY_DIFFS', payload: { items: [{ mediaId: 1, malId: 2 }], source: 'anilist' } })).toBe(true);
    expect(isRuntimeMessage({ type: 'APPLY_DIFFS', payload: { items: [{ mediaId: 1, malId: 2 }] } })).toBe(false);
    expect(MESSAGE_ORIGINS['COMPARE_LISTS']).toBe('extension');
    expect(MESSAGE_ORIGINS['APPLY_DIFFS']).toBe('extension');
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
    expect(MESSAGE_ORIGINS['GET_PANEL_MEDIA']).toBe('extension');
  });
});

describe('import Crunchyroll', () => {
  const history = { seasons: [], stats: { items: 0, pages: 1, partial: false } };

  it('payloads validés, réservés aux pages de l’extension', () => {
    expect(isRuntimeMessage({ type: 'CR_IMPORT_ANALYZE', payload: { history } })).toBe(true);
    expect(isRuntimeMessage({ type: 'CR_IMPORT_ANALYZE', payload: { history: { seasons: 'x', stats: history.stats } } })).toBe(false);
    // Import ADN : même message, plateforme précisée (absente : Crunchyroll)
    expect(isRuntimeMessage({ type: 'CR_IMPORT_ANALYZE', payload: { history, platform: 'adn' } })).toBe(true);
    // Import Netflix : même message (platformSeasons des saisons revalidé), titres filtrés par NETFLIX_IMPORT_TITLES
    expect(isRuntimeMessage({ type: 'CR_IMPORT_ANALYZE', payload: { history, platform: 'netflix' } })).toBe(true);
    expect(isRuntimeMessage({ type: 'CR_IMPORT_ANALYZE', payload: { history, platform: 'disney' } })).toBe(false);
    expect(isRuntimeMessage({ type: 'NETFLIX_IMPORT_TITLES', payload: { titles: ['Ranma ½', 'One Piece'] } })).toBe(true);
    expect(isRuntimeMessage({ type: 'NETFLIX_IMPORT_TITLES', payload: { titles: [] } })).toBe(false);
    expect(isRuntimeMessage({ type: 'NETFLIX_IMPORT_TITLES', payload: { titles: Array.from({ length: 11 }, (_, i) => `T${i}`) } })).toBe(false);
    expect(isRuntimeMessage({ type: 'NETFLIX_IMPORT_TITLES', payload: { titles: ['  '] } })).toBe(false);
    expect(isRuntimeMessage({ type: 'CR_IMPORT_APPLY', payload: { ids: ['m:21'] } })).toBe(true);
    expect(isRuntimeMessage({ type: 'CR_IMPORT_APPLY', payload: { ids: [21] } })).toBe(false);
    expect(isRuntimeMessage({ type: 'CR_IMPORT_CANCEL', payload: null })).toBe(true);
    expect(isRuntimeMessage({ type: 'CR_IMPORT_REVIEWS', payload: { keys: ['crunchyroll:GR:s1'] } })).toBe(true);
    for (const type of ['CR_IMPORT_ANALYZE', 'CR_IMPORT_APPLY', 'CR_IMPORT_CANCEL', 'CR_IMPORT_REVIEWS', 'NETFLIX_IMPORT_TITLES'] as const) expect(MESSAGE_ORIGINS[type]).toBe('extension');
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

describe('DEFER_RATING', () => {
  const message = (coverUrl: unknown): unknown => ({ type: 'DEFER_RATING', payload: { media: { mediaId: 21, malId: null, title: 'One Piece' }, coverUrl } });

  it('affiche d’un hôte d’images autorisé ou null (SEC-02)', () => {
    expect(isRuntimeMessage(message(null))).toBe(true);
    expect(isRuntimeMessage(message('https://s4.anilist.co/file/x.jpg'))).toBe(true);
    expect(isRuntimeMessage(message('https://tracker.example/p?id=victime'))).toBe(false);
    expect(isRuntimeMessage(message('http://s4.anilist.co/file/x.jpg'))).toBe(false);
  });
});

describe('REMOVE_FROM_LIST / GET_LIST_NOTES / SET_LIST_NOTES', () => {
  const media = { mediaId: 21, malId: null, title: 'One Piece' };

  it('fiche validée (AniList ou MAL seule), jamais sans identifiant', () => {
    expect(isRuntimeMessage({ type: 'REMOVE_FROM_LIST', payload: { media } })).toBe(true);
    expect(isRuntimeMessage({ type: 'REMOVE_FROM_LIST', payload: { media: { mediaId: null, malId: 20, title: 'Naruto' } } })).toBe(true);
    expect(isRuntimeMessage({ type: 'REMOVE_FROM_LIST', payload: { media: { mediaId: null, malId: null, title: 'X' } } })).toBe(false);
    expect(isRuntimeMessage({ type: 'REMOVE_FROM_LIST', payload: null })).toBe(false);
    expect(isRuntimeMessage({ type: 'GET_LIST_NOTES', payload: { media } })).toBe(true);
    expect(isRuntimeMessage({ type: 'GET_LIST_NOTES', payload: { media: { mediaId: -1, malId: null, title: 'X' } } })).toBe(false);
  });

  it('commentaire : chaîne de 6000 caractères au plus, vide accepté (effacement)', () => {
    const notes = (value: unknown): unknown => ({ type: 'SET_LIST_NOTES', payload: { media, notes: value } });
    expect(isRuntimeMessage(notes(''))).toBe(true);
    expect(isRuntimeMessage(notes('À revoir'))).toBe(true);
    expect(isRuntimeMessage(notes('x'.repeat(6000)))).toBe(true);
    expect(isRuntimeMessage(notes('x'.repeat(6001)))).toBe(false);
    expect(isRuntimeMessage(notes(null))).toBe(false);
    expect(isRuntimeMessage(notes(42))).toBe(false);
  });

  it('réservés aux pages de l’extension (popup, panneau) : jamais depuis une page tierce', () => {
    for (const type of ['REMOVE_FROM_LIST', 'GET_LIST_NOTES', 'SET_LIST_NOTES'] as const) {
      expect(isAllowedOrigin(type, 'extension')).toBe(true);
      expect(isAllowedOrigin(type, 'content')).toBe(false);
    }
  });
});

describe('expéditeurs autorisés (MESSAGE_ORIGINS, ARCH-07)', () => {
  /** Appels `sendMessage('TYPE', …)` ou `callWorker('TYPE', …)` (type littéral) ; ni les déclarations, ni `chrome.runtime.sendMessage` */
  const SEND_RE = /(?<!function |\.)\b(?:sendMessage|callWorker)(?:<[^>]*>)?\(\s*'([A-Z_]+)'/g;
  const CALL_RE = /(?<!function |\.)\b(?:sendMessage|callWorker)(?:<[^>]*>)?\(/g;
  const sentTypes = (files: Iterable<string>): Set<string> =>
    new Set([...files].flatMap((file) => [...(SOURCES.get(file) ?? '').matchAll(SEND_RE)].map((match) => match[1] ?? '')));
  const typesWith = (origins: readonly string[]): string[] =>
    Object.entries(MESSAGE_ORIGINS)
      .filter(([, origin]) => origins.includes(origin))
      .map(([type]) => type)
      .sort();

  /** Code des scripts de contenu : src/content et tout ce qu'il importe (kit d'interface, shared…) */
  const contentCode = reachableFrom(layerFiles('content'));
  /** Code des pages de l'extension */
  const pageCode = reachableFrom(['popup', 'sidepanel', 'import', 'import-cr'].flatMap(layerFiles));

  it('exhaustif : chaque type de message a une origine', () => {
    const types = Object.keys(MESSAGE_ORIGINS);
    expect(types.length).toBeGreaterThan(25);
    for (const type of types) expect(['content', 'extension', 'both'], type).toContain(MESSAGE_ORIGINS[type as MessageType]);
  });

  it('les types ouverts aux scripts de contenu sont exactement ceux qu’envoie src/content', () => {
    // Appels avec un type littéral seulement : sinon la lecture statique ne verrait pas le message
    const calls = [...contentCode].reduce((total, file) => total + [...(SOURCES.get(file) ?? '').matchAll(CALL_RE)].length, 0);
    const literal = [...contentCode].reduce((total, file) => total + [...(SOURCES.get(file) ?? '').matchAll(SEND_RE)].length, 0);
    expect(literal).toBe(calls);
    expect([...sentTypes(contentCode)].sort()).toEqual(typesWith(['content', 'both']));
    expect([...contentCode].some((file) => /chrome\.runtime\.sendMessage\(/.test(SOURCES.get(file) ?? '') && file.startsWith('content/'))).toBe(false);
  });

  it('les pages de l’extension n’envoient que des types qui leur sont ouverts ; « both » envoyé des deux côtés', () => {
    const sent = sentTypes(pageCode);
    expect([...sent].filter((type) => !isAllowedOrigin(type as MessageType, 'extension'))).toEqual([]);
    for (const type of typesWith(['both'])) expect(sent, type).toContain(type);
  });

  it('isAllowedOrigin : refus croisés', () => {
    expect(isAllowedOrigin('EPISODE_COMPLETED', 'content')).toBe(true);
    expect(isAllowedOrigin('EPISODE_COMPLETED', 'extension')).toBe(false);
    expect(isAllowedOrigin('GET_VIEWER', 'content')).toBe(false);
    expect(isAllowedOrigin('GET_MAL_VIEWER', 'content')).toBe(false);
    expect(isAllowedOrigin('LOGIN_ANILIST', 'content')).toBe(false);
    expect(isAllowedOrigin('RATE_MEDIA', 'content')).toBe(true);
    expect(isAllowedOrigin('RATE_MEDIA', 'extension')).toBe(true);
  });
});

describe('Disney+ (EPISODE_COMPLETED, RESOLVE_PAGE_MEDIA)', () => {
  /** Épisode tel que le produit l'adapter Disney+ : aucun identifiant de série, arc en saison 99 */
  const disneyEpisode = {
    platform: 'disney',
    episodeId: '0580a81e-2408-48e8-a6e0-14da8ca0e87f',
    seriesId: null,
    seriesSlug: null,
    animeTitle: 'Undead Unluck',
    seasonNumber: 99,
    seasonTitle: 'Undead Unluck: Winter Arc',
    seasonEpisodeNumber: 1,
    displayedEpisodeNumber: 1,
    episodeTitle: 'Undead Unluck: Winter Arc',
    url: 'https://www.disneyplus.com/play/0580a81e-2408-48e8-a6e0-14da8ca0e87f',
  };

  it('épisode Disney+ accepté depuis un script de contenu', () => {
    expect(isRuntimeMessage({ type: 'EPISODE_COMPLETED', payload: { episode: disneyEpisode, services: null } })).toBe(true);
    expect(isAllowedOrigin('EPISODE_COMPLETED', 'content')).toBe(true);
  });

  it('fiche de la page d’un épisode Disney+ acceptée depuis les pages de l’extension', () => {
    const page = { platform: 'disney', kind: 'episode', seriesId: null, seriesSlug: null, seriesTitle: 'Undead Unluck', seasonNumber: 99, seasonTitle: 'Undead Unluck: Winter Arc', episode: disneyEpisode };
    expect(isRuntimeMessage({ type: 'RESOLVE_PAGE_MEDIA', payload: { page, mediaId: null } })).toBe(true);
    expect(isRuntimeMessage({ type: 'RESOLVE_PAGE_MEDIA', payload: { page: { ...page, platform: 'netflix' }, mediaId: null } })).toBe(false);
  });
});

describe('isRuntimeMessage, branches négatives', () => {
  const media = { mediaId: 21, malId: null, title: 'One Piece' };
  const accepts = (type: string, payload: unknown): boolean => isRuntimeMessage({ type, payload });

  it('enveloppe invalide : non-objet, type absent ou non textuel, type inconnu', () => {
    for (const value of [null, undefined, 'GET_VIEWER', 42, [], {}, { type: 7, payload: null }, { type: 'NOPE', payload: null }]) expect(isRuntimeMessage(value), String(value)).toBe(false);
  });

  it('clés héritées de Object.prototype refusées comme types (pas de garde « trouvée » par le prototype)', () => {
    for (const type of ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf']) expect(accepts(type, null), type).toBe(false);
  });

  it('types sans payload : tout sauf null est refusé', () => {
    for (const type of ['LOGIN_ANILIST', 'GET_VIEWER', 'LOGIN_MAL', 'GET_MAL_VIEWER', 'CHECK_AIRING', 'COMPARE_LISTS', 'CANCEL_COMPARE_JOB', 'CR_IMPORT_CANCEL']) {
      expect(accepts(type, null), type).toBe(true);
      expect(accepts(type, undefined), `${type} undefined`).toBe(false);
      expect(accepts(type, {}), `${type} {}`).toBe(false);
    }
    expect(isRuntimeMessage({ type: 'GET_VIEWER' })).toBe(false);
  });

  it('SEARCH_ANIME : requête non vide (après trim) de 100 caractères au plus', () => {
    expect(accepts('SEARCH_ANIME', { query: 'Frieren' })).toBe(true);
    expect(accepts('SEARCH_ANIME', { query: 'a'.repeat(100) })).toBe(true);
    for (const query of ['', '   ', 'a'.repeat(101), 5, null]) expect(accepts('SEARCH_ANIME', { query }), String(query)).toBe(false);
    expect(accepts('SEARCH_ANIME', 'Frieren')).toBe(false);
  });

  it('GET_WATCHING / ADJUST_PROGRESS : service et deltas validés', () => {
    expect(accepts('GET_WATCHING', { service: 'mal' })).toBe(true);
    expect(accepts('GET_WATCHING', { service: 'kitsu' })).toBe(false);
    expect(accepts('GET_WATCHING', {})).toBe(false);
    const ok = { mediaId: 5, malId: null, delta: 1 };
    expect(accepts('ADJUST_PROGRESS', ok)).toBe(true);
    expect(accepts('ADJUST_PROGRESS', { mediaId: null, malId: 9, delta: -1 })).toBe(true);
    for (const bad of [{ ...ok, delta: 2 }, { ...ok, delta: 0 }, { ...ok, mediaId: null }, { ...ok, mediaId: 0 }, { ...ok, mediaId: 1.5 }, { ...ok, malId: -3 }, { delta: 1 }]) {
      expect(accepts('ADJUST_PROGRESS', bad), JSON.stringify(bad)).toBe(false);
    }
  });

  it('ADJUST_PROGRESS › retry : services non vides et distincts, progression entière de 0 à 100 000', () => {
    const base = { mediaId: 5, malId: null, delta: 1 as const };
    expect(accepts('ADJUST_PROGRESS', { ...base, retry: { services: ['mal'], progress: 0 } })).toBe(true);
    expect(accepts('ADJUST_PROGRESS', { ...base, retry: { services: ['anilist', 'mal'], progress: 100_000 } })).toBe(true);
    const bads: unknown[] = [
      { services: [], progress: 3 },
      { services: ['mal', 'mal'], progress: 3 },
      { services: ['kitsu'], progress: 3 },
      { services: ['mal'], progress: -1 },
      { services: ['mal'], progress: 100_001 },
      { services: ['mal'], progress: 2.5 },
      { services: ['mal'], progress: '3' },
      { services: 'mal', progress: 3 },
      null,
    ];
    for (const retry of bads) expect(accepts('ADJUST_PROGRESS', { ...base, retry }), JSON.stringify(retry)).toBe(false);
  });

  it('EPISODE_COMPLETED › services : null (tous) ou liste non vide de services connus', () => {
    const episode = {
      platform: 'crunchyroll',
      episodeId: 'EP1',
      seriesId: 'S',
      seriesSlug: 's',
      animeTitle: 'Série',
      seasonNumber: 1,
      seasonTitle: null,
      seasonEpisodeNumber: 1,
      displayedEpisodeNumber: 1,
      episodeTitle: null,
      url: 'https://www.crunchyroll.com/watch/EP1',
    };
    expect(accepts('EPISODE_COMPLETED', { episode, services: null })).toBe(true);
    expect(accepts('EPISODE_COMPLETED', { episode, services: ['anilist'] })).toBe(true);
    for (const services of [[], ['kitsu'], 'anilist', undefined]) expect(accepts('EPISODE_COMPLETED', { episode, services }), JSON.stringify(services)).toBe(false);
    expect(accepts('EPISODE_COMPLETED', { episode: { ...episode, episodeId: 7 }, services: null })).toBe(false);
    expect(accepts('EPISODE_COMPLETED', { services: null })).toBe(false);
  });

  it('clés des cartes (RESOLVE_REVIEW, REOPEN_REVIEW, RETRY_QUEUED) : chaîne de 1 à 200 caractères', () => {
    expect(accepts('RETRY_QUEUED', { id: 'crunchyroll:EP1' })).toBe(true);
    for (const id of ['', 'a'.repeat(201), 3, null]) expect(accepts('RETRY_QUEUED', { id }), String(id)).toBe(false);
    for (const key of ['', 'a'.repeat(201), undefined]) expect(accepts('REOPEN_REVIEW', { key }), String(key)).toBe(false);
    expect(accepts('RESOLVE_REVIEW', { key: 'k', mediaId: 5, progress: 3 })).toBe(true);
    for (const bad of [{ key: 'k', mediaId: 0, progress: 3 }, { key: 'k', mediaId: 5, progress: 0 }, { key: '', mediaId: 5, progress: 3 }, { mediaId: 5, progress: 3 }]) {
      expect(accepts('RESOLVE_REVIEW', bad), JSON.stringify(bad)).toBe(false);
    }
  });

  it('notes : demi-points de 0,5 à 10 seulement ; START_REWATCH : progression entière positive', () => {
    for (const score of [0.5, 7, 7.5, 10]) expect(accepts('RATE_MEDIA', { media, score }), String(score)).toBe(true);
    for (const score of [0, 10.5, 7.25, -1, '8', null]) expect(accepts('RATE_MEDIA', { media, score }), String(score)).toBe(false);
    expect(accepts('RATE_MEDIA', { media, score: 8, fromCard: 'oui' })).toBe(false);
    expect(accepts('RATE_MEDIA', { media: { ...media, mediaId: null }, score: 8 })).toBe(false);
    expect(accepts('RATE_MEDIA', { media: { ...media, title: 'x'.repeat(301) }, score: 8 })).toBe(false);
    expect(accepts('START_REWATCH', { media, progress: 12 })).toBe(true);
    for (const progress of [0, -1, 1.5, '12']) expect(accepts('START_REWATCH', { media, progress }), String(progress)).toBe(false);
  });

  it('GET_CONTENT_CATALOG : langue proposée seulement', () => {
    expect(accepts('GET_CONTENT_CATALOG', { locale: 'de' })).toBe(true);
    for (const locale of ['xx', '', 'EN', 3, undefined]) expect(accepts('GET_CONTENT_CATALOG', { locale }), String(locale)).toBe(false);
  });

  it('isExtensionPageSender : préfixe strict (une origine voisine ne passe pas)', () => {
    const origin = 'chrome-extension://abc/';
    expect(isExtensionPageSender({ url: 'chrome-extension://abcd/page.html' }, origin)).toBe(false);
    expect(isExtensionPageSender({ url: 'https://evil.test/chrome-extension://abc/' }, origin)).toBe(false);
  });
});
