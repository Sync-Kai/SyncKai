// Faux MyAnimeList (API REST v2 https://api.myanimelist.net/v2) : catalogue, comptes et listes en mémoire, avec état.
// Chemins reconnus : ceux de src/background/api/mal.ts et api/watching.ts (profil, liste « watching », fiche avec
// my_list_status, PATCH / DELETE my_list_status). Tout autre chemin est refusé et relevé. Token vérifié à chaque requête.
import { json, sleep, type FakeResponse, type InterceptedRequest, type RequestHandler } from './harness';

export const MAL_API = 'https://api.myanimelist.net/v2';

export type MalStatus = 'watching' | 'completed' | 'on_hold' | 'dropped' | 'plan_to_watch';

export interface MalAnimeSeed {
  id: number;
  title: string;
  numEpisodes: number;
}

export interface MalListStatus {
  status: MalStatus;
  num_episodes_watched: number;
  /** 0 = pas de note */
  score: number;
  is_rewatching: boolean;
  num_times_rewatched: number;
  comments: string;
  updated_at: string;
}

export type MalListStatusSeed = Partial<Omit<MalListStatus, 'updated_at'>> & Pick<MalListStatus, 'status' | 'num_episodes_watched'>;

export interface MalAccountSeed {
  token: string;
  user: { id: number; name: string };
  /** Entrées de liste par identifiant MAL */
  list?: Record<number, MalListStatusSeed>;
}

/** Échec simulé : statut HTTP ou réseau coupé, pour les méthodes choisies */
export interface MalFailure {
  status?: number;
  network?: true;
  retryAfter?: number;
  /** Méthodes visées (toutes si absent), ex. ['PATCH'] : seules les écritures échouent */
  methods?: readonly string[];
}

export interface MalRequestLog {
  method: string;
  /** Chemin après /v2, sans la requête (ex. /anime/1001/my_list_status) */
  path: string;
  query: string;
  token: string | null;
  /** Corps du PATCH (formulaire) décodé */
  body: Record<string, string> | null;
  /** Statut renvoyé (0 : échec réseau simulé) */
  status: number;
  at: number;
}

interface Account {
  token: string;
  user: { id: number; name: string };
  list: Map<number, MalListStatus>;
  revoked: boolean;
}

const now = (): string => new Date().toISOString();

export class FakeMal {
  readonly requests: MalRequestLog[] = [];
  /** Chemins inconnus du faux (à ajouter si l'extension en appelle un nouveau) */
  readonly unknownPaths: string[] = [];
  latencyMs = 0;
  failure: MalFailure | null = null;
  private readonly anime = new Map<number, MalAnimeSeed>();
  private readonly accounts = new Map<string, Account>();

  constructor(seed: { anime: readonly MalAnimeSeed[]; accounts: readonly MalAccountSeed[] }) {
    for (const anime of seed.anime) this.anime.set(anime.id, anime);
    for (const account of seed.accounts) {
      const list = new Map<number, MalListStatus>();
      for (const [id, status] of Object.entries(account.list ?? {})) list.set(Number(id), { score: 0, is_rewatching: false, num_times_rewatched: 0, comments: '', updated_at: now(), ...status });
      this.accounts.set(account.token, { token: account.token, user: account.user, list, revoked: false });
    }
  }

  revoke(token: string): void {
    const account = this.accounts.get(token);
    if (account) account.revoked = true;
  }

  entry(token: string, malId: number): MalListStatus | null {
    return this.accounts.get(token)?.list.get(malId) ?? null;
  }

  /** Anime retiré de la liste sur myanimelist.net (hors de l'extension) */
  removeEntry(token: string, malId: number): void {
    this.accounts.get(token)?.list.delete(malId);
  }

  /** Écritures réussies (PATCH, DELETE), éventuellement pour un seul token */
  writes(token?: string): MalRequestLog[] {
    return this.requests.filter((r) => (r.method === 'PATCH' || r.method === 'DELETE') && r.status === 200 && (token === undefined || r.token === token));
  }

  readonly handler: RequestHandler = (request: InterceptedRequest): Promise<FakeResponse | null> | null => {
    if (!request.url.startsWith(`${MAL_API}/`)) return null;
    return this.respond(request);
  };

  private async respond(request: InterceptedRequest): Promise<FakeResponse> {
    if (this.latencyMs > 0) await sleep(this.latencyMs);
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/v2/, '');
    const auth = request.headers.authorization ?? null;
    const token = auth?.startsWith('Bearer ') ? auth.slice('Bearer '.length) : null;
    const body = request.body !== null && request.method === 'PATCH' ? Object.fromEntries(new URLSearchParams(request.body)) : null;
    const log = (status: number): void => {
      this.requests.push({ method: request.method, path, query: url.search, token, body, status, at: Date.now() });
    };

    const failure = this.failure;
    if (failure && (failure.methods === undefined || failure.methods.includes(request.method))) {
      log(failure.network ? 0 : (failure.status ?? 500));
      if (failure.network) return { network: true };
      const headers: Record<string, string> = failure.retryAfter !== undefined ? { 'Retry-After': String(failure.retryAfter) } : {};
      return json(failure.status ?? 500, { error: 'internal_server_error', message: '' }, headers);
    }

    const account = token === null ? null : (this.accounts.get(token) ?? null);
    if (account === null || account.revoked) {
      log(401);
      return json(401, { error: 'invalid_token', message: 'token is invalid' });
    }

    const result = this.execute(request.method, path, url.searchParams, body, account);
    if (result === null) {
      this.unknownPaths.push(`${request.method} ${path}`);
      log(400);
      return json(400, { error: 'bad_request', message: `Chemin non simulé : ${path}` });
    }
    log(result.status);
    return json(result.status, result.body);
  }

  private execute(method: string, path: string, query: URLSearchParams, body: Record<string, string> | null, account: Account): { status: number; body: unknown } | null {
    if (method === 'GET' && path === '/users/@me') return { status: 200, body: { id: account.user.id, name: account.user.name } };

    if (method === 'GET' && path === '/users/@me/animelist') {
      const wanted = query.get('status');
      const data = [...account.list.entries()]
        .filter(([, status]) => wanted === null || status.status === wanted)
        .flatMap(([id, status]) => {
          const anime = this.anime.get(id);
          return anime ? [{ node: { id, title: anime.title, main_picture: null, num_episodes: anime.numEpisodes, status: 'finished_airing' }, list_status: status }] : [];
        });
      return { status: 200, body: { data, paging: {} } };
    }

    const listStatus = /^\/anime\/(\d+)\/my_list_status$/.exec(path);
    if (listStatus) {
      const id = Number(listStatus[1]);
      if (!this.anime.has(id)) return { status: 404, body: { error: 'not_found', message: '' } };
      if (method === 'DELETE') {
        if (!account.list.has(id)) return { status: 404, body: { error: 'not_found', message: '' } };
        account.list.delete(id);
        return { status: 200, body: [] };
      }
      if (method !== 'PATCH' || body === null) return null;
      const current = account.list.get(id) ?? { status: 'plan_to_watch', num_episodes_watched: 0, score: 0, is_rewatching: false, num_times_rewatched: 0, comments: '', updated_at: now() };
      const saved: MalListStatus = {
        ...current,
        ...(body.status !== undefined ? { status: body.status as MalStatus } : {}),
        ...(body.num_watched_episodes !== undefined ? { num_episodes_watched: Number(body.num_watched_episodes) } : {}),
        ...(body.score !== undefined ? { score: Number(body.score) } : {}),
        ...(body.is_rewatching !== undefined ? { is_rewatching: body.is_rewatching === 'true' } : {}),
        ...(body.num_times_rewatched !== undefined ? { num_times_rewatched: Number(body.num_times_rewatched) } : {}),
        ...(body.comments !== undefined ? { comments: body.comments } : {}),
        updated_at: now(),
      };
      account.list.set(id, saved);
      return { status: 200, body: saved };
    }

    const anime = /^\/anime\/(\d+)$/.exec(path);
    if (method === 'GET' && anime) {
      const id = Number(anime[1]);
      const seed = this.anime.get(id);
      if (!seed) return { status: 404, body: { error: 'not_found', message: '' } };
      const status = account.list.get(id);
      return { status: 200, body: { id, title: seed.title, num_episodes: seed.numEpisodes, ...(status ? { my_list_status: status } : {}) } };
    }
    return null;
  }
}
