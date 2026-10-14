// Faux AniList (API GraphQL https://graphql.anilist.co) : catalogue, comptes et listes en mémoire, avec état. Les
// opérations sont reconnues par leur nom (`query Viewer`, `mutation SaveProgress`…), tel que les envoie
// src/background/api/*.ts ; une opération inconnue est refusée et relevée. Le token (Authorization: Bearer) est vérifié
// à chaque requête : un test prouve ainsi que le service worker envoie bien le token déchiffré.
import type { AniListScoreFormat } from '../../src/shared/score';
import type { ListStatus } from '../../src/shared/sync.types';
import { json, sleep, type FakeResponse, type InterceptedRequest, type RequestHandler } from './harness';

export const ANILIST_URL = 'https://graphql.anilist.co/';

export interface AniListMediaSeed {
  id: number;
  idMal: number | null;
  title: string;
  episodes: number | null;
  /** Liens externes (ex. https://www.crunchyroll.com/series/GSERIES1) */
  externalLinks?: string[];
  /** Titres alternatifs (titres localisés), trouvés par la recherche comme le titre */
  synonyms?: string[];
  /** FINISHED par défaut ; RELEASING pour une série en cours de diffusion (One Piece) */
  status?: 'FINISHED' | 'RELEASING';
}

export interface AniListEntry {
  /** Identifiant de l'entrée de liste (MediaList.id) */
  id: number;
  status: ListStatus;
  progress: number;
  repeat: number;
  /** 0 = pas de note */
  score: number;
  notes: string | null;
  updatedAt: number;
}

export type AniListEntrySeed = Partial<Omit<AniListEntry, 'id' | 'updatedAt'>> & Pick<AniListEntry, 'status' | 'progress'>;

export interface AniListAccountSeed {
  token: string;
  viewer: { id: number; name: string };
  scoreFormat?: AniListScoreFormat;
  /** Entrées de liste par identifiant de fiche */
  entries?: Record<number, AniListEntrySeed>;
}

/** Échec simulé : statut HTTP (500, 429 avec Retry-After…) ou réseau coupé, pour les opérations choisies */
export interface AniListFailure {
  status?: number;
  network?: true;
  retryAfter?: number;
  /** Opérations visées (toutes si absent) */
  operations?: readonly string[];
}

/** Requête reçue, après décodage */
export interface AniListRequestLog {
  operation: string;
  variables: Record<string, unknown>;
  /** Token reçu (null : requête sans Authorization) */
  token: string | null;
  /** Statut renvoyé (0 : échec réseau simulé) */
  status: number;
  at: number;
}

const MUTATIONS: ReadonlySet<string> = new Set(['SaveProgress', 'SaveScore', 'SaveEntry', 'SaveNotes', 'DeleteEntry']);

interface Account {
  token: string;
  viewer: { id: number; name: string };
  scoreFormat: AniListScoreFormat;
  entries: Map<number, AniListEntry>;
  revoked: boolean;
}

/** Signes diacritiques combinants (après décomposition NFD) */
const DIACRITICS = /\p{M}/u;
const withoutDiacritics = (text: string): string => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

export class FakeAniList {
  readonly requests: AniListRequestLog[] = [];
  /** Opérations GraphQL inconnues du faux (à ajouter si l'extension en envoie une nouvelle) */
  readonly unknownOperations: string[] = [];
  /** Latence de chaque réponse (ms), pour faire se chevaucher deux requêtes concurrentes */
  latencyMs = 0;
  failure: AniListFailure | null = null;
  private readonly media = new Map<number, AniListMediaSeed>();
  private readonly accounts = new Map<string, Account>();
  private nextEntryId = 9000;

  constructor(seed: { media: readonly AniListMediaSeed[]; accounts: readonly AniListAccountSeed[] }) {
    for (const media of seed.media) this.media.set(media.id, media);
    for (const account of seed.accounts) this.addAccount(account);
  }

  addAccount(seed: AniListAccountSeed): void {
    const entries = new Map<number, AniListEntry>();
    for (const [mediaId, entry] of Object.entries(seed.entries ?? {})) entries.set(Number(mediaId), this.newEntry(entry));
    this.accounts.set(seed.token, { token: seed.token, viewer: seed.viewer, scoreFormat: seed.scoreFormat ?? 'POINT_10_DECIMAL', entries, revoked: false });
  }

  /** Token révoqué (application retirée sur anilist.co) : 401 « Invalid token » */
  revoke(token: string): void {
    const account = this.accounts.get(token);
    if (account) account.revoked = true;
  }

  entry(token: string, mediaId: number): AniListEntry | null {
    return this.accounts.get(token)?.entries.get(mediaId) ?? null;
  }

  /** Mutations reçues (écritures), éventuellement pour un seul token */
  mutations(token?: string): AniListRequestLog[] {
    return this.requests.filter((r) => MUTATIONS.has(r.operation) && r.status === 200 && (token === undefined || r.token === token));
  }

  readonly handler: RequestHandler = (request: InterceptedRequest): Promise<FakeResponse | null> | null => {
    if (request.url !== ANILIST_URL && request.url !== ANILIST_URL.slice(0, -1)) return null;
    return this.respond(request);
  };

  private newEntry(seed: AniListEntrySeed): AniListEntry {
    return { id: this.nextEntryId++, repeat: 0, score: 0, notes: null, updatedAt: Math.floor(Date.now() / 1000), ...seed };
  }

  private log(operation: string, variables: Record<string, unknown>, token: string | null, status: number): void {
    this.requests.push({ operation, variables, token, status, at: Date.now() });
  }

  private async respond(request: InterceptedRequest): Promise<FakeResponse> {
    if (this.latencyMs > 0) await sleep(this.latencyMs);
    const parsed: unknown = JSON.parse(request.body ?? 'null');
    const query = isRecord(parsed) && typeof parsed.query === 'string' ? parsed.query : '';
    const variables = isRecord(parsed) && isRecord(parsed.variables) ? parsed.variables : {};
    const operation = /\b(?:query|mutation)\s+(\w+)/.exec(query)?.[1] ?? '(anonyme)';
    const auth = request.headers.authorization ?? null;
    const token = auth?.startsWith('Bearer ') ? auth.slice('Bearer '.length) : null;

    const failure = this.failure;
    if (failure && (failure.operations === undefined || failure.operations.includes(operation))) {
      if (failure.network) {
        this.log(operation, variables, token, 0);
        return { network: true };
      }
      const status = failure.status ?? 500;
      this.log(operation, variables, token, status);
      const headers: Record<string, string> = failure.retryAfter !== undefined ? { 'Retry-After': String(failure.retryAfter) } : {};
      return json(status, { data: null, errors: [{ message: status === 429 ? 'Too Many Requests.' : 'Internal Server Error', status }] }, headers);
    }

    // Token inconnu ou révoqué : AniList répond « Invalid token » (le client le reconnaît aussi sous 401)
    const account = token === null ? null : (this.accounts.get(token) ?? null);
    if (token !== null && (account === null || account.revoked)) {
      this.log(operation, variables, token, 401);
      return json(401, { data: null, errors: [{ message: 'Invalid token', status: 401 }] });
    }

    const data = this.execute(operation, variables, account);
    if (data === null) {
      this.unknownOperations.push(operation);
      this.log(operation, variables, token, 400);
      return json(400, { data: null, errors: [{ message: `Opération non simulée : ${operation}`, status: 400 }] });
    }
    if ('error' in data) {
      this.log(operation, variables, token, data.error);
      return json(data.error, { data: null, errors: [{ message: data.message, status: data.error }] });
    }
    this.log(operation, variables, token, 200);
    return json(200, { data: data.ok }, { 'X-RateLimit-Limit': '90', 'X-RateLimit-Remaining': '89' });
  }

  /** Données de l'opération ; null si inconnue */
  private execute(operation: string, v: Record<string, unknown>, account: Account | null): { ok: unknown } | { error: number; message: string } | null {
    const needsAccount = (): { error: number; message: string } => ({ error: 401, message: 'Unauthorized.' });
    switch (operation) {
      case 'Viewer':
        if (!account) return needsAccount();
        return { ok: { Viewer: { id: account.viewer.id, name: account.viewer.name, siteUrl: `https://anilist.co/user/${account.viewer.name}`, avatar: null } } };
      case 'ScoreFormat':
        if (!account) return needsAccount();
        return { ok: { Viewer: { mediaListOptions: { scoreFormat: account.scoreFormat } } } };
      case 'AnimeById':
      case 'MediaEntry': {
        const media = this.media.get(Number(v.id));
        if (!media) return { error: 404, message: 'Not Found.' };
        if (operation === 'MediaEntry' && !account) return needsAccount();
        return { ok: { Media: this.mediaFields(media, account) } };
      }
      case 'AnimeByIds':
      case 'CatalogByMal': {
        const ids = Array.isArray(v.ids) ? v.ids.map(Number) : [];
        const found = [...this.media.values()].filter((m) => (operation === 'AnimeByIds' ? ids.includes(m.id) : m.idMal !== null && ids.includes(m.idMal)));
        return { ok: { Page: { media: found.map((m) => this.mediaFields(m, null)) } } };
      }
      case 'SearchAnime': {
        // Comme le vrai AniList (observé le 2026-10-14) : une requête accentuée ne trouve rien, même un synonyme accentué ;
        // sans accents, titre et synonymes sont comparés sans leurs accents
        const search = String(v.search ?? '');
        const titles = (m: AniListMediaSeed): string[] => [m.title, ...(m.synonyms ?? [])].map(withoutDiacritics);
        const found = DIACRITICS.test(search.normalize('NFD')) ? [] : [...this.media.values()].filter((m) => titles(m).some((title) => title.includes(withoutDiacritics(search))));
        return { ok: { Page: { media: found.map((m) => this.mediaFields(m, null)) } } };
      }
      case 'Watching': {
        if (!account) return needsAccount();
        if (Number(v.userId) !== account.viewer.id) return { error: 400, message: 'Private list.' };
        const entries = [...account.entries.entries()]
          .filter(([, entry]) => entry.status === 'CURRENT' || entry.status === 'REPEATING')
          .flatMap(([mediaId, entry]) => {
            const media = this.media.get(mediaId);
            return media ? [{ progress: entry.progress, updatedAt: entry.updatedAt, media: this.mediaFields(media, null) }] : [];
          });
        return { ok: { MediaListCollection: { lists: [{ entries }] } } };
      }
      case 'SaveProgress':
      case 'SaveScore':
      case 'SaveEntry':
      case 'SaveNotes': {
        if (!account) return needsAccount();
        const mediaId = Number(v.mediaId);
        if (!this.media.has(mediaId)) return { error: 404, message: 'Not Found.' };
        const current = account.entries.get(mediaId) ?? this.newEntry({ status: 'PLANNING', progress: 0 });
        const saved: AniListEntry = {
          ...current,
          ...(typeof v.status === 'string' ? { status: v.status as ListStatus } : {}),
          ...(typeof v.progress === 'number' ? { progress: v.progress } : {}),
          ...(typeof v.repeat === 'number' ? { repeat: v.repeat } : {}),
          ...(typeof v.score === 'number' ? { score: v.score } : {}),
          ...(typeof v.notes === 'string' ? { notes: v.notes === '' ? null : v.notes } : {}),
          updatedAt: Math.floor(Date.now() / 1000),
        };
        account.entries.set(mediaId, saved);
        return { ok: { SaveMediaListEntry: { status: saved.status, progress: saved.progress, repeat: saved.repeat, score: saved.score, notes: saved.notes } } };
      }
      case 'DeleteEntry': {
        if (!account) return needsAccount();
        const found = [...account.entries.entries()].find(([, entry]) => entry.id === Number(v.id));
        if (found) account.entries.delete(found[0]);
        return { ok: { DeleteMediaListEntry: { deleted: found !== undefined } } };
      }
      default:
        return null;
    }
  }

  /** Fiche au format des requêtes de l'extension (MEDIA_FIELDS de api/media.ts, champs de watching.ts et list.ts) */
  private mediaFields(media: AniListMediaSeed, account: Account | null): Record<string, unknown> {
    const entry = account?.entries.get(media.id) ?? null;
    return {
      id: media.id,
      idMal: media.idMal,
      siteUrl: `https://anilist.co/anime/${media.id}`,
      format: 'TV',
      episodes: media.episodes,
      status: media.status ?? 'FINISHED',
      startDate: { year: 2023, month: 1, day: 6 },
      seasonYear: 2023,
      coverImage: { medium: null, large: null },
      title: { romaji: media.title, english: media.title, native: null, userPreferred: media.title },
      synonyms: media.synonyms ?? [],
      nextAiringEpisode: null,
      externalLinks: (media.externalLinks ?? []).map((url) => ({ url })),
      relations: { edges: [] },
      mediaListEntry: entry && { id: entry.id, status: entry.status, progress: entry.progress, repeat: entry.repeat, score: entry.score, notes: entry.notes },
    };
  }
}
