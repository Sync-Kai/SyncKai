import { describe, expect, it, vi } from 'vitest';
import {
  decodeDisneyHandshake,
  decodeDisneyPortOffer,
  decodeDisneyPush,
  disneyBridgeFlag,
  DISNEY_BRIDGE_VERSION,
  DISNEY_PORT_OFFER,
  encodeDisneyHandshake,
  encodeDisneyPortOffer,
  encodeDisneyPush,
  installDisneyBridgeOnce,
  isDisneyPlayerExperience,
} from './bridge-protocol';
import {
  DISNEY_MAX_ENTRIES,
  DISNEY_MAX_IDS,
  DISNEY_MAX_TEXT,
  hasDisneyId,
  infoBlockEntityIds,
  observedRequest,
  playerExperienceRequestId,
  reduceDisneyPlayback,
  reduceDisneyPlayerExperience,
  withDisneyPlayback,
  type DisneyPlayerExperience,
} from '../../platforms/disney/metadata';
import {
  nonAnimeEpisode,
  PLAYBACK_URL,
  playerExperienceUrl,
  SEEN_AT,
  SYNDUALITY_S1E1_AVAIL_ID,
  SYNDUALITY_S1E1_FFEC_MS,
  SYNDUALITY_S1E1_MEDIA_ID,
  SYNDUALITY_S1E1_PLAY_ID,
  syndualityPlayback,
  syndualityS1E1,
  UNDEAD_UNLUCK_S1E1_AVAIL_ID,
  UNDEAD_UNLUCK_S1E1_INFO_BLOCK,
  UNDEAD_UNLUCK_S1E1_PLAY_ID,
  undeadUnluckS1E1,
  WINTER_ARC_E1_AVAIL_ID,
  winterArcE1,
} from './fixtures';

const V = DISNEY_BRIDGE_VERSION;

describe('playerExperienceRequestId (requêtes observées)', () => {
  it('requête playerExperience de l’API du site → identifiant du chemin en minuscules', () => {
    expect(playerExperienceRequestId(playerExperienceUrl(UNDEAD_UNLUCK_S1E1_AVAIL_ID))).toBe(UNDEAD_UNLUCK_S1E1_AVAIL_ID);
    expect(playerExperienceRequestId(playerExperienceUrl(UNDEAD_UNLUCK_S1E1_PLAY_ID.toUpperCase(), '3'))).toBe(UNDEAD_UNLUCK_S1E1_PLAY_ID);
    expect(playerExperienceRequestId(`https://disney.api.edge.bamgrid.com/explore/v1/playerExperience/${WINTER_ARC_E1_AVAIL_ID}?x=1`)).toBe(WINTER_ARC_E1_AVAIL_ID);
    // URL relative (résolue sur la page)
    expect(playerExperienceRequestId(`/explore/v1.21/playerExperience/${WINTER_ARC_E1_AVAIL_ID}`, 'https://www.disneyplus.com/fr-fr/play/x')).toBe(WINTER_ARC_E1_AVAIL_ID);
  });

  it.each([
    'https://disney.api.edge.bamgrid.com/explore/v1.21/upNext?availId=0580a81e-2408-48e8-a6e0-14da8ca0e87f',
    'https://disney.playback.edge.bamgrid.com/v7/playback/ctr-regular',
    `https://evil.example/explore/v1.21/playerExperience/${WINTER_ARC_E1_AVAIL_ID}`,
    `https://bamgrid.com.evil.example/explore/v1.21/playerExperience/${WINTER_ARC_E1_AVAIL_ID}`,
    `http://disney.api.edge.bamgrid.com/explore/v1.21/playerExperience/${WINTER_ARC_E1_AVAIL_ID}`,
    'https://disney.api.edge.bamgrid.com/explore/v1.21/playerExperience/not-a-uuid',
    'pas une url :',
  ])('autre requête ignorée : %s', (url) => {
    expect(playerExperienceRequestId(url, 'invalid base')).toBeNull();
  });
});

describe('infoBlockEntityIds', () => {
  it('bloc réel (S1E1) : l’épisode de l’URL /play/{id}, pas l’identifiant d’événement', () => {
    expect(infoBlockEntityIds(UNDEAD_UNLUCK_S1E1_INFO_BLOCK)).toEqual([UNDEAD_UNLUCK_S1E1_PLAY_ID]);
  });

  it('bloc absent, trop long, illisible ou sans entité : aucun identifiant', () => {
    expect(infoBlockEntityIds(undefined)).toEqual([]);
    expect(infoBlockEntityIds('')).toEqual([]);
    expect(infoBlockEntityIds('!!pas du base64!!')).toEqual([]);
    expect(infoBlockEntityIds(btoa('aucune entité ici'))).toEqual([]);
    expect(infoBlockEntityIds('A'.repeat(20_000))).toEqual([]);
    expect(infoBlockEntityIds(btoa(`\u0001urn:ds:cmp:eva:movie/${WINTER_ARC_E1_AVAIL_ID.toUpperCase()}\u0002`))).toEqual([WINTER_ARC_E1_AVAIL_ID]);
  });
});

describe('reduceDisneyPlayerExperience', () => {
  it('identifiants de la requête, de la réponse et de l’épisode ; aucun autre champ (images, flux, infoBlock brut)', () => {
    const reduced = reduceDisneyPlayerExperience(undeadUnluckS1E1(), UNDEAD_UNLUCK_S1E1_PLAY_ID, SEEN_AT);
    expect(reduced).toEqual({
      ids: [UNDEAD_UNLUCK_S1E1_PLAY_ID, UNDEAD_UNLUCK_S1E1_AVAIL_ID],
      seenAt: SEEN_AT,
      title: 'Undead Unluck',
      subtitle: 'S1:E1 Undead et Unluck',
      internalTitle: 'Undead Unluck - s1e1 - mediaId:1986b4d2-f9b8-4382-8059-e067b887c911',
      originalLanguage: 'ja',
      runtimeMs: 1460000,
      programType: 'episode',
      editorial: null,
    });
    expect(JSON.stringify(reduced)).not.toMatch(/playback|ripcut|ratings|EiJ1/);
    expect(isDisneyPlayerExperience(reduced)).toBe(true);
    // Requête par availId : l'épisode (infoBlock) est tout de même connu
    expect(reduceDisneyPlayerExperience(undeadUnluckS1E1(), UNDEAD_UNLUCK_S1E1_AVAIL_ID, SEEN_AT)?.ids).toEqual([UNDEAD_UNLUCK_S1E1_AVAIL_ID, UNDEAD_UNLUCK_S1E1_PLAY_ID]);
    expect(isDisneyPlayerExperience(reduceDisneyPlayerExperience(winterArcE1(), WINTER_ARC_E1_AVAIL_ID, SEEN_AT))).toBe(true);
    expect(isDisneyPlayerExperience(reduceDisneyPlayerExperience(nonAnimeEpisode(), '11111111-2222-4333-8444-555555555555', SEEN_AT))).toBe(true);
  });

  it('availId de la réponse différent de la requête : gardé, la fiche n’est pas rejetée', () => {
    expect(reduceDisneyPlayerExperience(winterArcE1(), UNDEAD_UNLUCK_S1E1_PLAY_ID, SEEN_AT)?.ids).toEqual([UNDEAD_UNLUCK_S1E1_PLAY_ID, WINTER_ARC_E1_AVAIL_ID]);
  });

  it('forme inattendue ou identifiant de requête invalide : écartée', () => {
    expect(reduceDisneyPlayerExperience(null, UNDEAD_UNLUCK_S1E1_AVAIL_ID, SEEN_AT)).toBeNull();
    expect(reduceDisneyPlayerExperience({ data: {} }, UNDEAD_UNLUCK_S1E1_AVAIL_ID, SEEN_AT)).toBeNull();
    expect(reduceDisneyPlayerExperience({ data: { playerExperience: { availId: UNDEAD_UNLUCK_S1E1_AVAIL_ID } } }, UNDEAD_UNLUCK_S1E1_AVAIL_ID, SEEN_AT)).toBeNull();
    expect(reduceDisneyPlayerExperience(undeadUnluckS1E1(), 'x', SEEN_AT)).toBeNull();
    expect(reduceDisneyPlayerExperience(undeadUnluckS1E1(), UNDEAD_UNLUCK_S1E1_AVAIL_ID, Number.NaN)).toBeNull();
  });

  it('champs facultatifs invalides : null, textes nettoyés et tronqués', () => {
    const raw = {
      data: {
        playerExperience: {
          availId: 'pas-un-uuid',
          title: `  ${'x'.repeat(DISNEY_MAX_TEXT + 50)}  `,
          subtitle: 42,
          internalTitle: '   ',
          originalLanguage: 'ja; DROP',
          timeline: { runtimeMs: -5 },
          analytics: { programType: '<script>' },
          infoBlock: 42,
        },
      },
    };
    expect(reduceDisneyPlayerExperience(raw, UNDEAD_UNLUCK_S1E1_AVAIL_ID, SEEN_AT)).toEqual({
      ids: [UNDEAD_UNLUCK_S1E1_AVAIL_ID],
      seenAt: SEEN_AT,
      title: 'x'.repeat(DISNEY_MAX_TEXT),
      subtitle: null,
      internalTitle: null,
      originalLanguage: null,
      runtimeMs: null,
      programType: null,
      editorial: null,
    });
  });

  it('hasDisneyId : n’importe lequel des identifiants, casse ignorée', () => {
    const entry = reduceDisneyPlayerExperience(undeadUnluckS1E1(), UNDEAD_UNLUCK_S1E1_AVAIL_ID, SEEN_AT);
    if (!entry) throw new Error('fixture');
    expect(hasDisneyId(entry, UNDEAD_UNLUCK_S1E1_PLAY_ID.toUpperCase())).toBe(true);
    expect(hasDisneyId(entry, UNDEAD_UNLUCK_S1E1_AVAIL_ID)).toBe(true);
    expect(hasDisneyId(entry, WINTER_ARC_E1_AVAIL_ID)).toBe(false);
  });
});

describe('réponse de lecture (générique de fin)', () => {
  it('requête de lecture : hôte bamgrid.com et chemin …/playback/…, version et scénario variables', () => {
    expect(observedRequest(PLAYBACK_URL)).toEqual({ kind: 'playback', id: '' });
    expect(observedRequest('https://disney.playback.edge.bamgrid.com/v12/playback/tv-drm-ctr?x=1')).toEqual({ kind: 'playback', id: '' });
    expect(observedRequest('https://www.disneyplus.com/playback/ctr-regular')).toBeNull();
    expect(observedRequest('https://disney.playback.edge.bamgrid.com.evil.example/v7/playback/ctr-regular')).toBeNull();
    expect(observedRequest('http://disney.playback.edge.bamgrid.com/v7/playback/ctr-regular')).toBeNull();
    expect(observedRequest('https://disney.playback.edge.bamgrid.com/widevine/v1/obtain-license')).toBeNull();
    expect(playerExperienceRequestId(PLAYBACK_URL)).toBeNull();
  });

  it('réduite aux identifiants (availId, entityId de l’URL, mediaId) et aux repères FFEC / up_next', () => {
    expect(reduceDisneyPlayback(syndualityPlayback())).toEqual({
      ids: [SYNDUALITY_S1E1_AVAIL_ID, SYNDUALITY_S1E1_PLAY_ID, SYNDUALITY_S1E1_MEDIA_ID],
      creditsStartMs: SYNDUALITY_S1E1_FFEC_MS,
      upNextMs: 1434808,
    });
  });

  it('URL de flux et jetons de droits présents dans la réponse : jamais gardés', () => {
    const raw = syndualityPlayback();
    const stream = raw.stream as Record<string, unknown>;
    const rights = stream.playbackRights as Record<string, unknown>;
    const withSecrets = {
      ...raw,
      stream: {
        ...stream,
        sources: [{ complete: { url: 'https://vod.example.invalid/master.m3u8?sig=FAKE-SIGNATURE' } }],
        insertion: { ...(stream.insertion as Record<string, unknown>), base: 'https://vod.example.invalid/base?sig=FAKE-SIGNATURE' },
        playbackRights: { ...rights, playbackRightsContext: 'eyJGAKE.FAKE-TOKEN.FAKE' },
      },
      url: 'https://vod.example.invalid/top?sig=FAKE-SIGNATURE',
    };
    const reduced = reduceDisneyPlayback(withSecrets);
    expect(reduced?.creditsStartMs).toBe(SYNDUALITY_S1E1_FFEC_MS);
    expect(JSON.stringify(reduced)).not.toMatch(/https?:|FAKE|sig=|eyJ|alid|12ab9363|SGAI|INT-0/);
    expect(Object.keys(reduced ?? {}).sort()).toEqual(['creditsStartMs', 'ids', 'upNextMs']);
  });

  it('sans FFEC ni up_next, repères invalides : null ; sans stream ou sans identifiant valide : écartée', () => {
    const base = syndualityPlayback();
    const stream = base.stream as Record<string, unknown>;
    expect(reduceDisneyPlayback({ ...base, stream: { ...stream, editorial: [{ label: 'LFEC', offsetMillis: 1441023 }] } })).toMatchObject({ creditsStartMs: null, upNextMs: null });
    expect(reduceDisneyPlayback({ ...base, stream: { ...stream, editorial: [{ label: 'FFEC', offsetMillis: -5 }, { label: 'up_next', offsetMillis: '1434808' }] } })).toMatchObject({
      creditsStartMs: null,
      upNextMs: null,
    });
    expect(reduceDisneyPlayback({ ...base, stream: { ...stream, editorial: undefined } })).toMatchObject({ creditsStartMs: null });
    expect(reduceDisneyPlayback({ tracking: base.tracking })).toBeNull();
    expect(reduceDisneyPlayback({ stream: { editorial: stream.editorial } })).toBeNull();
    expect(reduceDisneyPlayback(null)).toBeNull();
  });

  it('jointe à la fiche de la même vidéo (availId commun, ou mediaId du titre interne) ; autre vidéo : fiche inchangée', () => {
    const playback = reduceDisneyPlayback(syndualityPlayback());
    const entry = reduceDisneyPlayerExperience(syndualityS1E1(), SYNDUALITY_S1E1_AVAIL_ID, SEEN_AT);
    if (!playback || !entry) throw new Error('fixture');
    const joined = withDisneyPlayback(entry, [playback]);
    expect(joined.editorial).toEqual({ creditsStartMs: SYNDUALITY_S1E1_FFEC_MS, upNextMs: 1434808 });
    expect(joined.ids).toEqual(entry.ids);
    expect(isDisneyPlayerExperience(joined)).toBe(true);
    // mediaId seul en commun (fiche demandée par un autre identifiant, sans availId lisible)
    const byMedia = { ...entry, ids: ['00000000-0000-4000-8000-000000000001'] };
    expect(withDisneyPlayback(byMedia, [{ ...playback, ids: [SYNDUALITY_S1E1_MEDIA_ID] }]).editorial?.creditsStartMs).toBe(SYNDUALITY_S1E1_FFEC_MS);
    const other = reduceDisneyPlayerExperience(undeadUnluckS1E1(), UNDEAD_UNLUCK_S1E1_AVAIL_ID, SEEN_AT);
    if (!other) throw new Error('fixture');
    expect(withDisneyPlayback(other, [playback])).toBe(other);
    // Plusieurs réponses de la même vidéo : la plus récente
    const later = { ...playback, creditsStartMs: 1_400_000 };
    expect(withDisneyPlayback(entry, [playback, later]).editorial?.creditsStartMs).toBe(1_400_000);
  });
});

const ENTRY: DisneyPlayerExperience = {
  ids: [UNDEAD_UNLUCK_S1E1_PLAY_ID, UNDEAD_UNLUCK_S1E1_AVAIL_ID],
  seenAt: SEEN_AT,
  title: 'Undead Unluck',
  subtitle: null,
  internalTitle: null,
  originalLanguage: 'ja',
  runtimeMs: 1460000,
  programType: 'episode',
  editorial: null,
};

describe('isDisneyPlayerExperience (revalidation côté isolé)', () => {
  it('repères éditoriaux valides (ou inconnus) : acceptés', () => {
    expect(isDisneyPlayerExperience({ ...ENTRY, editorial: { creditsStartMs: 1429803, upNextMs: null } })).toBe(true);
    expect(isDisneyPlayerExperience({ ...ENTRY, editorial: { creditsStartMs: null, upNextMs: null } })).toBe(true);
  });

  it.each<[string, Record<string, unknown>]>([
    ['identifiant en majuscules', { ids: [UNDEAD_UNLUCK_S1E1_AVAIL_ID.toUpperCase()] }],
    ['identifiant invalide', { ids: ['x'] }],
    ['aucun identifiant', { ids: [] }],
    ['identifiants en double', { ids: [UNDEAD_UNLUCK_S1E1_AVAIL_ID, UNDEAD_UNLUCK_S1E1_AVAIL_ID] }],
    ['trop d’identifiants', { ids: Array.from({ length: DISNEY_MAX_IDS + 1 }, (_, i) => `0000000${i}-0000-4000-8000-000000000000`) }],
    ['date invalide', { seenAt: -1 }],
    ['titre vide', { title: '' }],
    ['texte trop long', { subtitle: 'x'.repeat(DISNEY_MAX_TEXT + 1) }],
    ['langue invalide', { originalLanguage: 'japanese!' }],
    ['durée négative', { runtimeMs: -1 }],
    ['durée non entière', { runtimeMs: 1.5 }],
    ['type invalide', { programType: 'Episode' }],
    ['repères absents', { editorial: undefined }],
    ['repères invalides', { editorial: { creditsStartMs: -1, upNextMs: null } }],
    ['repère non entier', { editorial: { creditsStartMs: 1.5, upNextMs: null } }],
    ['repère manquant', { editorial: { creditsStartMs: 1000 } }],
  ])('%s : refusée', (_label, patch) => {
    expect(isDisneyPlayerExperience({ ...ENTRY, ...patch })).toBe(false);
  });
});

describe('messages du canal (chaînes JSON)', () => {
  it('demande d’ouverture et offre de port : aller-retour, version et forme vérifiées', () => {
    expect(decodeDisneyHandshake(encodeDisneyHandshake({ v: V, nonce: 'n1' }))).toEqual({ v: V, nonce: 'n1' });
    expect(decodeDisneyHandshake(JSON.stringify({ v: 1, nonce: 'n1' }))).toBeNull();
    expect(decodeDisneyHandshake({ v: V, nonce: 'n1' })).toBeNull();
    const offer = encodeDisneyPortOffer({ v: V, type: DISNEY_PORT_OFFER, nonce: 'n1' });
    expect(decodeDisneyPortOffer(offer)).toEqual({ v: V, type: DISNEY_PORT_OFFER, nonce: 'n1' });
    expect(decodeDisneyPortOffer('{"type":"autre"}')).toBeNull();
    expect(decodeDisneyPortOffer(JSON.stringify({ v: V, type: 'synckai:netflix:port', nonce: 'n1' }))).toBeNull();
  });

  it('fiches poussées : chaque fiche revalidée, une fiche invalide est écartée seule', () => {
    const push = encodeDisneyPush({ v: V, entries: [ENTRY] });
    expect(decodeDisneyPush(push)).toEqual({ v: V, entries: [ENTRY] });
    expect(decodeDisneyPush(JSON.stringify({ v: V, entries: [ENTRY, { ...ENTRY, ids: ['forged'] }] }))).toEqual({ v: V, entries: [ENTRY] });
    expect(decodeDisneyPush(JSON.stringify({ v: V, entries: Array.from({ length: DISNEY_MAX_ENTRIES + 1 }, () => ENTRY) }))).toBeNull();
    // Pont v1 resté dans la page après une mise à jour : ignoré
    expect(decodeDisneyPush(JSON.stringify({ v: 1, entries: [ENTRY] }))).toBeNull();
    expect(decodeDisneyPush('pas du json')).toBeNull();
  });
});

describe('installDisneyBridgeOnce', () => {
  it('installe une fois par version de protocole', () => {
    const global = {};
    const install = vi.fn();
    expect(installDisneyBridgeOnce(global, 1, install)).toBe(true);
    expect(installDisneyBridgeOnce(global, 1, install)).toBe(false);
    expect(installDisneyBridgeOnce(global, 2, install)).toBe(true);
    expect(install).toHaveBeenCalledTimes(2);
    expect(disneyBridgeFlag(1)).not.toBe(disneyBridgeFlag(2));
    // Clé distincte de celle du pont Netflix
    expect(disneyBridgeFlag(1)).not.toBe(Symbol.for('synckai.netflix.bridge'));
  });
});
