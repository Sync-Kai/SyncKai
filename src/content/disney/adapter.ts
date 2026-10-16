import { DISNEY_ARC_SEASON, type EpisodeInfo } from '../../shared/episode.types';
import { createLogger } from '../../browser/logger';
import { medianMinutes, toPlatformSignals, withSignals, type PlatformFormat, type PlatformSignals } from '../../shared/match-signals';
import { domainOrSubdomain } from '../../shared/hosts';
import { lazy, pageEndpoints } from '../bridge/client-kit';
import type { SeriesPageInfo } from '../../shared/page-media.types';
import { createDisneyBridgeClient, type DisneyBridgeClient } from './bridge-client';
import {
  hasDisneyId,
  parseInternalTitle,
  type DisneyPlayerExperience,
  type DisneySeason,
  type DisneySeriesPage,
} from '../../platforms/disney/metadata';
import { watchElementText } from '../lib/season-watch';
import type { PlaybackTime, StreamingAdapter } from '../lib/adapter';
import { meaningfulSeasonTitle } from '../lib/parsing';

export { parseInternalTitle, type DisneyInternalTitle } from '../../platforms/disney/metadata';

const log = createLogger('disney');

/**
 * Page de lecture : /{langue}/play/{id} (langue facultative et variable : fr-fr, en-us, de-de, es-419…). `id` est
 * l'identifiant de l'ÉPISODE (deeplinkId), pas l'`availId` de la réponse playerExperience. Vérifié le 2026-10-11 :
 * /fr-fr/play/539f8e74-65f6-4c6e-a689-c91d125b6c61?contextId=… (availId eaccaafa-…).
 */
const PLAY_PATH_REGEX = /^\/(?:[a-z]{2,3}(?:-[a-z0-9]{2,4})?\/)?play\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i;
/** Page de série : /{langue}/browse/entity-{uuid} (langue facultative). Relevé le 2026-10-11 : /fr-fr/browse/entity-9a14d04d-… */
const ENTITY_PATH_REGEX = /^\/(?:[a-z]{2,3}(?:-[a-z0-9]{2,4})?\/)?browse\/entity-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i;

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
  /**
   * Bouton du menu des saisons d'une page de série, dans le DOM de la page (relevé le 2026-10-11 sur Undead Unluck, arc
   * choisi) : `<button data-testid="dropdown-button" aria-haspopup="listbox">Undead Unluck: Winter Arc</button>`. Son
   * texte est le nom de la saison choisie (`visuals.name` de la réponse de la page).
   */
  seasonButton: 'button[data-testid="dropdown-button"][aria-haspopup="listbox"]',
  /** Repli si ce bouton change : élément ouvrant une liste ou un menu (retenu seulement s'il est visible et sans ambiguïté) */
  seasonToggle: 'button[aria-haspopup], [role="combobox"]',
} as const;

export function parseDisneyPlayId(pathname: string): string | null {
  return PLAY_PATH_REGEX.exec(pathname)?.[1]?.toLowerCase() ?? null;
}

/** uuid de l'entité d'une page de série /browse/entity-{uuid} (minuscules), sinon null */
export function parseDisneyEntityId(pathname: string): string | null {
  return ENTITY_PATH_REGEX.exec(pathname)?.[1]?.toLowerCase() ?? null;
}

const playUrl = (urlId: string): string => `https://www.disneyplus.com/play/${urlId}`;

// ─── Sous-titre ───────────────────────────────────────────────────────────

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

/** Libellé comparable : casse, espaces multiples et espace avant les deux-points (typographie française) ignorés */
const labelKey = (text: string): string => text.replace(/\s+/g, ' ').replace(/ :/g, ':').trim().toLowerCase();

/** Titre anglais de la série d'une page (titre interne de ses épisodes), null sans titre interne lisible */
function englishTitleOf(page: DisneySeriesPage): string | null {
  const internal = parseInternalTitle(page.internalTitle);
  return internal ? (internal.kind === 'episode' ? internal.series : internal.title) : null;
}

/** Format d'après `programType` (épisode → série, film → film), undefined sinon */
const formatOf = (programType: string | null): PlatformFormat | undefined => (programType === 'movie' ? 'movie' : programType === 'episode' ? 'series' : undefined);

/**
 * Signaux d'une page de lecture : format et durée de la fiche, et, si la page de série de la même série (titre anglais)
 * a été vue dans l'onglet, année de début de la série et nombre d'épisodes de la saison (arc : par son nom).
 */
export function playbackSignals(entry: DisneyPlayerExperience, title: string, season: number | null, arc: string | null, pages: readonly DisneySeriesPage[]): PlatformSignals | undefined {
  const page = pages.findLast((known) => englishTitleOf(known)?.toLowerCase() === title.toLowerCase());
  const shown = arc !== null ? page?.seasons.find((s) => s.name !== null && labelKey(s.name) === labelKey(arc)) : page?.seasons.find((s) => season !== null && s.seasonNumber === season);
  return toPlatformSignals({
    seriesYear: page?.startYear,
    seasonEpisodeCount: shown?.episodeCount,
    episodeMinutes: medianMinutes([entry.runtimeMs === null ? null : entry.runtimeMs / 1000]),
    format: formatOf(entry.programType),
  });
}

/**
 * Épisode de l'URL `urlId` correspondant à la fiche `playerExperience` (identifiant de l'épisode = celui de l'URL), null si
 * ce n'est pas un anime (langue originale non japonaise), si la fiche ne porte pas cet identifiant (voir le repli du
 * client du pont, qui l'y ajoute), ou si son titre interne est illisible. Numérotation de Disney+ par saison
 * (S2:E1 = premier épisode de la saison 2) : `displayedEpisodeNumber` = numéro dans la saison.
 * Saison 99 : arc publié dans la série (« Undead Unluck: Winter Arc »), titre de l'arc en `seasonTitle` (fiche AniList
 * distincte, clé de correspondance par arc) ; arc illisible : saison spéciale (0).
 * Film : saison inconnue, épisode 1, comme sur Netflix. Signaux : voir playbackSignals (`pages` : pages de série en cache).
 */
export function episodeInfoFromPlayerExperience(entry: DisneyPlayerExperience, urlId: string, pages: readonly DisneySeriesPage[] = []): EpisodeInfo | null {
  if (!hasDisneyId(entry, urlId) || !isJapaneseOriginal(entry)) return null;
  const parsed = parseInternalTitle(entry.internalTitle);
  if (!parsed) return null;
  const episodeId = urlId.toLowerCase();
  const base = { platform: 'disney', episodeId, seriesId: null, seriesSlug: null, url: playUrl(episodeId) } as const;

  if (parsed.kind === 'movie') {
    if (entry.programType !== 'movie') return null;
    const signals = playbackSignals(entry, parsed.title, null, null, pages);
    return { ...base, animeTitle: parsed.title, seasonNumber: null, seasonTitle: null, seasonEpisodeNumber: 1, displayedEpisodeNumber: 1, episodeTitle: null, ...withSignals(signals) };
  }

  const { series, season, episode } = parsed;
  const arc = season === DISNEY_ARC_SEASON ? arcTitleFromSubtitle(entry.subtitle, episode) : null;
  const signals = playbackSignals(entry, series, season === DISNEY_ARC_SEASON ? null : season, arc, pages);
  return {
    ...base,
    ...withSignals(signals),
    animeTitle: series,
    seasonNumber: season === DISNEY_ARC_SEASON ? (arc ? DISNEY_ARC_SEASON : 0) : season,
    seasonTitle: arc,
    seasonEpisodeNumber: episode,
    displayedEpisodeNumber: episode,
    episodeTitle: episodeTitleFromSubtitle(entry.subtitle, episode),
  };
}

// ─── Page de série ────────────────────────────────────────────────────────

/** Genre « Anime » (libellé identique en français, anglais et allemand ; casse et accents ignorés) */
export function hasAnimeGenre(genres: readonly string[]): boolean {
  return genres.some((genre) => genre.normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase() === 'anime');
}

/** Élément du DOM lu pour le menu des saisons (Element en production, faux élément dans les tests) */
export interface MenuElement {
  textContent: string | null;
  getClientRects(): { length: number };
}

/** Racine de recherche (document en production) */
export interface MenuRoot {
  querySelectorAll(selectors: string): Iterable<MenuElement>;
}

/**
 * Saisons désignées par un élément : celles dont le nom est exactement son texte affiché (`innerText`, sans le texte
 * masqué) ou son `textContent`
 */
function seasonsNamedBy(element: MenuElement, seasons: readonly DisneySeason[]): string[] {
  const rendered: unknown = Reflect.get(element, 'innerText');
  const labels = new Set([rendered, element.textContent].flatMap((text) => (typeof text === 'string' && text.length <= 200 ? [labelKey(text)] : [])));
  return seasons.filter((season) => season.name !== null && labels.has(labelKey(season.name))).map((season) => season.id);
}

/** Identifiant de la seule saison désignée par ces éléments, null si aucune ou plusieurs */
function onlySeason(elements: Iterable<MenuElement>, seasons: readonly DisneySeason[], limit = 200): string | null {
  const matched = new Set<string>();
  let read = 0;
  for (const element of elements) {
    if (++read > limit) break;
    for (const id of seasonsNamedBy(element, seasons)) matched.add(id);
  }
  return matched.size === 1 ? ([...matched][0] ?? null) : null;
}

/**
 * Saison choisie dans le menu des saisons, relue à chaque demande (le site ne change pas l'URL) : texte du bouton du
 * menu (`seasonButton`), sinon d'un bouton ouvrant un menu, VISIBLE, qui désigne une seule saison. null si rien ne
 * désigne une saison sans ambiguïté (la dernière requête `season/{id}`, puis `focus`, prennent le relais).
 */
export function seasonFromMenu(root: MenuRoot, seasons: readonly DisneySeason[]): { id: string; source: 'menu' | 'generic' } | null {
  const button = onlySeason(root.querySelectorAll(SELECTORS.seasonButton), seasons);
  if (button) return { id: button, source: 'menu' };
  const visible = [...root.querySelectorAll(SELECTORS.seasonToggle)].filter((element) => element.getClientRects().length > 0);
  const generic = onlySeason(visible, seasons);
  return generic ? { id: generic, source: 'generic' } : null;
}

/**
 * Saison affichée sur la page de série : la seule saison ; sinon celle du menu des saisons (`menuSeasonId`, lu dans le
 * DOM) ; sinon la dernière demandée par le site (`season/{id}`) ; sinon celle affichée au chargement (`focus`) ; sinon null.
 */
export function pickDisneySeason(page: DisneySeriesPage, menuSeasonId: string | null): DisneySeason | null {
  const { seasons } = page;
  if (seasons.length === 1) return seasons[0] ?? null;
  for (const id of [menuSeasonId, page.selectedSeasonId, page.focusSeasonId]) {
    const season = id !== null ? seasons.find((s) => s.id === id) : undefined;
    if (season) return season;
  }
  return null;
}

/** « Saison 2 », « Staffel 10 » (nom générique) → 2, 10 */
const numberInName = (name: string): number | null => {
  const match = /\d{1,3}/.exec(name);
  return match ? Number(match[0]) : null;
};

/**
 * Page de série Disney+ : uuid de l'entité (série), titre anglais (titre interne des épisodes, sinon titre localisé),
 * genre « Anime » (inconnu sans genre), saison affichée. Mêmes règles que la lecture : numérotation par saison, arc
 * (saison 99) désigné par son nom (fiche AniList distincte), arc sans nom lisible : saison spéciale (0). Saison dont aucun
 * épisode n'a été lu : numéro du nom générique (« Saison 2 »), sinon son nom (« … Winter Arc »).
 */
export function seriesInfoFromDisneyPage(page: DisneySeriesPage, season: DisneySeason | null): SeriesPageInfo {
  const internal = parseInternalTitle(page.internalTitle);
  // Année de la SÉRIE (jamais celle de la saison), épisodes et durée médiane de la saison affichée
  const signals = toPlatformSignals({
    seriesYear: page.startYear,
    seasonEpisodeCount: season?.episodeCount,
    episodeMinutes: season?.episodeMinutes,
    format: internal ? (internal.kind === 'episode' ? 'series' : 'movie') : undefined,
  });
  const base = {
    seriesId: page.entityId,
    seriesSlug: null,
    seriesTitle: internal?.kind === 'episode' ? internal.series : (internal?.title ?? page.title),
    ...(page.genres.length > 0 ? { catalogAnime: hasAnimeGenre(page.genres) } : {}),
    ...withSignals(signals),
  };
  if (!season) return { ...base, seasonNumber: null, seasonTitle: null, seasonEpisodeCount: null };
  const named = meaningfulSeasonTitle(season.name);
  const seasonEpisodeCount = season.episodeCount;
  if (season.seasonNumber === DISNEY_ARC_SEASON) return { ...base, seasonNumber: named ? DISNEY_ARC_SEASON : 0, seasonTitle: named, seasonEpisodeCount };
  if (season.seasonNumber !== null) return { ...base, seasonNumber: season.seasonNumber, seasonTitle: null, seasonEpisodeCount };
  return { ...base, seasonNumber: named || !season.name ? null : numberInName(season.name), seasonTitle: named, seasonEpisodeCount };
}

/** Page de série affichée, avec la saison choisie au moment de la demande (menu relu à chaque appel, rien en cache) */
function seriesInfo(page: DisneySeriesPage): SeriesPageInfo {
  const menu = page.seasons.length > 1 ? seasonFromMenu(document, page.seasons) : null;
  const season = pickDisneySeason(page, menu?.id ?? null);
  const info = seriesInfoFromDisneyPage(page, season);
  // Diagnostic (build de développement seulement : retiré du script publié, budget de taille)
  if (__SYNCKAI_DEBUG__) {
    const buttons = [...document.querySelectorAll(SELECTORS.seasonButton)].map((element) => `« ${element.textContent?.trim() ?? ''} »`);
    log.debug(`Menu des saisons : bouton ${buttons.join(', ') || 'introuvable'} ; saisons ${page.seasons.map((s) => `« ${s.name ?? '?'} »`).join(', ')}`);
    const origin = menu ? (menu.source === 'menu' ? 'menu' : 'menu (repli)') : season?.id === page.selectedSeasonId ? 'requête season' : season?.id === page.focusSeasonId ? 'focus' : 'seule saison';
    log.debug(
      `Page de série « ${info.seriesTitle} » (${page.entityId}, genres : ${page.genres.join(', ') || '?'}) : ${season ? `saison « ${season.name ?? '?'} » (${origin}) → S${info.seasonNumber ?? '?'}${info.seasonTitle ? ` « ${info.seasonTitle} »` : ''}` : 'saison non déterminée'}`,
    );
  }
  return info;
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
const bridge: () => DisneyBridgeClient = lazy(() =>
  createDisneyBridgeClient({ ...pageEndpoints(), log: __SYNCKAI_DEBUG__ ? (message) => log.debug(message) : undefined }),
);

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
  if (__SYNCKAI_DEBUG__) log.debug(found ? 'Barre de progression du lecteur trouvée' : 'Barre de progression du lecteur introuvable pour l’instant');
}

/** Dernier lecteur signalé (diagnostic : « trouvé » / « introuvable » journalisé à chaque changement) */
let reportedVideo: HTMLVideoElement | null | undefined;

export const disneyAdapter: StreamingAdapter = {
  platform: 'disney',
  // Catalogue généraliste : pas de toast pour une vidéo qui n'est probablement pas un anime
  quiet: true,

  supportsHost: domainOrSubdomain('disneyplus.com'),

  getEpisodeId(url) {
    const urlId = parseDisneyPlayId(url.pathname);
    if (urlId) urlChangedAt(urlId);
    return urlId;
  },

  // Synchrone : lecture du cache rempli par le pont (aucune métadonnée fiable dans le DOM de Disney+)
  extractEpisodeInfo(url) {
    const urlId = parseDisneyPlayId(url.pathname);
    const entry = urlId ? bridge().peek(urlId) : null;
    return urlId && entry ? episodeInfoFromPlayerExperience(entry, urlId, bridge().pages()) : null;
  },

  async loadEpisodeInfo(episodeId, signal) {
    if (__SYNCKAI_DEBUG__) log.debug(`Page de lecture Disney+ : identifiant de l’URL ${episodeId}`);
    const entry = await bridge().load(episodeId, signal, urlChangedAt(episodeId));
    if (!entry) {
      // Onglet ouvert avant l'activation ou la mise à jour : la requête du site a précédé le pont (épisode suivant suivi)
      if (__SYNCKAI_DEBUG__ && !signal.aborted) log.debug(`Aucune fiche Disney+ pour ${episodeId} : vidéo non suivie`);
      return null;
    }
    // Pas un anime, ou titre interne illisible : rien de journalisé hors debug (catalogue généraliste ; messages retirés du
    // script publié, budget de taille)
    const episode = episodeInfoFromPlayerExperience(entry, episodeId, bridge().pages());
    if (__SYNCKAI_DEBUG__) {
      if (episode) log.debug(`Anime retenu (langue originale ${entry.originalLanguage ?? '?'}) : « ${episode.animeTitle} » S${episode.seasonNumber ?? '?'} E${episode.seasonEpisodeNumber ?? '?'}`);
      else if (!isJapaneseOriginal(entry)) log.debug(`Pas un anime (langue originale ${entry.originalLanguage ?? 'inconnue'}) : vidéo ${episodeId} ignorée`);
      else log.debug(`Titre interne illisible (« ${entry.internalTitle ?? ''} », ${entry.programType ?? '?'}) : vidéo ${episodeId} non suivie`);
    }
    return episode;
  },

  // Synchrone : lecture du cache rempli par le pont (réponse `page/entity-{uuid}` du site)
  detectSeries(url) {
    const entityId = parseDisneyEntityId(url.pathname);
    const page = entityId ? bridge().peekPage(entityId) : null;
    return page ? seriesInfo(page) : null;
  },

  // Bouton du menu des saisons (son texte est la saison choisie)
  watchSeason(url, onChange) {
    return parseDisneyEntityId(url.pathname) ? watchElementText(SELECTORS.seasonButton, onChange) : null;
  },

  async loadSeries(url, signal) {
    const entityId = parseDisneyEntityId(url.pathname);
    if (!entityId) return null;
    const page = await bridge().loadPage(entityId, signal);
    if (__SYNCKAI_DEBUG__ && !page) log.debug(`Aucune page de série reçue du pont pour l’entité ${entityId}`);
    return page ? seriesInfo(page) : null;
  },

  findVideo() {
    const video = chooseDisneyVideo(document);
    if (__SYNCKAI_DEBUG__ && video !== reportedVideo) {
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
    // Diagnostic de la barre en développement seulement : retiré du script publié (budget de taille)
    progressReader ??= createProgressReader(() => findShadowHost(SELECTORS.progressHost), Date.now, __SYNCKAI_DEBUG__ ? reportProgressHost : undefined);
    return progressReader(video, currentProgressContext());
  },

  /**
   * Début du générique de fin : repère FFEC de la réponse de lecture du lecteur, joint à la fiche par le pont (attente
   * bornée, voir loadEditorial). Même ligne de temps que la barre de progression (position du programme) : le bumper
   * de marque en préroll (SGAI, « INT-0 », 5 s) est une insertion hors du programme, absente de la barre comme des
   * repères (aria-valuemax de la barre = runtimeMs de la fiche ; FFEC 1429,8 s < LFEC 1441,0 s < durée 1460,1 s).
   * Null (seuil de repli) sans réponse de lecture ou sans FFEC ; resolveCompletionPoint écarte une valeur invraisemblable.
   */
  async getCreditsStart(episodeId, signal) {
    const ms = (await bridge().loadEditorial(episodeId, signal, urlChangedAt(episodeId)))?.creditsStartMs ?? null;
    const start = ms !== null ? ms / 1000 : null;
    if (__SYNCKAI_DEBUG__ && !signal.aborted) log.debug(start !== null ? `Générique de fin annoncé à ${start} s` : 'Pas de données de générique de fin (seuil de repli)');
    return start;
  },
};
