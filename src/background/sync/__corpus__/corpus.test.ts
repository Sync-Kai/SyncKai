import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { installFakeChrome } from '../../../test/fake-chrome';
import mediaSource from '../../anilist/media.ts?raw';
import refreshScriptSource from '../../../../scripts/refresh-anilist-corpus.ts?raw';
import { CASES } from './cases';
import { byIdsKey, CATALOG, SNAPSHOTS } from './snapshots';
import { bumpkinDetailBody, spaDetailResponse } from '../../../shared/__fixtures__/prime-detail';
import type { StreamingPlatform } from '../../../shared/episode.types';
import { medianMinutes, toPlatformSignals, type PlatformSignals } from '../../../shared/match-signals';
import { isNetflixShowMetadata, netflixSignals, type NetflixShowMetadata } from '../../../platforms/netflix/metadata';
import { primeSignals, reducePrimeDetail } from '../../../platforms/prime/metadata';
import { crunchyrollSignals, mergeCrunchyrollSeries, reduceCrunchyrollEpisodes, reduceCrunchyrollSeasons } from '../../../platforms/crunchyroll/metadata';
import type { CapturedSignals, CorpusCase, CorpusMedia, CorpusOutcome, PlatformSeasonSignal } from './types';

// Corpus de cas réels (voir README.md) : chaque cas passe par la vraie résolution (resolveEpisode pour une page de
// lecture, resolvePageMedia pour une page de série) ; seules les requêtes AniList sont servies par les instantanés
// (aucun réseau). `expected` (comportement actuel) est vérifié strictement ; l'écart avec `ideal` est un rapport.

/** Requêtes envoyées par le cas en cours, et celles absentes des instantanés (à relever) */
const sent = { searches: [] as string[], missing: [] as string[] };

/** Fiche brute telle que l'API la renvoie : champs de MEDIA_FIELDS, signaux (rangés à part dans l'instantané) remis en place */
type RawMedia = Omit<CorpusMedia, 'signals'> & Omit<CorpusMedia['signals'], 'seasonYear'>;

function raw(id: number): RawMedia | null {
  const entry = CATALOG.media.get(id);
  if (!entry) return null;
  const { signals, ...fields } = entry;
  return { ...fields, duration: signals.duration, countryOfOrigin: signals.countryOfOrigin, status: signals.status, endDate: signals.endDate };
}

function page(ids: readonly number[], what: string): { Page: { media: RawMedia[] } } {
  const media = ids.map((id) => {
    const entry = raw(id);
    if (!entry) sent.missing.push(`${what} : fiche #${id} absente`);
    return entry;
  });
  return { Page: { media: media.filter((m): m is RawMedia => m !== null) } };
}

/** Réponse de l'API publique AniList (recherche, fiches par identifiants, fiche de la page) servie par les instantanés */
function answer(query: string, variables: Record<string, unknown>): unknown {
  // Fiches de la carte en une requête (page-media › prefetchSeasons) : mêmes fiches que PageMedia, aucune liste (aucun compte)
  if (/query PageMediaBatch\b/.test(query) && Array.isArray(variables.ids)) {
    const ids = variables.ids.filter((id): id is number => typeof id === 'number');
    return { Page: { media: ids.flatMap((id) => { const entry = raw(id); return entry ? [{ ...entry, status: CATALOG.media.get(id)?.signals.status ?? null, siteUrl: `https://anilist.co/anime/${id}`, coverImage: null, nextAiringEpisode: null }] : []; }) } };
  }
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

vi.mock('../../anilist/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../anilist/client')>()),
  anilistPublicQuery: (query: string, isData: (data: unknown) => boolean, variables: Record<string, unknown> = {}): Promise<unknown> => {
    const data = answer(query, variables);
    if (!isData(data)) return Promise.reject(new Error(`Réponse simulée refusée : ${JSON.stringify(variables)}`));
    return Promise.resolve(data);
  },
}));
// Aucun service connecté (pas de lecture des listes), accès aux plateformes facultatives accordé
vi.mock('../../trackers', () => ({ getConnectedTrackers: () => Promise.resolve([]) }));
vi.mock('../../../browser/platform-access', () => ({ hasPlatformAccess: () => Promise.resolve(true) }));

const fake = installFakeChrome();
const { resolveEpisode } = await import('../resolver');
const { resolvePageMedia, forgetPageResolutions } = await import('../../page-media/page-media');
const { clearCatalogCache } = await import('../../anilist/media');
const { getMediaMapping, saveMediaMapping } = await import('../../../browser/storage/mappings');

/** Saison affichée parmi les saisons relevées (`seq` = numéro de saison ; une seule saison relevée : celle-ci) */
function shownSeason(captured: CapturedSignals, seasonNumber: number | null): PlatformSeasonSignal | undefined {
  const seasons = captured.seasons ?? [];
  return seasons.find((s) => s.seq === seasonNumber) ?? (seasons.length === 1 ? seasons[0] : undefined);
}

const withAiring = (signals: PlatformSignals | undefined, captured: CapturedSignals): PlatformSignals | undefined =>
  signals && captured.airing !== undefined ? { ...signals, airing: captured.airing } : signals;

/**
 * Netflix : métadonnées réduites reconstruites des saisons relevées (`video.seasons[]` : seq, year, épisodes), passées
 * par netflixSignals, comme le script de contenu (adapters/netflix.ts › episodeInfoFromMetadata).
 */
function netflixCaseSignals(captured: CapturedSignals, seasonNumber: number | null): PlatformSignals | undefined {
  const runtime = captured.episodeDurationS ?? null;
  const show: NetflixShowMetadata = {
    showId: '1',
    type: captured.format === 'movie' ? 'movie' : 'show',
    title: 'corpus',
    runtime: captured.format === 'movie' ? runtime : null,
    creditsOffset: null,
    seasons: (captured.seasons ?? []).map((s) => ({
      seq: s.seq,
      title: s.title ?? null,
      year: s.year,
      episodes: Array.from({ length: s.episodes ?? 0 }, (_, i) => ({ id: String(s.seq * 10_000 + i + 1), seq: i + 1, title: null, runtime, creditsOffset: null })),
    })),
  };
  if (!isNetflixShowMetadata(show)) throw new Error('saisons Netflix relevées illisibles');
  const season = show.seasons.find((s) => s.seq === shownSeason(captured, seasonNumber)?.seq) ?? null;
  return withAiring(netflixSignals(show, season), captured);
}

/**
 * Prime Video : page de détail (forme relevée le 2026-10-14) portant le `releaseYear` de la saison, réduite par
 * reducePrimeDetail puis primeSignals, comme le script de contenu (adapters/prime.ts)
 */
function primeCaseSignals(captured: CapturedSignals, seasonNumber: number | null): PlatformSignals | undefined {
  const season = shownSeason(captured, seasonNumber);
  const body = bumpkinDetailBody({ releaseYear: season?.year ?? null, seasonNumber: season?.seq ?? 1, titleType: captured.format === 'movie' ? 'movie' : 'season', episodes: season?.episodes ?? 0 });
  const title = reducePrimeDetail(spaDetailResponse(body));
  if (!title) throw new Error('page de détail Prime Video illisible');
  return withAiring(primeSignals(title), captured);
}

/**
 * Disney+ (page de lecture, adapters/disney.ts › playbackSignals) : année de début de la SÉRIE et épisodes de la saison
 * (page de série vue dans l'onglet), durée de la fiche, format d'après `programType`. Jamais d'année de saison.
 */
function disneyCaseSignals(captured: CapturedSignals, seasonNumber: number | null): PlatformSignals | undefined {
  const signals = toPlatformSignals({
    seriesYear: captured.seriesStartYear,
    seasonEpisodeCount: shownSeason(captured, seasonNumber)?.episodes,
    episodeMinutes: medianMinutes([captured.episodeDurationS]),
    format: captured.format ?? 'series',
  });
  return withAiring(signals, captured);
}

/**
 * Crunchyroll (adapters/crunchyroll.ts, via le pont MAIN) : réponses `seasons` et `episodes` reconstruites des saisons
 * relevées dans la forme réelle du 2026-10-14 (une ligne par saison originale japonaise, `is_dubbed: true` dès qu'un
 * doublage existe, sa propre entrée `original` dans `versions[]` ; premier épisode diffusé l'année relevée), passées par
 * les réductions et crunchyrollSignals. Crunchyroll n'envoie pas `airing`.
 */
function crunchyrollCaseSignals(captured: CapturedSignals, seasonNumber: number | null): PlatformSignals | undefined {
  const seasons = captured.seasons ?? [];
  const rows = reduceCrunchyrollSeasons({ data: seasons.map((s) => ({ id: `GCORPUS${s.seq}`, season_number: s.seq, season_sequence_number: s.seq, number_of_episodes: s.episodes, audio_locale: 'ja-JP', is_dubbed: true, is_subbed: true, versions: [{ audio_locale: 'ja-JP', guid: `GCORPUS${s.seq}`, original: true }, { audio_locale: 'en-US', guid: `GCORPUSDUB${s.seq}`, original: false }] })) }) ?? [];
  const series = mergeCrunchyrollSeries('GCORPUS', captured.seriesStartYear ?? null, rows, (id) => {
    const s = seasons.find((x) => `GCORPUS${x.seq}` === id);
    return s ? (reduceCrunchyrollEpisodes({ data: [{ id: `GCORPUSE${s.seq}`, episode_air_date: `${s.year}-01-01T00:00:00Z`, duration_ms: captured.episodeDurationS === undefined ? undefined : captured.episodeDurationS * 1000, media_type: 'episode' }] }) ?? undefined) : undefined;
  });
  return crunchyrollSignals(series, { seasonNumber });
}

/**
 * Signaux relevés du cas, sous la forme envoyée par la plateforme (EpisodeInfo.signals) : Netflix, Prime Video et
 * Disney+ et Crunchyroll par les règles de leur script de contenu ; ADN (lecture : aucun signal envoyé aujourd'hui) sous
 * la forme supposée : saison affichée, année de la série, durée en minutes, format, diffusion.
 */
function signalsOf(platform: StreamingPlatform, captured: CapturedSignals | undefined, seasonNumber: number | null): PlatformSignals | undefined {
  if (!captured) return undefined;
  if (platform === 'netflix') return netflixCaseSignals(captured, seasonNumber);
  if (platform === 'prime') return primeCaseSignals(captured, seasonNumber);
  if (platform === 'disney') return disneyCaseSignals(captured, seasonNumber);
  if (platform === 'crunchyroll') return crunchyrollCaseSignals(captured, seasonNumber);
  const season = shownSeason(captured, seasonNumber);
  const signals: PlatformSignals = {
    ...(season ? { seasonYear: season.year } : {}),
    ...(season?.episodes !== undefined ? { seasonEpisodeCount: season.episodes } : {}),
    ...(captured.seriesStartYear !== undefined ? { seriesYear: captured.seriesStartYear } : {}),
    ...(captured.episodeDurationS !== undefined ? { episodeMinutes: captured.episodeDurationS / 60 } : {}),
    ...(captured.format !== undefined ? { format: captured.format } : {}),
    ...(captured.airing !== undefined ? { airing: captured.airing } : {}),
  };
  return Object.keys(signals).length > 0 ? signals : undefined;
}

async function outcomeOf(corpusCase: CorpusCase): Promise<CorpusOutcome> {
  for (const [key, mapping] of Object.entries(corpusCase.mappings ?? {})) await saveMediaMapping(key, mapping);
  if (corpusCase.kind === 'episode') {
    const signals = signalsOf(corpusCase.episode.platform, corpusCase.signals, corpusCase.episode.seasonNumber);
    const { result } = await resolveEpisode(signals ? { ...corpusCase.episode, signals } : corpusCase.episode);
    if (result.ok) return { mediaId: result.target.mediaId, confidence: result.target.confidence, progress: result.target.progress };
    return { mediaId: null, confidence: result.ignored ? 'ignored' : 'not-found', progress: null };
  }
  const signals = signalsOf(corpusCase.page.platform, corpusCase.signals, corpusCase.page.seasonNumber);
  const result = await resolvePageMedia({ page: signals ? { ...corpusCase.page, signals } : corpusCase.page, mediaId: null });
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
    // Correspondance qui peut être un choix de l'utilisateur (sans `learned`) : jamais supprimée ni réécrite
    for (const [key, mapping] of Object.entries(corpusCase.mappings ?? {})) if (mapping.learned !== true) expect(await getMediaMapping(key), key).toEqual(mapping);
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

  it('le script de relevé demande exactement les champs de la résolution (MEDIA_FIELDS de anilist/media.ts)', () => {
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
