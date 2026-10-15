import type { EpisodeInfo } from '../../shared/episode.types';
import { createLogger } from '../../browser/logger';
import type { SeriesPageInfo } from '../../shared/page-media.types';
import {
  parsePrimeDetailId,
  primeAnimeVerdict,
  primeCompactGti,
  primeSignals,
  primeTitleHas,
  reducePrimeDetail,
  withPrimeWidgets,
  type PrimeTitle,
} from '../../platforms/prime/metadata';
import { titleKey } from '../../shared/title';
import { createPrimeBridgeClient, type PrimeBridgeClient, type ReceivedCatalog } from './bridge-client';
import type { PrimeWidgetsEntry } from './bridge-protocol';
import type { PlaybackTime, StreamingAdapter } from '../lib/adapter';

// Prime Video (accès optionnel, comme Netflix et Disney+). Particularités relevées le 2026-10-14 :
// - le lecteur est intégré à la page de détail de la saison : l'URL (/detail/{GTI compact de la saison}) ne change JAMAIS,
//   ni à la lecture ni à la lecture automatique de l'épisode suivant. L'épisode en cours vient du pont (métadonnées du
//   lecteur `catalogMetadataV2`, indexées par `entityId`), et `watchEpisode` relance le suivi à chaque nouvel épisode ;
// - genres et pistes audio : page de détail (nœud d'hydratation au premier chargement, réponses `/detail/` ensuite) ;
// - une seule <video> principale, réutilisée d'un épisode à l'autre (durée NaN pendant ~2 s à la bascule), et une
//   bande-annonce en pause sur la page, jamais retenue.

const log = createLogger('prime');

const SELECTORS = {
  /** Données de la page de détail du PREMIER chargement (pas mises à jour par la navigation SPA) */
  hydration: 'script#dv-web-page-hydration-data',
  /**
   * Compte à rebours d'une publicité (sélecteur NON VÉRIFIÉ, rapporté par des tiers : aucune publicité vue lors du relevé
   * du 2026-10-14). Visible : la position n'avance pas (aucune progression comptée pendant une publicité).
   */
  adTimer: '.atvwebplayersdk-ad-timer-remaining-time',
} as const;

/** Bande-annonce : durée finie sous ce seuil (43, 63, 133 s relevées) et en pause */
const TRAILER_MAX_S = 180;
/** Écart toléré entre la durée de la <video> et celle de l'épisode (1440 / 1441 s relevées) */
const DURATION_TOLERANCE_S = 5;
/** Widgets rapprochés des métadonnées du lecteur : envoyés 0,1 à 0,3 s après la bascule */
const WIDGETS_WINDOW_MS = 10_000;
/** Attente de la page de détail (réponse `/detail/`) avant de renoncer au filtre « anime » */
const TITLE_WAIT_MS = 5_000;

// ─── Identité de l'épisode en lecture (pur, testable) ────────────────────

/**
 * Épisode en lecture sur la page `path` : dernières métadonnées d'épisode ou de film reçues du lecteur, si elles ont
 * été reçues sur cette page (la lecture s'arrête avec la navigation vers une autre page). null sinon.
 */
export function playingCatalog(latest: ReceivedCatalog | null, path: string): ReceivedCatalog | null {
  return latest && latest.path === path ? latest : null;
}

/**
 * Identifiants de l'épisode `entry` : `entityId` de la requête, plus le GTI de `bestSelf` des widgets reçus autour de la
 * bascule s'il désigne le même numéro d'épisode (recoupement : `entityId` n'est que SUPPOSÉ être le GTI de l'épisode).
 */
export function episodeAliases(entry: ReceivedCatalog, widgets: readonly PrimeWidgetsEntry[]): string[] {
  const ids = new Set([entry.id]);
  for (const { seenAt, widgets: received } of widgets) {
    const best = received.bestSelf;
    if (!best || Math.abs(seenAt - entry.seenAt) > WIDGETS_WINDOW_MS || best.gti === entry.id) continue;
    const number = received.episodes.find((episode) => episode.gti === best.gti)?.episodeNumber ?? best.sequenceNumber;
    if (entry.episodeNumber !== null && number === entry.episodeNumber) ids.add(best.gti);
  }
  return [...ids];
}

/**
 * Page de détail (saison ou film) de l'épisode : celle qui le liste (un de ses identifiants), sinon celle désignée par
 * les widgets dont `bestSelf` est cet épisode, sinon la page affichée si c'est la même série ou la même saison (lecture
 * automatique vers la saison suivante sans changement d'URL). Complétée par les widgets de la même saison.
 */
export function titleForEpisode(
  entry: ReceivedCatalog,
  aliases: readonly string[],
  titles: readonly PrimeTitle[],
  widgets: readonly PrimeWidgetsEntry[],
  pageTitle: PrimeTitle | null,
): PrimeTitle | null {
  const newest = [...titles].reverse();
  const listing = newest.find((title) => aliases.some((id) => title.episodes.some((episode) => episode.gti === id || episode.compactGTI === id)));
  const seasonGti = widgets.findLast((received) => received.widgets.bestSelf !== null && aliases.includes(received.widgets.bestSelf.gti))?.widgets.seasonGti;
  const bySeason = seasonGti ? newest.find((title) => title.seasonGti === seasonGti) : undefined;
  // Numéro de saison seul : seulement sans titre de série dans le lecteur (une autre série lancée depuis le lecteur, URL
  // inchangée, a souvent aussi une saison 1 : elle aurait repris le verdict « anime » de la page affichée)
  const sameShow =
    pageTitle &&
    (entry.seriesTitle !== null
      ? titleKey(entry.seriesTitle) === titleKey(pageTitle.seriesTitle)
      : entry.seasonNumber !== null && entry.seasonNumber === pageTitle.seasonNumber)
      ? pageTitle
      : null;
  const title = listing ?? bySeason ?? sameShow;
  if (!title) return null;
  return widgets.reduce((merged, received) => withPrimeWidgets(merged, received.widgets), title);
}

const detailUrl = (title: PrimeTitle | null, fallback: string): string => (title?.compactGTI ? `https://www.primevideo.com/detail/${title.compactGTI}` : fallback);

/**
 * Signaux de la page de détail, seulement si elle décrit la saison de l'épisode (elle le liste, ou même numéro de saison)
 * ou le film : après une lecture automatique vers la saison suivante (URL inchangée), la page affichée est celle de la
 * saison précédente, son année ne vaut pas pour l'épisode.
 */
function titleSignals(entry: ReceivedCatalog, listed: boolean, title: PrimeTitle): Pick<EpisodeInfo, 'signals'> {
  const own = entry.type === 'movie' ? title.titleType === 'movie' : listed || (entry.seasonNumber !== null && entry.seasonNumber === title.seasonNumber);
  const signals = own ? primeSignals(title) : undefined;
  return signals ? { signals } : {};
}

/**
 * Épisode à synchroniser : métadonnées du lecteur (série sans mention de version, saison, numéro dans la saison) et
 * filtre « anime » de la page de détail. null si ce n'est pas un anime (`ignored` : genres d'une autre catégorie ou
 * illisibles, page de détail inconnue), ou sans numéro d'épisode. Film : saison inconnue, épisode 1 (comme Netflix).
 * Clé de correspondance par titre (`seriesId` null) : « prime:title:{titre normalisé}:s{saison} » (année de la saison
 * ajoutée par mappingKey si elle est connue).
 */
export function episodeInfoFromPrime(entry: ReceivedCatalog, aliases: readonly string[], title: PrimeTitle | null, pageUrl: string): EpisodeInfo | null {
  const verdict = title ? primeAnimeVerdict(title.genres, title.japaneseAudio) : 'ignored';
  if (verdict === 'ignored' || !title) return null;
  const animeTitle = entry.seriesTitle ?? title.seriesTitle;
  const base = { platform: 'prime', episodeId: entry.id, seriesId: null, seriesSlug: null, animeTitle, seasonTitle: null, url: detailUrl(title, pageUrl), primeAnime: verdict } as const;
  if (entry.type === 'movie') return { ...base, seasonNumber: null, seasonEpisodeNumber: 1, displayedEpisodeNumber: 1, episodeTitle: null, ...titleSignals(entry, false, title) };
  const listed = title.episodes.find((episode) => aliases.includes(episode.gti));
  const number = entry.episodeNumber ?? listed?.episodeNumber ?? null;
  if (number === null) return null;
  return {
    ...base,
    ...titleSignals(entry, listed !== undefined, title),
    seasonNumber: entry.seasonNumber ?? title.seasonNumber,
    seasonEpisodeNumber: number,
    displayedEpisodeNumber: number,
    episodeTitle: entry.title ?? listed?.title ?? null,
  };
}

/** Page de détail affichée (saison) : null hors anime (`ignored`, rien d'affiché), comme pour la lecture */
export function seriesInfoFromPrime(title: PrimeTitle, urlId: string | null): SeriesPageInfo | null {
  const verdict = primeAnimeVerdict(title.genres, title.japaneseAudio);
  if (verdict === 'ignored') return null;
  const signals = primeSignals(title);
  return {
    ...(signals ? { signals } : {}),
    seriesId: title.compactGTI ?? primeCompactGti(urlId),
    seriesSlug: null,
    seriesTitle: title.seriesTitle,
    seasonNumber: title.titleType === 'movie' ? null : title.seasonNumber,
    seasonTitle: null,
    seasonEpisodeCount: title.episodeCount,
    primeAnime: verdict,
  };
}

// ─── Lecteur (pur, testable) ──────────────────────────────────────────────

export type PrimeVideoCandidate = Pick<HTMLVideoElement, 'paused' | 'duration' | 'isConnected'>;

/**
 * <video> du lecteur : celle dont la durée est celle de l'épisode (`expectedS`), sinon une <video> en lecture, sinon une
 * <video> en pause qui n'est pas une bande-annonce (durée inconnue pendant la bascule, ou longue). Une bande-annonce (en
 * pause, courte) n'est jamais retenue. null si aucune.
 */
export function choosePrimeVideo<V extends PrimeVideoCandidate>(videos: Iterable<V>, expectedS: number | null): V | null {
  let best: { video: V; score: number } | null = null;
  for (const video of videos) {
    if (!video.isConnected) continue;
    const finite = Number.isFinite(video.duration) && video.duration > 0;
    let score: number;
    if (finite && expectedS !== null && Math.abs(video.duration - expectedS) <= DURATION_TOLERANCE_S) score = video.paused ? 3 : 4;
    else if (video.paused && finite && video.duration < TRAILER_MAX_S) continue;
    else score = video.paused ? 1 : 2;
    if (!best || score > best.score) best = { video, score };
  }
  return best?.video ?? null;
}

/** Élément du DOM lu pour la publicité (Element en production, faux élément dans les tests) */
export interface AdTimerElement {
  textContent: string | null;
  getClientRects(): { length: number };
}

/** Publicité en cours : compte à rebours affiché et non vide */
export function isAdPlaying(root: { querySelector(selectors: string): AdTimerElement | null }): boolean {
  const timer = root.querySelector(SELECTORS.adTimer);
  return timer !== null && timer.getClientRects().length > 0 && (timer.textContent ?? '').trim() !== '';
}

/** Position et durée de la <video> (temps du programme, relevé sans publicité), null pendant une publicité ou la bascule */
export function readPrimePlayback(video: Pick<HTMLVideoElement, 'currentTime' | 'duration'>, adPlaying: boolean): PlaybackTime | null {
  if (adPlaying || !Number.isFinite(video.duration) || video.duration <= 0 || !Number.isFinite(video.currentTime)) return null;
  return { currentTime: video.currentTime, duration: video.duration };
}

// ─── Adapter ──────────────────────────────────────────────────────────────

/** Créé à la première utilisation : le module est aussi importé hors navigateur (tests) */
let client: PrimeBridgeClient | null = null;
function bridge(): PrimeBridgeClient {
  client ??= createPrimeBridgeClient({ target: document, messages: window, origin: location.origin, log: __SYNCKAI_DEBUG__ ? (message) => log.debug(message) : undefined });
  return client;
}

/** Page du premier chargement (seule décrite par le nœud d'hydratation) et sa lecture */
let hydration: { path: string; node: Element | null; title: PrimeTitle | null } | null = null;

/** Page de détail du nœud d'hydratation, lu une fois par nœud (il n'est pas mis à jour par la navigation SPA) */
function hydratedTitle(): { path: string; title: PrimeTitle | null } {
  const node = document.querySelector(SELECTORS.hydration);
  if (hydration && hydration.node === node) return hydration;
  let title: PrimeTitle | null = null;
  try {
    title = node?.textContent ? reducePrimeDetail(JSON.parse(node.textContent)) : null;
  } catch {
    title = null;
  }
  hydration = { path: hydration?.path ?? location.pathname, node, title };
  if (__SYNCKAI_DEBUG__) log.debug(title ? `Page de détail (hydratation) : « ${title.seriesTitle} » S${title.seasonNumber ?? '?'}, genres ${title.genres.join(', ') || '?'}` : 'Pas de données d’hydratation lisibles');
  return hydration;
}

/** Page de détail de l'URL : réponse `/detail/` du pont, sinon le nœud d'hydratation (même identifiant, ou première page) */
function pageTitle(url: URL): PrimeTitle | null {
  const id = parsePrimeDetailId(url.pathname);
  const fromBridge = id ? bridge().peekTitle(id) : null;
  if (fromBridge) return fromBridge;
  const hydrated = hydratedTitle();
  if (!hydrated.title) return null;
  return (id && primeTitleHas(hydrated.title, id)) || hydrated.path === url.pathname ? hydrated.title : null;
}

/** Toutes les pages de détail connues (hydratation d'abord, réponses du pont ensuite : les plus récentes en dernier) */
function knownTitles(): PrimeTitle[] {
  const hydrated = hydratedTitle().title;
  return [...(hydrated ? [hydrated] : []), ...bridge().titles()];
}

function playing(url: URL): ReceivedCatalog | null {
  return playingCatalog(bridge().latestCatalog(), url.pathname);
}

/** Épisode `episodeId` (métadonnées du lecteur) avec ses identifiants et sa page de détail, null si inconnu */
function resolveEpisode(episodeId: string, url: URL): { entry: ReceivedCatalog; aliases: string[]; title: PrimeTitle | null } | null {
  const entry = bridge().peekCatalog(episodeId);
  if (!entry) return null;
  const widgets = bridge().widgets();
  const aliases = episodeAliases(entry, widgets);
  return { entry, aliases, title: titleForEpisode(entry, aliases, knownTitles(), widgets, pageTitle(url)) };
}

function episodeInfo(episodeId: string, url: URL): EpisodeInfo | null {
  const resolved = resolveEpisode(episodeId, url);
  return resolved ? episodeInfoFromPrime(resolved.entry, resolved.aliases, resolved.title, `${url.origin}${url.pathname}`) : null;
}

/** Durée attendue de l'épisode en lecture (s) : repères de lecture, sinon page de détail */
function expectedDuration(): number | null {
  const url = new URL(location.href);
  const current = playing(url);
  if (!current) return null;
  const resolved = resolveEpisode(current.id, url);
  const aliases = resolved?.aliases ?? [current.id];
  const ms = aliases.map((id) => bridge().peekPlayback(id)?.durationMs ?? null).find((value) => value !== null) ?? null;
  if (ms !== null) return ms / 1000;
  return resolved?.title?.episodes.find((episode) => aliases.includes(episode.gti))?.durationS ?? null;
}

/** Dernier lecteur signalé (diagnostic) */
let reportedVideo: HTMLVideoElement | null | undefined;

export const primeAdapter: StreamingAdapter = {
  platform: 'prime',
  // Catalogue généraliste : pas de toast pour une vidéo qui n'est probablement pas un anime
  quiet: true,

  supportsHost(hostname) {
    return hostname === 'primevideo.com' || hostname.endsWith('.primevideo.com');
  },

  // Aucun identifiant d'épisode dans l'URL : épisode en lecture d'après le lecteur, sur cette page seulement
  getEpisodeId(url) {
    return playing(url)?.id ?? null;
  },

  extractEpisodeInfo(url) {
    const current = playing(url);
    return current ? episodeInfo(current.id, url) : null;
  },

  async loadEpisodeInfo(episodeId, signal) {
    const url = new URL(location.href);
    if (!resolveEpisode(episodeId, url)?.title) {
      // Page de détail pas encore reçue (navigation SPA juste avant la lecture) : attente bornée
      const id = parsePrimeDetailId(url.pathname);
      if (id) await bridge().loadTitle(id, AbortSignal.any([signal, AbortSignal.timeout(TITLE_WAIT_MS)]));
    }
    if (signal.aborted) return null;
    const episode = episodeInfo(episodeId, url);
    if (__SYNCKAI_DEBUG__) {
      const resolved = resolveEpisode(episodeId, url);
      const title = resolved?.title ?? null;
      const verdict = title ? primeAnimeVerdict(title.genres, title.japaneseAudio) : 'page de détail inconnue';
      log.debug(
        episode
          ? `Épisode retenu (${verdict}) : « ${episode.animeTitle} » S${episode.seasonNumber ?? '?'} E${episode.seasonEpisodeNumber ?? '?'} [${resolved?.aliases.join(', ') ?? episodeId}]`
          : `Vidéo ${episodeId} non suivie (${verdict}, genres ${title?.genres.join(', ') || '?'})`,
      );
    }
    return episode;
  },

  // Lecture automatique : l'URL ne change pas, le suivi est relancé à chaque nouvel épisode reçu du lecteur
  watchEpisode(onChange) {
    // Démarrage du script : le nœud d'hydratation décrit cette page-ci (lu avant toute navigation SPA)
    hydratedTitle();
    let last = playing(new URL(location.href))?.id ?? null;
    const stop = bridge().subscribe(() => {
      const id = playing(new URL(location.href))?.id ?? null;
      if (id === last) return;
      last = id;
      onChange();
    });
    bridge().start();
    return stop;
  },

  // Synchrone : nœud d'hydratation (premier chargement) ou réponse `/detail/` du pont (navigation SPA)
  detectSeries(url) {
    const title = pageTitle(url);
    return title ? seriesInfoFromPrime(title, parsePrimeDetailId(url.pathname)) : null;
  },

  // Le sélecteur de saison mène à la page de détail de l'autre saison (nouvelle URL) : pas de watchSeason
  async loadSeries(url, signal) {
    const id = parsePrimeDetailId(url.pathname);
    if (!id) return null;
    const title = pageTitle(url) ?? (await bridge().loadTitle(id, signal));
    if (__SYNCKAI_DEBUG__ && !title) log.debug(`Aucune page de détail reçue pour ${id}`);
    return title ? seriesInfoFromPrime(title, id) : null;
  },

  findVideo() {
    const video = choosePrimeVideo(document.querySelectorAll('video'), expectedDuration());
    if (__SYNCKAI_DEBUG__ && video !== reportedVideo) {
      reportedVideo = video;
      log.debug(video ? `Lecteur vidéo retenu (${video.paused ? 'en pause' : 'en lecture'}, durée ${video.duration})` : 'Lecteur vidéo introuvable pour l’instant');
    }
    return video;
  },

  readPlayback(video) {
    return readPrimePlayback(video, isAdPlaying(document));
  },

  /**
   * Début du générique de fin : `END_CREDITS` de la réponse de lecture de CET épisode (indexée par `titleId`, jamais
   * celle de l'épisode suivant reçue avant la bascule). Null (seuil de repli) sans repère ; `NEXT_UP` et `SKIP_INTRO`
   * sont ignorés.
   */
  async getCreditsStart(episodeId, signal) {
    const resolved = resolveEpisode(episodeId, new URL(location.href));
    const cached = (resolved?.aliases ?? []).map((id) => bridge().peekPlayback(id)).find((entry) => entry !== null) ?? null;
    const ms = (cached ?? (await bridge().loadPlayback(episodeId, signal)))?.creditsStartMs ?? null;
    const start = ms !== null ? ms / 1000 : null;
    if (__SYNCKAI_DEBUG__ && !signal.aborted) log.debug(start !== null ? `Générique de fin annoncé à ${start} s` : 'Pas de repère de générique de fin (seuil de repli)');
    return start;
  },
};
