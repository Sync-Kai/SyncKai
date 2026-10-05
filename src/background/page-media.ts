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
import { getMediaMappings } from '../shared/storage';
import type { ListStatus } from '../shared/sync.types';
import { createLogger } from '../shared/logger';
import { getScoreFormat } from './api/list';
import { ApiError } from './api/errors';
import { getPageMediaDetails, type AniListMedia } from './api/media';
import {
  episodeCountMismatch,
  firstUnfinishedSeason,
  pickKnownSeason,
  pickPartInGroup,
  rememberedSeason,
  seriesMappingPrefix,
  toPageSeasons,
  type SeasonChoice,
} from './page-media-rules';
import { resolveTarget } from './sync/matching';
import { findSeriesSeasons, resolveEpisode, toCandidateSummary } from './sync/resolver';
import { fromAniListScore, fromMalScore } from './sync/score';
import { getConnectedTrackers } from './trackers';
import type { CatalogMedia, TrackerService } from './trackers/tracker';

// Fiche de la page (#23) : série ou épisode de l'onglet actif → fiche AniList + état dans les listes.
// Lecture seule : rien n'est écrit (ni sur les services, ni dans le cache des correspondances).

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
}

interface Cached<T> {
  at: number;
  value: T;
}

/** Caches mémoire du service worker (perdus à sa mise en veille : simple accélération) */
const resolutions = new Map<string, Cached<Resolution>>();
const details = new Map<number, Cached<PageMediaDetails>>();
/** Saison choisie dans le sélecteur, par série/saison de la page (durée de vie du service worker) */
const manualChoices = new Map<string, number>();

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
async function resolveEpisodePage(page: PageMediaInfo & { episode: NonNullable<PageMediaInfo['episode']> }, manual: number | null): Promise<Resolution | null> {
  const { result, candidates, seasons: pool, seasonGroups } = await resolveEpisode(page.episode, { persist: false });
  // Sélecteur : saisons de la série uniquement (pas de films ni de spéciaux) ; la fiche retenue hors saisons
  // (spécial lié à l'épisode) est ajoutée par la carte. Aucune saison identifiée : fiches candidates, à confirmer.
  const seasons = toPageSeasons(pool.length > 0 ? pool.slice(0, MAX_PICKER_SEASONS) : candidates, seasonGroups);
  if (manual !== null) return { mediaId: manual, source: 'manual', confidence: 'certain', seasons };
  if (result.ok) {
    return { mediaId: result.target.mediaId, source: 'page', confidence: result.target.confidence === 'high' ? 'certain' : 'uncertain', seasons };
  }
  // Aucune correspondance : première saison (ou meilleure fiche candidate), à confirmer dans le sélecteur
  const first = seasons[0];
  return first ? { mediaId: first.id, source: 'page', confidence: 'uncertain', seasons } : null;
}

/** Page de série : saison lue sur la page, correspondance mémorisée, puis première saison non terminée */
async function resolveSeriesPage(page: PageMediaInfo, manual: number | null): Promise<Resolution | null> {
  const query = { platform: page.platform, seriesId: page.seriesId, seriesSlug: page.seriesSlug, animeTitle: page.seriesTitle, seasonTitle: page.seasonTitle };
  const { candidates, seasons, others, seasonGroups } = await findSeriesSeasons(query);
  const shown = (seasons.length > 0 ? seasons : others).slice(0, MAX_PICKER_SEASONS);
  const summaries = toPageSeasons(shown.map(toCandidateSummary), seasonGroups);
  if (shown.length === 0) return null;

  // (a) Saison de la page : même règle que la synchro, appliquée à son premier épisode
  const hasSeasonInfo = page.seasonNumber !== null || page.seasonTitle !== null;
  const target =
    hasSeasonInfo || seasons.length <= 1
      ? resolveTarget(
          { animeTitle: page.seriesTitle, seasonTitle: page.seasonTitle, seasonNumber: page.seasonNumber, seasonEpisodeNumber: 1, displayedEpisodeNumber: 1 },
          candidates,
        )
      : null;
  const pageMatch = target?.ok ? { mediaId: target.target.mediaId, confident: target.target.confidence === 'high' } : null;

  if (seasons.length === 0) {
    if (manual !== null) return { mediaId: manual, source: 'manual', confidence: 'certain', seasons: summaries };
    // Aucune saison série : fiche dédiée (spécial publié comme série, titre exact), sinon premier résultat, à confirmer
    if (pageMatch) return { mediaId: pageMatch.mediaId, source: 'page', confidence: pageMatch.confident ? 'certain' : 'uncertain', seasons: summaries };
    return { mediaId: summaries[0].id, source: 'page', confidence: 'uncertain', seasons: summaries };
  }
  // (b) Correspondance mémorisée (synchro précédente)
  const remembered = rememberedSeason(await getMediaMappings(), seriesMappingPrefix(page), page.seasonNumber);

  const seasonIds = seasons.map((s) => s.id);
  const choice: SeasonChoice | null =
    pickKnownSeason({ seasonIds, manual, pageMatch, remembered }) ??
    // (c) Première saison non terminée par l'utilisateur
    firstUnfinishedSeason(seasonIds, await seasonStatuses(seasons));
  if (!choice) return null;
  return { ...(choice.source === 'page' ? await refinePageSeason(page, choice, seasons, seasonGroups, remembered) : choice), seasons: summaries };
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
  return { ...choice, mediaId, confidence: mismatch ? 'uncertain' : choice.confidence };
}

async function resolveSeason(page: PageMediaInfo, manual: number | null): Promise<Resolution | null> {
  const key = JSON.stringify([pageSeasonKey(page), page.episode?.episodeId ?? null, manual]);
  const cached = readCache(resolutions, key);
  if (cached) return cached;
  const resolution = page.kind === 'episode' && page.episode ? await resolveEpisodePage({ ...page, episode: page.episode }, manual) : await resolveSeriesPage(page, manual);
  if (resolution) writeCache(resolutions, key, resolution);
  return resolution;
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
        const { entry } = await tracker.getEntry(id);
        if (!entry) return { service, state: 'not-in-list', siteUrl };
        return { service, state: 'in-list', status: entry.status, progress: entry.progress, score: await toScore10(tracker, entry.score), siteUrl };
      } catch (error: unknown) {
        log.warn(`${service} : liste illisible`, error);
        return { service, state: 'error', message: error instanceof ApiError ? error.message : t('error.unexpected') };
      }
    }),
  );
}

/**
 * Fiche AniList de la série affichée dans l'onglet actif, avec l'état de chaque liste connectée.
 * `mediaId` : saison choisie dans le sélecteur (mémorisée pour cette page le temps du service worker).
 */
export async function resolvePageMedia({ page, mediaId }: ResolvePageMediaPayload): Promise<PageMediaResult> {
  try {
    const seasonKey = pageSeasonKey(page);
    if (mediaId !== null) manualChoices.set(seasonKey, mediaId);
    const resolution = await resolveSeason(page, mediaId ?? manualChoices.get(seasonKey) ?? null);
    if (!resolution) return { ok: false, code: 'NOT_FOUND', message: t('page.notFound', { title: page.seriesTitle }) };

    const media = await getDetails(resolution.mediaId);
    const lists = await readLists(media);
    log.info(`Fiche de la page : ${media.title} (#${media.mediaId}, ${resolution.source}, ${resolution.confidence})`);
    const { confidence, source, seasons } = resolution;
    return { ok: true, data: { media, lists, confidence, source, seasons } };
  } catch (error: unknown) {
    if (error instanceof ApiError) return { ok: false, code: error.code, message: error.message };
    log.error('Erreur inattendue (fiche de la page) :', error);
    return { ok: false, code: 'API_ERROR', message: t('error.unexpected') };
  }
}
