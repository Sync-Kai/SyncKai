// Vraies jaquettes et bannières AniList des fiches de démo (décision du 2026-10-18), lues au moment de la génération :
// UNE requête anonyme groupée à l'API GraphQL publique, réponse gardée dans le dossier temporaire du système (jamais
// dans le dépôt), images chargées par le navigateur depuis s4.anilist.co. Aucune image n'est enregistrée : elles ne
// finissent que dans les PNG générés. AniList injoignable → null (jaquettes de remplacement), jamais d'échec.
import { readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { isRecord } from '../../src/shared/guards.ts';
import { DEMO_MEDIA_IDS, type DemoCover, type DemoCovers } from './demo-media.ts';

const ENDPOINT = 'https://graphql.anilist.co';
const QUERY = 'query ($ids: [Int]) { Page(perPage: 50) { media(id_in: $ids, type: ANIME) { id coverImage { large extraLarge color } bannerImage } } }';
const CACHE_FILE = path.join(os.tmpdir(), 'synckai-screenshot-covers.json');
/** Les URL d'images d'AniList changent quand une jaquette est remplacée : cache relu au plus une semaine */
const CACHE_TTL_MS = 7 * 24 * 60 * 60_000;
const IMAGE_HOST = 's4.anilist.co';

export type CoversMode = 'anilist' | 'placeholder';

export function isCoversMode(value: string): value is CoversMode {
  return value === 'anilist' || value === 'placeholder';
}

/** URL https de s4.anilist.co, seul hôte AniList accepté par toImageSrc dans les vues ; sinon null */
function imageUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === IMAGE_HOST ? url.toString() : null;
  } catch {
    return null;
  }
}

const hexColor = (value: unknown): string | null => (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : null);

/** Réponse GraphQL → jaquettes par id ; forme inattendue → null */
export function parseCovers(body: unknown): DemoCovers | null {
  if (!isRecord(body) || !isRecord(body.data) || !isRecord(body.data.Page) || !Array.isArray(body.data.Page.media)) return null;
  const covers: DemoCovers = {};
  for (const media of body.data.Page.media) {
    if (!isRecord(media) || typeof media.id !== 'number') continue;
    const image = isRecord(media.coverImage) ? media.coverImage : {};
    // `extraLarge` (dossier cover/large, ≈ 460 px de large) plutôt que `large` (cover/medium, ≈ 100 px) : jaquettes
    // affichées sur 64 px de large au plus (héros du panneau), plus nettes réduites depuis une grande image
    const cover: DemoCover = { cover: imageUrl(image.extraLarge) ?? imageUrl(image.large), banner: imageUrl(media.bannerImage), color: hexColor(image.color) };
    covers[String(media.id)] = cover;
  }
  return covers;
}

interface CacheFile {
  fetchedAt: number;
  ids: number[];
  covers: DemoCovers;
}

async function readCache(now: number): Promise<DemoCovers | null> {
  try {
    const parsed: unknown = JSON.parse(await readFile(CACHE_FILE, 'utf8'));
    if (!isRecord(parsed) || typeof parsed.fetchedAt !== 'number' || !isRecord(parsed.covers)) return null;
    const ids: unknown[] = Array.isArray(parsed.ids) ? parsed.ids : [];
    // Cache expiré, ou écrit avant l'ajout d'une fiche de démo : relu sur l'API
    if (now - parsed.fetchedAt > CACHE_TTL_MS || !DEMO_MEDIA_IDS.every((id) => ids.includes(id))) return null;
    // Mêmes contrôles d'URL qu'à la lecture de l'API
    const covers: DemoCovers = {};
    for (const [id, c] of Object.entries(parsed.covers)) if (isRecord(c)) covers[id] = { cover: imageUrl(c.cover), banner: imageUrl(c.banner), color: hexColor(c.color) };
    return covers;
  } catch {
    return null;
  }
}

async function fetchCovers(): Promise<DemoCovers> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query: QUERY, variables: { ids: DEMO_MEDIA_IDS } }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const covers = parseCovers(await response.json());
  if (!covers) throw new Error('réponse inattendue');
  return covers;
}

/**
 * Jaquettes réelles des fiches de démo, ou null (mode `placeholder`, AniList injoignable) : les vues gardent alors les
 * jaquettes de remplacement de covers.ts. Une fiche absente de la réponse garde la sienne (avertissement).
 */
export async function loadDemoCovers(mode: CoversMode, now: number = Date.now()): Promise<DemoCovers | null> {
  if (mode === 'placeholder') {
    console.log('Jaquettes de remplacement (SYNCKAI_SCREENSHOT_COVERS=placeholder ou --covers placeholder)');
    return null;
  }
  let covers = await readCache(now);
  if (covers) {
    console.log(`Jaquettes AniList : cache ${CACHE_FILE}`);
  } else {
    try {
      covers = await fetchCovers();
      const cache: CacheFile = { fetchedAt: now, ids: [...DEMO_MEDIA_IDS], covers };
      await writeFile(CACHE_FILE, JSON.stringify(cache));
      console.log(`Jaquettes AniList : ${Object.keys(covers).length} fiches lues (cache ${CACHE_FILE})`);
    } catch (error: unknown) {
      console.warn(`⚠ AniList injoignable (${error instanceof Error ? error.message : String(error)}) : jaquettes de remplacement`);
      return null;
    }
  }
  const missing = DEMO_MEDIA_IDS.filter((id) => !covers[String(id)]?.cover);
  if (missing.length > 0) console.warn(`⚠ Sans jaquette AniList (remplacement gardé) : ${missing.join(', ')}`);
  return covers;
}
