// Fausses API d'historique de visionnage, appelées par le script de contenu DANS l'onglet de la plateforme (import d'un
// historique, src/import-cr) : Crunchyroll (content/crunchyroll/history.ts : jeton de session puis pages de
// /watch-history et épisodes des saisons) et ADN (content/adn/history.ts : GET gw.api…/viewing/history avec le jeton
// du localStorage du site). Mêmes chemins, en-têtes et structures de réponse que ceux relevés sur les sites (voir les
// parseurs de ces fichiers). Toute autre requête vers ces API est refusée et relevée (`unknown`).
import { json, type FakeResponse, type InterceptedRequest, type RequestHandler } from './harness';

/** Requête reçue par une fausse API, avec le statut renvoyé (0 : échec réseau simulé) */
export interface HistoryRequestLog {
  method: string;
  url: string;
  headers: Record<string, string>;
  status: number;
}

// ─── Crunchyroll ──────────────────────────────────────────────────────────

const CR_ORIGIN = 'https://www.crunchyroll.com';
/** Identifiant client public du site (CR_WEB_CLIENT_ID), envoyé en Basic par l'extension */
const CR_BASIC = `Basic ${Buffer.from('noaihdevm_6iyg0a8l0q:').toString('base64')}`;

/** Épisode de l'historique Crunchyroll (champs lus par parseHistoryItem) */
export interface CrHistoryItemSeed {
  episodeId: string;
  seriesId: string;
  seriesTitle: string;
  seriesSlug: string;
  seasonId: string;
  seasonNumber: number;
  seasonTitle: string;
  episodeNumber: number;
  fullyWatched: boolean;
  /** Position de lecture (s) */
  playhead: number;
  durationMs: number;
  /** Date ISO du visionnage */
  playedAt: string;
}

export class FakeCrunchyrollHistory {
  readonly accountId = 'e2e-cr-account';
  /** Jeton de courte durée de l'API (jamais visible hors de l'onglet Crunchyroll) */
  readonly accessToken = 'e2e-cr-access-token';
  readonly requests: HistoryRequestLog[] = [];
  /** Requêtes inconnues du faux */
  readonly unknown: string[] = [];
  /** Réseau coupé (Wi-Fi désactivé) : toutes les requêtes de l'API échouent */
  offline = false;
  /** Coupure du réseau déclenchée par la première requête dont le chemin commence ainsi (moment précis de la lecture) */
  cutNetworkAt: string | null = null;
  private readonly items: CrHistoryItemSeed[];
  /** Numéros d'épisode de chaque saison (/content/v2/cms/seasons/{id}/episodes) */
  private readonly seasons: Map<string, number[]>;

  constructor(seed: { items: CrHistoryItemSeed[]; seasons?: Record<string, number[]> }) {
    this.items = seed.items;
    this.seasons = new Map(Object.entries(seed.seasons ?? {}));
  }

  /** Requêtes reçues dont le chemin commence par `prefix` (après l'origine) */
  calls(prefix: string): HistoryRequestLog[] {
    return this.requests.filter((r) => new URL(r.url).pathname.startsWith(prefix));
  }

  readonly handler: RequestHandler = (request: InterceptedRequest): FakeResponse | null => {
    const url = new URL(request.url);
    if (url.origin !== CR_ORIGIN || !(url.pathname.startsWith('/auth/v1/') || url.pathname.startsWith('/content/v2/'))) return null;
    const response = this.respond(request, url);
    this.requests.push({ method: request.method, url: request.url, headers: request.headers, status: 'network' in response ? 0 : response.status });
    return response;
  };

  private respond(request: InterceptedRequest, url: URL): FakeResponse {
    if (this.cutNetworkAt !== null && url.pathname.startsWith(this.cutNetworkAt)) {
      this.cutNetworkAt = null;
      this.offline = true;
    }
    if (this.offline) return { network: true };
    if (request.method === 'POST' && url.pathname === '/auth/v1/token') {
      const body = new URLSearchParams(request.body ?? '');
      if (request.headers.authorization !== CR_BASIC || body.get('grant_type') !== 'etp_rt_cookie') return json(400, { error: 'invalid_request' });
      return json(200, { access_token: this.accessToken, expires_in: 300, token_type: 'Bearer', account_id: this.accountId });
    }
    if (request.headers.authorization !== `Bearer ${this.accessToken}`) return json(401, { error: 'unauthorized' });

    const history = `/content/v2/${this.accountId}/watch-history`;
    if (request.method === 'GET' && url.pathname === history) {
      const size = Number(url.searchParams.get('page_size') ?? '100');
      const page = Number(url.searchParams.get('page') ?? '1');
      const slice = this.items.slice((page - 1) * size, page * size);
      const more = page * size < this.items.length;
      const nextUrl = new URL(url.pathname, CR_ORIGIN);
      nextUrl.search = new URLSearchParams({ page_size: String(size), locale: url.searchParams.get('locale') ?? '', page: String(page + 1) }).toString();
      // `total` = taille de la page (relevé sur le site), ignoré par l'extension
      return json(200, { total: slice.length, data: slice.map(toHistoryItem), meta: { next_page: more ? `${nextUrl.pathname}${nextUrl.search}` : '' } });
    }
    const season = /^\/content\/v2\/cms\/seasons\/([\w-]+)\/episodes$/.exec(url.pathname);
    if (request.method === 'GET' && season) {
      const numbers = this.seasons.get(season[1] ?? '');
      if (!numbers) return json(404, { error: 'not_found' });
      return json(200, { total: numbers.length, data: numbers.map((n) => ({ episode_number: n, episode: String(n) })) });
    }
    this.unknown.push(`${request.method} ${url.pathname}`);
    return json(404, { error: 'not_found' });
  }
}

/** Élément de /watch-history (structure de parseHistoryItem, vérifiée sur le site le 2026-10-08) */
function toHistoryItem(item: CrHistoryItemSeed): Record<string, unknown> {
  return {
    id: item.episodeId,
    parent_type: 'series',
    fully_watched: item.fullyWatched,
    playhead: item.playhead,
    date_played: item.playedAt,
    panel: {
      id: item.episodeId,
      title: `Episode ${item.episodeNumber}`,
      slug_title: `episode-${item.episodeNumber}`,
      episode_metadata: {
        series_id: item.seriesId,
        series_title: item.seriesTitle,
        series_slug_title: item.seriesSlug,
        season_id: item.seasonId,
        season_number: item.seasonNumber,
        season_title: item.seasonTitle,
        episode_number: item.episodeNumber,
        episode: String(item.episodeNumber),
        sequence_number: item.episodeNumber,
        duration_ms: item.durationMs,
      },
    },
  };
}

// ─── ADN ──────────────────────────────────────────────────────────────────

export const ADN_HISTORY_API = 'https://gw.api.animationdigitalnetwork.com/viewing/history';

/** Épisode de l'historique ADN (structure de parseAdnVideo, vérifiée sur le site le 2026-10-12) */
export interface AdnVideoSeed {
  id: number;
  showId: number;
  showTitle: string;
  showSlug: string;
  season: string;
  shortNumber: string;
  /** Durée (s) */
  duration: number;
  /** Position de lecture (s) */
  stoptime: number;
  isFullyWatched: boolean;
  watchDate: string;
}

export class FakeAdnHistory {
  /** Jeton (JWT) que le site garde dans son localStorage : ne doit jamais quitter l'onglet ADN */
  readonly token = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJlMmUtYWRuLXVzZXIifQ.e2e-adn-signature-not-a-secret';
  readonly requests: HistoryRequestLog[] = [];
  /** Session expirée côté ADN : 401 */
  loggedOut = false;
  private readonly videos: AdnVideoSeed[];

  constructor(videos: AdnVideoSeed[]) {
    this.videos = videos;
  }

  /** Requêtes GET de l'historique (hors pré-vol CORS) */
  historyCalls(): HistoryRequestLog[] {
    return this.requests.filter((r) => r.method === 'GET');
  }

  readonly handler: RequestHandler = (request: InterceptedRequest): FakeResponse | null => {
    if (!request.url.startsWith(ADN_HISTORY_API)) return null;
    const response = this.respond(request);
    this.requests.push({ method: request.method, url: request.url, headers: request.headers, status: 'network' in response ? 0 : response.status });
    return response;
  };

  private respond(request: InterceptedRequest): FakeResponse {
    // Pré-vol CORS (en-têtes du site : authorization, x-profile-id…) : accepté sans cookies, comme l'API d'ADN
    if (request.method === 'OPTIONS') {
      return { status: 204, headers: { 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Allow-Headers': request.headers['access-control-request-headers'] ?? '*' } };
    }
    if (this.loggedOut || request.headers.authorization !== `Bearer ${this.token}`) return json(401, { message: 'Unauthorized' });
    const url = new URL(request.url);
    const offset = Number(url.searchParams.get('offset') ?? '0');
    const limit = Number(url.searchParams.get('limit') ?? '0');
    // limit > 100 : HTTP 400 sur le site
    if (limit < 1 || limit > 100) return json(400, { message: 'Bad Request' });
    return json(200, { videos: this.videos.slice(offset, offset + limit).map(toAdnVideo) });
  }
}

function toAdnVideo(video: AdnVideoSeed): Record<string, unknown> {
  const showPath = `/video/${video.showId}-${video.showSlug}`;
  return {
    id: video.id,
    name: `Épisode ${video.shortNumber}`,
    shortNumber: video.shortNumber,
    season: video.season,
    type: 'EPS',
    duration: video.duration,
    urlPath: `${showPath}/${video.id}-episode-${video.shortNumber}`,
    // Champs du compte renvoyés par le site : jamais transmis par le script de contenu (pickVideo)
    user: { id: 987654, stoptime: video.stoptime, watchDate: video.watchDate, isFullyWatched: video.isFullyWatched },
    show: { id: video.showId, title: video.showTitle, urlPath: showPath },
  };
}
