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
export interface RecoReason { seedId: number; seedTitle: string; seedScore: number; matched: string[] }
export interface RecoItem { card: RecoCard; score: number; reason: RecoReason | null }
export interface RecoBatch { items: RecoItem[]; computedAt: number; seedCount: number; cold: boolean }
// Réponse du service worker à GET_RECOMMENDATIONS ; `malOnly` : seul MyAnimeList est connecté (catalogue AniList lu sans compte)
export type RecoResult = { ok: true; batch: RecoBatch; malOnly: boolean } | { ok: false; message: string };
export interface Seed { id: number; title: string; score10: number; genres: string[]; tags: string[] }

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
    .map((e) => ({ id: e.id, title: e.title, score10: e.score10 as number }));
  if (seeds.length < MIN_SEEDS) {
    for (const e of done) {
      if (seeds.length >= MIN_SEEDS) break;
      if (e.score10 === null) seeds.push({ id: e.id, title: e.title, score10: UNSCORED_WEIGHT });
    }
  }
  return { seeds, cold: done.length < MIN_SEEDS };
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
      const unseenPrequel = (media.relations?.edges ?? []).some((e) => e.relationType === 'PREQUEL' && e.node !== null && !exclude.watchedOrCurrent.has(e.node.id));
      if (unseenPrequel) continue;
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
    items.push({ card, score: sum * (1 + affinity), reason: { seedId: best.seed.id, seedTitle: best.seed.title, seedScore: best.seed.score10, matched } });
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

export function withoutItem(batch: RecoBatch, id: number): RecoBatch {
  return { ...batch, items: batch.items.filter((i) => i.card.id !== id) };
}
