import { t } from '../../i18n';
import { createLogger } from '../../browser/logger';
import { getOpenSessions, writeIfSessions } from '../../browser/storage/sessions';
import { STORAGE_KEYS } from '../../protocol/storage-keys';
import type { AniListListEntry, MalListEntry } from '../../shared/compare';
import { isRecord } from '../../shared/guards';
import { buildBatch, hasUnseenPrequel, isRecoBatch, MAX_SEEDS, prequelIdsOf, pickSeeds, relevantTags, toCard, type RawRecoMedia, type RecoBatch, type RecoItem, type RecoResult, type Seed } from '../../shared/recommendations';
import { sameSessions, type SessionEpochs } from '../../shared/session-epochs';
import { fromAniListScore, fromMalScore } from '../../shared/score';
import type { ListStatus } from '../../shared/sync.types';
import { aniListIdsByMal } from '../anilist/by-mal';
import { anilistPublicQuery } from '../anilist/client';
import { fetchAniListFullList } from '../anilist/full-list';
import { getScoreFormat } from '../anilist/list';
import { buildPlatforms } from '../anilist/watching';
import { ApiError } from '../errors';
import { fetchMalFullList } from '../mal/full-list';
import { purgeStoredBatch } from './messages';
import { beginBuild, endBuild, touchedIds } from './touched';

// Suggestions « Découvrir » : lot calculé dans le service worker (listes complètes + recommandations AniList des séries
// aimées), gardé 24 h dans `reco:batch` (portée compte). Tout part en file de fond ; les règles de score sont dans shared/.

const log = createLogger('reco');

export const RECO_TTL_MS = 24 * 3600_000;
/**
 * Graines lues par requête. Mesuré sur l'API publique le 2026-11-12 : la complexité AniList ne dépend pas de `perPage`
 * (requête des graines avec `idMal` des relations, `isAdult` et titre : 49 sur 500 ; 44 avant ces champs) ; 50 graines
 * avec 10 recommandations chacune passent en une requête (environ 1,4 Mo, 2,5 s). MAX_SEEDS (50) : une seule lecture.
 */
const SEEDS_PER_QUERY = 50;
/** Séries MAL converties en ids AniList : candidates au rôle de graine seulement (2 pages `idMal_in` au plus, marge pour les ids inconnus) */
const MAL_SEED_CANDIDATES = 2 * MAX_SEEDS;
const SEASON_SIZE = 20;
/** Démarrage à froid : 20 lues, les 10 meilleures gardées après filtrage */
const COLD_SIZE = 10;

const CARD_FIELDS =
  'id idMal isAdult format status episodes duration averageScore genres tags { name rank isMediaSpoiler } title { userPreferred } coverImage { large medium color } bannerImage siteUrl startDate { year } season seasonYear externalLinks { url } relations { edges { relationType node { id idMal } } }';

const SEEDS_QUERY = /* GraphQL */ `
  query RecoSeeds($ids: [Int]) {
    Page(perPage: ${SEEDS_PER_QUERY}) {
      media(id_in: $ids) {
        id isAdult title { userPreferred } genres tags { name rank isMediaSpoiler }
        recommendations(sort: RATING_DESC, perPage: 10) { nodes { rating mediaRecommendation { ${CARD_FIELDS} } } }
      }
    }
  }
`;

const SEASON_QUERY = /* GraphQL */ `
  query RecoSeason($season: MediaSeason, $year: Int) {
    Page(perPage: ${SEASON_SIZE}) {
      media(type: ANIME, season: $season, seasonYear: $year, sort: SCORE_DESC, isAdult: false) { ${CARD_FIELDS} }
    }
  }
`;

const isPageData = (data: unknown): data is { Page: { media: unknown[] } } => isRecord(data) && isRecord(data.Page) && Array.isArray(data.Page.media);

// ─── Lecture défensive des réponses AniList ───────────────────────────────

const orNull = <T>(value: unknown, ok: (v: unknown) => v is T): T | null => (ok(value) ? value : null);
const isString = (v: unknown): v is string => typeof v === 'string';
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStringList = (v: unknown): v is string[] => Array.isArray(v) && v.every(isString);

function toTags(value: unknown): NonNullable<RawRecoMedia['tags']> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((tag): NonNullable<RawRecoMedia['tags']> =>
    isRecord(tag) && isString(tag.name) ? [{ name: tag.name, rank: orNull(tag.rank, isNumber), isMediaSpoiler: tag.isMediaSpoiler === true }] : []);
}

/** Fiche de suggestion brute ; illisible (sans identifiant) : ignorée */
function toRaw(value: unknown): RawRecoMedia | null {
  if (!isRecord(value) || !isNumber(value.id)) return null;
  const title = isRecord(value.title) ? { userPreferred: orNull(value.title.userPreferred, isString) } : null;
  const cover = isRecord(value.coverImage)
    ? { large: orNull(value.coverImage.large, isString), medium: orNull(value.coverImage.medium, isString), color: orNull(value.coverImage.color, isString) }
    : null;
  const edges = isRecord(value.relations) && Array.isArray(value.relations.edges) ? value.relations.edges : null;
  return {
    id: value.id,
    idMal: orNull(value.idMal, isNumber),
    isAdult: value.isAdult === true,
    format: orNull(value.format, isString),
    status: orNull(value.status, isString),
    episodes: orNull(value.episodes, isNumber),
    duration: orNull(value.duration, isNumber),
    averageScore: orNull(value.averageScore, isNumber),
    genres: orNull(value.genres, isStringList),
    tags: toTags(value.tags),
    title,
    coverImage: cover,
    bannerImage: orNull(value.bannerImage, isString),
    siteUrl: orNull(value.siteUrl, isString),
    startDate: isRecord(value.startDate) ? { year: orNull(value.startDate.year, isNumber) } : null,
    season: orNull(value.season, isString),
    seasonYear: orNull(value.seasonYear, isNumber),
    externalLinks: Array.isArray(value.externalLinks) ? value.externalLinks.filter(isRecord).map((l) => ({ url: orNull(l.url, isString) })) : null,
    relations: edges
      ? {
          edges: edges.flatMap((e): { relationType: string; node: { id: number; idMal: number | null } | null }[] =>
            isRecord(e) && isString(e.relationType) ? [{ relationType: e.relationType, node: isRecord(e.node) && isNumber(e.node.id) ? { id: e.node.id, idMal: orNull(e.node.idMal, isNumber) } : null }] : []),
        }
      : null,
  };
}

// ─── Listes de l'utilisateur ──────────────────────────────────────────────

interface Listed { id: number; title: string; status: ListStatus; score10: number | null }
interface UserLists {
  /** Entrées dans l'ordre des listes (aucun `updatedAt` en liste complète : les séries sans note gardent l'ordre de l'API) */
  entries: Listed[];
  /** Tout ce qui est en liste, quel que soit le statut, par id AniList et par id MAL */
  ids: Set<number>;
  malIds: Set<number>;
  /** Terminé, en cours ou revisionnage : un préquel de cette liste ne bloque pas sa suite */
  watchedOrCurrent: Set<number>;
  /** Ids MAL terminés, en cours ou en revisionnage : préquels vus sans conversion en id AniList */
  watchedMalIds: Set<number>;
}

const isWatched = (status: ListStatus): boolean => status === 'COMPLETED' || status === 'CURRENT' || status === 'REPEATING';

async function readLists(connected: { anilist: boolean; mal: boolean }): Promise<UserLists> {
  const entries: Listed[] = [];
  const ids = new Set<number>();
  const malIds = new Set<number>();
  const seen = (id: number, status: ListStatus): void => {
    ids.add(id);
    if (isWatched(status)) watchedOrCurrent.add(id);
  };
  const watchedOrCurrent = new Set<number>();
  const watchedMalIds = new Set<number>();

  let anilist: AniListListEntry[] = [];
  if (connected.anilist) {
    const [list, format] = await Promise.all([fetchAniListFullList(), getScoreFormat('background')]);
    anilist = list;
    for (const e of list) {
      seen(e.mediaId, e.status);
      if (e.malId !== null) malIds.add(e.malId);
      entries.push({ id: e.mediaId, title: e.title, status: e.status, score10: e.score === null ? null : fromAniListScore(e.score, format) });
    }
  }
  if (connected.mal) {
    const mal: MalListEntry[] = await fetchMalFullList();
    // Ids MAL déjà connus de la liste AniList : pas de relecture du catalogue pour eux
    const known = new Map(anilist.flatMap((e) => (e.malId !== null ? [[e.malId, e.mediaId] as const] : [])));
    // Seules les candidates au rôle de graine sont converties (RECO-01 : 22 requêtes pour 1000 séries avant) : terminées ou en
    // revisionnage, notées ≥ 7 d'abord, puis non notées (complément de pickSeeds : rang 6,5), puis le reste. Les autres séries
    // vues comptent pour la règle du préquel par leur id MAL (`watchedMalIds`), les séries en liste sont exclues par leur `idMal`.
    const rank = (score: number | null): number => (score === null ? 6.5 : score);
    const candidates = mal.filter((e) => !known.has(e.malId) && (e.status === 'COMPLETED' || e.status === 'REPEATING')).sort((a, b) => rank(b.score) - rank(a.score));
    const unknown = [...new Set(candidates.map((e) => e.malId))].slice(0, MAL_SEED_CANDIDATES);
    const mapped = unknown.length > 0 ? await aniListIdsByMal(unknown) : new Map<number, number>();
    for (const e of mal) {
      malIds.add(e.malId);
      if (isWatched(e.status)) watchedMalIds.add(e.malId);
      const id = known.get(e.malId) ?? mapped.get(e.malId);
      if (id === undefined) continue;
      seen(id, e.status);
      // Jamais le titre MAL (TERMS-03) : readSeeds le remplace par le titre AniList de la graine
      entries.push({ id, title: `#${id}`, status: e.status, score10: e.score === null ? null : fromMalScore(e.score) });
    }
  }
  return { entries, ids, malIds, watchedOrCurrent, watchedMalIds };
}

// ─── Lot ──────────────────────────────────────────────────────────────────

const readDismissed = async (): Promise<Set<number>> => {
  const stored = (await chrome.storage.local.get(STORAGE_KEYS.recoDismissed))[STORAGE_KEYS.recoDismissed];
  return new Set(Array.isArray(stored) ? stored.filter(isNumber) : []);
};

/** Saison AniList du mois courant (hiver : janvier à mars) */
const seasonOf = (now: number): { season: string; year: number } => {
  const date = new Date(now);
  return { season: ['WINTER', 'SPRING', 'SUMMER', 'FALL'][Math.floor(date.getUTCMonth() / 3)] ?? 'FALL', year: date.getUTCFullYear() };
};

const withPlatforms = (items: readonly RecoItem[], links: ReadonlyMap<number, unknown>): RecoItem[] =>
  items.map((item) => ({ ...item, card: { ...item.card, platforms: buildPlatforms(links.get(item.card.id), []) } }));

/** Démarrage à froid : tops de la saison, hors adultes, séries déjà en liste, écartées et suites dont le préquel n'est pas vu */
async function coldBatch(lists: UserLists, dismissed: ReadonlySet<number>, now: number): Promise<RecoBatch> {
  const { Page } = await anilistPublicQuery(SEASON_QUERY, isPageData, seasonOf(now), 'background');
  const links = new Map<number, unknown>();
  const items: RecoItem[] = [];
  for (const raw of Page.media.map(toRaw)) {
    if (!raw || raw.isAdult || lists.ids.has(raw.id) || dismissed.has(raw.id) || (raw.idMal !== null && lists.malIds.has(raw.idMal))) continue;
    if (hasUnseenPrequel(prequelIdsOf(raw.relations?.edges, lists.watchedMalIds), lists.watchedOrCurrent)) continue;
    links.set(raw.id, raw.externalLinks);
    items.push({ card: toCard(raw), score: raw.averageScore ?? 0, reason: null });
  }
  items.sort((a, b) => b.score - a.score || a.card.id - b.card.id);
  return { items: withPlatforms(items.slice(0, COLD_SIZE), links), computedAt: now, seedCount: 0, cold: true };
}

/** Recommandations des graines (50 par requête) : leurs titre AniList, genres et tags, les fiches proposées et leurs liens externes */
async function readSeeds(picked: readonly Omit<Seed, 'genres' | 'tags'>[]): Promise<{ seeds: Seed[]; recs: Map<number, { rating: number; media: RawRecoMedia }[]>; links: Map<number, unknown> }> {
  const byId = new Map<number, Record<string, unknown>>();
  const recs = new Map<number, { rating: number; media: RawRecoMedia }[]>();
  const links = new Map<number, unknown>();
  for (let from = 0; from < picked.length; from += SEEDS_PER_QUERY) {
    const ids = picked.slice(from, from + SEEDS_PER_QUERY).map((s) => s.id);
    const { Page } = await anilistPublicQuery(SEEDS_QUERY, isPageData, { ids }, 'background');
    for (const node of Page.media) {
      if (!isRecord(node) || !isNumber(node.id)) continue;
      byId.set(node.id, node);
      const nodes = isRecord(node.recommendations) && Array.isArray(node.recommendations.nodes) ? node.recommendations.nodes : [];
      recs.set(
        node.id,
        nodes.flatMap((n): { rating: number; media: RawRecoMedia }[] => {
          const media = isRecord(n) ? toRaw(n.mediaRecommendation) : null;
          if (!isRecord(n) || !media) return [];
          links.set(media.id, media.externalLinks);
          return [{ rating: isNumber(n.rating) ? n.rating : 0, media }];
        }),
      );
    }
  }
  const seeds = picked.flatMap((s): Seed[] => {
    const node = byId.get(s.id);
    // Graine adulte : ni citée ni utilisée (spec §8, RECO-06)
    if (node?.isAdult === true) return [];
    const title = isRecord(node?.title) ? orNull(node.title.userPreferred, isString) : null;
    return [{ ...s, title: title ?? s.title, genres: orNull(node?.genres, isStringList) ?? [], tags: relevantTags({ tags: toTags(node?.tags) }) }];
  });
  return { seeds, recs, links };
}

async function buildFresh(): Promise<RecoResult> {
  // Sessions relevées AVANT la première requête : le lot décrit les listes de ces comptes (docs/memory/security.md)
  const epochs = await getOpenSessions();
  if (epochs.anilist === undefined && epochs.mal === undefined) return { ok: false, code: 'NO_ACCOUNT', message: t('error.unexpected') };
  beginBuild();
  try {
    return await buildWith(epochs);
  } finally {
    endBuild();
  }
}

async function buildWith(epochs: SessionEpochs): Promise<RecoResult> {
  const now = Date.now();
  const [lists, dismissed] = await Promise.all([readLists({ anilist: epochs.anilist !== undefined, mal: epochs.mal !== undefined }), readDismissed()]);
  const { seeds: picked, cold } = pickSeeds(lists.entries);
  const read = cold ? null : await readSeeds(picked);
  let batch: RecoBatch;
  // Aucune graine retenue (toutes adultes) : démarrage à froid plutôt qu'un lot vide gardé 24 h
  if (!read || read.seeds.length === 0) batch = await coldBatch(lists, dismissed, now);
  else {
    const built = buildBatch(read.seeds, read.recs, { ids: lists.ids, malIds: lists.malIds, dismissed, watchedOrCurrent: lists.watchedOrCurrent, watchedMalIds: lists.watchedMalIds }, now);
    batch = { ...built, items: withPlatforms(built.items, read.links), cold: false };
  }
  // Ajoutées, écartées ou écrites sur un service pendant le calcul : jamais réécrites dans le lot
  const all = batch.items;
  const skip = touchedIds(all);
  batch = { ...batch, items: all.filter((i) => !skip.has(i.card.id)), epochs };
  // Déconnexion ou autre compte pendant la construction : rien n'est écrit ni servi
  if (!(await writeIfSessions(epochs, { [STORAGE_KEYS.recoBatch]: batch }))) {
    log.warn('Session fermée ou changée pendant le calcul : suggestions abandonnées');
    return { ok: false, code: 'SESSION_CHANGED', message: t('error.unexpected') };
  }
  // Touchées entre le filtre et l'écriture : retirées du lot enregistré, et du lot servi
  const late = touchedIds(all);
  if (late.size > skip.size) {
    await purgeStoredBatch(late);
    batch = { ...batch, items: batch.items.filter((i) => !late.has(i.card.id)) };
  }
  log.info(`Suggestions : ${batch.items.length} fiches, ${batch.seedCount} graines${batch.cold ? ' (démarrage à froid)' : ''}`);
  return { ok: true, batch, malOnly: epochs.anilist === undefined };
}

let inFlight: Promise<RecoResult> | null = null;

/** GET_RECOMMENDATIONS : lot en cache s'il a moins de 24 h (et pas `force`), sinon recalculé. Ne lève jamais. */
export async function getRecommendations(force: boolean): Promise<RecoResult> {
  try {
    if (!force) {
      const stored = (await chrome.storage.local.get(STORAGE_KEYS.recoBatch))[STORAGE_KEYS.recoBatch];
      const open = await getOpenSessions();
      const age = isRecoBatch(stored) ? Date.now() - stored.computedAt : -1;
      // Mêmes sessions qu'au calcul : un service connecté depuis (ou un autre compte) fait recalculer
      if (isRecoBatch(stored) && stored.epochs && sameSessions(stored.epochs, open) && age >= 0 && age < RECO_TTL_MS) {
        // Écartées depuis le calcul (autre appareil, restauration d'une sauvegarde) : jamais servies
        const dismissed = await readDismissed();
        return { ok: true, batch: { ...stored, items: stored.items.filter((i) => !dismissed.has(i.card.id)) }, malOnly: open.anilist === undefined };
      }
    }
    // Deux demandes simultanées (popup et panneau) partagent le même calcul
    inFlight ??= buildFresh().finally(() => {
      inFlight = null;
    });
    return await inFlight;
  } catch (error: unknown) {
    if (error instanceof ApiError) return { ok: false, code: 'FAILED', message: error.message };
    log.error('Erreur inattendue (suggestions) :', error);
    return { ok: false, code: 'FAILED', message: t('error.unexpected') };
  }
}
