// Données de détail de Prime Video (page d'une saison ou d'un film), réduites à ce dont SyncKai a besoin : fonctions
// PURES, sans DOM ni chrome.*, partagées par le pont du monde MAIN (réponses `/detail/` et `getDetailWidgets` du site),
// le script isolé (nœud d'hydratation `#dv-web-page-hydration-data` du premier chargement) et les tests.
//
// Formes relevées le 2026-10-14 (Chrome, primevideo.com/region/eu, interface anglaise) ; tout champ absent ou d'un type
// inattendu est ignoré, une forme inconnue donne null (jamais d'exception) :
// - hydratation `init.preparations.body` et réponse JSON de `/detail/{id}` (navigation SPA, racine exacte inconnue) :
//   `atf.state` (`pageTitleId`, `detail.headerDetail.{gti}`, `self.{gti}`, `seasons.{gti}[]`, `metadata.{gti}`) et
//   `btf.state.detail.detail.{gti}` (un nœud par épisode) ;
// - `getDetailWidgets` : `widgets.buybox.bestSelf` (épisode en lecture), `widgets.episodeList.episodes[]`,
//   `widgets.seasonSelector[]`.
// Genres (`av_genre_*`) et pistes audio (`audioTracks`) : chemin exact inconnu, cherchés dans le détail du titre, à défaut
// dans tout le document.
import type { PrimeAnimeVerdict } from './episode.types';
import { isRecord } from './guards';
import { stripVersionTags } from './title';

/** GTI complet (« amzn1.dv.gti.{uuid} »), minuscules */
export const PRIME_GTI_REGEX = /^amzn1\.dv\.gti\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** GTI compact (26 caractères, chemin /detail/{id}), majuscules */
export const PRIME_COMPACT_GTI_REGEX = /^[0-9A-Z]{26}$/;
/** ASIN (10 caractères), majuscules : anciens liens et pages régionales */
export const PRIME_ASIN_REGEX = /^[0-9A-Z]{10}$/;

/** Bornes de la réduction */
export const PRIME_MAX_TEXT = 300;
export const PRIME_MAX_EPISODES = 300;
export const PRIME_MAX_SEASONS = 50;
export const PRIME_MAX_GENRES = 16;
/** Nœuds parcourus au plus par une recherche dans le document (genres, pistes audio, racine `atf`/`btf`) */
const MAX_WALK_NODES = 60_000;
const MAX_WALK_DEPTH = 40;
/** Durée plausible d'un épisode ou d'un film (s) : 12 h */
const MAX_DURATION_S = 12 * 3_600;

/** Épisode d'une saison */
export interface PrimeEpisode {
  gti: string;
  compactGTI: string | null;
  /** Numéro dans la saison */
  episodeNumber: number | null;
  /** Titre localisé (affichage seulement) */
  title: string | null;
  durationS: number | null;
}

/** Saison listée dans le sélecteur (chaque saison a sa propre page de détail) */
export interface PrimeSeason {
  gti: string | null;
  compactGTI: string | null;
  seasonNumber: number | null;
}

/** Page de détail réduite (saison ou film) : seuls ces champs quittent le monde MAIN */
export interface PrimeTitle {
  /** GTI de la saison (ou du film) : `pageTitleId` */
  seasonGti: string;
  /** GTI compact de la page (URL /detail/{compactGTI}) */
  compactGTI: string | null;
  /** Titre de la série (`parentTitle`), sans mention de version */
  seriesTitle: string;
  /** « season », « movie »… (minuscules) */
  titleType: string | null;
  seasonNumber: number | null;
  /** `metadata.{gti}.episodeCount` (« 12 episodes »), sinon nombre d'épisodes lus */
  episodeCount: number | null;
  seasons: PrimeSeason[];
  episodes: PrimeEpisode[];
  /** Identifiants de genre (`av_genre_anime`, `av_genre_animation_adult_interest`…) */
  genres: string[];
  /** Une piste audio japonaise (« 日本語… ») est proposée */
  japaneseAudio: boolean;
}

/** Réponse `getDetailWidgets` réduite (envoyée à chaque changement d'épisode) */
export interface PrimeDetailWidgets {
  /** GTI de la saison (`buybox.titleID`, sinon `pageContext.pageTitleId`) */
  seasonGti: string | null;
  /** Épisode en lecture (`buybox.bestSelf`), null s'il n'est pas un épisode */
  bestSelf: { gti: string; compactGTI: string | null; sequenceNumber: number | null } | null;
  episodes: PrimeEpisode[];
  seasons: PrimeSeason[];
}

// ─── Lecture tolérante ────────────────────────────────────────────────────

const record = (value: unknown): Record<string, unknown> => (isRecord(value) && !Array.isArray(value) ? value : {});
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/** Texte nettoyé et tronqué ; null si absent ou vide */
export function primeText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/\s+/g, ' ').trim();
  return cleaned ? cleaned.slice(0, PRIME_MAX_TEXT) : null;
}

/** Entier de 0 à `max` (nombre, ou chaîne de chiffres), sinon null */
function integer(value: unknown, max: number, min = 0): number | null {
  const n = typeof value === 'string' && /^\d{1,6}$/.test(value) ? Number(value) : value;
  return typeof n === 'number' && Number.isSafeInteger(n) && n >= min && n <= max ? n : null;
}

/** Durée en secondes (nombre positif plausible), arrondie */
function duration(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= MAX_DURATION_S ? Math.round(value) : null;
}

/** GTI complet en minuscules, sinon null */
export function primeGti(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const lower = value.trim().toLowerCase();
  return PRIME_GTI_REGEX.test(lower) ? lower : null;
}

/** GTI compact en majuscules, sinon null */
export function primeCompactGti(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const upper = value.trim().toUpperCase();
  return PRIME_COMPACT_GTI_REGEX.test(upper) ? upper : null;
}

/**
 * Identifiant Prime Video quelconque (GTI, GTI compact, ASIN) sous sa forme canonique (GTI en minuscules, les autres en
 * majuscules), sinon null
 */
export function primeId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const gti = primeGti(value);
  if (gti) return gti;
  const upper = value.trim().toUpperCase();
  return PRIME_COMPACT_GTI_REGEX.test(upper) || PRIME_ASIN_REGEX.test(upper) ? upper : null;
}

/** Chemin d'une page de détail : /[region/{xx}/][-/{langue}/]detail/{id}[/…] */
const DETAIL_PATH = /^\/(?:region\/[a-z]{2}\/)?(?:-\/[a-z]{2}(?:[-_][a-z]{2})?\/)?detail\/([^/?#]+)(?:\/|$)/i;

/** Identifiant de la page de détail d'un chemin (GTI compact, ASIN ou GTI), sinon null */
export function parsePrimeDetailId(pathname: string): string | null {
  const raw = DETAIL_PATH.exec(pathname)?.[1];
  if (raw === undefined) return null;
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  return primeId(decoded);
}

/** Lien de saison (« /region/eu/detail/0GMSR5…?ref_=… ») → GTI compact, sinon null */
function compactFromLink(link: unknown): string | null {
  if (typeof link !== 'string' || link.length > 2_000) return null;
  try {
    return primeCompactGti(parsePrimeDetailId(new URL(link, 'https://www.primevideo.com/').pathname));
  } catch {
    return null;
  }
}

/** Domaines Amazon d'un lien AniList vers Prime Video (boutique : amazon.com, amazon.co.uk, amazon.de, amazon.co.jp…) */
const AMAZON_HOST = /^(?:www\.|smile\.)?amazon\.(?:com|ca|com\.mx|com\.br|co\.uk|de|fr|it|es|nl|se|pl|com\.tr|co\.jp|in|com\.au|sg|ae|sa|eg)$/;

/**
 * Identifiant Prime Video d'un lien AniList (primevideo.com ou amazon.<tld>) : /detail/{id}, /dp/{id}, /gp/video/detail/{id},
 * paramètre `gti`. Lecture seulement (le service worker décidera du rapprochement) ; null pour un autre site ou une autre page.
 */
export function primeIdInLink(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase();
  const prime = host === 'primevideo.com' || host.endsWith('.primevideo.com');
  if (!prime && !AMAZON_HOST.test(host)) return null;
  const fromQuery = primeGti(parsed.searchParams.get('gti'));
  if (fromQuery) return fromQuery;
  const detail = parsePrimeDetailId(parsed.pathname);
  if (detail) return detail;
  if (prime) return null;
  const dp = /^\/(?:[^/]+\/)?(?:dp|gp\/video\/detail|gp\/product)\/([0-9A-Za-z]{10})(?:[/?]|$)/.exec(parsed.pathname)?.[1];
  return dp ? primeId(dp) : null;
}

// ─── Parcours borné ───────────────────────────────────────────────────────

/** Visite chaque valeur (objets et tableaux compris) en largeur, bornée en nombre de nœuds et en profondeur ; `visit` → true : arrêt */
function walk(root: unknown, visit: (value: unknown, key: string | null) => boolean): void {
  const queue: { value: unknown; key: string | null; depth: number }[] = [{ value: root, key: null, depth: 0 }];
  let visited = 0;
  for (let head = 0; head < queue.length; head++) {
    const item = queue[head];
    if (!item || ++visited > MAX_WALK_NODES) return;
    if (visit(item.value, item.key)) return;
    if (item.depth >= MAX_WALK_DEPTH || !isRecord(item.value)) continue;
    if (Array.isArray(item.value)) for (const child of item.value) queue.push({ value: child, key: item.key, depth: item.depth + 1 });
    else for (const [key, child] of Object.entries(item.value)) queue.push({ value: child, key, depth: item.depth + 1 });
  }
}

const GENRE_ID = /^av_genre_[a-z_]{1,60}$/;

/** Identifiants `av_genre_*` trouvés sous `root` (sans doublon, ordre de rencontre, bornés) */
function genresUnder(root: unknown): string[] {
  const genres = new Set<string>();
  walk(root, (value) => {
    if (typeof value === 'string' && GENRE_ID.test(value)) genres.add(value);
    return genres.size >= PRIME_MAX_GENRES;
  });
  return [...genres];
}

/** Vrai si une liste `audioTracks` sous `root` propose le japonais (« 日本語 », « 日本語 [Audio Description] »…) ; null sans liste */
function japaneseAudioUnder(root: unknown): boolean | null {
  let found: boolean | null = null;
  walk(root, (value, key) => {
    if (key !== 'audioTracks' || !Array.isArray(value)) return false;
    found = found === true || value.some((track) => typeof track === 'string' && track.trim().startsWith('日本語'));
    return found;
  });
  return found;
}

/** Objet portant `atf.state` ou `btf.state` (racine `init.preparations.body`, `{ body }`, `{ page: [{ body }] }`…) */
function findDetailBody(raw: unknown): Record<string, unknown> | null {
  const direct = record(record(record(record(raw).init).preparations).body);
  if (isDetailBody(direct)) return direct;
  let body: Record<string, unknown> | null = null;
  walk(raw, (value) => {
    if (isDetailBody(value)) body = value;
    return body !== null;
  });
  return body;
}

function isDetailBody(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && !Array.isArray(value) && (isRecord(record(value.atf).state) || isRecord(record(value.btf).state));
}

// ─── Page de détail ───────────────────────────────────────────────────────

/** Épisode d'un nœud de détail (`btf.state.detail.detail.{gti}` ou `episodeList.episodes[].detail`) */
function episodeOf(gti: string, detail: Record<string, unknown>, self: Record<string, unknown>): PrimeEpisode {
  return {
    gti,
    compactGTI: primeCompactGti(self.compactGTI),
    episodeNumber: integer(detail.episodeNumber, 99_999) ?? integer(self.sequenceNumber, 99_999),
    title: primeText(detail.title),
    durationS: duration(detail.duration),
  };
}

const byEpisodeNumber = (a: PrimeEpisode, b: PrimeEpisode): number => (a.episodeNumber ?? Infinity) - (b.episodeNumber ?? Infinity);

function seasonsOf(values: unknown, idKey: 'seasonId' | 'titleID'): PrimeSeason[] {
  return list(values)
    .slice(0, PRIME_MAX_SEASONS)
    .flatMap((value) => {
      const season = record(value);
      const gti = primeGti(season[idKey]);
      const compactGTI = compactFromLink(season.seasonLink);
      return gti || compactGTI ? [{ gti, compactGTI, seasonNumber: integer(season.sequenceNumber, 999) }] : [];
    });
}

/** « 12 episodes », « 12 épisodes », 12 → 12 */
function episodeCountOf(value: unknown): number | null {
  if (typeof value === 'number') return integer(value, 10_000, 1);
  const digits = typeof value === 'string' ? /\d{1,5}/.exec(value)?.[0] : undefined;
  return digits !== undefined ? integer(Number(digits), 10_000, 1) : null;
}

/**
 * Réduit les données de détail (nœud d'hydratation du premier chargement, ou réponse JSON de `/detail/{id}` après une
 * navigation SPA) à `PrimeTitle`. Null si la forme est inattendue ou sans titre de série.
 */
export function reducePrimeDetail(raw: unknown): PrimeTitle | null {
  const body = findDetailBody(raw);
  if (!body) return null;
  const atf = record(record(body.atf).state);
  const btf = record(record(body.btf).state);
  const seasonGti = primeGti(atf.pageTitleId) ?? primeGti(record(atf.pageContext).pageTitleId) ?? primeGti(record(btf.pageContext).pageTitleId);
  if (!seasonGti) return null;
  const header = record(record(record(atf.detail).headerDetail)[seasonGti]);
  const btfDetails = record(record(btf.detail).detail);
  const ownDetail = record(btfDetails[seasonGti]);
  const self = { ...record(record(btf.self)[seasonGti]), ...record(record(atf.self)[seasonGti]) };
  const seriesTitle = primeText(header.parentTitle) ?? primeText(ownDetail.parentTitle) ?? primeText(header.title) ?? primeText(ownDetail.title);
  if (!seriesTitle) return null;

  const selfs = { ...record(btf.self), ...record(atf.self) };
  const episodes = Object.entries(btfDetails)
    .flatMap(([key, value]) => {
      const gti = primeGti(key);
      const detail = record(value);
      return gti && gti !== seasonGti && primeText(detail.titleType)?.toLowerCase() === 'episode' ? [episodeOf(gti, detail, record(selfs[gti]))] : [];
    })
    .sort(byEpisodeNumber)
    .slice(0, PRIME_MAX_EPISODES);

  // Genres et pistes audio : détail du titre d'abord (les carrousels de suggestions en portent d'autres), sinon le document
  const scoped = [header, ownDetail, record(record(atf.metadata)[seasonGti])];
  const genres = genresUnder(scoped);
  const audio = japaneseAudioUnder(scoped);
  const titleType = primeText(header.titleType ?? ownDetail.titleType ?? self.titleType)?.toLowerCase() ?? null;
  return {
    seasonGti,
    compactGTI: primeCompactGti(self.compactGTI),
    seriesTitle: stripVersionTags(seriesTitle),
    titleType: titleType && /^[a-z_]{1,32}$/.test(titleType) ? titleType : null,
    seasonNumber: integer(header.seasonNumber ?? ownDetail.seasonNumber, 999) ?? (titleType === 'season' ? integer(self.sequenceNumber, 999) : null),
    episodeCount: episodeCountOf(record(record(atf.metadata)[seasonGti]).episodeCount) ?? (episodes.length > 0 ? episodes.length : null),
    seasons: seasonsOf(record(atf.seasons)[seasonGti], 'seasonId'),
    episodes,
    genres: genres.length > 0 ? genres : genresUnder(body),
    japaneseAudio: audio ?? japaneseAudioUnder(body) ?? false,
  };
}

/** Réduit la réponse `getDetailWidgets` (`{ widgets: { buybox, episodeList, seasonSelector, pageContext } }`). Null sans `widgets`. */
export function reducePrimeDetailWidgets(raw: unknown): PrimeDetailWidgets | null {
  const widgets = record(raw).widgets;
  if (!isRecord(widgets) || Array.isArray(widgets)) return null;
  const buybox = record(widgets.buybox);
  const best = record(buybox.bestSelf);
  const bestGti = primeText(best.titleType)?.toLowerCase() === 'episode' ? primeGti(best.gti) : null;
  const episodes = list(record(widgets.episodeList).episodes)
    .slice(0, PRIME_MAX_EPISODES)
    .flatMap((value) => {
      const item = record(value);
      const self = record(item.self);
      const gti = primeGti(self.gti) ?? primeGti(item.titleID);
      return gti ? [episodeOf(gti, record(item.detail), self)] : [];
    })
    .sort(byEpisodeNumber);
  return {
    seasonGti: primeGti(buybox.titleID) ?? primeGti(record(widgets.pageContext).pageTitleId),
    bestSelf: bestGti ? { gti: bestGti, compactGTI: primeCompactGti(best.compactGTI), sequenceNumber: integer(best.sequenceNumber, 99_999) } : null,
    episodes,
    seasons: seasonsOf(widgets.seasonSelector, 'titleID'),
  };
}

/** Titre complété par les widgets de la même saison (épisodes manquants ajoutés, champs manquants complétés) */
export function withPrimeWidgets(title: PrimeTitle, widgets: PrimeDetailWidgets): PrimeTitle {
  if (widgets.seasonGti !== title.seasonGti) return title;
  const known = new Map(title.episodes.map((episode) => [episode.gti, episode]));
  for (const episode of widgets.episodes) {
    const previous = known.get(episode.gti);
    known.set(episode.gti, previous ? { ...previous, compactGTI: previous.compactGTI ?? episode.compactGTI, durationS: previous.durationS ?? episode.durationS } : episode);
  }
  return {
    ...title,
    episodes: [...known.values()].sort(byEpisodeNumber).slice(0, PRIME_MAX_EPISODES),
    seasons: title.seasons.length > 0 ? title.seasons : widgets.seasons,
  };
}

/** Vrai si le titre décrit l'identifiant `id` (saison, page ou l'un de ses épisodes) */
export function primeTitleHas(title: PrimeTitle, id: string): boolean {
  return title.seasonGti === id || title.compactGTI === id || title.episodes.some((episode) => episode.gti === id || episode.compactGTI === id);
}

// ─── Filtre « anime » ─────────────────────────────────────────────────────

/**
 * Verdict « anime » d'un titre Prime Video (décision du 2026-10-14) :
 * - `av_genre_anime` → `anime` ;
 * - un autre genre `av_genre_animation*` (`animation_adult_interest`, partagé avec l'animation occidentale) : avec une piste
 *   audio japonaise → `animation-ja` (résolution normale), sans → `animation-exact-only` (suivi seulement sur un titre
 *   AniList exact) ;
 * - aucun genre d'animation, ou aucun genre lu → `ignored` (rien envoyé, en silence).
 */
export function primeAnimeVerdict(genres: readonly string[], japaneseAudio: boolean): PrimeAnimeVerdict {
  if (genres.includes('av_genre_anime')) return 'anime';
  if (genres.some((genre) => genre.startsWith('av_genre_animation'))) return japaneseAudio ? 'animation-ja' : 'animation-exact-only';
  return 'ignored';
}

// ─── Revalidation (monde isolé : la page peut émettre n'importe quoi) ─────

const isNullableText = (v: unknown): v is string | null => v === null || (typeof v === 'string' && v.length > 0 && v.length <= PRIME_MAX_TEXT);
const isNullableInt = (v: unknown, max: number): v is number | null => v === null || integer(v, max) === v;
const isGti = (v: unknown): v is string => typeof v === 'string' && PRIME_GTI_REGEX.test(v);
const isNullableGti = (v: unknown): v is string | null => v === null || isGti(v);
const isNullableCompact = (v: unknown): v is string | null => v === null || (typeof v === 'string' && PRIME_COMPACT_GTI_REGEX.test(v));

function isPrimeEpisode(value: unknown): value is PrimeEpisode {
  return (
    isRecord(value) &&
    isGti(value.gti) &&
    isNullableCompact(value.compactGTI) &&
    isNullableInt(value.episodeNumber, 99_999) &&
    isNullableText(value.title) &&
    (value.durationS === null || duration(value.durationS) === value.durationS)
  );
}

function isPrimeSeason(value: unknown): value is PrimeSeason {
  return isRecord(value) && isNullableGti(value.gti) && isNullableCompact(value.compactGTI) && isNullableInt(value.seasonNumber, 999);
}

export function isPrimeTitle(value: unknown): value is PrimeTitle {
  return (
    isRecord(value) &&
    isGti(value.seasonGti) &&
    isNullableCompact(value.compactGTI) &&
    typeof value.seriesTitle === 'string' &&
    isNullableText(value.seriesTitle) &&
    (value.titleType === null || (typeof value.titleType === 'string' && /^[a-z_]{1,32}$/.test(value.titleType))) &&
    isNullableInt(value.seasonNumber, 999) &&
    (value.episodeCount === null || integer(value.episodeCount, 10_000, 1) === value.episodeCount) &&
    Array.isArray(value.seasons) &&
    value.seasons.length <= PRIME_MAX_SEASONS &&
    value.seasons.every(isPrimeSeason) &&
    Array.isArray(value.episodes) &&
    value.episodes.length <= PRIME_MAX_EPISODES &&
    value.episodes.every(isPrimeEpisode) &&
    Array.isArray(value.genres) &&
    value.genres.length <= PRIME_MAX_GENRES &&
    value.genres.every((genre) => typeof genre === 'string' && GENRE_ID.test(genre)) &&
    typeof value.japaneseAudio === 'boolean'
  );
}

export function isPrimeDetailWidgets(value: unknown): value is PrimeDetailWidgets {
  if (!isRecord(value) || !isNullableGti(value.seasonGti)) return false;
  const best: unknown = value.bestSelf;
  return (
    (best === null || (isRecord(best) && isGti(best.gti) && isNullableCompact(best.compactGTI) && isNullableInt(best.sequenceNumber, 99_999))) &&
    Array.isArray(value.episodes) &&
    value.episodes.length <= PRIME_MAX_EPISODES &&
    value.episodes.every(isPrimeEpisode) &&
    Array.isArray(value.seasons) &&
    value.seasons.length <= PRIME_MAX_SEASONS &&
    value.seasons.every(isPrimeSeason)
  );
}
