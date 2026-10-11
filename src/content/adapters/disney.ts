import { DISNEY_ARC_SEASON, type EpisodeInfo } from '../../shared/episode.types';
import { createLogger } from '../../shared/logger';
import { createDisneyBridgeClient, type DisneyBridgeClient } from '../disney/bridge-client';
import { hasDisneyId, type DisneyPlayerExperience } from '../disney/bridge-protocol';
import type { PlaybackTime, StreamingAdapter } from './adapter';

const log = createLogger('disney');

/**
 * Page de lecture : /{langue}/play/{id} (langue facultative et variable : fr-fr, en-us, de-de, es-419…). `id` est
 * l'identifiant de l'ÉPISODE (deeplinkId), pas l'`availId` de la réponse playerExperience. Vérifié le 2026-10-11 :
 * /fr-fr/play/539f8e74-65f6-4c6e-a689-c91d125b6c61?contextId=… (availId eaccaafa-…).
 */
const PLAY_PATH_REGEX = /^\/(?:[a-z]{2,3}(?:-[a-z0-9]{2,4})?\/)?play\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i;

const SELECTORS = {
  /**
   * Lecteur actuel de Disney+ (relevé le 2026-10-11 : `video.hive-video`, en lecture, durée Infinity). La page garde
   * aussi une `video.btm-media-client-element` inactive (en pause, durée NaN, sans image) : jamais retenue d'office.
   */
  hiveVideo: 'video.hive-video',
  /** Autres lecteurs connus, candidats parmi toutes les <video> */
  playerVideo: '#hivePlayer video, video#hivePlayer, video.btm-media-client-element',
  /** Hôte (Shadow DOM ouvert) de la barre de progression */
  progressHost: 'progress-bar',
  /** Plage de la barre : aria-valuenow (s écoulées), aria-valuemax (durée en s) */
  progressRange: '.progress-bar__seekable-range',
} as const;

export function parseDisneyPlayId(pathname: string): string | null {
  return PLAY_PATH_REGEX.exec(pathname)?.[1]?.toLowerCase() ?? null;
}

const playUrl = (urlId: string): string => `https://www.disneyplus.com/play/${urlId}`;

// ─── Titre interne et sous-titre ──────────────────────────────────────────

export type DisneyInternalTitle = { kind: 'episode'; series: string; season: number; episode: number } | { kind: 'movie'; title: string };

/**
 * « Undead Unluck - s1e1 - mediaId:{uuid} » → série (anglais, quelle que soit la langue du profil), saison, épisode.
 * Ancré sur la fin : le titre de la série peut lui-même contenir « - » (« Disney Twisted-Wonderland: The Animation -
 * Episode of Heartslabyul »). Sans « sNeN » : film (« Suzume - mediaId:{uuid} »).
 */
const INTERNAL_EPISODE = /^(.+?)\s+-\s+s(\d{1,3})e(\d{1,4})\s+-\s+mediaId:[0-9a-f-]{36}$/i;
const INTERNAL_MOVIE = /^(.+?)\s+-\s+mediaId:[0-9a-f-]{36}$/i;
const EPISODE_CODE = /(?:^|\s)s\d{1,3}e\d{1,4}(?:\s|$)/i;

export function parseInternalTitle(internalTitle: string | null): DisneyInternalTitle | null {
  if (!internalTitle) return null;
  const episode = INTERNAL_EPISODE.exec(internalTitle);
  if (episode) {
    const [, series = '', season, number] = episode;
    const title = series.trim();
    return title ? { kind: 'episode', series: title, season: Number(season), episode: Number(number) } : null;
  }
  // Repère « sNeN » présent mais forme illisible : ni épisode ni film
  if (EPISODE_CODE.test(internalTitle)) return null;
  const title = INTERNAL_MOVIE.exec(internalTitle)?.[1]?.trim();
  return title ? { kind: 'movie', title } : null;
}

/**
 * Repère d'épisode du sous-titre localisé : « S1:E1 Titre », « Undead Unluck: Winter Arc : E1 Titre » (fr : espace
 * avant les deux-points), « …: F1 … » (lettre propre à la langue). Seul le repère portant le numéro de l'épisode compte.
 */
const EPISODE_MARKER = /\s*:\s*\p{L}{1,3}\s?(\d{1,4})(?=\s|$)/gu;

function episodeMarker(subtitle: string, episode: number): { start: number; end: number } | null {
  for (const match of subtitle.matchAll(EPISODE_MARKER)) {
    if (Number(match[1]) === episode) return { start: match.index, end: match.index + match[0].length };
  }
  return null;
}

/** Arc (saison 99) : texte avant le repère d'épisode (« Undead Unluck: Winter Arc : E1 … » → « Undead Unluck: Winter Arc ») */
export function arcTitleFromSubtitle(subtitle: string | null, episode: number): string | null {
  if (!subtitle) return null;
  const marker = episodeMarker(subtitle, episode);
  const arc = marker ? subtitle.slice(0, marker.start).trim() : '';
  return arc.length >= 2 ? arc : null;
}

/** Titre de l'épisode (localisé, affichage seulement) : texte après le repère (« S1:E1 Undead et Unluck » → « Undead et Unluck ») */
export function episodeTitleFromSubtitle(subtitle: string | null, episode: number): string | null {
  if (!subtitle) return null;
  const marker = episodeMarker(subtitle, episode);
  const title = marker ? subtitle.slice(marker.end).trim() : '';
  return title || null;
}

/** Filtre « anime » : langue originale japonaise uniquement (le reste du catalogue est ignoré en silence) */
export function isJapaneseOriginal(entry: Pick<DisneyPlayerExperience, 'originalLanguage'>): boolean {
  return entry.originalLanguage !== null && /^ja(?:-|$)/i.test(entry.originalLanguage);
}

/**
 * Épisode de l'URL `urlId` correspondant à la fiche `playerExperience` (identifiant de l'épisode = celui de l'URL), null si
 * ce n'est pas un anime (langue originale non japonaise), si la fiche ne porte pas cet identifiant (voir le repli du
 * client du pont, qui l'y ajoute), ou si son titre interne est illisible. Numérotation de Disney+ par saison
 * (S2:E1 = premier épisode de la saison 2) : `displayedEpisodeNumber` = numéro dans la saison.
 * Saison 99 : arc publié dans la série (« Undead Unluck: Winter Arc »), titre de l'arc en `seasonTitle` (fiche AniList
 * distincte, clé de correspondance par arc) ; arc illisible : saison spéciale (0).
 * Film : saison inconnue, épisode 1, comme sur Netflix.
 */
export function episodeInfoFromPlayerExperience(entry: DisneyPlayerExperience, urlId: string): EpisodeInfo | null {
  if (!hasDisneyId(entry, urlId) || !isJapaneseOriginal(entry)) return null;
  const parsed = parseInternalTitle(entry.internalTitle);
  if (!parsed) return null;
  const episodeId = urlId.toLowerCase();
  const base = { platform: 'disney', episodeId, seriesId: null, seriesSlug: null, url: playUrl(episodeId) } as const;

  if (parsed.kind === 'movie') {
    if (entry.programType !== 'movie') return null;
    return { ...base, animeTitle: parsed.title, seasonNumber: null, seasonTitle: null, seasonEpisodeNumber: 1, displayedEpisodeNumber: 1, episodeTitle: null };
  }

  const { series, season, episode } = parsed;
  const arc = season === DISNEY_ARC_SEASON ? arcTitleFromSubtitle(entry.subtitle, episode) : null;
  return {
    ...base,
    animeTitle: series,
    seasonNumber: season === DISNEY_ARC_SEASON ? (arc ? DISNEY_ARC_SEASON : 0) : season,
    seasonTitle: arc,
    seasonEpisodeNumber: episode,
    displayedEpisodeNumber: episode,
    episodeTitle: episodeTitleFromSubtitle(entry.subtitle, episode),
  };
}

// ─── Lecteur ──────────────────────────────────────────────────────────────

/** Propriétés d'une <video> lues pour choisir le lecteur */
export type VideoCandidate = Pick<HTMLVideoElement, 'paused' | 'readyState' | 'videoWidth'>;

/** <video> réellement en lecture (pas en pause, image disponible), sinon qui affiche une image, sinon null */
export function pickPlayingVideo<V extends VideoCandidate>(candidates: readonly V[]): V | null {
  return candidates.find((video) => !video.paused && video.readyState >= 2) ?? candidates.find((video) => video.videoWidth > 0) ?? null;
}

/**
 * Lecteur de la page : `video.hive-video` d'abord, puis la <video> en lecture parmi les lecteurs connus et toutes les
 * <video> de la page, puis le premier lecteur connu ou la première <video>.
 */
export function chooseDisneyVideo(root: Pick<ParentNode, 'querySelector' | 'querySelectorAll'>): HTMLVideoElement | null {
  const hive = root.querySelector<HTMLVideoElement>(SELECTORS.hiveVideo);
  if (hive) return hive;
  const candidates = [...new Set([...root.querySelectorAll<HTMLVideoElement>(SELECTORS.playerVideo), ...root.querySelectorAll<HTMLVideoElement>('video')])];
  return pickPlayingVideo(candidates) ?? candidates[0] ?? null;
}

// ─── Position de lecture (barre de progression du lecteur) ────────────────

/** Valeurs ARIA de la plage de la barre de progression : position (s) et durée (s), null si illisibles */
export function readProgressRange(range: Pick<Element, 'getAttribute'> | null): { now: number; max: number | null } | null {
  if (!range) return null;
  const number = (name: string): number | null => {
    const raw = range.getAttribute(name);
    const value = raw === null || raw.trim() === '' ? Number.NaN : Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : null;
  };
  const now = number('aria-valuenow');
  const max = number('aria-valuemax');
  if (now === null) return null;
  return { now, max: max !== null && max > 0 ? max : null };
}

/** Hôte d'un Shadow DOM ouvert, cherché dans le document puis dans les Shadow DOM ouverts (parcours borné) */
function findShadowHost(selector: string, maxNodes = 5_000): Element | null {
  const direct = document.querySelector(selector);
  if (direct) return direct;
  const roots: ShadowRoot[] = [];
  let visited = 0;
  for (const element of document.querySelectorAll('*')) {
    if (++visited > maxNodes) break;
    if (element.shadowRoot) roots.push(element.shadowRoot);
  }
  for (let root = roots.shift(); root !== undefined; root = roots.shift()) {
    const found = root.querySelector(selector);
    if (found) return found;
    for (const element of root.querySelectorAll('*')) {
      if (++visited > maxNodes) return null;
      if (element.shadowRoot) roots.push(element.shadowRoot);
    }
  }
  return null;
}

/** Intervalle entre deux recherches de la barre tant qu'elle est introuvable (lecteur pas encore monté) : 1 s, doublé jusqu'à 8 s */
const PROGRESS_SEARCH_MIN_MS = 1_000;
const PROGRESS_SEARCH_MAX_MS = 8_000;

/** Vidéo lue par le lecteur de position */
export interface ProgressContext {
  /** Vidéo affichée (identifiant de l'URL) : l'ancre et les valeurs de la barre ne valent que pour elle */
  key: string | null;
  /** Durée de la fiche (s), repli de la barre */
  fallbackDuration: number | null;
}

/**
 * Position de lecture de Disney+ : la <video> n'a pas de durée (Infinity/NaN). La barre de progression du lecteur
 * (Shadow DOM ouvert, `progress-bar`) donne position et durée ; la durée de la fiche (`runtimeMs`) sert de repli.
 * Si la barre se fige (commandes masquées) ou disparaît, la position avance du temps écoulé sur la <video> depuis la
 * dernière valeur lue (ancre). Sans barre ni ancre : inconnue (la position de la <video> n'est pas celle du
 * programme, elle peut continuer celle de l'épisode précédent). Après un changement de vidéo (lecture automatique),
 * une barre restée sur les valeurs de la vidéo précédente est ignorée jusqu'à ce qu'elle bouge : elle déclencherait
 * sinon la fin du nouvel épisode.
 */
export function createProgressReader(
  findHost: () => Element | null,
  now: () => number = Date.now,
  onHostChange: (found: boolean) => void = () => undefined,
): (video: HTMLVideoElement, context: ProgressContext) => PlaybackTime | null {
  let host: Element | null = null;
  let nextSearch = Number.NEGATIVE_INFINITY;
  let failures = 0;
  /** Dernière valeur retenue de la barre, et la vidéo à laquelle elle appartient */
  let lastBar: { key: string | null; now: number; max: number | null } | null = null;
  /** Dernière position retenue, avec la position de la <video> et la durée à cet instant */
  let anchor: { video: HTMLVideoElement; key: string | null; position: number; videoTime: number | null; duration: number } | null = null;

  const range = (): Element | null => {
    if (!host?.isConnected) {
      host = null;
      if (now() < nextSearch) return null;
      host = findHost();
      // Diagnostic : barre trouvée, ou introuvable à la première recherche d'une série d'échecs
      if (host || failures === 0) onHostChange(host !== null);
      // Introuvable : recherches espacées (parcours des Shadow DOM) ; hôte retiré après avoir été trouvé : recherche immédiate
      if (host) failures = 0;
      nextSearch = host ? Number.NEGATIVE_INFINITY : now() + Math.min(PROGRESS_SEARCH_MIN_MS * 2 ** failures++, PROGRESS_SEARCH_MAX_MS);
    }
    return host?.shadowRoot?.querySelector(SELECTORS.progressRange) ?? null;
  };

  /** Valeurs de la barre pour la vidéo `key`, null si absentes ou encore celles de la vidéo précédente */
  const readBar = (key: string | null): { now: number; max: number | null } | null => {
    const bar = readProgressRange(range());
    if (!bar) return null;
    if (lastBar && lastBar.key !== key && lastBar.now === bar.now && lastBar.max === bar.max) return null;
    lastBar = { key, ...bar };
    return bar;
  };

  return (video, { key, fallbackDuration }) => {
    const bar = readBar(key);
    const current = anchor?.video === video && anchor.key === key ? anchor : null;
    const duration = bar?.max ?? fallbackDuration ?? current?.duration ?? null;
    if (duration === null || !(duration > 0)) return null;
    const videoTime = Number.isFinite(video.currentTime) ? video.currentTime : null;
    if (bar && current?.position !== bar.now) {
      anchor = { video, key, position: bar.now, videoTime, duration };
      return { currentTime: Math.min(bar.now, duration), duration };
    }
    if (current) {
      // Barre figée ou absente : avance de la <video> depuis l'ancre (jamais en arrière, bornée à la durée)
      const elapsed = videoTime !== null && current.videoTime !== null ? Math.max(0, videoTime - current.videoTime) : 0;
      return { currentTime: Math.min(current.position + elapsed, duration), duration };
    }
    return null;
  };
}

// ─── Adapter ──────────────────────────────────────────────────────────────

/**
 * Avance prise sur le changement d'URL pour dater les fiches qui lui appartiennent : le site peut demander la fiche de
 * l'épisode un peu avant de changer l'URL.
 */
const URL_CHANGE_MARGIN_MS = 2_000;
/** Identifiants d'URL retenus (date du premier passage) au plus */
const MAX_SEEN_URLS = 20;

/** Créés à la première utilisation : le module est aussi importé hors navigateur (tests) */
let client: DisneyBridgeClient | null = null;
function bridge(): DisneyBridgeClient {
  client ??= createDisneyBridgeClient({ target: document, messages: window, origin: location.origin, log: (message) => log.debug(message) });
  return client;
}

/**
 * Date du changement d'URL vers `urlId` (premier passage), pour le repli du pont (seule fiche reçue depuis). Premier
 * identifiant de la page : 0, toutes les fiches vues par le pont appartiennent à la page.
 */
const urlSeenAt = new Map<string, number>();
function urlChangedAt(urlId: string): number {
  const known = urlSeenAt.get(urlId);
  if (known !== undefined) return known;
  const at = urlSeenAt.size === 0 ? 0 : Date.now() - URL_CHANGE_MARGIN_MS;
  urlSeenAt.set(urlId, at);
  if (urlSeenAt.size > MAX_SEEN_URLS) urlSeenAt.delete(urlSeenAt.keys().next().value ?? urlId);
  return at;
}

let progressReader: ReturnType<typeof createProgressReader> | null = null;

/** Vidéo affichée et durée de sa fiche (s), repli de la barre de progression */
function currentProgressContext(): ProgressContext {
  const urlId = parseDisneyPlayId(location.pathname);
  const runtimeMs = urlId ? (bridge().peek(urlId)?.runtimeMs ?? null) : null;
  return { key: urlId, fallbackDuration: runtimeMs !== null ? runtimeMs / 1000 : null };
}

/**
 * Diagnostic de la barre de progression : « trouvée » et « introuvable » journalisés une fois chacun par épisode (la barre
 * apparaît et disparaît avec les commandes du lecteur).
 */
let hostReports: { key: string | null; seen: Set<boolean> } = { key: null, seen: new Set() };
function reportProgressHost(found: boolean): void {
  const key = parseDisneyPlayId(location.pathname);
  if (hostReports.key !== key) hostReports = { key, seen: new Set() };
  if (hostReports.seen.has(found)) return;
  hostReports.seen.add(found);
  log.debug(found ? 'Barre de progression du lecteur trouvée' : 'Barre de progression du lecteur introuvable pour l’instant');
}

/** Dernier lecteur signalé (diagnostic : « trouvé » / « introuvable » journalisé à chaque changement) */
let reportedVideo: HTMLVideoElement | null | undefined;

export const disneyAdapter: StreamingAdapter = {
  platform: 'disney',
  // Catalogue généraliste : pas de toast pour une vidéo qui n'est probablement pas un anime
  quiet: true,

  supportsHost(hostname) {
    return hostname === 'disneyplus.com' || hostname.endsWith('.disneyplus.com');
  },

  getEpisodeId(url) {
    const urlId = parseDisneyPlayId(url.pathname);
    if (urlId) urlChangedAt(urlId);
    return urlId;
  },

  // Synchrone : lecture du cache rempli par le pont (aucune métadonnée fiable dans le DOM de Disney+)
  extractEpisodeInfo(url) {
    const urlId = parseDisneyPlayId(url.pathname);
    const entry = urlId ? bridge().peek(urlId) : null;
    return urlId && entry ? episodeInfoFromPlayerExperience(entry, urlId) : null;
  },

  async loadEpisodeInfo(episodeId, signal) {
    log.debug(`Page de lecture Disney+ : identifiant de l’URL ${episodeId}`);
    const entry = await bridge().load(episodeId, signal, urlChangedAt(episodeId));
    if (!entry) {
      // Onglet ouvert avant l'activation ou la mise à jour : la requête du site a précédé le pont (épisode suivant suivi)
      if (!signal.aborted) log.debug(`Aucune fiche Disney+ pour ${episodeId} : vidéo non suivie`);
      return null;
    }
    // Pas un anime, ou titre interne illisible : rien de journalisé hors debug (catalogue généraliste)
    const episode = episodeInfoFromPlayerExperience(entry, episodeId);
    if (episode) log.debug(`Anime retenu (langue originale ${entry.originalLanguage ?? '?'}) : « ${episode.animeTitle} » S${episode.seasonNumber ?? '?'} E${episode.seasonEpisodeNumber ?? '?'}`);
    else if (!isJapaneseOriginal(entry)) log.debug(`Pas un anime (langue originale ${entry.originalLanguage ?? 'inconnue'}) : vidéo ${episodeId} ignorée`);
    else log.debug(`Titre interne illisible (« ${entry.internalTitle ?? ''} », ${entry.programType ?? '?'}) : vidéo ${episodeId} non suivie`);
    return episode;
  },

  // Pages de série Disney+ (/browse/entity-…) non gérées : Disney+ reste limité aux pages de lecture
  detectSeries() {
    return null;
  },

  findVideo() {
    const video = chooseDisneyVideo(document);
    if (video !== reportedVideo) {
      reportedVideo = video;
      log.debug(
        video
          ? `Lecteur vidéo retenu (${video.className || video.id || 'sans classe'}, ${video.paused ? 'en pause' : 'en lecture'}, ${video.videoWidth} px)`
          : 'Lecteur vidéo introuvable pour l’instant',
      );
    }
    return video;
  },

  readPlayback(video) {
    progressReader ??= createProgressReader(() => findShadowHost(SELECTORS.progressHost), Date.now, reportProgressHost);
    return progressReader(video, currentProgressContext());
  },

  // Aucun début de générique dans les métadonnées de Disney+ : complétion au seuil de repli (getCreditsStart absent)
};
