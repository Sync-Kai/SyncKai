import type { CrHistoryErrorCode, HistorySeason } from './cr-history';
import { isRecord } from './guards';
import { episodeNumbers, netflixSignals, platformSeasonsOf, type NetflixBookmark, type NetflixShowMetadata } from './netflix-metadata';
import type { Result } from './result';
import type { CompletionTrigger } from './settings';
import { meaningfulSeasonTitle, normalizeTitle } from './title';

// Import de l'historique Netflix (pur, testé), dans la page d'import : lecture de la page Activité de visionnage du profil
// (netflix.com/viewingactivity) en pilotant l'onglet, regroupement des lignes par série, filtre « anime » (AniList, dans
// le service worker), puis métadonnées des seules séries retenues → une ligne par saison (HistorySeason), analysée par le
// même pipeline que Crunchyroll et ADN. Numérotation et clés identiques à la synchro en direct (netflix-metadata.ts).
//
// Budget de requêtes (≈ 300 titres distincts dans un historique de 1 900 lignes) :
// 1. lignes : clics sur « Voir plus » du site (≈ 20 lignes par clic, au plus un par seconde), aucune requête de SyncKai ;
// 2. filtre : une recherche AniList par titre, NETFLIX_TITLES_PER_REQUEST titres par requête GraphQL (alias) → 30 requêtes
//    de fond pour 300 titres (≈ 1,5 min à 20 requêtes de fond par minute), résultats mis en cache comme searchAnime ;
// 3. métadonnées Netflix : une requête par série gardée (lien AniList vers Netflix, ou titre identique), espacées ;
// 4. analyse : le résolveur de la synchro en direct, saison par saison (recherche du titre anglais, souvent déjà en cache).

// ─── Lignes de l'historique ───────────────────────────────────────────────

/** Ligne de l'historique : vidéo (épisode, ou film) et texte de son lien (« Série : Saison : "Épisode" ») */
export interface NetflixHistoryRow {
  id: string;
  text: string;
}

/** Lignes lues au plus (au-delà : historique déclaré partiel) */
export const MAX_NETFLIX_HISTORY_ROWS = 6000;

const clean = (value: string): string => value.replace(/\s+/g, ' ').trim();

/** Ligne relue de l'onglet ({ href, text } du lien du titre) ; null si illisible */
export function parseNetflixRow(raw: unknown): NetflixHistoryRow | null {
  if (!isRecord(raw) || typeof raw.href !== 'string' || typeof raw.text !== 'string') return null;
  const id = /\/title\/(\d{1,12})(?:[/?#]|$)/.exec(raw.href)?.[1];
  const text = clean(raw.text).slice(0, 300);
  return id && text ? { id, text } : null;
}

// Guillemets des titres d'épisode, quelle que soit la langue du profil Netflix (ouvrants comme fermants) : "…", “…”,
// ”…”, „…“, „…”, «…», »…«, ‹…›, ‚…‘, ‘…’, 「…」, 『…』. Séparateur : « : » suivi d'une espace (« Re:ZERO » n'est pas
// coupé) ou deux-points pleine chasse « ： » (chinois, japonais ; format de ces profils non relevé)
/** Fin de ligne entre guillemets (titre de l'épisode), après le DERNIER séparateur qui la précède */
const QUOTED_EPISODE = /^(.*)\s*(?::\s+|：\s*)[«»„“”‚‘’"「」『』‹›](.*)$/s;
/** Guillemets fermants en fin de titre d'épisode */
const CLOSING_QUOTES = /[«»„“”‚‘’"「」『』‹›]+$/;
/** Dernier séparateur « : » ou « ： » */
const LAST_SEPARATOR = /^(.+)\s*(?::\s+|：\s*)(.+)$/s;

export interface NetflixRowTitle {
  series: string;
  /** Saison ou arc (« Saison 1 », « Elbaph Arc », « Mini-série »), null sans */
  season: string | null;
  /** Titre de l'épisode, null pour un film */
  episode: string | null;
}

/**
 * Texte du lien d'une ligne → série, saison, épisode. Formats relevés (FR « : », EN / DE « : ») :
 * « Ranma ½ : Saison 1 : "Épisode 1" », « One Piece: Elbaph Arc: "Episode 1180" », « Le Voyage de Chihiro » (film) ;
 * guillemets des autres langues acceptés (voir QUOTED_EPISODE).
 * L'épisode est la partie finale entre guillemets ; la saison, le dernier segment avant lui ; la série, tout le reste
 * (un titre qui contient « : » sans saison perd son dernier segment : la recherche AniList le retrouve quand même).
 * Sans guillemets : film (titre entier, deux-points compris).
 */
export function splitNetflixTitle(text: string): NetflixRowTitle {
  const value = clean(text);
  const quoted = QUOTED_EPISODE.exec(value);
  if (!quoted) return { series: value, season: null, episode: null };
  const head = clean(quoted[1] ?? '');
  const episode = clean((quoted[2] ?? '').replace(CLOSING_QUOTES, '')) || null;
  const split = LAST_SEPARATOR.exec(head);
  const series = split ? clean(split[1] ?? '') : head;
  return series ? { series, season: split ? clean(split[2] ?? '') : null, episode } : { series: value, season: null, episode: null };
}

/** Série vue dans l'historique (lignes regroupées par titre de série normalisé) */
export interface NetflixTitleGroup {
  /** Titre de la série tel qu'affiché (langue du profil), cherché sur AniList */
  title: string;
  /** Vidéos de la série, la plus récente d'abord (3 au plus : la suivante sert si les métadonnées manquent) */
  movieIds: string[];
}

/** Vidéos gardées par série (métadonnées introuvables pour la première : épisode retiré du catalogue) */
export const NETFLIX_IDS_PER_TITLE = 3;

/** Lignes (plus récentes d'abord) → séries distinctes, dans l'ordre du dernier visionnage */
export function groupNetflixRows(rows: readonly NetflixHistoryRow[]): NetflixTitleGroup[] {
  const groups = new Map<string, NetflixTitleGroup>();
  for (const row of rows) {
    const { series } = splitNetflixTitle(row.text);
    const key = normalizeTitle(series) || series.toLowerCase();
    const group = groups.get(key);
    if (!group) groups.set(key, { title: series, movieIds: [row.id] });
    else if (group.movieIds.length < NETFLIX_IDS_PER_TITLE && !group.movieIds.includes(row.id)) group.movieIds.push(row.id);
  }
  return [...groups.values()];
}

// ─── Lecture de l'onglet (pilotée par la page d'import) ───────────────────

export type NetflixTabOp = 'state' | 'click' | 'rows' | 'show';

/**
 * Exécutée DANS l'onglet Netflix par chrome.scripting.executeScript (monde isolé de l'extension, celui du script de
 * contenu ; jamais le monde de la page) : AUTONOME, le navigateur n'en transmet que le texte (aucune référence à un import
 * ni à une constante de ce module). Hypothèses sur le DOM relevées le 2026-10-12 (profil français) : lignes
 * `li.retableRow`, lien du titre `a[href="/title/{id}"]`, bouton « Voir plus » (« Show more », « Mehr anzeigen ») hors des
 * lignes. Ne clique JAMAIS sur autre chose que ce bouton (ni « Masquer dans l'historique », ni « Signaler un problème »).
 * Libellé du bouton dans la langue du PROFIL Netflix (pas celle de SyncKai) : FR / EN / DE relevés sur le site, les autres
 * d'après l'article d'aide officiel de Netflix (help.netflix.com/<langue>/node/101917) ; langue absente (chinois
 * simplifié, coréen : libellé non vérifié) → bouton jamais trouvé, seules les premières lignes sont lues.
 * - state : chemin, lignes affichées, bouton présent, choix du profil affiché, liste présente ;
 * - click : un clic sur « Voir plus » (true s'il existait) ;
 * - rows  : { href, text } du lien de chaque ligne ;
 * - show  : métadonnées réduites de la série de `movieId`, AVEC les points de lecture, demandées par le script de contenu
 *           Netflix (fonction exposée sous Symbol.for(`hook`)) au pont du monde MAIN ; 'absent' sans script de contenu.
 */
export function netflixTabOp(op: NetflixTabOp, hook: string, movieId: string): unknown {
  const row = 'li.retableRow';
  // « Voir plus » en minuscules (NFC) : FR / EN / DE (site), puis it, es / es-419, pt-BR, nl, sv, pl, cs, ro, ru, uk, tr,
  // id, vi, ja, zh-TW, zh-CN, ko (help.netflix.com/<langue>/node/101917)
  const labels = [
    'voir plus',
    'afficher plus',
    'show more',
    'see more',
    'load more',
    'mehr anzeigen',
    'weitere anzeigen',
    'mehr laden',
    'mostra altri',
    'mostrar más',
    'mostrar mais',
    'meer weergeven',
    'visa mer',
    'pokaż więcej',
    'zobrazit více',
    'mai multe',
    'показать еще',
    'показать ещё',
    'показати більше',
    'daha fazla göster',
    'tampilkan lainnya',
    'hiển thị thêm',
    'その他を表示',
    '顯示更多',
    '显示更多',
    '더 보기',
  ].map((label) => label.normalize('NFC'));
  const text = (value: string | null | undefined): string => (value ?? '').replace(/\s+/g, ' ').trim();
  const more = (): HTMLButtonElement | undefined =>
    [...document.querySelectorAll('button')].find(
      (button) => !button.disabled && !button.closest(row) && labels.includes(text(button.textContent).normalize('NFC').toLowerCase()),
    );
  if (op === 'state') {
    return {
      path: location.pathname,
      rows: document.querySelectorAll(row).length,
      more: more() !== undefined,
      gate: document.querySelector('.profile-gate-container, .list-profiles') !== null,
      list: document.querySelector('.retable') !== null,
    };
  }
  if (op === 'click') {
    const button = more();
    button?.click();
    return button !== undefined;
  }
  if (op === 'rows') {
    return [...document.querySelectorAll(row)].map((item) => {
      const link = item.querySelector('a[href*="/title/"]');
      return { href: link?.getAttribute('href') ?? '', text: text(link?.textContent).slice(0, 300) };
    });
  }
  const load: unknown = Reflect.get(globalThis, Symbol.for(hook));
  return typeof load === 'function' ? (Reflect.apply(load, undefined, [movieId]) as unknown) : 'absent';
}

/** État de la page Activité relu de l'onglet */
export interface NetflixPageState {
  path: string;
  rows: number;
  more: boolean;
  /** Choix du profil (« Qui est-ce ? ») affiché à la place */
  gate: boolean;
  /** Liste de l'historique présente (vide : aucun visionnage) */
  list: boolean;
}

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

export function isNetflixPageState(value: unknown): value is NetflixPageState {
  return isRecord(value) && typeof value.path === 'string' && isCount(value.rows) && typeof value.more === 'boolean' && typeof value.gate === 'boolean' && typeof value.list === 'boolean';
}

/** Page Activité de visionnage du profil : /viewingactivity, éventuellement précédée du pays */
const ACTIVITY_PATH = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?viewingactivity\/?$/i;
const LOGIN_PATH = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(?:login|signup)(?:\/|$)/i;

/** Page qui ne permet pas la lecture : déconnecté (ou choix du profil), autre page de Netflix ; null si c'est la bonne */
export function netflixPageProblem(state: NetflixPageState): CrHistoryErrorCode | null {
  if (LOGIN_PATH.test(state.path) || state.gate) return 'logged-out';
  return ACTIVITY_PATH.test(state.path) ? null : 'wrong-page';
}

/** Au plus un clic par seconde ; nouvelles lignes attendues au plus 8 s, vérifiées toutes les 250 ms */
export const NETFLIX_CLICK_GAP_MS = 1_000;
export const NETFLIX_GROWTH_TIMEOUT_MS = 8_000;
export const NETFLIX_POLL_MS = 250;
/** Clics de suite sans nouvelle ligne avant d'abandonner (historique déclaré partiel) */
export const NETFLIX_MAX_STALLS = 3;
/** Garde-fou : clics au plus (≈ 20 lignes par clic) */
export const NETFLIX_MAX_CLICKS = 400;
/** Lignes de la première page de l'historique : au-delà, Netflix affiche « Voir plus » */
export const NETFLIX_PAGE_ROWS = 20;
/** Attente des premières lignes (page en cours de chargement) */
export const NETFLIX_READY_TIMEOUT_MS = 15_000;

/** Onglet Netflix piloté (scripting.executeScript dans la page d'import, simulé dans les tests) ; réponses à revalider */
export interface NetflixTab {
  state(): Promise<unknown>;
  clickMore(): Promise<unknown>;
  rows(): Promise<unknown>;
}

export interface NetflixReadDeps {
  sleep: (ms: number) => Promise<void>;
  /** Lecture abandonnée (« Arrêter », page fermée) */
  stopped: () => boolean;
}

export interface NetflixHistoryRead {
  rows: NetflixHistoryRow[];
  clicks: number;
  /** Bouton toujours là après NETFLIX_MAX_STALLS clics sans effet, ou limite atteinte : historique le plus ancien non lu */
  partial: boolean;
  /**
   * Aucun bouton reconnu sur une première page pleine (≥ NETFLIX_PAGE_ROWS lignes) : profil Netflix dans une langue dont
   * le libellé « Voir plus » est inconnu, historique sans doute plus long (ou exactement une page, sans moyen de le savoir)
   */
  moreUnrecognized: boolean;
}

/** Échec de lecture (code affiché par la page), ou null si la lecture a été arrêtée */
export type NetflixReadResult = { ok: true; read: NetflixHistoryRead } | { ok: false; code: CrHistoryErrorCode } | null;

/** État relu ; forme inattendue → la page n'est plus celle attendue (« site modifié ») */
async function readState(tab: NetflixTab): Promise<NetflixPageState | null> {
  const state = await tab.state();
  return isNetflixPageState(state) ? state : null;
}

/**
 * Lit tout l'historique : attend les premières lignes, puis clique sur « Voir plus » tant qu'il existe. Après chaque clic,
 * attend de nouvelles lignes (au plus NETFLIX_GROWTH_TIMEOUT_MS) et au moins NETFLIX_CLICK_GAP_MS. Arrêt : bouton absent
 * (fin de l'historique), MAX_NETFLIX_HISTORY_ROWS lignes, NETFLIX_MAX_CLICKS clics ou NETFLIX_MAX_STALLS clics de suite sans
 * nouvelle ligne (ces trois cas : partiel). Les erreurs de l'onglet (fermé, rechargé) sont levées.
 */
export async function readNetflixHistory(tab: NetflixTab, deps: NetflixReadDeps, onProgress: (rows: number, clicks: number) => void): Promise<NetflixReadResult> {
  // a) Page prête
  let state: NetflixPageState | null = null;
  for (let waited = 0; ; waited += NETFLIX_POLL_MS) {
    if (deps.stopped()) return null;
    state = await readState(tab);
    if (!state) return { ok: false, code: 'unavailable' };
    const problem = netflixPageProblem(state);
    if (problem) return { ok: false, code: problem };
    if (state.rows > 0) break;
    if (waited >= NETFLIX_READY_TIMEOUT_MS) {
      // Liste présente mais vide : aucun visionnage ; sinon la page a changé
      return state.list ? { ok: true, read: { rows: [], clicks: 0, partial: false, moreUnrecognized: false } } : { ok: false, code: 'unavailable' };
    }
    await deps.sleep(NETFLIX_POLL_MS);
  }

  // b) « Voir plus » jusqu'à la fin
  let clicks = 0;
  let stalls = 0;
  let partial = false;
  for (;;) {
    const before = state.rows;
    onProgress(before, clicks);
    // Vérifié juste avant chaque clic : « Arrêter » n'est jamais suivi d'un clic de plus
    if (deps.stopped()) return null;
    if (before >= MAX_NETFLIX_HISTORY_ROWS || clicks >= NETFLIX_MAX_CLICKS) {
      partial = state.more;
      break;
    }
    if (!state.more) break;
    if ((await tab.clickMore()) !== true) break;
    clicks++;
    let waited = 0;
    for (;;) {
      await deps.sleep(NETFLIX_POLL_MS);
      waited += NETFLIX_POLL_MS;
      if (deps.stopped()) return null;
      const next = await readState(tab);
      if (!next) return { ok: false, code: 'unavailable' };
      state = next;
      if ((state.rows > before && waited >= NETFLIX_CLICK_GAP_MS) || waited >= NETFLIX_GROWTH_TIMEOUT_MS) break;
    }
    stalls = state.rows > before ? 0 : stalls + 1;
    if (stalls >= NETFLIX_MAX_STALLS) {
      partial = state.more;
      break;
    }
  }

  // c) Lignes
  const raw = await tab.rows();
  const rows = (Array.isArray(raw) ? raw : []).flatMap((item) => parseNetflixRow(item) ?? []).slice(0, MAX_NETFLIX_HISTORY_ROWS);
  if (rows.length === 0 && state.rows > 0) return { ok: false, code: 'unavailable' };
  const moreUnrecognized = clicks === 0 && !state.more && state.rows >= NETFLIX_PAGE_ROWS;
  return { ok: true, read: { rows, clicks, partial: partial || moreUnrecognized, moreUnrecognized } };
}

// ─── Points de lecture → saisons ──────────────────────────────────────────

/**
 * Épisode (ou film) compté comme vu, d'après le DERNIER point de lecture que garde Netflix : position ≥ la plus petite des
 * marques de fin connues (`watchedToEndOffset`, début du générique `creditsOffset` ; absentes ou ≤ 0 ignorées) ; sans
 * aucune marque, position ≥ seuil de fin réglé dans SyncKai (pourcentage de la durée). Commencé seulement : jamais.
 * Ranma ½ S1 (relevé le 2026-10-12) : E1 1308 ≥ 1269 vu ; E6 1262 < min(1283, 1293) non vu.
 * Déclencheur « pourcentage » (réglage, comme la synchro en direct) : seuil de la durée seulement, les marques ne servent
 * que si la durée est inconnue.
 */
export function isNetflixWatched(
  item: { bookmark?: NetflixBookmark | null; runtime: number | null; creditsOffset: number | null },
  completionPercentage: number,
  completionTrigger: CompletionTrigger = 'credits',
): boolean {
  const bookmark = item.bookmark;
  if (!bookmark || bookmark.offset <= 0) return false;
  const byPercentage = item.runtime !== null && item.runtime > 0 ? bookmark.offset / item.runtime >= completionPercentage / 100 : null;
  if (completionTrigger === 'percentage' && byPercentage !== null) return byPercentage;
  const marks = [bookmark.watchedToEndOffset, item.creditsOffset].filter((mark): mark is number => mark !== null && mark > 0);
  if (marks.length > 0) return bookmark.offset >= Math.min(...marks);
  return byPercentage ?? false;
}

/**
 * Série (ou film) avec points de lecture → une ligne par saison où au moins un épisode est vu : progression = épisode vu
 * de plus grand `seq` (Netflix ne garde que le dernier point de lecture : un épisode revu depuis le début paraît non vu,
 * les épisodes vus avant lui comptent quand même). Numéros et clés de la synchro en direct (episodeNumbers : numérotation
 * absolue des arcs de One Piece, saisons relatives de Ranma ½), épisodes par saison (`platformSeasons`) pour le résolveur.
 * Film vu : épisode 1, sans saison (clé `s0`), comme en lecture.
 */
export function reduceNetflixShow(show: NetflixShowMetadata, completionPercentage: number, completionTrigger: CompletionTrigger = 'credits'): HistorySeason[] {
  const base = { seriesId: show.showId, seriesTitle: show.title, seriesSlug: null, lastPlayedAt: null } as const;
  if (show.type === 'movie') {
    if (!isNetflixWatched(show, completionPercentage, completionTrigger)) return [];
    const signals = netflixSignals(show, null);
    return [{ ...base, seasonId: `${show.showId}-s0`, seasonNumber: null, seasonTitle: null, episodeId: show.showId, episodeTitle: null, episodeNumber: 1, seasonEpisodeNumber: 1, watchedCount: 1, ...(signals ? { signals } : {}) }];
  }
  const platformSeasons = platformSeasonsOf(show);
  return show.seasons.flatMap((season): HistorySeason[] => {
    const watched = season.episodes.filter((episode) => episode.seq >= 1 && isNetflixWatched(episode, completionPercentage, completionTrigger));
    const best = watched.reduce<(typeof watched)[number] | null>((top, episode) => (top === null || episode.seq > top.seq ? episode : top), null);
    if (!best) return [];
    const { seasonEpisodeNumber, displayedEpisodeNumber } = episodeNumbers(show.seasons, season, best);
    // Mêmes signaux que la synchro en direct (même résolution, même clé)
    const signals = netflixSignals(show, season);
    return [
      {
        ...base,
        seasonId: `${show.showId}-s${season.seq}`,
        seasonNumber: season.seq,
        seasonTitle: meaningfulSeasonTitle(season.title),
        episodeId: best.id,
        episodeTitle: best.title,
        // Numéro absolu inconnu (saison précédente vide) : numéro dans la saison, comme le ferait une correspondance par saison
        episodeNumber: displayedEpisodeNumber ?? seasonEpisodeNumber,
        seasonEpisodeNumber,
        watchedCount: watched.length,
        platformSeasons,
        ...(signals ? { signals } : {}),
      },
    ];
  });
}

// ─── Filtre « anime » (service worker) ────────────────────────────────────

/** Titres par message NETFLIX_IMPORT_TITLES = recherches AniList réunies dans UNE requête GraphQL (alias) */
export const NETFLIX_TITLES_PER_REQUEST = 10;

/**
 * Verdict du filtre pour un titre de l'historique (recherche AniList du titre affiché) :
 * - showIds : séries Netflix (/title/{id}) liées par les fiches trouvées ; la série lue doit en faire partie ;
 * - titleMatch : une fiche porte exactement ce titre (sans lien Netflix : « À vérifier », comme en direct).
 * Ni l'un ni l'autre : pas un anime (ignoré en silence, aucune requête Netflix).
 */
export interface NetflixTitleVerdict {
  title: string;
  showIds: string[];
  titleMatch: boolean;
}

export interface NetflixTitlesPayload {
  titles: string[];
}

export type NetflixTitlesResult = Result<NetflixTitleVerdict[], 'NOT_CONNECTED' | 'API_ERROR'>;

export const isNetflixTitlesPayload = (p: unknown): p is NetflixTitlesPayload =>
  isRecord(p) &&
  Array.isArray(p.titles) &&
  p.titles.length > 0 &&
  p.titles.length <= NETFLIX_TITLES_PER_REQUEST &&
  p.titles.every((title) => typeof title === 'string' && title.trim().length > 0 && title.length <= 300);

/** Série à demander à Netflix : liée à Netflix par une fiche trouvée, ou au même titre */
export const needsMetadata = (verdict: Pick<NetflixTitleVerdict, 'showIds' | 'titleMatch'>): boolean => verdict.showIds.length > 0 || verdict.titleMatch;

/** Série lue gardée pour l'analyse : son identifiant est lié sur AniList, ou le titre correspond (vérification seulement) */
export const keepsShow = (verdict: Pick<NetflixTitleVerdict, 'showIds' | 'titleMatch'>, show: Pick<NetflixShowMetadata, 'showId'>): boolean =>
  verdict.titleMatch || verdict.showIds.includes(show.showId);
