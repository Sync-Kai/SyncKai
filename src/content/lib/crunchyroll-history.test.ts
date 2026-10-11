import { describe, expect, it } from 'vitest';
import {
  createCrClient,
  CR_WEB_CLIENT_ID,
  CrHistoryError,
  isWatched,
  MAX_HISTORY_PAGES,
  MAX_LOOKUP_FAILURES_IN_A_ROW,
  needsSeasonLookup,
  nextPagePath,
  pageLocale,
  parseHistoryItem,
  parseTokenResponse,
  readCrunchyrollHistory,
  readHistoryPages,
  reduceHistory,
  relativeEpisodeNumber,
  RETRY_DELAYS_MS,
  retryAfterMs,
  type FetchLike,
  type ReaderDeps,
} from './crunchyroll-history';

const ORIGIN = 'https://www.crunchyroll.com';

/** Élément d'historique au format vérifié le 2026-10-08 */
function item(over: {
  id?: string;
  series?: string;
  seriesTitle?: string;
  seriesSlug?: string;
  seasonId?: string;
  season?: number | null;
  seasonTitle?: string;
  episode?: number | null;
  fully?: boolean;
  playhead?: number;
  durationMs?: number;
  played?: string;
  parentType?: string;
}): Record<string, unknown> {
  return {
    parent_type: over.parentType ?? 'series',
    fully_watched: over.fully ?? true,
    playhead: over.playhead ?? 0,
    date_played: over.played ?? '2026-10-01T20:00:00Z',
    panel: {
      id: over.id ?? 'GEP1',
      title: 'Titre',
      episode_metadata: {
        series_id: over.series ?? 'GRS1',
        series_title: over.seriesTitle ?? 'Black Butler',
        series_slug_title: over.seriesSlug ?? 'black-butler',
        season_id: over.seasonId ?? 'GSE1',
        season_number: over.season === undefined ? 1 : over.season,
        season_title: over.seasonTitle ?? 'Black Butler',
        episode_number: over.episode === undefined ? 1 : over.episode,
        episode: String(over.episode ?? ''),
        sequence_number: over.episode ?? 0,
        duration_ms: over.durationMs ?? 1_440_000,
      },
    },
  };
}

describe('éléments d’historique', () => {
  it('lit la structure vérifiée (série, saison, numéro, position)', () => {
    expect(parseHistoryItem(item({ id: 'GX9', season: 4, episode: 4, fully: false, playhead: 6, seasonTitle: 'Slime (English Dub)' }))).toMatchObject({
      episodeId: 'GX9',
      seriesId: 'GRS1',
      seriesSlug: 'black-butler',
      seasonNumber: 4,
      seasonTitle: 'Slime',
      episodeNumber: 4,
      fullyWatched: false,
      playhead: 6,
      durationMs: 1_440_000,
    });
  });

  it('slug de la série (anciens liens AniList crunchyroll.com/{slug}) : normalisé, ignoré si douteux', () => {
    expect(parseHistoryItem(item({ seriesSlug: 'One-Piece' }))?.seriesSlug).toBe('one-piece');
    expect(parseHistoryItem(item({ seriesSlug: '../evil' }))?.seriesSlug).toBeNull();
    const noSlug = item({});
    const panel = noSlug.panel as { episode_metadata: Record<string, unknown> };
    delete panel.episode_metadata.series_slug_title;
    expect(parseHistoryItem(noSlug)?.seriesSlug).toBeNull();
  });

  it('films, éléments sans fiche et identifiants invalides ignorés ; spécial sans numéro conservé sans numéro', () => {
    expect(parseHistoryItem(item({ parentType: 'movie_listing' }))).toBeNull();
    expect(parseHistoryItem({ parent_type: 'series', panel: null })).toBeNull();
    expect(parseHistoryItem(item({ series: '../evil' }))).toBeNull();
    expect(parseHistoryItem(item({ episode: null }))?.episodeNumber).toBeNull();
    expect(parseHistoryItem(item({ episode: 12.5 }))?.episodeNumber).toBeNull();
  });

  it('vu : marqué terminé, ou position ≥ seuil réglé', () => {
    expect(isWatched({ fullyWatched: true, playhead: 0, durationMs: null }, 85)).toBe(true);
    expect(isWatched({ fullyWatched: false, playhead: 6, durationMs: 1_440_000 }, 85)).toBe(false);
    expect(isWatched({ fullyWatched: false, playhead: 1_224, durationMs: 1_440_000 }, 85)).toBe(true);
    expect(isWatched({ fullyWatched: false, playhead: 1_223, durationMs: 1_440_000 }, 85)).toBe(false);
    expect(isWatched({ fullyWatched: false, playhead: 9_999, durationMs: null }, 85)).toBe(false);
  });
});

describe('réduction par saison', () => {
  it('garde l’épisode vu le plus avancé de chaque saison, ignore les non terminés, films et spéciaux', () => {
    const { seasons, ignored } = reduceHistory(
      [
        item({ id: 'A3', episode: 3, played: '2026-10-03T00:00:00Z' }),
        item({ id: 'A5', episode: 5, played: '2026-10-01T00:00:00Z' }),
        item({ id: 'A6', episode: 6, fully: false, playhead: 10 }),
        item({ id: 'SP', episode: null }),
        item({ id: 'MV', parentType: 'movie_listing' }),
        // VF de la même saison (autre season_id) : même ligne
        item({ id: 'A4', episode: 4, seasonId: 'GSE1VF' }),
        item({ id: 'B1', series: 'GRS2', seriesTitle: 'Slime', season: 4, seasonId: 'GSE4', episode: 2, played: '2026-10-05T00:00:00Z' }),
      ],
      85,
    );
    expect(ignored).toBe(3);
    expect(seasons).toHaveLength(2);
    // Plus récent d'abord
    expect(seasons[0]).toMatchObject({ seriesId: 'GRS2', seasonNumber: 4, episodeNumber: 2, watchedCount: 1 });
    expect(seasons[1]).toMatchObject({ seriesId: 'GRS1', episodeId: 'A5', episodeNumber: 5, watchedCount: 3, seasonEpisodeNumber: null });
    expect(seasons[1]?.lastPlayedAt).toBe(Date.parse('2026-10-03T00:00:00Z'));
  });

  it('saison sans épisode vu : absente', () => {
    expect(reduceHistory([item({ fully: false, playhead: 1 })], 85).seasons).toEqual([]);
  });
});

describe('numérotation absolue', () => {
  it('lecture de la saison seulement si le numéro peut être absolu', () => {
    expect(needsSeasonLookup({ seasonNumber: 1, episodeNumber: 12 })).toBe(false);
    expect(needsSeasonLookup({ seasonNumber: null, episodeNumber: 24 })).toBe(false);
    expect(needsSeasonLookup({ seasonNumber: 2, episodeNumber: 3 })).toBe(true);
    expect(needsSeasonLookup({ seasonNumber: 1, episodeNumber: 1180 })).toBe(true);
  });

  it('position dans la saison = numéro − premier numéro de la saison + 1 (One Piece E1180 → 25)', () => {
    const onePiece = { data: [{ episode_number: null }, ...Array.from({ length: 30 }, (_, i) => ({ episode_number: 1156 + i }))] };
    expect(relativeEpisodeNumber(1180, onePiece)).toBe(25);
    expect(relativeEpisodeNumber(3, { data: [{ episode_number: 1 }, { episode_number: 2 }, { episode_number: 3 }] })).toBe(3);
    // Épisode absent de la liste ou réponse inattendue : inconnu
    expect(relativeEpisodeNumber(99, onePiece)).toBeNull();
    expect(relativeEpisodeNumber(1, { items: [] })).toBeNull();
  });

  it('spécial numéroté 1 dans une saison en numérotation absolue : ignoré (Kaiju No. 8 E23 → 11) ; trou court toléré', () => {
    const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => ({ episode_number: from + i }));
    expect(relativeEpisodeNumber(23, { data: [{ episode_number: 1 }, ...range(13, 23)] })).toBe(11);
    expect(relativeEpisodeNumber(88, { data: [...range(64, 88), { episode_number: 1 }] })).toBe(25);
    // Épisode 71 retiré du catalogue : la saison commence toujours à 64
    expect(relativeEpisodeNumber(88, { data: [...range(64, 70), ...range(72, 88)] })).toBe(25);
  });
});

describe('pagination par curseur', () => {
  it('suit uniquement les chemins de l’API de la même origine', () => {
    expect(nextPagePath({ next_page: '/content/v2/acc/watch-history?page=abc&page_size=100' }, ORIGIN)).toBe('/content/v2/acc/watch-history?page=abc&page_size=100');
    expect(nextPagePath({ next_page: '' }, ORIGIN)).toBeNull();
    expect(nextPagePath({ next_page: 'https://evil.example/content/v2/x' }, ORIGIN)).toBeNull();
    expect(nextPagePath({ next_page: '/auth/v1/token' }, ORIGIN)).toBeNull();
    expect(nextPagePath(null, ORIGIN)).toBeNull();
  });
});

// ─── Faux Crunchyroll ─────────────────────────────────────────────────────

interface FakeCall {
  url: string;
  init: RequestInit | undefined;
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

function deps(fetch: FetchLike, signal: AbortSignal = new AbortController().signal): ReaderDeps {
  let now = 1_000_000;
  return {
    fetch,
    origin: ORIGIN,
    locale: 'fr-FR',
    deviceId: 'device-1',
    // Temps simulé : les attentes avancent l'horloge sans bloquer
    sleep: (ms) => {
      now += ms;
      return Promise.resolve();
    },
    now: () => now,
    signal,
  };
}

const token = (n = 1): Response => json(200, { access_token: `jwt-${n}`, expires_in: 300, account_id: 'acc-1' });

function fakeCrunchyroll(pages: number, options: { historyStatus?: (call: number) => number | null; seasonEpisodes?: unknown } = {}): { fetch: FetchLike; calls: FakeCall[] } {
  const calls: FakeCall[] = [];
  let tokens = 0;
  let historyCalls = 0;
  const fetch: FetchLike = (url, init) => {
    calls.push({ url, init });
    const path = new URL(url).pathname;
    if (path === '/auth/v1/token') return Promise.resolve(token(++tokens));
    if (path.includes('/watch-history')) {
      historyCalls++;
      const status = options.historyStatus?.(historyCalls) ?? null;
      if (status !== null) return Promise.resolve(json(status, {}));
      const page = Number(new URL(url).searchParams.get('page') ?? '0');
      const next = page + 1 < pages ? `/content/v2/acc-1/watch-history?page=${page + 1}&page_size=100` : '';
      return Promise.resolve(json(200, { data: [item({ id: `E${page}`, series: `S${page}`, episode: 1 })], total: 100, meta: { prev_page: '', next_page: next } }));
    }
    if (path.includes('/seasons/')) return Promise.resolve(json(200, options.seasonEpisodes ?? { data: [] }));
    return Promise.resolve(json(404, {}));
  };
  return { fetch, calls };
}

describe('lecture de l’historique (faux fetch)', () => {
  it('jeton : client web public en Basic, cookie de session inclus, appareil SyncKai', async () => {
    const { fetch, calls } = fakeCrunchyroll(1);
    await readHistoryPages(createCrClient(deps(fetch)), { origin: ORIGIN, locale: 'fr-FR' }, () => undefined);
    const [first] = calls;
    expect(first?.url).toBe(`${ORIGIN}/auth/v1/token`);
    expect(first?.init?.credentials).toBe('include');
    expect(first?.init?.headers).toMatchObject({ Authorization: `Basic ${btoa(`${CR_WEB_CLIENT_ID}:`)}` });
    expect(String(first?.init?.body)).toBe('grant_type=etp_rt_cookie&device_id=device-1&device_type=SyncKai');
    expect(calls[1]?.init?.headers).toMatchObject({ Authorization: 'Bearer jwt-1' });
    expect(calls[1]?.url).toBe(`${ORIGIN}/content/v2/acc-1/watch-history?page_size=100&locale=fr-FR`);
  });

  it('suit meta.next_page jusqu’à la fin (total ignoré) et signale la progression', async () => {
    const { fetch } = fakeCrunchyroll(3);
    const progress: number[] = [];
    const result = await readHistoryPages(createCrClient(deps(fetch)), { origin: ORIGIN, locale: 'fr-FR' }, (pages) => progress.push(pages));
    expect(result).toMatchObject({ pages: 3, partial: false });
    expect(result.items).toHaveLength(3);
    expect(progress).toEqual([1, 2, 3]);
  });

  it('garde-fou : au-delà de MAX_HISTORY_PAGES, historique partiel', async () => {
    const { fetch } = fakeCrunchyroll(MAX_HISTORY_PAGES + 5);
    const result = await readHistoryPages(createCrClient(deps(fetch)), { origin: ORIGIN, locale: 'fr-FR' }, () => undefined);
    expect(result).toMatchObject({ pages: MAX_HISTORY_PAGES, partial: true });
  });

  it('401 : jeton renouvelé une seule fois, puis la requête est rejouée', async () => {
    const { fetch, calls } = fakeCrunchyroll(1, { historyStatus: (n) => (n === 1 ? 401 : null) });
    const result = await readHistoryPages(createCrClient(deps(fetch)), { origin: ORIGIN, locale: 'fr-FR' }, () => undefined);
    expect(result.pages).toBe(1);
    expect(calls.filter((c) => c.url.endsWith('/auth/v1/token'))).toHaveLength(2);
    expect(calls.at(-1)?.init?.headers).toMatchObject({ Authorization: 'Bearer jwt-2' });
  });

  it('401 persistant → déconnecté ; 403 → bloqué (arrêt immédiat) ; 429 persistant → bloqué après les nouvelles tentatives', async () => {
    const always401 = fakeCrunchyroll(1, { historyStatus: () => 401 });
    await expect(readHistoryPages(createCrClient(deps(always401.fetch)), { origin: ORIGIN, locale: 'fr-FR' }, () => undefined)).rejects.toMatchObject({ code: 'logged-out' });
    for (const [status, calls] of [
      [403, 1],
      [429, 1 + RETRY_DELAYS_MS.length],
    ] as const) {
      const blocked = fakeCrunchyroll(2, { historyStatus: () => status });
      await expect(readHistoryPages(createCrClient(deps(blocked.fetch)), { origin: ORIGIN, locale: 'fr-FR' }, () => undefined)).rejects.toMatchObject({ code: 'blocked' });
      expect(blocked.calls.filter((c) => c.url.includes('watch-history'))).toHaveLength(calls);
    }
  });

  it('jeton refusé : pas de session → déconnecté ; client refusé ou requête invalide → indisponible ; réseau → network', async () => {
    const tokenFail = (status: number, body: unknown): FetchLike => () => Promise.resolve(json(status, body));
    const read = (fetch: FetchLike): Promise<unknown> => readHistoryPages(createCrClient(deps(fetch)), { origin: ORIGIN, locale: 'fr-FR' }, () => undefined);
    await expect(read(tokenFail(400, { error: 'invalid_grant' }))).rejects.toMatchObject({ code: 'logged-out' });
    await expect(read(tokenFail(401, {}))).rejects.toMatchObject({ code: 'logged-out' });
    await expect(read(tokenFail(401, { error: 'invalid_client' }))).rejects.toMatchObject({ code: 'unavailable' });
    await expect(read(tokenFail(200, { access_token: 'x' }))).rejects.toMatchObject({ code: 'unavailable' });
    await expect(read(() => Promise.reject(new TypeError('Failed to fetch')))).rejects.toBeInstanceOf(CrHistoryError);
    await expect(read(() => Promise.reject(new TypeError('Failed to fetch')))).rejects.toMatchObject({ code: 'network' });
  });

  it('CRI-06 : 400 invalid_request (identifiant client changé) → indisponible, pas « déconnecté »', async () => {
    const fetch: FetchLike = () => Promise.resolve(json(400, { error: 'invalid_request' }));
    await expect(readHistoryPages(createCrClient(deps(fetch)), { origin: ORIGIN, locale: 'fr-FR' }, () => undefined)).rejects.toMatchObject({ code: 'unavailable' });
    await expect(readHistoryPages(createCrClient(deps(() => Promise.resolve(json(400, {})))), { origin: ORIGIN, locale: 'fr-FR' }, () => undefined)).rejects.toMatchObject({
      code: 'unavailable',
    });
  });

  it('CRI-01 : 429 avec Retry-After puis succès → attente respectée, la lecture continue', async () => {
    const sleeps: number[] = [];
    let historyCalls = 0;
    const fetch: FetchLike = (url) => {
      const path = new URL(url).pathname;
      if (path === '/auth/v1/token') return Promise.resolve(token());
      historyCalls++;
      if (historyCalls === 1) return Promise.resolve(json(429, {}, { 'Retry-After': '7' }));
      return Promise.resolve(json(200, { data: [item({})], meta: { next_page: '' } }));
    };
    const reader = deps(fetch);
    const sleep = reader.sleep;
    reader.sleep = (ms) => {
      sleeps.push(ms);
      return sleep(ms);
    };
    const result = await readHistoryPages(createCrClient(reader), { origin: ORIGIN, locale: 'fr-FR' }, () => undefined);
    expect(result).toMatchObject({ pages: 1, partial: false });
    expect(historyCalls).toBe(2);
    expect(sleeps).toContain(7_000);
  });

  it('CRI-01 : coupure réseau ou 503 passagers sur une page → nouvelle tentative, la lecture continue', async () => {
    for (const fail of [() => Promise.reject(new TypeError('Failed to fetch')), () => Promise.resolve(json(503, {}))]) {
      let historyCalls = 0;
      const fetch: FetchLike = (url) => {
        if (new URL(url).pathname === '/auth/v1/token') return Promise.resolve(token());
        historyCalls++;
        return historyCalls <= 2 ? fail() : Promise.resolve(json(200, { data: [item({})], meta: { next_page: '' } }));
      };
      const result = await readHistoryPages(createCrClient(deps(fetch)), { origin: ORIGIN, locale: 'fr-FR' }, () => undefined);
      expect(result.pages).toBe(1);
      expect(historyCalls).toBe(3);
    }
  });

  it('lecture complète : position dans la saison établie pour un numéro absolu', async () => {
    const calls: string[] = [];
    const fetch: FetchLike = (url) => {
      calls.push(url);
      const path = new URL(url).pathname;
      if (path === '/auth/v1/token') return Promise.resolve(token());
      if (path.includes('/watch-history')) {
        return Promise.resolve(
          json(200, {
            data: [
              item({ id: 'OP1180', series: 'GRMG8ZQZR', seriesTitle: 'One Piece', season: 24, seasonId: 'GSOP24', seasonTitle: 'Elbaph', episode: 1180 }),
              item({ id: 'BB1', series: 'GRBB', season: 1, seasonId: 'GSBB1', episode: 3 }),
            ],
            meta: { next_page: '' },
          }),
        );
      }
      return Promise.resolve(json(200, { data: Array.from({ length: 30 }, (_, i) => ({ episode_number: 1156 + i })) }));
    };
    const result = await readCrunchyrollHistory(deps(fetch), 85, () => undefined);
    expect(result.stats).toEqual({ items: 2, pages: 1, partial: false });
    expect(result.seasons.find((s) => s.seriesId === 'GRMG8ZQZR')).toMatchObject({ episodeNumber: 1180, seasonEpisodeNumber: 25 });
    expect(result.seasons.find((s) => s.seriesId === 'GRBB')).toMatchObject({ episodeNumber: 3, seasonEpisodeNumber: 3 });
    // Une seule saison lue (celle au numéro absolu)
    expect(calls.filter((u) => u.includes('/seasons/'))).toEqual([`${ORIGIN}/content/v2/cms/seasons/GSOP24/episodes?locale=fr-FR`]);
  });

  it('saison introuvable : position inconnue (à vérifier), la lecture continue', async () => {
    const fetch: FetchLike = (url) => {
      const path = new URL(url).pathname;
      if (path === '/auth/v1/token') return Promise.resolve(token());
      if (path.includes('/watch-history')) return Promise.resolve(json(200, { data: [item({ season: 2, episode: 25 })], meta: {} }));
      return Promise.resolve(json(404, {}));
    };
    const result = await readCrunchyrollHistory(deps(fetch), 85, () => undefined);
    expect(result.seasons[0]?.seasonEpisodeNumber).toBeNull();
  });

  /** Historique de saisons à numéro absolu (S2 E25…) : chaque saison est lue, `seasonResponse` décide de sa réponse */
  function lookupFetch(seasonIds: string[], seasonResponse: (seasonId: string) => Promise<Response>): FetchLike {
    return (url) => {
      const path = new URL(url).pathname;
      if (path === '/auth/v1/token') return Promise.resolve(token());
      if (path.includes('/watch-history')) {
        const data = seasonIds.map((seasonId, i) => item({ id: `E${seasonId}`, series: `GR${seasonId}`, seasonId, season: 2, episode: 26, played: `2026-10-0${i + 1}T00:00:00Z` }));
        return Promise.resolve(json(200, { data, meta: { next_page: '' } }));
      }
      const seasonId = /\/seasons\/([^/]+)\//.exec(path)?.[1] ?? '';
      return seasonResponse(seasonId);
    };
  }
  const seasonOk = (): Promise<Response> => Promise.resolve(json(200, { data: Array.from({ length: 14 }, (_, i) => ({ episode_number: 13 + i })) }));

  it('CRI-01 : échec persistant d’une recherche de saison (503, réseau) → position inconnue, la lecture continue', async () => {
    for (const fail of [() => Promise.resolve(json(503, {})), () => Promise.reject(new TypeError('Failed to fetch'))]) {
      const fetch = lookupFetch(['GSA', 'GSB'], (seasonId) => (seasonId === 'GSA' ? fail() : seasonOk()));
      const result = await readCrunchyrollHistory(deps(fetch), 85, () => undefined);
      expect(result.seasons.find((s) => s.seasonId === 'GSA')?.seasonEpisodeNumber).toBeNull();
      expect(result.seasons.find((s) => s.seasonId === 'GSB')?.seasonEpisodeNumber).toBe(14);
    }
  });

  it('CRI-01 : panne durable pendant les recherches de saison (plusieurs saisons d’affilée) → arrêt « réseau »', async () => {
    const ids = Array.from({ length: MAX_LOOKUP_FAILURES_IN_A_ROW + 2 }, (_, i) => `GS${i}`);
    const fetch = lookupFetch(ids, () => Promise.reject(new TypeError('Failed to fetch')));
    await expect(readCrunchyrollHistory(deps(fetch), 85, () => undefined)).rejects.toMatchObject({ code: 'network' });
  });

  it('CRI-01 : session perdue pendant les recherches de saison → arrêt « déconnecté »', async () => {
    let tokens = 0;
    const base = lookupFetch(['GSA', 'GSB'], () => Promise.resolve(json(401, {})));
    const fetch: FetchLike = (url, init) => (new URL(url).pathname === '/auth/v1/token' && ++tokens > 1 ? Promise.resolve(json(400, { error: 'invalid_grant' })) : base(url, init));
    await expect(readCrunchyrollHistory(deps(fetch), 85, () => undefined)).rejects.toMatchObject({ code: 'logged-out' });
  });

  it('Retry-After : secondes ou date HTTP', () => {
    expect(retryAfterMs('7', 0)).toBe(7_000);
    expect(retryAfterMs(new Date(60_000).toUTCString(), 0)).toBe(60_000);
    expect(retryAfterMs(null, 0)).toBeNull();
    expect(retryAfterMs('bientôt', 0)).toBeNull();
  });

  it('lecture abandonnée (port fermé) : aucune requête de plus', async () => {
    const controller = new AbortController();
    controller.abort();
    const { fetch, calls } = fakeCrunchyroll(1);
    await expect(readCrunchyrollHistory(deps(fetch, controller.signal), 85, () => undefined)).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });
});

describe('jeton et langue', () => {
  it('réponse de jeton validée', () => {
    expect(parseTokenResponse({ access_token: 'a', expires_in: 300, account_id: 'acc-1' }, 0)).toEqual({ accessToken: 'a', accountId: 'acc-1', expiresAt: 300_000 });
    expect(parseTokenResponse({ access_token: 'a', account_id: '../x' }, 0)).toBeNull();
    expect(parseTokenResponse(null, 0)).toBeNull();
  });

  it('langue de la page → locale de l’API', () => {
    expect(pageLocale('fr')).toBe('fr-FR');
    expect(pageLocale('de-de')).toBe('de-DE');
    expect(pageLocale('es-419')).toBe('es-419');
    expect(pageLocale('')).toBe('en-US');
  });
});
