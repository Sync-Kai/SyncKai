// Relevé des instantanés AniList du corpus de correspondance (src/background/sync/__corpus__/anilist/*.json).
// Lancement manuel, hors `npm run verify` (réseau) :
//   node scripts/refresh-anilist-corpus.ts            → relève de nouveau toutes les requêtes de tous les instantanés
//   node scripts/refresh-anilist-corpus.ts --pending  → seulement les requêtes à `null` (cas ajouté), date inchangée (sauf instantané neuf)
//   node scripts/refresh-anilist-corpus.ts one-piece  → un seul instantané (combinable avec --pending)
// API publique, anonyme (aucun jeton) : https://graphql.anilist.co, au plus ~25 requêtes par minute.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CORPUS_DIR = join(import.meta.dirname, '../src/background/sync/__corpus__/anilist');
const ENDPOINT = 'https://graphql.anilist.co';
/** 2,5 s entre deux requêtes : 24 par minute, sous la limite anonyme d'AniList */
const REQUEST_GAP_MS = 2500;

// Copie EXACTE de MEDIA_FIELDS (src/background/api/media.ts), vérifiée par corpus.test.ts
const MEDIA_FIELDS = /* GraphQL */ `
  id
  idMal
  format
  episodes
  startDate { year month day }
  seasonYear
  coverImage { medium }
  title { romaji english native userPreferred }
  synonyms
  externalLinks { url }
  relations { edges { relationType node { id type format } } }
`;

/** Signaux relevés à part (pas encore lus par la résolution) */
const SIGNAL_FIELDS = 'duration countryOfOrigin status endDate { year month day }';

const SEARCH_QUERY = `query SearchAnime($search: String!) { Page(perPage: 20) { media(search: $search, type: ANIME) { ${MEDIA_FIELDS} ${SIGNAL_FIELDS} } } }`;
const BY_IDS_QUERY = `query AnimeByIds($ids: [Int]) { Page(perPage: 50) { media(id_in: $ids, type: ANIME) { ${MEDIA_FIELDS} ${SIGNAL_FIELDS} } } }`;

/** Hôtes des plateformes prises en charge : seuls liens lus par la résolution (les autres sont retirés de l'instantané) */
const PLATFORM_HOSTS = /(^|\.)(crunchyroll\.com|animationdigitalnetwork\.(com|fr)|netflix\.com|disneyplus\.com|primevideo\.com|amazon\.[a-z.]+)$/;

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };

interface Snapshot {
  fetchedAt: string;
  searches: Record<string, number[] | null>;
  byIds: Record<string, number[] | null>;
  media: JsonObject[];
}

const isObject = (v: Json | undefined): v is JsonObject => typeof v === 'object' && v !== null && !Array.isArray(v);
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
let lastRequestAt = 0;
let requestCount = 0;

async function query(text: string, variables: JsonObject): Promise<JsonObject[]> {
  for (let attempt = 0; ; attempt++) {
    const wait = lastRequestAt + REQUEST_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
    requestCount++;
    const response = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ query: text, variables }) });
    if (response.status === 429 && attempt < 3) {
      const retry = Number(response.headers.get('retry-after') ?? '60');
      console.warn(`429 : nouvelle tentative dans ${retry} s`);
      await sleep((Number.isFinite(retry) ? retry : 60) * 1000 + 1000);
      continue;
    }
    if (!response.ok) throw new Error(`AniList ${response.status} : ${await response.text()}`);
    const body = (await response.json()) as Json;
    const page = isObject(body) && isObject(body.data) && isObject(body.data.Page) ? body.data.Page.media : undefined;
    if (!Array.isArray(page)) throw new Error(`Réponse inattendue : ${JSON.stringify(body).slice(0, 300)}`);
    return page.filter(isObject);
  }
}

/** Fiche réduite aux champs lus (liens des plateformes seulement), signaux à part, sans image */
function reduce(raw: JsonObject): JsonObject {
  const { duration, countryOfOrigin, status, endDate, coverImage: _cover, externalLinks, ...fields } = raw;
  const links = (Array.isArray(externalLinks) ? externalLinks : []).filter((link): link is JsonObject => {
    if (!isObject(link) || typeof link.url !== 'string') return false;
    try {
      return PLATFORM_HOSTS.test(new URL(link.url).hostname);
    } catch {
      return false;
    }
  });
  // Relations lues par la résolution : suites / préquelles d'anime uniquement
  const edges = isObject(fields.relations) && Array.isArray(fields.relations.edges) ? fields.relations.edges : [];
  const franchise = edges.filter((edge) => isObject(edge) && (edge.relationType === 'SEQUEL' || edge.relationType === 'PREQUEL') && isObject(edge.node) && edge.node.type === 'ANIME');
  return {
    ...fields,
    relations: { edges: franchise },
    externalLinks: links.map((link) => ({ url: link.url ?? null })),
    signals: { duration: duration ?? null, countryOfOrigin: countryOfOrigin ?? null, status: status ?? null, seasonYear: fields.seasonYear ?? null, endDate: endDate ?? null },
  };
}

/** Une fiche par ligne : relecture et diff lisibles */
function serialize(snapshot: Snapshot): string {
  const block = (record: Record<string, number[] | null>): string =>
    Object.entries(record)
      .map(([key, ids]) => `    ${JSON.stringify(key)}: ${JSON.stringify(ids)}`)
      .join(',\n');
  const media = [...snapshot.media].sort((a, b) => Number(a.id) - Number(b.id)).map((m) => `    ${JSON.stringify(m)}`).join(',\n');
  return `{\n  "fetchedAt": ${JSON.stringify(snapshot.fetchedAt)},\n  "searches": {\n${block(snapshot.searches)}\n  },\n  "byIds": {\n${block(snapshot.byIds)}\n  },\n  "media": [\n${media}\n  ]\n}\n`;
}

async function refresh(name: string, pendingOnly: boolean): Promise<void> {
  const path = join(CORPUS_DIR, `${name}.json`);
  const snapshot = JSON.parse(readFileSync(path, 'utf8')) as Snapshot;
  const media = new Map<number, JsonObject>(pendingOnly ? snapshot.media.map((m) => [Number(m.id), m]) : []);
  const keep = (list: JsonObject[]): number[] =>
    list.map((raw) => {
      const reduced = reduce(raw);
      media.set(Number(reduced.id), reduced);
      return Number(reduced.id);
    });
  for (const [search, ids] of Object.entries(snapshot.searches)) {
    if (pendingOnly && ids !== null) continue;
    snapshot.searches[search] = keep(await query(SEARCH_QUERY, { search }));
    console.log(`${name} · recherche « ${search} » : ${snapshot.searches[search]?.length ?? 0} fiches`);
  }
  for (const [key, ids] of Object.entries(snapshot.byIds)) {
    if (pendingOnly && ids !== null) continue;
    snapshot.byIds[key] = keep(await query(BY_IDS_QUERY, { ids: key.split(',').map(Number) }));
    console.log(`${name} · fiches ${key} : ${snapshot.byIds[key]?.length ?? 0}`);
  }
  // Relevé complet : seules les fiches renvoyées par les requêtes restent ; date du jour
  if (!pendingOnly || snapshot.fetchedAt === '') snapshot.fetchedAt = new Date().toISOString().slice(0, 10);
  snapshot.media = [...media.values()];
  writeFileSync(path, serialize(snapshot));
}

const args = process.argv.slice(2);
const pendingOnly = args.includes('--pending');
const only = args.filter((arg) => !arg.startsWith('--'));
const names = readdirSync(CORPUS_DIR)
  .filter((file) => file.endsWith('.json'))
  .map((file) => file.slice(0, -'.json'.length))
  .filter((name) => only.length === 0 || only.includes(name));
for (const name of names) await refresh(name, pendingOnly);
console.log(`${requestCount} requêtes AniList`);
