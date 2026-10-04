import { t } from '../../i18n';
import { isRecord } from '../../shared/guards';
import type { MalViewer, MalViewerResult } from '../../shared/mal.types';
import { clearMalSession, saveCachedMalViewer } from '../../shared/storage';
import type { ListStatusChange } from '../../shared/sync.types';
import { toSafeUrl } from '../../shared/url';
import { getMalAccessToken } from '../auth/mal';
import type { ListEntryState, ListStatus, WriteStatus } from '../sync/rules';
import { ApiError } from './errors';
import { retryDelayMs, sleep } from './rate-limit';
import { createLogger } from '../../shared/logger';

const log = createLogger('mal');

const MAL_API_URL = 'https://api.myanimelist.net/v2';

type MalListStatus = 'watching' | 'completed' | 'on_hold' | 'dropped' | 'plan_to_watch';

const MAL_TO_LIST_STATUS: Record<MalListStatus, ListStatus> = {
  watching: 'CURRENT',
  completed: 'COMPLETED',
  on_hold: 'PAUSED',
  dropped: 'DROPPED',
  plan_to_watch: 'PLANNING',
};

/** Statut MAL → statut commun aux règles de mise à jour (un revisionnage MAL = REPEATING). */
export function fromMalStatus(status: unknown, isRewatching: unknown): ListStatus | null {
  if (typeof status !== 'string' || !Object.hasOwn(MAL_TO_LIST_STATUS, status)) return null;
  return isRewatching === true ? 'REPEATING' : MAL_TO_LIST_STATUS[status as MalListStatus];
}

/** Statut écrit par SyncKai → statut MAL (un revisionnage MAL reste « completed » avec is_rewatching) */
export function toMalStatus(status: WriteStatus): MalListStatus {
  return status === 'CURRENT' ? 'watching' : 'completed';
}

/** my_list_status MAL → état d'entrée commun ; null si l'anime n'est pas dans la liste */
export function parseMalListStatus(value: unknown): ListEntryState | null {
  if (!isRecord(value)) return null;
  const status = fromMalStatus(value.status, value.is_rewatching);
  if (!status) return null;
  const entry: ListEntryState = { status, progress: typeof value.num_episodes_watched === 'number' ? value.num_episodes_watched : 0 };
  if (typeof value.num_times_rewatched === 'number') entry.repeat = value.num_times_rewatched;
  // 0 = pas de note sur MAL
  if (typeof value.score === 'number' && value.score > 0) entry.score = value.score;
  return entry;
}

const STATUS_CHANGE_TO_MAL: Record<ListStatusChange, MalListStatus> = {
  PAUSED: 'on_hold',
  DROPPED: 'dropped',
  COMPLETED: 'completed',
};

/**
 * Corps du PATCH my_list_status pour un changement de statut manuel (pur, testable).
 * is_rewatching toujours à false : mettre en pause, abandonner ou terminer sort d'un revisionnage.
 * `repeat` : nouveau compteur de revisionnages (revisionnage marqué terminé).
 */
export function malStatusBody(status: ListStatusChange, progress: number, repeat?: number): URLSearchParams {
  const body = new URLSearchParams({ status: STATUS_CHANGE_TO_MAL[status], num_watched_episodes: String(progress), is_rewatching: 'false' });
  if (repeat !== undefined) body.set('num_times_rewatched', String(repeat));
  return body;
}

/**
 * Corps du PATCH my_list_status pour une progression (pur, testable) :
 * REPEATING → completed + is_rewatching ; `repeat` (fin de revisionnage) → is_rewatching false + compteur.
 */
export function malProgressBody(progress: number, status: WriteStatus, repeat?: number): URLSearchParams {
  const body = new URLSearchParams({ status: toMalStatus(status), num_watched_episodes: String(progress) });
  if (status === 'REPEATING') body.set('is_rewatching', 'true');
  if (repeat !== undefined) {
    body.set('is_rewatching', 'false');
    body.set('num_times_rewatched', String(repeat));
  }
  return body;
}

interface RequestOptions {
  method?: 'GET' | 'PATCH';
  body?: URLSearchParams;
  /** Nouvelle tentative déjà faite après un 401 (token renouvelé) */
  refreshed?: boolean;
  /** Nouvelle tentative déjà faite après un 429 */
  rateRetried?: boolean;
}

export async function malRequest<T>(path: string, isData: (data: unknown) => data is T, options: RequestOptions = {}): Promise<T> {
  const accessToken = await getMalAccessToken(options.refreshed === true);
  if (!accessToken) throw new ApiError('NOT_AUTHENTICATED', t('api.notAuthenticated', { service: 'MyAnimeList' }));

  let response: Response;
  try {
    response = await fetch(`${MAL_API_URL}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(options.body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      },
      body: options.body,
    });
  } catch {
    throw new ApiError('NETWORK', t('api.network', { service: 'MyAnimeList' }));
  }

  if (response.status === 401) {
    // Token révoqué ou expiré plus tôt que prévu : un renouvellement, puis abandon
    if (!options.refreshed) return malRequest(path, isData, { ...options, refreshed: true });
    await clearMalSession();
    throw new ApiError('TOKEN_INVALID', t('api.sessionExpired', { service: 'MyAnimeList' }));
  }

  if (response.status === 429) {
    const delay = options.rateRetried ? null : retryDelayMs(response.headers.get('Retry-After'));
    if (delay !== null) {
      log.warn(`Limite de requêtes MyAnimeList atteinte, nouvelle tentative dans ${Math.ceil(delay / 1000)} s`);
      await sleep(delay);
      return malRequest(path, isData, { ...options, rateRetried: true });
    }
    throw new ApiError('RATE_LIMITED', t('api.rateLimited', { service: 'MyAnimeList' }));
  }

  if (response.status === 404) throw new ApiError('API_ERROR', t('api.malNotFound'));
  if (!response.ok) {
    log.error('Erreur API MyAnimeList :', response.status);
    throw new ApiError('API_ERROR', t('api.httpError', { service: 'MyAnimeList', status: response.status }));
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // traité ci-dessous
  }
  if (!isData(body)) {
    log.error('Réponse MyAnimeList inattendue :', body);
    throw new ApiError('INVALID_RESPONSE', t('api.invalidResponse.mal'));
  }
  return body;
}

// ─── Profil ───────────────────────────────────────────────────────────────

interface RawMalUser {
  id: number;
  name: string;
  picture?: unknown;
}

function isRawMalUser(data: unknown): data is RawMalUser {
  return isRecord(data) && typeof data.id === 'number' && typeof data.name === 'string';
}

/** Profil de l'utilisateur MAL connecté, mis en cache pour le popup. Ne lève jamais. */
export async function getMalViewer(): Promise<MalViewerResult> {
  try {
    const user = await malRequest('/users/@me?fields=picture', isRawMalUser);
    const viewer: MalViewer = {
      id: user.id,
      name: user.name,
      pictureUrl: toSafeUrl(typeof user.picture === 'string' ? user.picture : null),
    };
    await saveCachedMalViewer(viewer);
    return { ok: true, data: viewer };
  } catch (error: unknown) {
    if (error instanceof ApiError) return { ok: false, code: error.code, message: error.message };
    log.error('Erreur inattendue (getMalViewer) :', error);
    return { ok: false, code: 'API_ERROR', message: t('api.profileLoadFailed') };
  }
}

// ─── Liste de l'utilisateur ───────────────────────────────────────────────

export interface MalAnimeInfo {
  title: string;
  episodes: number | null;
  entry: ListEntryState | null;
}

function isRawMalAnime(data: unknown): data is { id: number; title: string; num_episodes?: unknown; my_list_status?: unknown } {
  return isRecord(data) && typeof data.id === 'number' && typeof data.title === 'string';
}

// Champs imbriqués : num_times_rewatched n'est pas renvoyé par défaut dans my_list_status
const MY_LIST_FIELDS = 'my_list_status{status,score,num_episodes_watched,is_rewatching,num_times_rewatched}';

export async function getMalAnime(malId: number): Promise<MalAnimeInfo> {
  const anime = await malRequest(`/anime/${malId}?fields=num_episodes,${MY_LIST_FIELDS}`, isRawMalAnime);
  const episodes = typeof anime.num_episodes === 'number' && anime.num_episodes > 0 ? anime.num_episodes : null; // 0 = inconnu
  return { title: anime.title, episodes, entry: parseMalListStatus(anime.my_list_status) };
}

async function patchMalListStatus(malId: number, body: URLSearchParams): Promise<ListEntryState> {
  const saved = await malRequest(`/anime/${malId}/my_list_status`, isRecord, { method: 'PATCH', body });
  const entry = parseMalListStatus(saved);
  if (!entry) throw new ApiError('INVALID_RESPONSE', t('api.invalidAfterUpdate.mal'));
  return entry;
}

/** `repeat` : nouveau nombre de revisionnages (fin d'un revisionnage), sinon inchangé */
export function saveMalProgress(malId: number, progress: number, status: WriteStatus, repeat?: number): Promise<ListEntryState> {
  return patchMalListStatus(malId, malProgressBody(progress, status, repeat));
}

/** Changement de statut manuel (on_hold, dropped, completed) */
export function saveMalListStatus(malId: number, status: ListStatusChange, progress: number, repeat?: number): Promise<ListEntryState> {
  return patchMalListStatus(malId, malStatusBody(status, progress, repeat));
}

/** `score` déjà converti (entier 1 à 10, voir toMalScore) */
export function saveMalScore(malId: number, score: number): Promise<ListEntryState> {
  return patchMalListStatus(malId, new URLSearchParams({ score: String(score) }));
}
