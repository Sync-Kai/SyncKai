import { describe, expect, it } from 'vitest';
import {
  appendTraceEvents,
  boundTraceData,
  formatTraceArgs,
  graphqlOperation,
  isTraceEvent,
  isTraceInput,
  redactTraceText,
  restPathTemplate,
  summarizeOutcome,
  toTraceEvent,
  TRACE_ARRAY_MAX,
  TRACE_KEYS_MAX,
  TRACE_MAX,
  TRACE_MAX_VERBOSE,
  TRACE_STRING_MAX,
  traceCapacity,
  type TraceRecord,
} from './debug-trace';

// Trace de débogage (builds de dev) : bornes, filtre de confidentialité et anneau d'événements, purs.

const record = (type: string, at = 1_000, data: Record<string, unknown> = {}): TraceRecord => ({ at, source: 'sw', category: 'sync', type, data });

describe('boundTraceData : bornes', () => {
  it('tronque les chaînes longues et garde les scalaires', () => {
    const data = boundTraceData({ title: 'x'.repeat(500), progress: 12, completed: true, missing: null });
    expect(typeof data.title).toBe('string');
    expect((data.title as string).length).toBe(TRACE_STRING_MAX);
    expect((data.title as string).endsWith('…')).toBe(true);
    expect(data).toMatchObject({ progress: 12, completed: true, missing: null });
  });

  it('nombres non finis → null, undefined et fonctions retirés', () => {
    expect(boundTraceData({ a: Number.NaN, b: Number.POSITIVE_INFINITY, c: undefined, d: () => 1 })).toEqual({ a: null, b: null });
  });

  it('objets sur un niveau, tableaux de scalaires bornés, nombre de clés borné', () => {
    const data = boundTraceData({
      before: { progress: 3, status: 'CURRENT', deep: { x: 1 } },
      ids: Array.from({ length: 30 }, (_, i) => i),
      mixed: [1, 'a', { no: true }],
      ...Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`k${i}`, i])),
    });
    expect(data.before).toEqual({ progress: 3, status: 'CURRENT' });
    expect(data.ids).toHaveLength(TRACE_ARRAY_MAX);
    expect(data.mixed).toEqual([1, 'a']);
    expect(Object.keys(data).length).toBeLessThanOrEqual(TRACE_KEYS_MAX);
  });

  it('valeur non objet → données vides', () => {
    expect(boundTraceData('texte')).toEqual({});
    expect(boundTraceData(null)).toEqual({});
    expect(boundTraceData([1, 2])).toEqual({});
  });
});

describe('boundTraceData : confidentialité', () => {
  it('retire les jetons, en-têtes, cookies, identifiants de compte et URL', () => {
    const data = boundTraceData({
      accessToken: 'abc',
      refresh_token: 'def',
      Authorization: 'Bearer xyz',
      headers: { Authorization: 'Bearer xyz' },
      cookie: 'sid=1',
      'set-cookie': 'a=b',
      code_verifier: 'v',
      code: 'oauth-code',
      clientSecret: 's',
      password: 'p',
      userId: 42,
      viewerName: 'Quentin',
      accountId: 'acc',
      profileId: 'prof',
      email: 'me@example.com',
      url: 'https://cdn.example/stream.m3u8?sig=1',
      streamUrl: 'https://cdn.example/x',
      body: '{"query":"…"}',
      jwt: 'eyJ…',
      session: 'x',
      mediaId: 21,
      episodeId: 'GE001',
      status: 200,
    });
    expect(data).toEqual({ mediaId: 21, episodeId: 'GE001', status: 200 });
  });

  it('filtre aussi les clés des objets imbriqués', () => {
    expect(boundTraceData({ request: { op: 'SaveProgress', token: 't', headers: 'h' } })).toEqual({ request: { op: 'SaveProgress' } });
  });

  it('masque les jetons et les secrets dans les textes, réduit les URL à leur origine', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl';
    expect(redactTraceText(`Bearer ${jwt}`)).not.toContain('eyJ');
    expect(redactTraceText(`jeton ${jwt} refusé`)).toBe('jeton [REDACTED] refusé');
    expect(redactTraceText('Authorization: Bearer abcdef123456')).not.toContain('abcdef123456');
    expect(redactTraceText('https://x.chromiumapp.org/#access_token=secret123&token_type=Bearer')).toBe('https://x.chromiumapp.org/…');
    expect(redactTraceText('voir https://anilist.co/anime/21')).toBe('voir https://anilist.co/…');
    expect(redactTraceText('refresh_token=abc123&x=1')).toBe('refresh_token=[REDACTED]&x=1');
    // Chaîne opaque longue (jeton MAL, empreinte) : masquée ; identifiants courts gardés
    expect(redactTraceText('k 1846238e6ea67a5109899f5311a51d15c0ffee12')).toBe('k [REDACTED]');
    expect(redactTraceText('GE00376431JAJP')).toBe('GE00376431JAJP');
    // Identifiants d'épisode Disney+ / Prime Video (UUID) : gardés
    expect(redactTraceText('amzn1.dv.gti.539f8e74-1c2d-4e5f-8a9b-0c1d2e3f4a5b')).toBe('amzn1.dv.gti.539f8e74-1c2d-4e5f-8a9b-0c1d2e3f4a5b');
  });

  it('les chaînes des données passent par le masquage', () => {
    expect(boundTraceData({ reason: 'Bearer abcdefghijklmnop' }).reason).toBe('Bearer [REDACTED]');
  });
});

describe('formatTraceArgs : lignes du logger', () => {
  it('joint les arguments, décrit les erreurs, filtre les objets', () => {
    const text = formatTraceArgs(['Fiche', 21, new TypeError('boom'), { mediaId: 21, accessToken: 'secret', headers: { a: 1 } }]);
    expect(text).toBe('Fiche 21 TypeError: boom {"mediaId":21}');
  });

  it('masque un jeton passé en texte', () => {
    expect(formatTraceArgs(['token eyJabcdefgh.ijklmnop.qrstuv'])).toBe('token [REDACTED]');
  });
});

describe('isTraceInput : garde du message', () => {
  const valid = { at: 1, category: 'page', type: 'episode-identified', data: { title: 'One Piece' } };

  it('accepte un événement bien formé (contexte facultatif)', () => {
    expect(isTraceInput(valid)).toBe(true);
    expect(isTraceInput({ ...valid, tabId: 4, platform: 'crunchyroll', source: 'panel' })).toBe(true);
  });

  it('refuse catégorie, type, horodatage, plateforme ou source invalides', () => {
    expect(isTraceInput({ ...valid, category: 'other' })).toBe(false);
    expect(isTraceInput({ ...valid, type: '' })).toBe(false);
    expect(isTraceInput({ ...valid, type: 'x'.repeat(80) })).toBe(false);
    expect(isTraceInput({ ...valid, type: 'Avec Espace' })).toBe(false);
    expect(isTraceInput({ ...valid, at: Number.NaN })).toBe(false);
    expect(isTraceInput({ ...valid, platform: 'youtube' })).toBe(false);
    expect(isTraceInput({ ...valid, tabId: -1 })).toBe(false);
    expect(isTraceInput({ ...valid, source: 'sw' })).toBe(false);
    expect(isTraceInput({ ...valid, data: 'texte' })).toBe(false);
    expect(isTraceInput(null)).toBe(false);
  });
});

describe('appendTraceEvents : anneau', () => {
  it('ordre chronologique, seq croissant à partir du dernier enregistré', () => {
    const first = appendTraceEvents([], [record('a'), record('b')], TRACE_MAX);
    expect(first.map((e) => [e.type, e.seq])).toEqual([
      ['a', 1],
      ['b', 2],
    ]);
    const next = appendTraceEvents(first, [record('c')], TRACE_MAX);
    expect(next.map((e) => [e.type, e.seq])).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ]);
  });

  it('garde les `max` plus récents', () => {
    const many = Array.from({ length: TRACE_MAX + 25 }, (_, i) => record(`e${i}`, i));
    const events = appendTraceEvents([], many, TRACE_MAX);
    expect(events).toHaveLength(TRACE_MAX);
    expect(events[0]?.type).toBe('e25');
    expect(events.at(-1)?.seq).toBe(TRACE_MAX + 25);
  });

  it('ignore le contenu illisible du stockage', () => {
    expect(appendTraceEvents('n’importe quoi', [record('a')], TRACE_MAX).map((e) => e.seq)).toEqual([1]);
    expect(appendTraceEvents([{ bad: true }, toTraceEvent(record('x'), 7)], [record('a')], TRACE_MAX).map((e) => e.seq)).toEqual([7, 8]);
  });

  it('capacité : 300, 1000 en mode détaillé', () => {
    expect(traceCapacity(false)).toBe(TRACE_MAX);
    expect(traceCapacity(true)).toBe(TRACE_MAX_VERBOSE);
    expect(TRACE_MAX).toBe(300);
    expect(TRACE_MAX_VERBOSE).toBe(1000);
  });

  it('les événements produits sont valides et bornés', () => {
    const event = toTraceEvent({ at: 5, source: 'content', tabId: 3, platform: 'adn', category: 'page', type: 'video-found', data: { token: 'x', id: 'v' } }, 1);
    expect(event).toEqual({ at: 5, seq: 1, source: 'content', tabId: 3, platform: 'adn', category: 'page', type: 'video-found', data: { id: 'v' } });
    expect(isTraceEvent(event)).toBe(true);
  });
});

describe('noms d’opérations réseau', () => {
  it('GraphQL : nom de l’opération, « anonymous » sinon', () => {
    expect(graphqlOperation('query PageMedia($ids: [Int]) { Page { media { id } } }')).toBe('PageMedia');
    expect(graphqlOperation('\n  mutation SaveProgress($id: Int) { SaveMediaListEntry { id } }')).toBe('SaveProgress');
    expect(graphqlOperation('{ Viewer { id } }')).toBe('anonymous');
  });

  it('REST : chemin sans paramètres, nombres remplacés', () => {
    expect(restPathTemplate('/anime/52991/my_list_status')).toBe('/anime/{id}/my_list_status');
    expect(restPathTemplate('/users/@me/animelist?fields=list_status&limit=1000&offset=0')).toBe('/users/@me/animelist');
    expect(restPathTemplate('/users/@me?fields=picture')).toBe('/users/@me');
  });
});

describe('summarizeOutcome', () => {
  it('résume le résultat par service', () => {
    expect(
      summarizeOutcome({
        status: 'synced',
        mediaTitle: 'One Piece',
        results: [
          { service: 'anilist', outcome: { status: 'updated', progress: 1180, completed: false } },
          { service: 'mal', outcome: { status: 'error', message: 'HTTP 500', code: 'API_ERROR', httpStatus: 500 } },
        ],
        queued: true,
      }),
    ).toEqual({ status: 'synced', queued: true, anilist: 'updated 1180', mal: 'error API_ERROR 500' });
  });

  it('autres statuts : statut et code ou raison', () => {
    expect(summarizeOutcome({ status: 'needs-review', reason: 'Titre seul' })).toEqual({ status: 'needs-review', reason: 'Titre seul' });
    expect(summarizeOutcome({ status: 'error', message: 'x', code: 'NETWORK' })).toEqual({ status: 'error', code: 'NETWORK' });
    expect(summarizeOutcome({ status: 'ignored', noAccess: true })).toEqual({ status: 'ignored', noAccess: true });
  });
});
