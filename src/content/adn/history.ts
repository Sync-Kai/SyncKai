import {
  ADN_HISTORY_PAGE_SIZE,
  ADN_HISTORY_PORT_NAME,
  isAdnHistoryRequest,
  MAX_ADN_HISTORY_PAGES,
  type AdnHistoryPortMessage,
  type AdnHistoryRead,
} from '../../protocol/content-messages';
import { isRecord } from '../../shared/guards';
import { createLogger } from '../../shared/logger';
import { CrHistoryError } from '../crunchyroll/history';
import { abortableSleep, listenHistoryPort } from '../lib/history-port';
import { pageFetch, type FetchLike } from '../lib/page-fetch';

// Lecture de l'historique de visionnage ADN, DANS l'onglet ADN de l'utilisateur, avec la même requête que le site
// (vérifiée le 2026-10-12) : GET gw.api.animationdigitalnetwork.com/viewing/history, jeton de la page en en-tête.
// Le jeton est lu dans le localStorage du site au moment de la lecture : jamais stocké, journalisé ni transmis
// (seuls les épisodes remontent par le port). Jamais le `refresh_token`. Ni cookies ni en-têtes supplémentaires :
// la requête CORS du site n'en accepte pas d'autres.

const log = createLogger('adn-history');

export const ADN_HISTORY_URL = 'https://gw.api.animationdigitalnetwork.com/viewing/history';
/** Pages du site où le jeton est lisible (localStorage de cette origine) */
const HISTORY_HOST = /^(?:www\.)?animationdigitalnetwork\.com$/;
/** Espacement entre deux requêtes, puis attentes avant de renvoyer une requête en échec passager (réseau, 429, 5xx) */
export const ADN_REQUEST_GAP_MS = 300;
export const ADN_RETRY_DELAYS_MS: readonly number[] = [2_000, 5_000];

export interface AdnReaderDeps {
  fetch: FetchLike;
  headers: Record<string, string>;
  sleep: (ms: number) => Promise<void>;
  signal: AbortSignal;
}

/** Valeur du localStorage : JSON si possible (`"fr"`, `{ "id": 1 }`), sinon le texte brut */
function stored(storage: Pick<Storage, 'getItem'>, key: string): unknown {
  const raw = storage.getItem(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/**
 * En-têtes de la requête du site, d'après son localStorage : `token` (JWT), `profile` (identifiant de profil, nombre ou
 * objet { id }), `distribution` (fr, de…). null sans jeton lisible (déconnecté). Profil et distribution absents : 1 / fr.
 */
export function adnHeaders(storage: Pick<Storage, 'getItem'>): Record<string, string> | null {
  const raw = stored(storage, 'token');
  const token = typeof raw === 'string' ? raw.replace(/^Bearer\s+/i, '') : '';
  if (!/^[\w-]+\.[\w-]+\.[\w-]+$/.test(token)) return null;
  const profile = stored(storage, 'profile');
  const profileId = String(isRecord(profile) ? (profile.id ?? profile.profileId) : profile);
  const distribution = stored(storage, 'distribution');
  const language = typeof distribution === 'string' && /^[a-z]{2}$/.test(distribution) ? distribution : 'fr';
  return {
    accept: 'application/json',
    authorization: `Bearer ${token}`,
    'x-profile-id': /^\d{1,9}$/.test(profileId) ? profileId : '1',
    'x-target-distribution': language,
    'accept-language': language,
    'x-i18n-platform': '1',
    'x-source': 'Web',
  };
}

/** Requête espacée, renvoyée après une erreur passagère ; statut → CrHistoryError (401/403 : session à rouvrir) */
async function get(deps: AdnReaderDeps, url: string): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    const last = attempt >= ADN_RETRY_DELAYS_MS.length;
    await deps.sleep(attempt === 0 ? ADN_REQUEST_GAP_MS : (ADN_RETRY_DELAYS_MS[attempt - 1] ?? 0));
    let response: Response;
    try {
      response = await deps.fetch(url, { headers: deps.headers, credentials: 'omit', signal: deps.signal });
    } catch (error: unknown) {
      if (deps.signal.aborted) throw error;
      if (last) throw new CrHistoryError('network');
      continue;
    }
    if (!last && (response.status === 429 || response.status >= 500)) continue;
    if (response.status === 401 || response.status === 403) throw new CrHistoryError('logged-out');
    if (response.status === 429) throw new CrHistoryError('blocked');
    if (!response.ok) throw new CrHistoryError('unavailable', `HTTP ${response.status}`);
    try {
      return await response.json();
    } catch {
      throw new CrHistoryError('unavailable', 'Réponse non JSON');
    }
  }
}

/** Champs utiles d'un épisode (réduit dans la page d'import par shared/adn-import.ts) ; rien du compte (user.id) */
function pickVideo(video: unknown): unknown {
  if (!isRecord(video)) return null;
  const { id, name, shortNumber, season, duration, urlPath, user, show } = video;
  return {
    id,
    name,
    shortNumber,
    season,
    duration,
    urlPath,
    user: isRecord(user) ? { stoptime: user.stoptime, watchDate: user.watchDate, isFullyWatched: user.isFullyWatched } : null,
    show: isRecord(show) ? { id: show.id, title: show.title, urlPath: show.urlPath } : null,
  };
}

/**
 * Lit l'historique page par page (`offset` + 100) jusqu'à une page incomplète ou vide, au plus MAX_ADN_HISTORY_PAGES.
 * `onlyNext` (envoyé à true par le site) n'a rien changé sur un historique de 13 épisodes : envoyé à false, qui demande
 * explicitement tout l'historique. Lève CrHistoryError.
 */
export async function readAdnHistory(deps: AdnReaderDeps, onPage: (pages: number, items: number) => void): Promise<AdnHistoryRead> {
  const videos: unknown[] = [];
  for (let page = 0; page < MAX_ADN_HISTORY_PAGES; page++) {
    const body = await get(deps, `${ADN_HISTORY_URL}?offset=${page * ADN_HISTORY_PAGE_SIZE}&limit=${ADN_HISTORY_PAGE_SIZE}&onlyNext=false`);
    if (!isRecord(body) || !Array.isArray(body.videos)) throw new CrHistoryError('unavailable', 'Page d’historique inattendue');
    videos.push(...body.videos.map(pickVideo));
    onPage(page + 1, videos.length);
    if (body.videos.length < ADN_HISTORY_PAGE_SIZE) return { videos, stats: { items: videos.length, pages: page + 1, partial: false } };
  }
  return { videos, stats: { items: videos.length, pages: MAX_ADN_HISTORY_PAGES, partial: true } };
}

async function read(signal: AbortSignal, post: (message: AdnHistoryPortMessage) => void): Promise<void> {
  try {
    if (!HISTORY_HOST.test(location.hostname)) throw new CrHistoryError('wrong-page');
    // Lu à chaque lecture : le site renouvelle son jeton lui-même
    const headers = adnHeaders(localStorage);
    if (!headers) throw new CrHistoryError('logged-out', 'Jeton absent');
    const result = await readAdnHistory({ fetch: pageFetch(), headers, sleep: (ms) => abortableSleep(ms, signal), signal }, (pages, items) =>
      post({ type: 'progress', pages, items }),
    );
    // Chaîne retirée du bundle publié (budget du script de contenu)
    if (__SYNCKAI_DEBUG__) log.info(`Historique ADN lu : ${result.stats.items} épisodes${result.stats.partial ? ' (partiel)' : ''}`);
    post({ type: 'done', result });
  } catch (error: unknown) {
    if (signal.aborted) return;
    const code = error instanceof CrHistoryError ? error.code : 'unavailable';
    // Jamais le jeton, les en-têtes ni les réponses : le code et notre propre message suffisent
    log.warn(`Lecture de l’historique ADN impossible (${code})`, error instanceof CrHistoryError ? error.message : error instanceof Error ? error.name : '');
    post({ type: 'error', code });
  }
}

/** Port de la page d'import (Réglages › Importer un historique › ADN), voir history-port.ts */
export function listenAdnHistoryPorts(): void {
  listenHistoryPort(ADN_HISTORY_PORT_NAME, isAdnHistoryRequest, read);
}
