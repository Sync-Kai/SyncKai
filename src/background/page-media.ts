import { t } from '../i18n';
import type { Score10 } from '../shared/engagement.types';
import type {
  PageListState,
  PageMediaDetails,
  PageMediaInfo,
  PageMediaResult,
  PageSeason,
  ResolvePageMediaPayload,
  SeasonSource,
} from '../shared/page-media.types';
import { isSentPrimeAnimeVerdict, type EpisodeInfo } from '../shared/episode.types';
import { hasSignals, type PlatformSignals } from '../shared/match-signals';
import { hasPlatformAccess } from '../browser/platform-access';
import { isOptionalPlatform, PLATFORMS } from '../platforms/registry';
import { readCachedPageMedia, storeCachedPageMedia } from '../browser/storage/page-media-cache';
import { learnPlatformLink } from '../browser/storage/platform-links-store';
import { pageMediaFromEpisode } from '../shared/page-media';
import { getMediaMapping, getMediaMappings, saveMediaMapping } from '../browser/storage/mappings';
import { getOpenSessions } from '../browser/storage/sessions';
import type { ListStatus } from '../shared/sync.types';
import { createLogger } from '../browser/logger';
import { getScoreFormat } from './api/list';
import { ApiError } from './api/errors';
import { getPageMediaDetails, type AniListMedia } from './api/media';
import {
  episodeCountMismatch,
  exactRememberedMapping,
  firstUnfinishedSeason,
  learnableSeriesLink,
  manualSeasonProgress,
  pickKnownSeason,
  pickPartInGroup,
  rememberedSeason,
  seriesMappingPrefix,
  seriesPageGate,
  toPageSeasons,
  type SeasonChoice,
} from './page-media-rules';
import { isSeriesIgnored, rememberIgnoredSeries } from './sync/ignored-series';
import {
  cachedMappingVerdict,
  filtersAnime,
  isDisneyEntityLink,
  isPrimeOwnLink,
  isUnmatchedNamedSeason,
  mappingFromManualChoice,
  mappingKey,
  platformLinkVerdict,
  primeOwnIds,
  representsWholeShow,
  resolveTarget,
  seasonLabel,
  singleEntryDoubt,
} from './sync/matching';
import { findSeriesSeasons, resolveEpisode, toCandidateSummary, type SeriesSeasons } from './sync/resolver';
import { fromAniListScore, fromMalScore } from '../shared/score';
import { getConnectedTrackers } from './trackers';
import type { CatalogMedia, TrackerService } from './trackers/tracker';

// Fiche de la page (#23) : série ou épisode de l'onglet actif → fiche AniList + état dans les listes.
// Lecture seule côté services. Écrits localement : le lien de la série (correspondance certaine uniquement) pour le
// bouton « Ouvrir » sur la plateforme préférée, et la saison choisie dans le sélecteur sur une page de lecture,
// enregistrée comme correspondance de la saison (ARCH-20) : la synchro de l'épisode part sur la fiche affichée.

const log = createLogger('page-media');

/** Durée de vie des résolutions et fiches en mémoire (le popup est rouvert souvent sur la même page) */
const CACHE_TTL_MS = 10 * 60_000;
const MAX_CACHE_ENTRIES = 30;
/** Saisons consultées au plus pour trouver la première non terminée (une requête par saison) */
const MAX_STATUS_LOOKUPS = 6;
/** Saisons proposées dans le sélecteur de la carte */
const MAX_PICKER_SEASONS = 12;

interface Resolution {
  mediaId: number;
  source: SeasonSource;
  confidence: 'certain' | 'uncertain';
  seasons: PageSeason[];
  /**
   * Page de lecture : épisode rapporté à la fiche retenue (SyncTarget.progress, ou saison choisie : voir
   * manualSeasonProgress), sinon null
   */
  episodeProgress: number | null;
}

/** Série ignorée par la synchro (plateforme généraliste, pas un anime) : rien à afficher ni à vérifier */
const IGNORED = 'ignored';

interface Cached<T> {
  at: number;
  value: T;
}

/** Caches mémoire du service worker (perdus à sa mise en veille : simple accélération) */
const resolutions = new Map<string, Cached<Resolution | typeof IGNORED>>();
const details = new Map<number, Cached<PageMediaDetails>>();

function readCache<K, T>(cache: Map<K, Cached<T>>, key: K): T | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function writeCache<K, T>(cache: Map<K, Cached<T>>, key: K, value: T): void {
  // Map conserve l'ordre d'insertion : la plus ancienne entrée part en premier
  if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value as K);
  cache.set(key, { at: Date.now(), value });
}

/** Clé de la série/saison affichée sur la page (indépendante de l'épisode) */
function pageSeasonKey(page: PageMediaInfo): string {
  return JSON.stringify([page.platform, page.seriesId, page.seriesSlug, page.seriesTitle, page.seasonNumber, page.seasonTitle]);
}

// ─── Choix de la saison ───────────────────────────────────────────────────

/** Statuts des saisons dans la liste du premier service connecté, jusqu'à la première non terminée */
async function seasonStatuses(seasons: readonly AniListMedia[]): Promise<(ListStatus | null)[]> {
  const [tracker] = await getConnectedTrackers();
  if (!tracker) return [];
  const statuses: (ListStatus | null)[] = [];
  for (const season of seasons.slice(0, MAX_STATUS_LOOKUPS)) {
    const id = tracker.resolveId({ mediaId: season.id, idMal: season.idMal, title: season.displayTitle, episodes: season.episodes });
    const status = id !== null ? ((await tracker.getEntry(id)).entry?.status ?? null) : null;
    statuses.push(status);
    if (status !== 'COMPLETED') break;
  }
  return statuses;
}

/** Page de lecture : même résolution que la synchro (cache des correspondances compris), sans écriture */
async function resolveEpisodePage(
  page: PageMediaInfo & { episode: NonNullable<PageMediaInfo['episode']> },
  manual: number | null,
): Promise<Resolution | typeof IGNORED | null> {
  const { result, candidates, seasons: pool, seasonGroups } = await resolveEpisode(page.episode, { persist: false });
  // Sélecteur : saisons de la série uniquement (pas de films ni de spéciaux) ; la fiche retenue hors saisons
  // (spécial lié à l'épisode) est ajoutée par la carte. Aucune saison identifiée : fiches candidates, à confirmer.
  const seasons = toPageSeasons(pool.length > 0 ? pool.slice(0, MAX_PICKER_SEASONS) : candidates, seasonGroups);
  // Épisode de la page sur la fiche retenue par la synchro (valable seulement si c'est la fiche affichée)
  const target = result.ok ? result.target : null;
  if (manual !== null) {
    // Saison choisie : épisode de la synchro si c'est sa fiche, sinon rapporté à la saison choisie (parties comprises)
    const progress = target?.mediaId === manual ? target.progress : manualSeasonProgress(page.episode, manual, seasonGroups, new Map(pool.map((s) => [s.id, s.episodes])));
    return { mediaId: manual, source: 'manual', confidence: 'certain', seasons, episodeProgress: progress };
  }
  // Série ignorée (Netflix, probablement pas un anime) : aucune fiche proposée, même à confirmer
  if (!result.ok && result.ignored) return IGNORED;
  if (target) {
    return { mediaId: target.mediaId, source: 'page', confidence: target.confidence === 'high' ? 'certain' : 'uncertain', seasons, episodeProgress: target.progress };
  }
  // Aucune correspondance : première saison (ou meilleure fiche candidate), à confirmer dans le sélecteur
  const first = seasons[0];
  return first ? { mediaId: first.id, source: 'page', confidence: 'uncertain', seasons, episodeProgress: null } : null;
}

/**
 * Page de série : filtre « anime » des plateformes généralistes (Netflix, Disney+ ; Prime Video selon son verdict de genre :
 * mêmes règles que la lecture, verdict « série ignorée » mémorisé et partagé avec elle), puis choix de la saison
 * (pickSeriesSeason). Correspondance par le titre seul sur une plateforme généraliste : saison toujours à vérifier.
 */
async function resolveSeriesPage(page: PageMediaInfo, manual: number | null): Promise<Resolution | typeof IGNORED | null> {
  const series = { platform: page.platform, seriesId: page.seriesId, animeTitle: page.seriesTitle };
  // Prime Video sans verdict « anime » (jamais envoyé ainsi par le script de contenu) : rien à afficher, sans recherche
  if (page.platform === 'prime' && !isSentPrimeAnimeVerdict(page.primeAnime)) return IGNORED;
  const linkRequired = filtersAnime(page);
  if (linkRequired && manual === null && (await isSeriesIgnored(series))) {
    log.info('Page de série déjà ignorée (verdict mémorisé) :', page.seriesTitle);
    return IGNORED;
  }
  const query = { platform: page.platform, seriesId: page.seriesId, seriesSlug: page.seriesSlug, animeTitle: page.seriesTitle, seasonTitle: page.seasonTitle, platformSeasons: page.platformSeasons };
  const found = await findSeriesSeasons(query);
  const ownPrimeIds = page.platform === 'prime' ? primeOwnIds({ seriesId: page.seriesId }) : [];
  const isOwnLink = (url: string): boolean => (page.platform === 'prime' ? isPrimeOwnLink(url, ownPrimeIds) : page.platform === 'disney' && isDisneyEntityLink(url, page.seriesId));
  const ownLink = found.others.some((media) => media.externalLinkUrls.some(isOwnLink));
  const gate = seriesPageGate(page, platformLinkVerdict({ platform: page.platform, animeTitle: page.seriesTitle, primeAnime: page.primeAnime }, found.candidates), ownLink);
  if (linkRequired) log.info(`Page de série ${page.platform} « ${page.seriesTitle} » : filtre anime ${gate}${ownLink ? ' (lien vers la page)' : ''}${page.catalogAnime === false ? ' (pas de genre Anime)' : ''}`);
  if (gate === 'ignored') {
    await rememberIgnoredSeries(series);
    return IGNORED;
  }
  const resolution = await pickSeriesSeason(page, manual, found);
  return gate === 'title' && resolution && resolution.source !== 'manual' ? { ...resolution, confidence: 'uncertain' } : resolution;
}

/**
 * Signaux de la saison affichée sur une page de série : ceux de la page, complétés par le nombre d'épisodes de la saison
 * (menu des saisons) quand la page en donne d'autres. Sans autre signal : aucun (comportement d'avant, le nombre
 * d'épisodes reste un simple contrôle, voir episodeCountMismatch).
 */
function pageSignals(page: PageMediaInfo): PlatformSignals | undefined {
  if (!hasSignals(page.signals)) return undefined;
  const count = page.signals.seasonEpisodeCount ?? page.seasonEpisodeCount ?? undefined;
  return count !== undefined ? { ...page.signals, seasonEpisodeCount: count } : page.signals;
}

/** Saison de la page de série : saison lue sur la page, correspondance mémorisée, puis première saison non terminée */
async function pickSeriesSeason(page: PageMediaInfo, manual: number | null, { candidates, seasons, others, seasonGroups }: SeriesSeasons): Promise<Resolution | null> {
  const shown = (seasons.length > 0 ? seasons : others).slice(0, MAX_PICKER_SEASONS);
  const summaries = toPageSeasons(shown.map(toCandidateSummary), seasonGroups);
  if (shown.length === 0) return null;

  // (a) Saison de la page : même règle que la synchro, appliquée à son premier épisode
  const signals = pageSignals(page);
  const hasSeasonInfo = page.seasonNumber !== null || page.seasonTitle !== null || page.seasonFirstEpisode !== undefined;
  const target =
    hasSeasonInfo || seasons.length <= 1
      ? resolveTarget(
          // Arc numéroté en absolu (One Piece « Elbaph (1156-current) ») : son premier épisode, comme sur la page de lecture
          {
            platform: page.platform,
            animeTitle: page.seriesTitle,
            seasonTitle: page.seasonTitle,
            seasonNumber: page.seasonNumber,
            seasonEpisodeNumber: 1,
            displayedEpisodeNumber: page.seasonFirstEpisode ?? 1,
            ...(signals !== undefined ? { signals } : {}),
          },
          candidates,
        )
      : null;
  // Fiche unique, suite d'une autre fiche, qui ne couvre pas toutes les saisons de la plateforme : à vérifier (comme la synchro)
  const doubt = target?.ok ? singleEntryDoubt({ platform: page.platform, animeTitle: page.seriesTitle, platformSeasons: page.platformSeasons }, candidates, target.target.mediaId) : false;
  // Fiche unique liée qui couvre toutes les saisons de la plateforme (One Piece, arcs Netflix) : la série entière, certaine
  const wholeShow = target?.ok ? representsWholeShow({ animeTitle: page.seriesTitle, platformSeasons: page.platformSeasons }, candidates, target.target.mediaId) : false;
  // Saison nommée (« HEROINES ») sans fiche à son titre : la fiche retenue (série principale) reste à vérifier
  const chosen = target?.ok ? candidates.find((c) => c.id === target.target.mediaId) : undefined;
  const unmatchedName = chosen !== undefined && isUnmatchedNamedSeason({ animeTitle: page.seriesTitle, seasonTitle: page.seasonTitle, seasonNumber: page.seasonNumber, seasonFirstEpisode: page.seasonFirstEpisode }, chosen);
  // Fiche prouvée par les signaux de la plateforme (groupe de saison unique et confirmé) : certaine, jamais « Saison devinée »
  const proven = target?.ok === true && target.target.bySignals === true;
  const pageMatch = target?.ok ? { mediaId: target.target.mediaId, confident: proven || (((target.target.confidence === 'high' && !doubt) || wholeShow) && !unmatchedName) } : null;

  if (seasons.length === 0) {
    if (manual !== null) return { mediaId: manual, source: 'manual', confidence: 'certain', seasons: summaries, episodeProgress: null };
    // Aucune saison série : fiche dédiée (spécial publié comme série, titre exact), sinon premier résultat, à confirmer
    if (pageMatch) return { mediaId: pageMatch.mediaId, source: 'page', confidence: pageMatch.confident ? 'certain' : 'uncertain', seasons: summaries, episodeProgress: null };
    return { mediaId: summaries[0].id, source: 'page', confidence: 'uncertain', seasons: summaries, episodeProgress: null };
  }
  // (b) Correspondance mémorisée (synchro précédente), confrontée aux signaux comme pour la synchro (resolver.ts) : apprise
  // et contredite → ignorée ; d'origine inconnue et contredite → ignorée, saison affichée « à vérifier » (jamais l'ancienne
  // fiche donnée pour certaine) ; choix de l'utilisateur → gardé. Fiche absente des candidats : rien à comparer.
  const mappings = await getMediaMappings();
  const prefix = seriesMappingPrefix(page);
  const exact = exactRememberedMapping(mappings, prefix, page.seasonNumber, signals?.seasonYear);
  const verdict = exact ? cachedMappingVerdict(exact, candidates.find((c) => c.id === exact.mediaId) ?? null, signals) : { kind: 'keep' as const };
  if (verdict.kind !== 'keep') log.info(`Correspondance mémorisée #${exact?.mediaId ?? '?'} contredite par la plateforme (${verdict.signals.join(', ')}) : ${verdict.kind}`);
  const remembered = verdict.kind === 'keep' ? rememberedSeason(mappings, prefix, page.seasonNumber, signals?.seasonYear) : null;
  const doubted = verdict.kind === 'doubt';

  const seasonIds = seasons.map((s) => s.id);
  const choice: SeasonChoice | null =
    pickKnownSeason({ seasonIds, manual, pageMatch, remembered }) ??
    // (c) Première saison non terminée par l'utilisateur
    firstUnfinishedSeason(seasonIds, await seasonStatuses(seasons));
  if (!choice) return null;
  const refined = choice.source === 'page' ? await refinePageSeason(page, choice, seasons, seasonGroups, remembered, proven && choice.mediaId === pageMatch?.mediaId) : choice;
  const confidence = doubted && refined.source !== 'manual' ? 'uncertain' : refined.confidence;
  return { ...refined, confidence, seasons: summaries, episodeProgress: null };
}

/**
 * Saison lue sur la page et découpée en plusieurs fiches AniList (Mushoku Tensei « Season 2 » = « II » +
 * « II Part 2 ») : partie à afficher, et contrôle du nombre d'épisodes affiché par la page.
 */
async function refinePageSeason(
  page: PageMediaInfo,
  choice: SeasonChoice,
  seasons: readonly AniListMedia[],
  seasonGroups: readonly number[][],
  remembered: { mediaId: number; exact: boolean } | null,
  /** Fiche prouvée par les signaux (nombre d'épisodes compris) : jamais « Saison devinée » */
  proven = false,
): Promise<SeasonChoice> {
  const group = seasonGroups.find((ids) => ids.includes(choice.mediaId));
  if (!group) return choice;
  const byId = new Map(seasons.map((m) => [m.id, m]));
  const parts = group.flatMap((id) => byId.get(id) ?? []);

  let mediaId = choice.mediaId;
  // Première partie retenue par la résolution : la partie que l'utilisateur regarde, si on peut la connaître
  if (page.seasonNumber !== null && parts.length > 1 && group[0] === choice.mediaId) {
    const needsStatuses = !(remembered?.exact && group.includes(remembered.mediaId));
    mediaId = pickPartInGroup(group, remembered, needsStatuses ? await seasonStatuses(parts) : []) ?? mediaId;
  }
  // Nombre d'épisodes de la saison (page) très différent de la somme des parties : choix à vérifier
  const mismatch = episodeCountMismatch(page.seasonEpisodeCount, parts.map((m) => m.episodes));
  if (mismatch) log.info(`Saison ${page.seasonNumber ?? '?'} : ${page.seasonEpisodeCount ?? '?'} épisodes sur la page, autre total sur AniList`);
  return { ...choice, mediaId, confidence: mismatch && !proven ? 'uncertain' : choice.confidence };
}

const resolutionKey = (page: PageMediaInfo, manual: number | null): string => JSON.stringify([pageSeasonKey(page), page.episode?.episodeId ?? null, manual]);

async function resolveSeason(page: PageMediaInfo, manual: number | null): Promise<Resolution | typeof IGNORED | null> {
  const key = resolutionKey(page, manual);
  const cached = readCache(resolutions, key);
  if (cached) return cached;
  const resolution = page.kind === 'episode' && page.episode ? await resolveEpisodePage({ ...page, episode: page.episode }, manual) : await resolveSeriesPage(page, manual);
  if (resolution) writeCache(resolutions, key, resolution);
  return resolution;
}

/**
 * Oublie les saisons résolues (pas les fiches) : après une synchro ou une vérification, la correspondance
 * mémorisée doit primer sur une résolution incertaine mise en cache avant elle.
 */
export function forgetPageResolutions(): void {
  resolutions.clear();
}

/**
 * Saison choisie dans le sélecteur d'une page de lecture (ARCH-20) : enregistrée comme correspondance de la saison
 * (mêmes règles qu'un choix confirmé dans « À vérifier »), pour que la synchro de l'épisode (EPISODE_COMPLETED) parte
 * sur la fiche affichée. « Oublier » (Réglages › Mes données) la retire. `false` : épisode hors de la fiche choisie
 * (numéro au-delà de ses épisodes, ou inconnu) : rien n'est enregistré, la carte le signale.
 */
async function rememberManualSeason(episode: EpisodeInfo, media: PageMediaDetails, progress: number | null): Promise<boolean> {
  const mapping = progress !== null ? mappingFromManualChoice(episode, media.mediaId, progress, media.episodes) : null;
  if (!mapping) return false;
  const key = mappingKey(episode);
  const stored = await getMediaMapping(key);
  // Relecture avec la même saison (après une action) : correspondance déjà enregistrée, rien à réécrire
  if (stored?.chosen && stored.mediaId === mapping.mediaId && stored.numbering === mapping.numbering && stored.offset === mapping.offset) return true;
  // Choix de l'utilisateur (même fiche qu'une correspondance apprise ou d'origine inconnue : marquée choisie)
  await saveMediaMapping(key, { ...mapping, seriesLabel: seasonLabel(episode), mediaTitle: media.title, chosen: true });
  log.info(`Saison choisie enregistrée pour ${key} :`, mapping);
  return true;
}

// ─── Fiche et listes ──────────────────────────────────────────────────────

async function getDetails(mediaId: number): Promise<PageMediaDetails> {
  const cached = readCache(details, mediaId);
  if (cached) return cached;
  const media = await getPageMediaDetails(mediaId);
  writeCache(details, mediaId, media);
  return media;
}

/** Note brute du service → note sur 10 (affichage) ; format AniList illisible → pas de note affichée */
async function toScore10(tracker: TrackerService, score: number | undefined): Promise<Score10 | null> {
  if (score === undefined) return null;
  if (tracker.id === 'mal') return fromMalScore(score);
  try {
    return fromAniListScore(score, await getScoreFormat());
  } catch (error: unknown) {
    log.warn('Format de note AniList illisible :', error);
    return null;
  }
}

/** État de la série dans la liste de chaque service connecté (lecture fraîche, jamais mise en cache) */
async function readLists(media: PageMediaDetails): Promise<PageListState[]> {
  const trackers = await getConnectedTrackers();
  const catalog: CatalogMedia = { mediaId: media.mediaId, idMal: media.idMal, title: media.title, episodes: media.episodes };
  return Promise.all(
    trackers.map(async (tracker): Promise<PageListState> => {
      const service = tracker.id;
      const id = tracker.resolveId(catalog);
      if (id === null) return { service, state: 'unavailable' };
      const siteUrl = service === 'anilist' ? media.siteUrl : `https://myanimelist.net/anime/${id}`;
      try {
        const { entry, notes } = await tracker.getEntry(id);
        if (!entry) return { service, state: 'not-in-list', siteUrl };
        return { service, state: 'in-list', status: entry.status, progress: entry.progress, score: await toScore10(tracker, entry.score), notes, siteUrl };
      } catch (error: unknown) {
        log.warn(`${service} : liste illisible`, error);
        return { service, state: 'error', message: error instanceof ApiError ? error.message : t('error.unexpected') };
      }
    }),
  );
}

/**
 * Fiche AniList de la série affichée dans l'onglet actif, avec l'état de chaque liste connectée.
 * `mediaId` : saison choisie dans le sélecteur ; sur une page de lecture, enregistrée comme correspondance de la
 * saison (rememberManualSeason). Sur une page de série (aucun épisode pour fixer la numérotation), elle ne vaut que
 * pour l'affichage : l'écran la renvoie à chaque relecture (cache de l'onglet compris).
 */
export async function resolvePageMedia({ page, mediaId }: ResolvePageMediaPayload): Promise<PageMediaResult> {
  try {
    // Accès Netflix / Disney+ retiré, onglet ouvert avant le retrait (son script répond encore) : rien à suivre, comme la synchro
    const platform = PLATFORMS[page.platform].label;
    if (isOptionalPlatform(page.platform) && !(await hasPlatformAccess(page.platform))) return { ok: false, code: 'NOT_TRACKED', message: t('page.platformOff', { platform }) };
    const resolution = await resolveSeason(page, mediaId);
    if (resolution === IGNORED) {
      // Info seulement (aucune entrée au journal d'erreurs) : comme la synchro, qui ignore la série
      log.info('Fiche de la page : série ignorée (aucune fiche AniList liée) :', page.seriesTitle);
      return { ok: false, code: 'NOT_TRACKED', message: t('page.notTracked', { platform }) };
    }
    if (!resolution) return { ok: false, code: 'NOT_FOUND', message: t('page.notFound', { title: page.seriesTitle }) };

    const media = await getDetails(resolution.mediaId);
    let { confidence, episodeProgress } = resolution;
    if (mediaId !== null && page.episode) {
      if (await rememberManualSeason(page.episode, media, episodeProgress)) {
        // Saisons résolues avant le choix (cet épisode et les suivants) : la correspondance prime désormais.
        // Résolution du choix gardée : le sélecteur reste proposé aux relectures de la fiche.
        forgetPageResolutions();
        writeCache(resolutions, resolutionKey(page, mediaId), resolution);
      } else {
        confidence = 'uncertain';
        episodeProgress = null;
      }
    }

    // Page de série visitée, fiche certaine : lien mémorisé (AniList ne référence presque jamais ADN)
    const learnable = learnableSeriesLink(page, confidence);
    if (learnable) await learnPlatformLink(resolution.mediaId, learnable);

    const lists = await readLists(media);
    log.info(`Fiche de la page : ${media.title} (#${media.mediaId}, ${resolution.source}, ${confidence})`);
    const { source, seasons } = resolution;
    return { ok: true, data: { media, lists, confidence, source, seasons, episodeProgress } };
  } catch (error: unknown) {
    if (error instanceof ApiError) return { ok: false, code: error.code, message: error.message };
    log.error('Erreur inattendue (fiche de la page) :', error);
    return { ok: false, code: 'API_ERROR', message: t('error.unexpected') };
  }
}

/**
 * Après la synchro d'un épisode : fiche de son onglet recalculée (correspondance tout juste apprise, listes à jour)
 * et écrite dans le cache de l'onglet, que le panneau suit (storage.onChanged). Rien si aucune vue n'affiche
 * cet onglet (pas d'entrée en cache) : aucune requête inutile.
 */
export async function refreshTabPageMedia(tabId: number, episode: EpisodeInfo): Promise<void> {
  if (!(await readCachedPageMedia(tabId))) return;
  const page = pageMediaFromEpisode(episode);
  // Sessions relevées avant la résolution : la fiche n'est pas écrite si un compte est déconnecté entre-temps
  const epochs = await getOpenSessions();
  const result = await resolvePageMedia({ page, mediaId: null });
  if (result.ok) await storeCachedPageMedia(tabId, page, result.data, 'sync', epochs);
}
