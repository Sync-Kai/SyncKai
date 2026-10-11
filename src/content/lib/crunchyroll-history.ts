import { isRecord } from '../../shared/guards';
import { isSeriesSlug, MAX_HISTORY_SEASONS, type CrHistoryErrorCode, type CrHistoryResult, type HistorySeason } from '../../shared/cr-history';
import { cleanText, stripAudioTag } from '../adapters/parsing';

// Lecture de l'historique de visionnage Crunchyroll, DANS l'onglet Crunchyroll de l'utilisateur (même origine :
// la session du site, cookie httpOnly `etp_rt`, sert à demander à Crunchyroll un jeton de courte durée avec
// l'identifiant client public du site). Le jeton reste en mémoire le temps de la lecture : jamais stocké, jamais
// journalisé, jamais transmis au service worker. Erreurs passagères (coupure, 429, 5xx) : nouvelles tentatives.
// API vérifiée le 2026-10-08 (voir la structure des réponses dans les parseurs ci-dessous).

/**
 * Identifiant client PUBLIC du site web Crunchyroll (aucun secret : il figure dans le code du site). L'import demande
 * avec lui un jeton temporaire à Crunchyroll, comme le site. Il peut changer : le jeton est alors refusé et l'import
 * affiche « indisponible » ; la synchro en direct (lecture de la page) n'en dépend pas. Mise à jour : docs/STORE.md.
 */
export const CR_WEB_CLIENT_ID = 'noaihdevm_6iyg0a8l0q';

const TOKEN_PATH = '/auth/v1/token';
export const HISTORY_PAGE_SIZE = 100;
/** Garde-fou : 100 pages = 10 000 épisodes ; au-delà l'historique est déclaré partiel */
export const MAX_HISTORY_PAGES = 100;
/** Espacement entre deux requêtes à Crunchyroll */
export const REQUEST_GAP_MS = 300;
/** Marge avant l'expiration du jeton (5 min) : renouvelé avant de servir une requête */
const TOKEN_MARGIN_MS = 30_000;
/**
 * Attentes avant de renvoyer une requête après une erreur passagère (coupure réseau, 429, 5xx) : la longueur fixe le
 * nombre de nouvelles tentatives. Un 429 attend au moins son Retry-After (plafonné à MAX_RETRY_AFTER_MS).
 */
export const RETRY_DELAYS_MS: readonly number[] = [2_000, 5_000, 15_000];
const MAX_RETRY_AFTER_MS = 60_000;
/** Statuts passagers : nouvelle tentative avant de conclure */
const TRANSIENT_STATUSES: ReadonlySet<number> = new Set([429, 500, 502, 503, 504]);
/**
 * Recherches de saison en échec passager (réseau, refus) d'affilée au-delà desquelles la lecture s'arrête : une saison
 * isolée en échec devient « position inconnue » (à vérifier), une panne durable n'est pas subie saison après saison.
 */
export const MAX_LOOKUP_FAILURES_IN_A_ROW = 3;

export class CrHistoryError extends Error {
  readonly code: CrHistoryErrorCode;
  constructor(code: CrHistoryErrorCode, message: string = code) {
    super(message);
    this.code = code;
  }
}

/** Requête HTTP (fetch de la page, injectable pour les tests) */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface ReaderDeps {
  fetch: FetchLike;
  /** Origine de l'onglet (https://www.crunchyroll.com) : seules les URL de cette origine sont suivies */
  origin: string;
  /** Langue des titres (fr-FR, en-US…) */
  locale: string;
  /** Identifiant d'appareil de cette lecture (aléatoire, non conservé) */
  deviceId: string;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  signal: AbortSignal;
}

// ─── Jeton ────────────────────────────────────────────────────────────────

export interface CrToken {
  accessToken: string;
  accountId: string;
  expiresAt: number;
}

/** Réponse de /auth/v1/token : { access_token (JWT), expires_in: 300, account_id } */
export function parseTokenResponse(value: unknown, now: number): CrToken | null {
  if (!isRecord(value) || typeof value.access_token !== 'string' || value.access_token.length === 0) return null;
  if (typeof value.account_id !== 'string' || !/^[A-Za-z0-9-]{1,64}$/.test(value.account_id)) return null;
  const expiresIn = typeof value.expires_in === 'number' && value.expires_in > 0 ? value.expires_in : 300;
  return { accessToken: value.access_token, accountId: value.account_id, expiresAt: now + expiresIn * 1000 };
}

/**
 * Refus du jeton → cause. Seules les erreurs de session explicites (`invalid_grant` : cookie de session absent ou
 * expiré, ou 401 sans autre motif) signifient « déconnecté ». Client refusé (identifiant changé) ou tout autre 400
 * (`invalid_request`…) : import indisponible, l'utilisateur ne peut rien y faire.
 */
export function tokenFailureCode(status: number, body: unknown): CrHistoryErrorCode {
  const error = isRecord(body) && typeof body.error === 'string' ? body.error : '';
  if (error === 'invalid_client' || error === 'unauthorized_client') return 'unavailable';
  if (error === 'invalid_grant' || status === 401) return 'logged-out';
  return status === 403 || status === 429 ? 'blocked' : 'unavailable';
}

/** Retry-After (secondes ou date HTTP) → attente en ms, null si absent ou illisible */
export function retryAfterMs(value: string | null, now: number): number | null {
  if (value === null || value.trim() === '') return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now) : null;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/** Client de l'API Crunchyroll : espacement des requêtes, jeton renouvelé avant expiration et sur 401 (une fois) */
export interface CrClient {
  get(path: string): Promise<unknown>;
  accountId(): Promise<string>;
}

export function createCrClient(deps: ReaderDeps): CrClient {
  let token: CrToken | null = null;
  let lastRequestAt = 0;

  async function paced<T>(run: () => Promise<T>): Promise<T> {
    if (deps.signal.aborted) throw new DOMException('Lecture abandonnée', 'AbortError');
    await deps.sleep(Math.max(0, lastRequestAt + REQUEST_GAP_MS - deps.now()));
    lastRequestAt = deps.now();
    try {
      return await run();
    } catch (error: unknown) {
      if (error instanceof CrHistoryError || deps.signal.aborted) throw error;
      throw new CrHistoryError('network');
    }
  }

  /**
   * Requête espacée, renvoyée après une erreur passagère (coupure, 429, 5xx) avec des attentes croissantes. Après la
   * dernière tentative : la coupure lève 'network', le statut passager est rendu à l'appelant qui le classe.
   */
  async function send(run: () => Promise<Response>): Promise<Response> {
    for (let attempt = 0; ; attempt++) {
      const last = attempt >= RETRY_DELAYS_MS.length;
      let response: Response | null = null;
      try {
        response = await paced(run);
      } catch (error: unknown) {
        if (last || !(error instanceof CrHistoryError) || error.code !== 'network') throw error;
      }
      if (response !== null && (last || !TRANSIENT_STATUSES.has(response.status))) return response;
      const delay = RETRY_DELAYS_MS[attempt] ?? 0;
      const asked = response?.status === 429 ? retryAfterMs(response.headers.get('Retry-After'), deps.now()) : null;
      await deps.sleep(asked === null ? delay : Math.min(MAX_RETRY_AFTER_MS, Math.max(delay, asked)));
    }
  }

  async function refreshToken(): Promise<CrToken> {
    const response = await send(() =>
      deps.fetch(`${deps.origin}${TOKEN_PATH}`, {
        method: 'POST',
        credentials: 'include',
        headers: { Authorization: `Basic ${btoa(`${CR_WEB_CLIENT_ID}:`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'etp_rt_cookie', device_id: deps.deviceId, device_type: 'SyncKai' }).toString(),
        signal: deps.signal,
      }),
    );
    const body = await readJson(response);
    if (!response.ok) throw new CrHistoryError(tokenFailureCode(response.status, body));
    const parsed = parseTokenResponse(body, deps.now());
    if (!parsed) throw new CrHistoryError('unavailable', 'Réponse de jeton inattendue');
    token = parsed;
    return parsed;
  }

  async function validToken(): Promise<CrToken> {
    return token && token.expiresAt - TOKEN_MARGIN_MS > deps.now() ? token : refreshToken();
  }

  async function get(path: string, isRetry = false): Promise<unknown> {
    const { accessToken } = await validToken();
    const response = await send(() =>
      deps.fetch(`${deps.origin}${path}`, { credentials: 'include', headers: { Authorization: `Bearer ${accessToken}` }, signal: deps.signal }),
    );
    if (response.status === 401 && !isRetry) {
      // Jeton expiré entre-temps : un seul renouvellement
      token = null;
      return get(path, true);
    }
    if (response.status === 401) throw new CrHistoryError('logged-out');
    // 429 encore là après les nouvelles tentatives, ou refus (403) : Crunchyroll limite les requêtes
    if (response.status === 403 || response.status === 429) throw new CrHistoryError('blocked');
    if (!response.ok) throw new CrHistoryError('unavailable', `HTTP ${response.status}`);
    const body = await readJson(response);
    if (body === null) throw new CrHistoryError('unavailable', 'Réponse non JSON');
    return body;
  }

  return { get: (path) => get(path), accountId: async () => (await validToken()).accountId };
}

// ─── Pages de l'historique (pagination par curseur) ───────────────────────

/**
 * `meta.next_page` : URL relative avec un curseur opaque (`page=`). Seuls les chemins de l'API de la même
 * origine sont suivis ; null en fin d'historique.
 */
export function nextPagePath(meta: unknown, origin: string): string | null {
  const next = isRecord(meta) ? cleanText(meta.next_page) : null;
  if (!next) return null;
  let url: URL;
  try {
    url = new URL(next, origin);
  } catch {
    return null;
  }
  if (url.origin !== origin || !url.pathname.startsWith('/content/v2/')) return null;
  return `${url.pathname}${url.search}`;
}

export interface HistoryPages {
  items: unknown[];
  pages: number;
  partial: boolean;
}

/** Suit `meta.next_page` jusqu'au bout (ou MAX_HISTORY_PAGES). `total` de la réponse = taille de page : ignoré. */
export async function readHistoryPages(client: CrClient, deps: Pick<ReaderDeps, 'origin' | 'locale'>, onPage: (pages: number, items: number) => void): Promise<HistoryPages> {
  const accountId = await client.accountId();
  let path: string | null = `/content/v2/${encodeURIComponent(accountId)}/watch-history?page_size=${HISTORY_PAGE_SIZE}&locale=${encodeURIComponent(deps.locale)}`;
  const items: unknown[] = [];
  let pages = 0;
  while (path !== null) {
    if (pages >= MAX_HISTORY_PAGES) return { items, pages, partial: true };
    const body = await client.get(path);
    if (!isRecord(body) || !Array.isArray(body.data)) throw new CrHistoryError('unavailable', 'Page d’historique inattendue');
    items.push(...body.data);
    pages++;
    onPage(pages, items.length);
    // Page vide : fin de l'historique même si un curseur est encore fourni
    path = body.data.length > 0 ? nextPagePath(body.meta, deps.origin) : null;
  }
  return { items, pages, partial: false };
}

// ─── Éléments d'historique → saisons ──────────────────────────────────────

/** Épisode de l'historique, normalisé (séries uniquement : films et éléments sans fiche ignorés) */
export interface HistoryEpisode {
  episodeId: string;
  seriesId: string;
  seriesTitle: string;
  seriesSlug: string | null;
  seasonId: string;
  seasonNumber: number | null;
  seasonTitle: string | null;
  episodeTitle: string | null;
  /** Numéro affiché ; null pour un spécial (pas de numéro ou numéro décimal) */
  episodeNumber: number | null;
  fullyWatched: boolean;
  /** Position de lecture (secondes) */
  playhead: number;
  durationMs: number | null;
  playedAt: number | null;
}

const ID = /^[A-Za-z0-9_-]{1,40}$/;
const id = (v: unknown): string | null => (typeof v === 'string' && ID.test(v) ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const text = (v: unknown, max = 300): string | null => {
  const value = cleanText(v);
  return value && value.length <= max ? value : null;
};

/**
 * Élément de /watch-history. Structure vérifiée le 2026-10-08 :
 * { parent_type: 'series', fully_watched: false, playhead: 6, date_played: '2026-…',
 *   panel: { id: 'G…', title: '…', episode_metadata: { series_id, series_title, series_slug_title, season_id, season_number,
 *            season_title, episode_number, episode, sequence_number, duration_ms } } }
 */
export function parseHistoryItem(raw: unknown): HistoryEpisode | null {
  if (!isRecord(raw) || raw.parent_type !== 'series' || !isRecord(raw.panel)) return null;
  const panel = raw.panel;
  const meta = panel.episode_metadata;
  if (!isRecord(meta)) return null;
  const episodeId = id(panel.id) ?? id(raw.id);
  const seriesId = id(meta.series_id);
  const seasonId = id(meta.season_id);
  const seriesTitle = text(meta.series_title);
  if (!episodeId || !seriesId || !seasonId || !seriesTitle) return null;
  const seasonNumber = num(meta.season_number);
  const episodeNumber = num(meta.episode_number);
  const seasonTitle = text(meta.season_title);
  // Slug de la série (`series_slug_title`, « one-piece ») ; `panel.slug_title` est celui de l'épisode : ignoré
  const slug = typeof meta.series_slug_title === "string" ? meta.series_slug_title.trim().toLowerCase() : null;
  const played = typeof raw.date_played === 'string' ? Date.parse(raw.date_played) : Number.NaN;
  return {
    episodeId,
    seriesId,
    seriesTitle,
    seriesSlug: isSeriesSlug(slug) ? slug : null,
    seasonId,
    seasonNumber: seasonNumber !== null && Number.isInteger(seasonNumber) && seasonNumber >= 0 ? seasonNumber : null,
    // « Black Butler (English Dub) » → « Black Butler » : la version audio n'est pas une autre saison
    seasonTitle: seasonTitle ? cleanText(stripAudioTag(seasonTitle)) : null,
    episodeTitle: text(panel.title, 500),
    episodeNumber: episodeNumber !== null && Number.isInteger(episodeNumber) && episodeNumber >= 1 ? episodeNumber : null,
    fullyWatched: raw.fully_watched === true,
    playhead: Math.max(0, num(raw.playhead) ?? 0),
    durationMs: (() => {
      const d = num(meta.duration_ms);
      return d !== null && d > 0 ? d : null;
    })(),
    playedAt: Number.isFinite(played) ? played : null,
  };
}

/** Épisode compté comme vu : marqué terminé par Crunchyroll, ou position ≥ seuil de fin réglé dans SyncKai */
export function isWatched(episode: Pick<HistoryEpisode, 'fullyWatched' | 'playhead' | 'durationMs'>, completionPercentage: number): boolean {
  if (episode.fullyWatched) return true;
  if (episode.durationMs === null) return false;
  return (episode.playhead * 1000) / episode.durationMs >= completionPercentage / 100;
}

/** Clé de saison : la série + son numéro de saison (VO et VF d'une même saison ont des season_id différents) */
const seasonKey = (e: Pick<HistoryEpisode, 'seriesId' | 'seasonNumber' | 'seasonId'>): string =>
  e.seasonNumber !== null ? `${e.seriesId}:s${e.seasonNumber}` : `${e.seriesId}:${e.seasonId}`;

export interface ReducedHistory {
  /** seasonEpisodeNumber non établi (null) : voir needsSeasonLookup / relativeEpisodeNumber */
  seasons: HistorySeason[];
  /** Éléments ignorés : films, spéciaux sans numéro, éléments illisibles, épisodes non terminés */
  ignored: number;
}

/**
 * Une ligne par saison : l'épisode vu le plus avancé (numéro affiché le plus grand) et ses métadonnées.
 * Les saisons sans aucun épisode vu sont omises. Tri : visionnage le plus récent d'abord.
 */
export function reduceHistory(rawItems: readonly unknown[], completionPercentage: number): ReducedHistory {
  const bySeason = new Map<string, { best: HistoryEpisode; watched: Set<string>; lastPlayedAt: number | null }>();
  let ignored = 0;
  for (const raw of rawItems) {
    const episode = parseHistoryItem(raw);
    if (!episode || episode.episodeNumber === null || !isWatched(episode, completionPercentage)) {
      ignored++;
      continue;
    }
    const key = seasonKey(episode);
    const entry = bySeason.get(key);
    if (!entry) {
      bySeason.set(key, { best: episode, watched: new Set([episode.episodeId]), lastPlayedAt: episode.playedAt });
      continue;
    }
    entry.watched.add(episode.episodeId);
    if ((episode.episodeNumber ?? 0) > (entry.best.episodeNumber ?? 0)) entry.best = episode;
    if (episode.playedAt !== null && (entry.lastPlayedAt === null || episode.playedAt > entry.lastPlayedAt)) entry.lastPlayedAt = episode.playedAt;
  }
  const seasons = [...bySeason.values()]
    .sort((a, b) => (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0))
    .map(({ best, watched, lastPlayedAt }): HistorySeason => ({
      seriesId: best.seriesId,
      seriesTitle: best.seriesTitle,
      seriesSlug: best.seriesSlug,
      seasonId: best.seasonId,
      seasonNumber: best.seasonNumber,
      seasonTitle: best.seasonTitle,
      episodeId: best.episodeId,
      episodeTitle: best.episodeTitle,
      episodeNumber: best.episodeNumber ?? 1,
      seasonEpisodeNumber: null,
      watchedCount: watched.size,
      lastPlayedAt,
    }));
  return { seasons, ignored };
}

/**
 * Numéro affiché peut-être absolu : Crunchyroll numérote souvent la suite d'une série à partir de la saison
 * précédente (Jujutsu Kaisen S2 E25, One Piece E1180 pour le 25e épisode de la saison 24). Saison > 1 ou
 * numéro au-delà d'un cour double : la liste des épisodes de la saison est lue pour situer l'épisode.
 */
export const ABSOLUTE_NUMBER_HINT = 26;

export function needsSeasonLookup(season: Pick<HistorySeason, 'seasonNumber' | 'episodeNumber'>): boolean {
  return (season.seasonNumber !== null && season.seasonNumber > 1) || season.episodeNumber > ABSOLUTE_NUMBER_HINT;
}

/**
 * Position de l'épisode dans sa saison, d'après /content/v2/cms/seasons/{id}/episodes ({ data: [{ episode_number }] }) :
 * numéro − premier numéro de la suite d'épisodes qui le contient + 1 (spéciaux sans numéro ignorés). La suite
 * tolère quelques numéros manquants (MAX_NUMBER_GAP) mais s'arrête sur un numéro isolé loin en dessous : un spécial
 * numéroté 1 rangé dans une saison numérotée 13 à 23 ne ramène pas l'épisode 23 à la position 23.
 * null si la réponse est inattendue ou si l'épisode n'y figure pas.
 */
export function relativeEpisodeNumber(episodeNumber: number, seasonEpisodes: unknown): number | null {
  if (!isRecord(seasonEpisodes) || !Array.isArray(seasonEpisodes.data)) return null;
  const numbers = new Set(
    seasonEpisodes.data.flatMap((e) => {
      const n = isRecord(e) ? num(e.episode_number) : null;
      return n !== null && Number.isInteger(n) && n >= 1 ? [n] : [];
    }),
  );
  if (!numbers.has(episodeNumber)) return null;
  const lower = [...numbers].filter((n) => n < episodeNumber).sort((a, b) => b - a);
  let start = episodeNumber;
  for (const n of lower) {
    if (start - n > MAX_NUMBER_GAP + 1) break;
    start = n;
  }
  return episodeNumber - start + 1;
}

/** Numéros consécutifs manquants tolérés dans la liste d'une saison (épisode retiré du catalogue) */
const MAX_NUMBER_GAP = 2;

// ─── Lecture complète ─────────────────────────────────────────────────────

export interface ReadProgress {
  pages: number;
  items: number;
  lookups: number;
  lookupsTotal: number;
}

/**
 * Lit l'historique complet, le réduit par saison puis établit la position de l'épisode dans sa saison
 * (lecture de la saison seulement si le numéro affiché peut être absolu). Lève CrHistoryError.
 */
export async function readCrunchyrollHistory(deps: ReaderDeps, completionPercentage: number, onProgress: (progress: ReadProgress) => void): Promise<CrHistoryResult> {
  const client = createCrClient(deps);
  const progress: ReadProgress = { pages: 0, items: 0, lookups: 0, lookupsTotal: 0 };
  const history = await readHistoryPages(client, deps, (pages, items) => onProgress({ ...progress, pages, items }));
  progress.pages = history.pages;
  progress.items = history.items.length;

  const reduced = reduceHistory(history.items, completionPercentage);
  const truncated = reduced.seasons.length > MAX_HISTORY_SEASONS;
  const seasons = reduced.seasons.slice(0, MAX_HISTORY_SEASONS);
  const lookups = seasons.filter(needsSeasonLookup);
  progress.lookupsTotal = lookups.length;
  onProgress({ ...progress });

  // Une requête par saison (VO / VF d'une même saison partagent la numérotation) ; saisons déjà lues mémorisées
  const seasonEpisodes = new Map<string, unknown>();
  let failuresInARow = 0;
  for (const season of seasons) {
    if (!needsSeasonLookup(season)) {
      season.seasonEpisodeNumber = season.episodeNumber;
      continue;
    }
    let episodes = seasonEpisodes.get(season.seasonId);
    if (episodes === undefined) {
      try {
        episodes = await client.get(`/content/v2/cms/seasons/${encodeURIComponent(season.seasonId)}/episodes?locale=${encodeURIComponent(deps.locale)}`);
        failuresInARow = 0;
      } catch (error: unknown) {
        // Lecture abandonnée, session perdue ou erreur imprévue : arrêt
        if (deps.signal.aborted || !(error instanceof CrHistoryError) || error.code === 'logged-out') throw error;
        // Échec passager persistant (réseau, refus) : position inconnue → à vérifier, sauf panne durable (plusieurs
        // saisons d'affilée). Saison introuvable (retirée du catalogue) : position inconnue, sans compter d'échec.
        failuresInARow = error.code === 'unavailable' ? 0 : failuresInARow + 1;
        if (failuresInARow >= MAX_LOOKUP_FAILURES_IN_A_ROW) throw error;
        episodes = null;
      }
      seasonEpisodes.set(season.seasonId, episodes);
    }
    season.seasonEpisodeNumber = relativeEpisodeNumber(season.episodeNumber, episodes);
    progress.lookups++;
    onProgress({ ...progress });
  }
  return { seasons, stats: { items: history.items.length, pages: history.pages, partial: history.partial || truncated } };
}

// ─── Contexte de la page ──────────────────────────────────────────────────

declare global {
  // Firefox : `content.fetch` exécute la requête au nom de la page (cookies et origine du site)
  var content: { fetch?: typeof fetch } | undefined;
}

/** fetch de la page : `content.fetch` sur Firefox, sinon fetch du script de contenu (origine de la page sur Chrome) */
export function pageFetch(): FetchLike {
  const scoped = globalThis.content;
  if (scoped && typeof scoped.fetch === 'function') {
    const contentFetch = scoped.fetch;
    return (input, init) => contentFetch.call(scoped, input, init);
  }
  return (input, init) => window.fetch(input, init);
}

/** Langue des titres : celle de la page Crunchyroll (`<html lang>`), au format attendu par l'API */
export function pageLocale(lang: string | null | undefined): string {
  const value = (lang ?? '').trim();
  if (/^[a-z]{2}-[A-Za-z0-9]{2,3}$/.test(value)) {
    const [base, region] = value.split('-');
    return `${base}-${/^\d+$/.test(region ?? '') ? region : (region ?? '').toUpperCase()}`;
  }
  const defaults: Record<string, string> = { fr: 'fr-FR', de: 'de-DE', en: 'en-US', es: 'es-419', pt: 'pt-BR', it: 'it-IT', ru: 'ru-RU', ar: 'ar-SA' };
  return defaults[value.slice(0, 2).toLowerCase()] ?? 'en-US';
}
