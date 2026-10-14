import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { installFakeChrome } from '../../../test/fake-chrome';
import mediaSource from '../../api/media.ts?raw';
import refreshScriptSource from '../../../../scripts/refresh-anilist-corpus.ts?raw';
import { CASES } from './cases';
import { byIdsKey, CATALOG, SNAPSHOTS } from './snapshots';
import type { CorpusCase, CorpusMedia, CorpusOutcome } from './types';

// Corpus de cas réels (voir README.md) : chaque cas passe par la vraie résolution (resolveEpisode pour une page de
// lecture, resolvePageMedia pour une page de série) ; seules les requêtes AniList sont servies par les instantanés
// (aucun réseau). `expected` (comportement actuel) est vérifié strictement ; l'écart avec `ideal` est un rapport.

/** Requêtes envoyées par le cas en cours, et celles absentes des instantanés (à relever) */
const sent = { searches: [] as string[], missing: [] as string[] };

/** Fiche brute telle que l'API la renverrait (signaux retirés : jamais demandés par MEDIA_FIELDS) */
function raw(id: number): Omit<CorpusMedia, 'signals'> | null {
  const entry = CATALOG.media.get(id);
  if (!entry) return null;
  const { signals: _signals, ...fields } = entry;
  return fields;
}

function page(ids: readonly number[], what: string): { Page: { media: Omit<CorpusMedia, 'signals'>[] } } {
  const media = ids.map((id) => {
    const entry = raw(id);
    if (!entry) sent.missing.push(`${what} : fiche #${id} absente`);
    return entry;
  });
  return { Page: { media: media.filter((m): m is Omit<CorpusMedia, 'signals'> => m !== null) } };
}

/** Réponse de l'API publique AniList (recherche, fiches par identifiants, fiche de la page) servie par les instantanés */
function answer(variables: Record<string, unknown>): unknown {
  if (typeof variables.search === 'string') {
    const { search } = variables;
    sent.searches.push(search);
    const ids = CATALOG.searches.get(search);
    if (!ids) {
      sent.missing.push(`searches: ${JSON.stringify(search)}`);
      return { Page: { media: [] } };
    }
    return page(ids, `recherche « ${search} »`);
  }
  if (Array.isArray(variables.ids)) {
    const key = byIdsKey(variables.ids.filter((id): id is number => typeof id === 'number'));
    const ids = CATALOG.byIds.get(key);
    if (!ids) {
      sent.missing.push(`byIds: ${JSON.stringify(key)}`);
      return { Page: { media: [] } };
    }
    return page(ids, `fiches ${key}`);
  }
  if (typeof variables.id === 'number') {
    const entry = raw(variables.id);
    if (!entry) throw new Error(`Fiche de la page #${variables.id} absente des instantanés`);
    return { Media: { ...entry, status: CATALOG.media.get(variables.id)?.signals.status ?? null, siteUrl: `https://anilist.co/anime/${entry.id}`, coverImage: null, nextAiringEpisode: null } };
  }
  throw new Error(`Requête AniList inattendue : ${JSON.stringify(variables)}`);
}

vi.mock('../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/client')>()),
  anilistPublicQuery: (_query: string, isData: (data: unknown) => boolean, variables: Record<string, unknown> = {}): Promise<unknown> => {
    const data = answer(variables);
    if (!isData(data)) return Promise.reject(new Error(`Réponse simulée refusée : ${JSON.stringify(variables)}`));
    return Promise.resolve(data);
  },
}));
// Aucun service connecté (pas de lecture des listes), accès aux plateformes facultatives accordé
vi.mock('../../trackers', () => ({ getConnectedTrackers: () => Promise.resolve([]) }));
vi.mock('../../../shared/platform-access', () => ({ hasPlatformAccess: () => Promise.resolve(true) }));

const fake = installFakeChrome();
const { resolveEpisode } = await import('../resolver');
const { resolvePageMedia, forgetPageResolutions } = await import('../../page-media');
const { clearCatalogCache } = await import('../../api/media');

async function outcomeOf(corpusCase: CorpusCase): Promise<CorpusOutcome> {
  if (corpusCase.kind === 'episode') {
    const { result } = await resolveEpisode(corpusCase.episode);
    if (result.ok) return { mediaId: result.target.mediaId, confidence: result.target.confidence, progress: result.target.progress };
    return { mediaId: null, confidence: result.ignored ? 'ignored' : 'not-found', progress: null };
  }
  const result = await resolvePageMedia({ page: corpusCase.page, mediaId: null });
  if (result.ok) return { mediaId: result.data.media.mediaId, confidence: result.data.confidence === 'certain' ? 'high' : 'low' };
  if (result.code === 'NOT_TRACKED') return { mediaId: null, confidence: 'ignored' };
  if (result.code === 'NOT_FOUND') return { mediaId: null, confidence: 'not-found' };
  throw new Error(`${result.code} : ${result.message}`);
}

/** Forme comparée : `progress` seulement pour une page de lecture */
const comparable = (corpusCase: CorpusCase, outcome: CorpusOutcome): CorpusOutcome =>
  corpusCase.kind === 'episode' ? { mediaId: outcome.mediaId, confidence: outcome.confidence, progress: outcome.progress ?? null } : { mediaId: outcome.mediaId, confidence: outcome.confidence };

const actual = new Map<string, CorpusOutcome>();

beforeEach(() => {
  fake.reset();
  clearCatalogCache();
  forgetPageResolutions();
  sent.searches = [];
  sent.missing = [];
});

describe('corpus de correspondance : comportement actuel figé', () => {
  it.each(CASES.map((c) => [c.id, c] as const))('%s', async (_id, corpusCase) => {
    const outcome = await outcomeOf(corpusCase);
    actual.set(corpusCase.id, outcome);
    // Requête absente des instantanés : l'ajouter (valeur null) à anilist/<fichier>.json puis relever (README)
    expect(sent.missing, `anilist/${corpusCase.anilist}.json ${JSON.stringify(sent.missing)}`).toEqual([]);
    expect(comparable(corpusCase, outcome)).toEqual(comparable(corpusCase, corpusCase.expected));
    expect(sent.searches).toEqual(corpusCase.searches);
  });
});

describe('corpus : cohérence', () => {
  it('identifiants uniques, instantané existant, écart idéal décrit et réel', () => {
    expect(new Set(CASES.map((c) => c.id)).size).toBe(CASES.length);
    for (const c of CASES) {
      expect(SNAPSHOTS.has(c.anilist), `${c.id} : anilist/${c.anilist}.json`).toBe(true);
      expect(c.ideal === undefined, `${c.id} : ideal et gap vont ensemble`).toBe(c.gap === undefined);
      if (c.ideal) expect(comparable(c, c.ideal), `${c.id} : ideal identique à expected`).not.toEqual(comparable(c, c.expected));
    }
  });

  it('instantanés relevés : aucune requête en attente, date au format AAAA-MM-JJ', () => {
    for (const [name, snapshot] of SNAPSHOTS) {
      expect(snapshot.fetchedAt, name).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const pending = [...Object.entries(snapshot.searches), ...Object.entries(snapshot.byIds)].filter(([, ids]) => ids === null).map(([key]) => key);
      expect(pending, name).toEqual([]);
    }
  });

  it('le script de relevé demande exactement les champs de la résolution (MEDIA_FIELDS de api/media.ts)', () => {
    const fieldsOf = (source: string): string | undefined => /const MEDIA_FIELDS = \/\* GraphQL \*\/ `([^`]*)`/.exec(source)?.[1];
    const fields = fieldsOf(mediaSource);
    expect(fields).toBeDefined();
    expect(fieldsOf(refreshScriptSource)).toBe(fields);
  });
});

// Rapport (jamais en échec) : cas dont le résultat actuel n'est pas celui que veut le propriétaire
const describeOutcome = (o: CorpusOutcome | undefined): string => (o ? `${o.mediaId ?? '—'} ${o.confidence}${o.progress != null ? ` ep${o.progress}` : ''}` : '?');
for (const c of CASES) if (c.ideal) it.todo(`idéal ${c.id} : ${describeOutcome(c.ideal)} (actuel ${describeOutcome(c.expected)}) — ${c.gap ?? ''}`);

afterAll(() => {
  const rows = CASES.map((c) => ({ case: c.id, current: describeOutcome(actual.get(c.id)), ideal: c.ideal ? describeOutcome(c.ideal) : '= current' }));
  const gaps = CASES.filter((c) => c.ideal).length;
  console.log(`Corpus de correspondance : ${CASES.length} cas, ${gaps} écart(s) avec l'idéal\n${rows.map((r) => `${r.case.padEnd(36)} ${r.current.padEnd(22)} ${r.ideal}`).join('\n')}`);
});
