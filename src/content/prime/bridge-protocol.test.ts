import { describe, expect, it } from 'vitest';
import {
  decodePrimeHandshake,
  decodePrimePortOffer,
  decodePrimePush,
  encodePrimeHandshake,
  encodePrimePortOffer,
  encodePrimePush,
  installPrimeBridgeOnce,
  isPrimeCatalogEntry,
  observedPrimeRequest,
  PRIME_BRIDGE_VERSION,
  PRIME_PORT_OFFER,
  reducePrimeCatalog,
  reducePrimePlayback,
  type PrimeBridgePush,
} from './bridge-protocol';
import {
  BUMPKIN_CREDITS_MS,
  BUMPKIN_DURATION_MS,
  BUMPKIN_S1_COMPACT,
  BUMPKIN_S1_GTI,
  BUMPKIN_TITLE,
  bumpkinCatalog,
  bumpkinEpisodeGti,
  bumpkinNextUp,
  bumpkinPlayback,
  catalogUrl,
  detailUrl,
  playbackUrl,
  playbackWithoutCredits,
  SEEN_AT,
  widgetsUrl,
} from './fixtures';

describe('observedPrimeRequest', () => {
  it('quatre requêtes lues, identifiant de la requête (forme canonique)', () => {
    expect(observedPrimeRequest(catalogUrl(bumpkinEpisodeGti(2)))).toEqual({ kind: 'catalog', id: bumpkinEpisodeGti(2) });
    expect(observedPrimeRequest(playbackUrl(bumpkinEpisodeGti(3)))).toEqual({ kind: 'playback', id: bumpkinEpisodeGti(3) });
    expect(observedPrimeRequest(detailUrl())).toEqual({ kind: 'detail', id: BUMPKIN_S1_COMPACT });
    expect(observedPrimeRequest(widgetsUrl())).toEqual({ kind: 'widgets', id: BUMPKIN_S1_GTI });
    // Chemin relatif (fetch du site) résolu sur la page
    expect(observedPrimeRequest(`/region/eu/detail/${BUMPKIN_S1_COMPACT}?dvWebAppClientVersion=1`, 'https://www.primevideo.com/region/eu/')).toEqual({
      kind: 'detail',
      id: BUMPKIN_S1_COMPACT,
    });
  });

  it('licences, sessions, statistiques, autres hôtes, identifiant absent : jamais lus', () => {
    for (const url of [
      'https://atv-ps-eu.primevideo.com/playback/drm-vod/GetWidevineLicense?titleId=x',
      'https://atv-ps-eu.primevideo.com/cdp/playback/pes/StartSession?titleId=x',
      'https://atv-ps-eu.primevideo.com/cdp/usage/UpdateStream',
      'https://atv-ps-eu.primevideo.com/cdp/insights/reportEvent',
      'https://atv-ps-eu.primevideo.com/cdp/lumina/playerChromeResources/v1?desiredResources=nextUpV3',
      'https://atv-ps-eu.primevideo.com/playback/prs/GetVodPlaybackResources?titleId=not-an-id',
      'https://www.primevideo.com/region/eu/api/getDetailWidgets',
      `https://www.primevideo.com/region/eu/detail/${BUMPKIN_S1_COMPACT}/extra/path`,
      `https://atv-ps.amazon.com/cdp/lumina/playerChromeResources/v1?entityId=${bumpkinEpisodeGti(1)}`,
      `https://evil.example/region/eu/detail/${BUMPKIN_S1_COMPACT}`,
      `http://www.primevideo.com/region/eu/detail/${BUMPKIN_S1_COMPACT}`,
      'not a url ://',
    ]) {
      expect(observedPrimeRequest(url)).toBeNull();
    }
  });
});

describe('reducePrimeCatalog', () => {
  it('catalogMetadataV2 seul : série sans mention de version, saison, épisode', () => {
    expect(reducePrimeCatalog(bumpkinCatalog(2), bumpkinEpisodeGti(2), SEEN_AT)).toEqual({
      id: bumpkinEpisodeGti(2),
      seenAt: SEEN_AT,
      type: 'episode',
      title: 'The Old Country Bumpkin is Astounded by a Wizard',
      seriesTitle: BUMPKIN_TITLE,
      seasonNumber: 1,
      episodeNumber: 2,
    });
    expect(reducePrimeCatalog(bumpkinCatalog(1, 'VINLAND SAGA (Simuldub)'), bumpkinEpisodeGti(1), SEEN_AT)?.seriesTitle).toBe('VINLAND SAGA');
  });

  it('nextUpV3 (épisode suivant) ou forme inconnue : null', () => {
    expect(reducePrimeCatalog(bumpkinNextUp(3), bumpkinEpisodeGti(2), SEEN_AT)).toBeNull();
    expect(reducePrimeCatalog({ resources: { catalogMetadataV2: { catalog: { type: 42 } } } }, bumpkinEpisodeGti(2), SEEN_AT)).toBeNull();
    expect(reducePrimeCatalog(bumpkinCatalog(2), 'nope', SEEN_AT)).toBeNull();
    expect(reducePrimeCatalog(null, bumpkinEpisodeGti(2), SEEN_AT)).toBeNull();
  });
});

describe('reducePrimePlayback', () => {
  it('END_CREDITS et durée seuls : rien des URL, sous-titres ni licences', () => {
    const entry = reducePrimePlayback(bumpkinPlayback(3), bumpkinEpisodeGti(3), SEEN_AT);
    expect(entry).toEqual({ id: bumpkinEpisodeGti(3), seenAt: SEEN_AT, creditsStartMs: BUMPKIN_CREDITS_MS[3], durationMs: BUMPKIN_DURATION_MS });
    expect(JSON.stringify(entry)).not.toMatch(/SECRET|http/);
  });

  it('sans END_CREDITS : durée seule (NEXT_UP et SKIP_INTRO ignorés) ; ni l’un ni l’autre : null', () => {
    expect(reducePrimePlayback(playbackWithoutCredits(), bumpkinEpisodeGti(2), SEEN_AT)).toEqual({ id: bumpkinEpisodeGti(2), seenAt: SEEN_AT, creditsStartMs: null, durationMs: 1_448_000 });
    expect(reducePrimePlayback({ transitionTimecodes: { result: { events: [{ eventType: 'NEXT_UP', startTimeMs: 1 }] } } }, bumpkinEpisodeGti(2), SEEN_AT)).toBeNull();
    expect(reducePrimePlayback('x', bumpkinEpisodeGti(2), SEEN_AT)).toBeNull();
  });
});

describe('messages', () => {
  const push: PrimeBridgePush = {
    v: PRIME_BRIDGE_VERSION,
    catalog: [{ id: bumpkinEpisodeGti(1), seenAt: SEEN_AT, type: 'episode', title: 'T', seriesTitle: BUMPKIN_TITLE, seasonNumber: 1, episodeNumber: 1 }],
    playback: [{ id: bumpkinEpisodeGti(1), seenAt: SEEN_AT, creditsStartMs: 1_311_000, durationMs: 1_440_000 }],
    titles: [],
    widgets: [],
  };

  it('aller-retour, entrée invalide écartée sans perdre le message', () => {
    expect(decodePrimePush(encodePrimePush(push))).toEqual(push);
    const tampered = JSON.stringify({ ...push, catalog: [...push.catalog, { id: '../x', seenAt: SEEN_AT, type: 'episode' }] });
    expect(decodePrimePush(tampered)?.catalog).toEqual(push.catalog);
    expect(isPrimeCatalogEntry({ ...push.catalog[0], seriesTitle: 'x'.repeat(301) })).toBe(false);
  });

  it('autre version, forme inattendue : null', () => {
    expect(decodePrimePush(JSON.stringify({ ...push, v: 99 }))).toBeNull();
    expect(decodePrimePush(JSON.stringify({ ...push, playback: 'x' }))).toBeNull();
    expect(decodePrimePush({ ...push })).toBeNull();
  });

  it('ouverture : nonce relayé, offres étrangères ignorées', () => {
    expect(decodePrimeHandshake(encodePrimeHandshake({ v: PRIME_BRIDGE_VERSION, nonce: 'n1' }))).toEqual({ v: PRIME_BRIDGE_VERSION, nonce: 'n1' });
    expect(decodePrimeHandshake(JSON.stringify({ v: 0, nonce: 'n1' }))).toBeNull();
    expect(decodePrimePortOffer(encodePrimePortOffer({ v: PRIME_BRIDGE_VERSION, type: PRIME_PORT_OFFER, nonce: 'n1' }))?.nonce).toBe('n1');
    expect(decodePrimePortOffer({ type: PRIME_PORT_OFFER })).toBeNull();
    expect(decodePrimePortOffer('synckai:disney:port')).toBeNull();
  });

  it('pont installé une fois par version', () => {
    const global = {};
    let installs = 0;
    expect(installPrimeBridgeOnce(global, 1, () => installs++)).toBe(true);
    expect(installPrimeBridgeOnce(global, 1, () => installs++)).toBe(false);
    expect(installPrimeBridgeOnce(global, 2, () => installs++)).toBe(true);
    expect(installs).toBe(2);
  });
});
