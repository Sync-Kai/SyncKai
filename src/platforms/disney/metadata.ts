// Savoir Disney+ réduit en monde MAIN : réducteurs des réponses que le site demande lui-même (playerExperience, pages de série,
// saisons, lecture), formes réduites et bornes. Module PUR (aucun accès au DOM ni à chrome.*), importé du pont MAIN, du
// script de contenu isolé et des tests. Le protocole du pont (messages, version, revalidation côté isolé) est dans
// content/disney/bridge-protocol.ts.
import { isRecord } from '../../shared/guards';
import { isSignalYear, medianMinutes } from '../../shared/match-signals';

/** Identifiant Disney+ (épisode de /play/{id}, availId, entité) : UUID */
export const DISNEY_ID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Identifiants gardés par fiche au plus */
export const DISNEY_MAX_IDS = 6;
/** `infoBlock` (protobuf en base64) au-delà duquel rien n'est décodé */
const MAX_INFO_BLOCK_LENGTH = 16_000;
/** Entité de catalogue dans `infoBlock` : « urn:ds:cmp:eva:episode/{uuid} » (episode, program, movie…) */
const ENTITY_URN = /urn:ds:cmp:eva:[a-z]+\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi;

/** Bornes de la réduction : textes tronqués, fiches gardées et poussées en une fois */
export const DISNEY_MAX_TEXT = 300;
export const DISNEY_MAX_ENTRIES = 20;
/** Pages de série gardées et poussées en une fois, saisons et genres par page */
export const DISNEY_MAX_PAGES = 10;
export const DISNEY_MAX_SEASONS = 50;
export const DISNEY_MAX_GENRES = 12;
export const MAX_GENRE_LENGTH = 60;
/** Nombre d'épisodes plausible d'une saison */
export const MAX_EPISODE_COUNT = 10_000;
/** Durée maximale plausible d'un programme (ms) : 12 h */
const MAX_RUNTIME_MS = 12 * 3_600_000;

/**
 * Fiche réduite d'une vidéo (réponse `playerExperience`) : seuls ces champs quittent le monde MAIN.
 * `title` et `subtitle` sont localisés (langue du profil) ; `internalTitle` est stable et en anglais
 * (« Undead Unluck - s1e1 - mediaId:… »).
 */
export interface DisneyPlayerExperience {
  /**
   * Identifiants de la vidéo, en minuscules, sans doublon : chemin de la requête, `availId` de la réponse, entités de
   * `infoBlock` (dont l'épisode de l'URL /play/{id}). Jamais vide.
   */
  ids: string[];
  /** Réception de la réponse par le pont (ms depuis l'epoch) : rapproche une fiche d'un changement d'URL */
  seenAt: number;
  title: string;
  subtitle: string | null;
  internalTitle: string | null;
  /** Langue originale (« ja » pour un anime) */
  originalLanguage: string | null;
  /** Durée (ms) */
  runtimeMs: number | null;
  /** « episode », « movie »… */
  programType: string | null;
  /** Repères de la réponse de lecture de la même vidéo ; null tant qu'elle n'a pas été vue */
  editorial: DisneyEditorial | null;
}

/**
 * Repères éditoriaux de la réponse de lecture (ms, sur la ligne de temps du programme, comme la barre de progression) :
 * `FFEC` (First Frame End Credits, début du générique de fin) et `up_next` (carte « À suivre »), null si absents.
 */
export interface DisneyEditorial {
  creditsStartMs: number | null;
  upNextMs: number | null;
}

/** Réponse de lecture réduite (monde MAIN seulement) : identifiants de la vidéo (availId, entityId, mediaId) et repères */
export interface DisneyPlayback extends DisneyEditorial {
  ids: string[];
}

/** Saison d'une page de série */
export interface DisneySeason {
  /** Identifiant de la saison (minuscules) */
  id: string;
  /** Nom affiché, localisé : « Saison 1 », ou nom de l'arc (« Undead Unluck: Winter Arc ») */
  name: string | null;
  /** Numéro tiré des épisodes (internalTitle « sNeM », sinon `visuals.seasonNumber`) ; 99 = arc ; null sans épisode lu */
  seasonNumber: number | null;
  /** `pagination.totalCount` */
  episodeCount: number | null;
  /** Durée médiane (minutes) des épisodes lus de la saison (`items[].visuals.durationMs`), null sans durée */
  episodeMinutes: number | null;
}

/**
 * Page de série réduite (réponse `page/entity-{uuid}`, complétée par les réponses `season/{id}`) : seuls ces champs
 * quittent le monde MAIN. Jamais d'image, de description, d'identifiant de flux ni de suggestion d'autres séries.
 */
export interface DisneySeriesPage {
  /** uuid de l'entité (URL /browse/entity-{uuid}), minuscules */
  entityId: string;
  /** Réception de la réponse par le pont (ms depuis l'epoch) */
  seenAt: number;
  /** Titre localisé (langue du profil) */
  title: string;
  /**
   * Premier `internalTitle` des actions de la page et des épisodes (« Undead Unluck - s1e1 - mediaId:… ») : titre anglais
   * de la série, lu côté isolé par parseInternalTitle
   */
  internalTitle: string | null;
  /** Genres localisés, seulement pour reconnaître « Anime » */
  genres: string[];
  /**
   * Année de début de la SÉRIE (`page.visuals.metastringParts.releaseYearRange.startYear`, chaîne « 2024 » relevée le
   * 2026-10-14), jamais celle d'une saison ni des suggestions (`set`) ; null si absente
   */
  startYear: number | null;
  /** Saison affichée au chargement (`focus.seasonId`) */
  focusSeasonId: string | null;
  /** Dernière saison demandée par le site (`season/{id}` : menu des saisons, pagination), null sinon */
  selectedSeasonId: string | null;
  seasons: DisneySeason[];
}

// ─── Requêtes observées (monde MAIN) ──────────────────────────────────────

/** Hôtes de l'API du site (Disney Streaming / BAMTech) */
function isApiHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return ['bamgrid.com', 'disneyplus.com'].some((domain) => host === domain || host.endsWith(`.${domain}`));
}

/** Requêtes lues : fiche d'une vidéo, page de série (entité), saison d'une page de série */
const OBSERVED_PATH = /^\/explore\/v1(?:\.\d{1,3})?\/(playerExperience|page|season)\/(entity-)?([0-9a-f-]{36})\/?$/i;

export type DisneyRequestKind = 'player' | 'page' | 'season' | 'playback';

/**
 * URL d'une requête de l'API du site lue par le pont → nature et identifiant du chemin (minuscules), sinon null :
 * `…/explore/v1.21/playerExperience/{id}` (availId ou épisode : non garanti), `…/page/entity-{uuid}` (page de série),
 * `…/season/{id}` (saison), `…bamgrid.com/…/playback/…` (réponse de lecture, identifiant vide). Toute autre requête
 * (flux, upNext, images, autres pages…) est ignorée sans être lue.
 */
export function observedRequest(url: string, base = 'https://www.disneyplus.com/'): { kind: DisneyRequestKind; id: string } | null {
  let parsed: URL;
  try {
    parsed = new URL(url, base);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' || !isApiHost(parsed.hostname)) return null;
  // Lecture (POST du lecteur, `disney.playback.edge.bamgrid.com/v{n}/playback/{scénario}`, chemin exact non relevé) :
  // filtre tolérant sur la version et le scénario, hôte bamgrid.com seulement ; sans identifiant dans le chemin. Les
  // autres requêtes de cet hôte (licences DRM…) ne sont jamais lues.
  if (/\/playback\//i.test(parsed.pathname)) return parsed.hostname.endsWith('bamgrid.com') ? { kind: 'playback', id: '' } : null;
  const [, type = '', entity, id] = OBSERVED_PATH.exec(parsed.pathname) ?? [];
  if (id === undefined || !DISNEY_ID_REGEX.test(id)) return null;
  const kind: DisneyRequestKind = /^playerExperience$/i.test(type) ? 'player' : /^page$/i.test(type) ? 'page' : 'season';
  // Une page n'est lue que pour une entité (entity-{uuid}) ; les autres chemins n'en portent jamais
  if ((kind === 'page') !== (entity !== undefined)) return null;
  return { kind, id: id.toLowerCase() };
}

/** `playerExperience/{id}` → identifiant du chemin (minuscules), sinon null */
export function playerExperienceRequestId(url: string, base = 'https://www.disneyplus.com/'): string | null {
  const request = observedRequest(url, base);
  return request?.kind === 'player' ? request.id : null;
}

/** Texte nettoyé et tronqué ; null si absent ou vide */
function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/\s+/g, ' ').trim();
  return cleaned ? cleaned.slice(0, DISNEY_MAX_TEXT) : null;
}

const LANGUAGE = /^[a-z]{2,3}(?:-[a-z0-9]{1,8})*$/i;
const PROGRAM_TYPE = /^[a-z][a-z_-]{0,31}$/i;

export function language(value: unknown): string | null {
  return typeof value === 'string' && LANGUAGE.test(value) && value.length <= 16 ? value : null;
}

export function programType(value: unknown): string | null {
  return typeof value === 'string' && PROGRAM_TYPE.test(value) ? value.toLowerCase() : null;
}

export const isTimestamp = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0;

export function runtime(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= MAX_RUNTIME_MS ? Math.round(value) : null;
}

/**
 * Entités de catalogue citées par `infoBlock` (protobuf en base64) : seuls les identifiants en sortent, jamais le bloc.
 * Bloc absent, trop long ou illisible : aucun.
 */
export function infoBlockEntityIds(infoBlock: unknown): string[] {
  if (typeof infoBlock !== 'string' || infoBlock.length === 0 || infoBlock.length > MAX_INFO_BLOCK_LENGTH) return [];
  let decoded: string;
  try {
    decoded = atob(infoBlock);
  } catch {
    return [];
  }
  return [...decoded.matchAll(ENTITY_URN)].map((match) => (match[1] ?? '').toLowerCase()).filter((id) => DISNEY_ID_REGEX.test(id));
}

/**
 * Réduit la réponse de `playerExperience` (`{ data: { playerExperience: {…} } }`) à `DisneyPlayerExperience`.
 * `requestId` : identifiant du chemin de la requête (peut différer de l'`availId` de la réponse) ; `seenAt` : réception
 * (ms). Null si la forme est inattendue.
 */
export function reduceDisneyPlayerExperience(raw: unknown, requestId: string, seenAt: number): DisneyPlayerExperience | null {
  const data = isRecord(raw) ? raw.data : null;
  const experience = isRecord(data) ? data.playerExperience : null;
  if (!isRecord(experience)) return null;
  const title = text(experience.title);
  if (!title || !DISNEY_ID_REGEX.test(requestId) || !isTimestamp(seenAt)) return null;
  const availId = typeof experience.availId === 'string' && DISNEY_ID_REGEX.test(experience.availId) ? experience.availId : null;
  const ids = [...new Set([requestId, availId, ...infoBlockEntityIds(experience.infoBlock)].flatMap((id) => (id ? [id.toLowerCase()] : [])))].slice(
    0,
    DISNEY_MAX_IDS,
  );
  const timeline = isRecord(experience.timeline) ? experience.timeline : {};
  const analytics = isRecord(experience.analytics) ? experience.analytics : {};
  return {
    ids,
    seenAt,
    title,
    subtitle: text(experience.subtitle),
    internalTitle: text(experience.internalTitle),
    originalLanguage: language(experience.originalLanguage),
    runtimeMs: runtime(timeline.runtimeMs),
    programType: programType(analytics.programType),
    editorial: null,
  };
}

// ─── Réponse de lecture (monde MAIN) ──────────────────────────────────────

/**
 * Réduit la réponse de lecture à ses identifiants (`stream.playbackRights.externalIds.availId`, `tracking.qoe.entityId`
 * = identifiant de l'URL /play/{id}, `tracking.telemetry.mediaId`) et aux repères FFEC / up_next de `stream.editorial`.
 * Seuls ces champs sont lus : jamais `stream.sources`, `insertion`, ni les jetons de droits. Null sans `stream` ou sans
 * identifiant valide.
 */
export function reduceDisneyPlayback(raw: unknown): DisneyPlayback | null {
  const { stream, tracking } = record(raw);
  if (!isRecord(stream)) return null;
  const { qoe, telemetry } = record(tracking);
  const ids = [...new Set([record(record(stream.playbackRights).externalIds).availId, record(qoe).entityId, record(telemetry).mediaId].flatMap((id) => lowerId(id) ?? []))];
  if (ids.length === 0) return null;
  const marks = list(stream.editorial).map(record);
  const offset = (label: string): number | null => runtime(marks.find((mark) => typeof mark.label === 'string' && mark.label.toLowerCase() === label)?.offsetMillis);
  return { ids, creditsStartMs: offset('ffec'), upNextMs: offset('up_next') };
}

/**
 * Fiche complétée par la dernière réponse de lecture de la même vidéo (un identifiant en commun, ou le mediaId de son
 * titre interne), quel que soit l'ordre d'arrivée ; la fiche telle quelle sans correspondance.
 */
export function withDisneyPlayback(entry: DisneyPlayerExperience, playbacks: readonly DisneyPlayback[]): DisneyPlayerExperience {
  // Titre interne « … - s1e1 - mediaId:{uuid} » : le mediaId de la réponse de lecture en est la fin
  const title = entry.internalTitle?.toLowerCase();
  const playback = playbacks.findLast((known) => known.ids.some((id) => entry.ids.includes(id) || title?.endsWith(id)));
  return playback ? { ...entry, editorial: { creditsStartMs: playback.creditsStartMs, upNextMs: playback.upNextMs } } : entry;
}

// ─── Titre interne (anglais, stable) ──────────────────────────────────────

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

// ─── Pages de série (monde MAIN) ──────────────────────────────────────────

const record = (value: unknown): Record<string, unknown> => (isRecord(value) ? value : {});
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

function lowerId(value: unknown): string | null {
  return typeof value === 'string' && DISNEY_ID_REGEX.test(value) ? value.toLowerCase() : null;
}

/** Entier positif plausible (nombre ou chaîne de chiffres), sinon null */
export function positiveInt(value: unknown, max: number): number | null {
  const n = typeof value === 'string' && /^\d{1,5}$/.test(value) ? Number(value) : value;
  return typeof n === 'number' && Number.isSafeInteger(n) && n >= 1 && n <= max ? n : null;
}

/** Titres internes des actions des nœuds donnés (actions de la page, épisodes), dans l'ordre */
function internalTitles(nodes: readonly unknown[]): string[] {
  return nodes.flatMap((node) => list(record(node).actions).flatMap((action) => text(record(action).internalTitle) ?? []));
}

/** Repère « sNeM » d'un titre interne d'épisode (« Undead Unluck - s99e1 - mediaId:… ») */
const INTERNAL_SEASON = /\s-\s+s(\d{1,3})e\d{1,4}\s+-\s+mediaId:/i;

/** Numéro de saison d'après ses premiers épisodes : titre interne (« s99e1 » : arc), sinon `visuals.seasonNumber` */
function seasonNumberOf(items: readonly unknown[]): number | null {
  const sample = items.slice(0, 5);
  for (const title of internalTitles(sample)) {
    const season = INTERNAL_SEASON.exec(title)?.[1];
    if (season !== undefined) return Number(season);
  }
  for (const item of sample) {
    const n = positiveInt(record(record(item).visuals).seasonNumber, 999);
    if (n !== null) return n;
  }
  return null;
}

function reduceSeason(raw: unknown, id: string | null = lowerId(record(raw).id)): DisneySeason | null {
  if (!id || !isRecord(raw)) return null;
  return {
    id,
    name: text(record(raw.visuals).name),
    seasonNumber: seasonNumberOf(list(raw.items)),
    episodeCount: positiveInt(record(raw.pagination).totalCount, MAX_EPISODE_COUNT),
    // Durée inconnue (0) ignorée par medianMinutes
    episodeMinutes: medianMinutes(list(raw.items).map((item) => (runtime(record(record(item).visuals).durationMs) ?? 0) / 1000)) ?? null,
  };
}

function genresOf(values: unknown): string[] {
  return list(values)
    .flatMap((value) => {
      const genre = text(value);
      return genre && genre.length <= MAX_GENRE_LENGTH ? [genre] : [];
    })
    .slice(0, DISNEY_MAX_GENRES);
}

/**
 * Réduit la réponse `page/entity-{uuid}` (`{ data: { page: {…} } }`) à `DisneySeriesPage`. Seuls la page, ses actions
 * et les conteneurs `episodes` (saisons) et `details` (titre, genres) sont lus ; les suggestions (`set`) jamais. Null si
 * la forme est inattendue.
 */
export function reduceDisneySeriesPage(raw: unknown, entityId: string, seenAt: number): DisneySeriesPage | null {
  const page = record(record(record(raw).data).page);
  const containers = list(page.containers).filter(isRecord);
  const episodes = containers.find((container) => container.type === 'episodes') ?? {};
  const details = record(containers.find((container) => container.type === 'details')?.visuals);
  const visuals = record(page.visuals);
  const title = text(visuals.title) ?? text(details.title);
  if (!title || !DISNEY_ID_REGEX.test(entityId) || !isTimestamp(seenAt)) return null;
  const rawSeasons = list(episodes.seasons).slice(0, DISNEY_MAX_SEASONS);
  const metastring = record(visuals.metastringParts);
  const genres = genresOf(record(metastring.genres).values);
  const startYear = positiveInt(record(metastring.releaseYearRange).startYear, 9_999);
  return {
    entityId: entityId.toLowerCase(),
    seenAt,
    title,
    internalTitle: internalTitles([page, ...rawSeasons.flatMap((season) => list(record(season).items))])[0] ?? null,
    genres: genres.length > 0 ? genres : genresOf(record(details.genres).values),
    startYear: isSignalYear(startYear) ? startYear : null,
    focusSeasonId: lowerId(record(episodes.focus).seasonId),
    selectedSeasonId: null,
    seasons: rawSeasons.flatMap((season) => reduceSeason(season) ?? []),
  };
}

/**
 * Réponse `season/{id}` (forme non relevée : `{ data: { season: {…} } }` supposée, `{ data: {…} }` accepté) appliquée à
 * la page qui contient cette saison : saison retenue comme choisie, numéro et nombre d'épisodes complétés s'ils sont
 * lisibles, titre interne complété. Null si la page ne contient pas cette saison.
 */
export function applyDisneySeason(page: DisneySeriesPage, seasonId: string, raw: unknown): DisneySeriesPage | null {
  const id = seasonId.toLowerCase();
  if (!page.seasons.some((season) => season.id === id)) return null;
  const data = record(record(raw).data);
  const body = isRecord(data.season) ? data.season : data;
  const update = reduceSeason(body, id);
  return {
    ...page,
    internalTitle: page.internalTitle ?? internalTitles(list(body.items))[0] ?? null,
    selectedSeasonId: id,
    seasons: page.seasons.map((season) =>
      season.id === id && update
        ? {
            ...season,
            name: season.name ?? update.name,
            seasonNumber: update.seasonNumber ?? season.seasonNumber,
            episodeCount: update.episodeCount ?? season.episodeCount,
            episodeMinutes: update.episodeMinutes ?? season.episodeMinutes,
          }
        : season,
    ),
  };
}

/** Vrai si la fiche décrit la vidéo `id` (identifiant de l'URL, de la requête ou de la réponse) */
export function hasDisneyId(entry: Pick<DisneyPlayerExperience, 'ids'>, id: string): boolean {
  return entry.ids.includes(id.toLowerCase());
}
