import { isRecord } from './guards';
import type { SessionEpochs } from './session-epochs';
import type { PlatformLink } from './watching.types';

export const BATCH_SIZE = 60;
export const MAX_SEEDS = 50;
export const MAX_DISMISSED = 500;

const MIN_SEED_SCORE = 7;
const MIN_SEEDS = 3;
const UNSCORED_WEIGHT = 6;
const MAX_MATCHED = 4;
const MIN_TAG_RANK = 60;
const TAG_WEIGHT = 0.5;

export interface RecoCard { id: number; idMal: number | null; title: string; format: string | null; year: number | null; episodes: number | null; averageScore: number | null; genres: string[]; tags: string[]; coverUrl: string | null; coverLarge: string | null; color: string | null; bannerUrl: string | null; siteUrl: string; platforms: PlatformLink[] }
/** `rated` : la note de la graine vient de l'utilisateur ; faux pour une terminée non notée (poids de calcul seulement, jamais affiché) */
export interface RecoReason { seedId: number; seedTitle: string; seedScore: number; rated: boolean; matched: string[] }
export interface RecoItem { card: RecoCard; score: number; reason: RecoReason | null }
/** `epochs` : sessions ouvertes au calcul (écrit par le service worker) ; un autre jeu de sessions fait recalculer le lot */
export interface RecoBatch { items: RecoItem[]; computedAt: number; seedCount: number; cold: boolean; epochs?: SessionEpochs }
// Réponse du service worker à GET_RECOMMENDATIONS ; `malOnly` : seul MyAnimeList est connecté (catalogue AniList lu sans compte)
/** NO_ACCOUNT : aucun service connecté ; SESSION_CHANGED : déconnexion ou autre compte pendant le calcul ; FAILED : le reste */
export type RecoErrorCode = 'NO_ACCOUNT' | 'SESSION_CHANGED' | 'FAILED';
export type RecoResult = { ok: true; batch: RecoBatch; malOnly: boolean } | { ok: false; code: RecoErrorCode; message: string };
export interface Seed { id: number; title: string; score10: number; rated: boolean; genres: string[]; tags: string[] }

// Nœud `mediaRecommendation` tel que renvoyé par AniList (champs de la carte)
export interface RawRecoMedia {
  id: number;
  idMal: number | null;
  isAdult: boolean | null;
  format: string | null;
  status: string | null;
  episodes: number | null;
  duration: number | null;
  averageScore: number | null;
  genres: string[] | null;
  tags: { name: string; rank: number | null; isMediaSpoiler: boolean | null }[] | null;
  title: { userPreferred: string | null } | null;
  coverImage: { large: string | null; medium: string | null; color: string | null } | null;
  bannerImage: string | null;
  siteUrl: string | null;
  startDate: { year: number | null } | null;
  season: string | null;
  seasonYear: number | null;
  externalLinks: { url: string | null }[] | null;
  relations: { edges: { relationType: string; node: { id: number } | null }[] } | null;
}

interface PickEntry { id: number; title: string; status: string; score10: number | null }

/** Ids des préquels directs d'une fiche (arêtes `relations` d'AniList) */
export const prequelIdsOf = (edges: readonly { relationType: string; node: { id: number } | null }[] | null | undefined): number[] =>
  (edges ?? []).flatMap((e) => (e.relationType === 'PREQUEL' && e.node !== null ? [e.node.id] : []));

/** Suite dont un préquel n'est ni vu, ni en cours, ni en revisionnage : on ne la propose pas */
export const hasUnseenPrequel = (prequelIds: readonly number[], watchedOrCurrent: ReadonlySet<number>): boolean => prequelIds.some((id) => !watchedOrCurrent.has(id));

const isDone = (status: string): boolean => status === 'COMPLETED' || status === 'REPEATING';

export function pickSeeds(entries: readonly PickEntry[]): { seeds: Omit<Seed, 'genres' | 'tags'>[]; cold: boolean } {
  // Un même id présent sur deux comptes : on garde la meilleure note
  const merged = new Map<number, PickEntry>();
  for (const e of entries) {
    if (!isDone(e.status)) continue;
    const prev = merged.get(e.id);
    if (!prev) merged.set(e.id, e);
    else if ((e.score10 ?? -1) > (prev.score10 ?? -1)) merged.set(e.id, { ...prev, score10: e.score10 });
  }
  const done = [...merged.values()];
  const seeds = done
    .filter((e) => e.score10 !== null && e.score10 >= MIN_SEED_SCORE)
    .sort((a, b) => (b.score10 as number) - (a.score10 as number))
    .slice(0, MAX_SEEDS)
    .map((e) => ({ id: e.id, title: e.title, score10: e.score10 as number, rated: true }));
  if (seeds.length < MIN_SEEDS) {
    for (const e of done) {
      if (seeds.length >= MIN_SEEDS) break;
      if (e.score10 === null) seeds.push({ id: e.id, title: e.title, score10: UNSCORED_WEIGHT, rated: false });
    }
  }
  // Aucune graine (terminées toutes mal notées) : démarrage à froid plutôt qu'un lot vide gardé 24 h
  return { seeds, cold: seeds.length === 0 || done.length < MIN_SEEDS };
}

export function toCard(m: RawRecoMedia): RecoCard {
  return {
    id: m.id,
    idMal: m.idMal ?? null,
    title: m.title?.userPreferred ?? '',
    format: m.format ?? null,
    year: m.startDate?.year ?? m.seasonYear ?? null,
    episodes: m.episodes ?? null,
    averageScore: m.averageScore ?? null,
    genres: m.genres ?? [],
    tags: relevantTags(m),
    coverUrl: m.coverImage?.medium ?? m.coverImage?.large ?? null,
    coverLarge: m.coverImage?.large ?? null,
    color: m.coverImage?.color ?? null,
    bannerUrl: m.bannerImage ?? null,
    siteUrl: m.siteUrl ?? `https://anilist.co/anime/${m.id}`,
    platforms: [],
  };
}

// Tags assez représentatifs (rang ≥ 60) et sans spoiler
export const relevantTags = (m: Pick<RawRecoMedia, 'tags'>): string[] => (m.tags ?? []).filter((t) => (t.rank ?? 0) >= MIN_TAG_RANK && !t.isMediaSpoiler).map((t) => t.name);

// Part (0..1) de la note totale des graines qui portent chaque libellé
function shareByLabel(seeds: readonly Seed[], pick: (s: Seed) => string[]): Map<string, number> {
  const total = seeds.reduce((sum, s) => sum + s.score10, 0) || 1;
  const share = new Map<string, number>();
  for (const s of seeds) for (const label of new Set(pick(s))) share.set(label, (share.get(label) ?? 0) + s.score10 / total);
  return share;
}

export function buildBatch(
  seeds: readonly Seed[],
  recs: ReadonlyMap<number, { rating: number; media: RawRecoMedia }[]>,
  exclude: { ids: ReadonlySet<number>; malIds: ReadonlySet<number>; dismissed: ReadonlySet<number>; watchedOrCurrent: ReadonlySet<number> },
  now: number,
): RecoBatch {
  const genreShare = shareByLabel(seeds, (s) => s.genres);
  const tagShare = shareByLabel(seeds, (s) => s.tags);
  const candidates = new Map<number, { media: RawRecoMedia; sum: number; best: { seed: Seed; contribution: number } }>();

  for (const seed of seeds) {
    for (const { rating, media } of recs.get(seed.id) ?? []) {
      if (media.isAdult || exclude.ids.has(media.id) || exclude.dismissed.has(media.id)) continue;
      if (media.idMal !== null && media.idMal !== undefined && exclude.malIds.has(media.idMal)) continue;
      // Suite dont le préquel n'est ni vu ni en cours : on ne la propose pas
      if (hasUnseenPrequel(prequelIdsOf(media.relations?.edges), exclude.watchedOrCurrent)) continue;
      const contribution = seed.score10 * Math.max(rating, 1);
      const prev = candidates.get(media.id);
      if (!prev) candidates.set(media.id, { media, sum: contribution, best: { seed, contribution } });
      else {
        prev.sum += contribution;
        if (contribution > prev.best.contribution) prev.best = { seed, contribution };
      }
    }
  }

  const items: RecoItem[] = [];
  for (const { media, sum, best } of candidates.values()) {
    const card = toCard(media);
    // Affinité : part pondérée des genres (poids 1) et tags (poids 0,5) du candidat déjà aimés
    let weighted = 0;
    let weights = 0;
    for (const g of card.genres) { weighted += genreShare.get(g) ?? 0; weights += 1; }
    for (const t of card.tags) { weighted += TAG_WEIGHT * (tagShare.get(t) ?? 0); weights += TAG_WEIGHT; }
    const affinity = weights > 0 ? weighted / weights : 0;
    const matched = [...card.genres.filter((g) => best.seed.genres.includes(g)), ...card.tags.filter((t) => best.seed.tags.includes(t))].slice(0, MAX_MATCHED);
    items.push({ card, score: sum * (1 + affinity), reason: { seedId: best.seed.id, seedTitle: best.seed.title, seedScore: best.seed.score10, rated: best.seed.rated, matched } });
  }
  items.sort((a, b) => b.score - a.score || a.card.id - b.card.id);
  return { items: items.slice(0, BATCH_SIZE), computedAt: now, seedCount: seeds.length, cold: false };
}

// Tirage pondéré par le score parmi les éléments non encore tirés
export function drawNext(batch: RecoBatch, skip: ReadonlySet<number>, random: () => number): RecoItem | null {
  const pool = batch.items.filter((i) => !skip.has(i.card.id));
  if (pool.length === 0) return null;
  const total = pool.reduce((sum, i) => sum + i.score, 0);
  let target = random() * total;
  for (const item of pool) {
    target -= item.score;
    if (target < 0) return item;
  }
  return pool[pool.length - 1];
}

export type RecoFormat = 'all' | 'series' | 'movies';
/** Filtre de « Pour toi » : un genre (ou tous) et un format */
export interface RecoFilter { genre: string | null; format: RecoFormat }
export const ALL_RECO_FILTER: RecoFilter = { genre: null, format: 'all' };

export const isRecoFilter = (value: unknown): value is RecoFilter =>
  isRecord(value) && (value.genre === null || typeof value.genre === 'string') && (value.format === 'all' || value.format === 'series' || value.format === 'movies');

const SERIES_FORMATS: readonly string[] = ['TV', 'TV_SHORT', 'ONA', 'OVA', 'SPECIAL'];

/** movies = MOVIE ; series = TV, TV_SHORT, ONA, OVA, SPECIAL ; format null ou MUSIC : seulement « all » */
export function matchesRecoFilter(card: RecoCard, filter: RecoFilter): boolean {
  if (filter.genre !== null && !card.genres.includes(filter.genre)) return false;
  if (filter.format === 'all') return true;
  return filter.format === 'movies' ? card.format === 'MOVIE' : card.format !== null && SERIES_FORMATS.includes(card.format);
}

/** Genres du lot, du plus fréquent au moins fréquent, puis par nom */
export function recoGenres(batch: RecoBatch): string[] {
  const counts = new Map<string, number>();
  for (const { card } of batch.items) for (const genre of new Set(card.genres)) counts.set(genre, (counts.get(genre) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([genre]) => genre);
}

export function withoutItem(batch: RecoBatch, id: number): RecoBatch {
  return { ...batch, items: batch.items.filter((i) => i.card.id !== id) };
}

/** Lot lu dans le stockage : forme vérifiée (les fiches ne sont pas relues une à une, le lot est écrit par le service worker) */
export const isRecoBatch = (value: unknown): value is RecoBatch =>
  isRecord(value) && Array.isArray(value.items) && typeof value.computedAt === 'number' && typeof value.seedCount === 'number' && typeof value.cold === 'boolean';
