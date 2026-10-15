import { describe, expect, it } from 'vitest';
import {
  AOT_S3,
  AOT_S3E1,
  AOT_S3E1_DUB,
  AOT_SERIES_ID,
  aotSeason3Episodes,
  aotSeasons,
  FRIEREN_S1,
  FRIEREN_S1_DUB,
  FRIEREN_S2,
  FRIEREN_SEASONS,
  FRIEREN_SERIES_ID,
  frierenEpisodeId,
  frierenEpisodes,
  frierenSeasons,
  frierenSeries,
  frierenUpNext,
} from '../../shared/__fixtures__/crunchyroll-cms';
import {
  crunchyrollSignals,
  crunchyrollSignalTable,
  crunchyrollTableSignals,
  mergeCrunchyrollSeries,
  originalCrunchyrollSeason,
  reduceCrunchyrollEpisodes,
  reduceCrunchyrollSeasons,
  reduceCrunchyrollSeries,
  reduceCrunchyrollUpNext,
  type CrunchyrollEpisodeStats,
  type CrunchyrollSeries,
} from './metadata';

// Métadonnées Crunchyroll (forme relevée le 2026-10-14) → signaux de correspondance, dont la règle des doublages.

function frieren(stats: Record<string, CrunchyrollEpisodeStats | null> = {}, launchYear: number | null = 2023): CrunchyrollSeries {
  const rows = reduceCrunchyrollSeasons(frierenSeasons()) ?? [];
  return mergeCrunchyrollSeries(FRIEREN_SERIES_ID, launchYear, rows, (id) => stats[id] ?? undefined);
}

const S1_STATS = reduceCrunchyrollEpisodes(frierenEpisodes(1, 28));
const S1_DUB_STATS = reduceCrunchyrollEpisodes(frierenEpisodes(1, 20, { firstAirDate: '2024-11-08', dub: true }));
const S2_STATS = reduceCrunchyrollEpisodes(frierenEpisodes(2, 10, { firstAirDate: '2026-01-16' }));

describe('réductions (monde MAIN)', () => {
  it('série : année de lancement seule', () => {
    expect(reduceCrunchyrollSeries(frierenSeries())).toEqual({ launchYear: 2023 });
    expect(reduceCrunchyrollSeries(frierenSeries({ series_launch_year: 0 }))).toEqual({ launchYear: null });
    expect(reduceCrunchyrollSeries({ data: [] })).toBeNull();
    expect(reduceCrunchyrollSeries('<html>')).toBeNull();
  });

  it('saisons : numéros, nombre d’épisodes, langue audio, doublage ; rien d’autre', () => {
    const rows = reduceCrunchyrollSeasons(frierenSeasons());
    expect(rows).toEqual([
      { id: FRIEREN_S1, seasonNumber: 1, sequenceNumber: 1, episodeCount: 28, audioLocale: 'ja-JP', dubbed: false },
      { id: FRIEREN_S1_DUB, seasonNumber: 1, sequenceNumber: 1, episodeCount: 20, audioLocale: 'en-US', dubbed: true },
      { id: FRIEREN_S2, seasonNumber: 2, sequenceNumber: 2, episodeCount: 10, audioLocale: 'ja-JP', dubbed: false },
    ]);
    expect(reduceCrunchyrollSeasons({ data: [{ id: 'bad id', season_number: 1 }, { id: 'GOK1', season_number: -1, audio_locale: '<x>', is_dubbed: 'no' }] })).toEqual([
      { id: 'GOK1', seasonNumber: null, sequenceNumber: null, episodeCount: null, audioLocale: null, dubbed: null },
    ]);
    expect(reduceCrunchyrollSeasons({})).toBeNull();
  });

  it('épisodes : première année de diffusion, durée médiane, identifiants (et autres versions audio)', () => {
    expect(S1_STATS).toMatchObject({ firstAirYear: 2023, episodeMinutes: 26, movie: false });
    expect(S1_STATS?.episodeIds).toContain(frierenEpisodeId(1, 5));
    expect(S1_STATS?.episodeIds).toContain(frierenEpisodeId(1, 5, true));
    expect(reduceCrunchyrollEpisodes(frierenEpisodes(1, 1, { mediaType: 'movie' }))?.movie).toBe(true);
    expect(reduceCrunchyrollEpisodes({ data: [] })).toBeNull();
  });

  it('épisode suggéré : saison, identifiant et durée, jamais son année (une date isolée ne date pas la saison) ni la progression', () => {
    const next = reduceCrunchyrollUpNext(frierenUpNext());
    expect(next).toEqual({ seasonId: FRIEREN_S2, stats: { firstAirYear: null, episodeMinutes: 25, movie: false, episodeIds: [frierenEpisodeId(2, 3)] } });
    expect(JSON.stringify(next)).not.toMatch(/playhead|431|watched/);
    expect(reduceCrunchyrollUpNext({ data: [{ panel: { episode_metadata: {} } }] })).toBeNull();
  });
});

describe('originalCrunchyrollSeason : doublages publiés comme saisons à part', () => {
  const series = frieren({ [FRIEREN_S1]: S1_STATS, [FRIEREN_S1_DUB]: S1_DUB_STATS, [FRIEREN_S2]: S2_STATS });

  it('épisode original ou doublé : toujours la saison originale', () => {
    expect(originalCrunchyrollSeason(series, { episodeId: frierenEpisodeId(1, 5), seasonNumber: 1 })?.id).toBe(FRIEREN_S1);
    expect(originalCrunchyrollSeason(series, { episodeId: frierenEpisodeId(1, 5, true), seasonNumber: 1 })?.id).toBe(FRIEREN_S1);
    expect(originalCrunchyrollSeason(series, { episodeId: frierenEpisodeId(2, 3), seasonNumber: 2 })?.id).toBe(FRIEREN_S2);
  });

  it('numéro de saison seul : l’unique saison originale de ce numéro ; sans numéro, aucune (deux saisons originales)', () => {
    expect(originalCrunchyrollSeason(series, { seasonNumber: 1 })?.id).toBe(FRIEREN_S1);
    expect(originalCrunchyrollSeason(series, { seasonNumber: 3 })).toBeNull();
    expect(originalCrunchyrollSeason(series, { seasonNumber: null })).toBeNull();
  });

  it('dans le doute (deux versions au doublage inconnu, aucune originale) : aucune saison', () => {
    const unknown: CrunchyrollSeries = { ...series, seasons: series.seasons.map((s) => ({ ...s, dubbed: null })) };
    expect(originalCrunchyrollSeason(unknown, { seasonNumber: 1 })).toBeNull();
    expect(originalCrunchyrollSeason(unknown, { seasonNumber: 2 })?.id).toBe(FRIEREN_S2);
    const dubOnly: CrunchyrollSeries = { ...series, seasons: series.seasons.filter((s) => s.id === FRIEREN_S1_DUB) };
    expect(originalCrunchyrollSeason(dubOnly, { episodeId: frierenEpisodeId(1, 5, true), seasonNumber: 1 })).toBeNull();
  });
});

describe('crunchyrollSignals', () => {
  it('saison originale vue : année de première diffusion, épisodes, durée, format série, pays JP', () => {
    const series = frieren({ [FRIEREN_S1]: S1_STATS, [FRIEREN_S1_DUB]: S1_DUB_STATS, [FRIEREN_S2]: S2_STATS });
    expect(crunchyrollSignals(series, { episodeId: frierenEpisodeId(2, 3), seasonNumber: 2 })).toEqual({
      seasonYear: 2026,
      seasonEpisodeCount: 10,
      episodeMinutes: 26,
      format: 'series',
      country: 'JP',
    });
  });

  it('épisode du doublage : signaux de l’originale (28 épisodes, 2023), jamais les 20 épisodes ni l’année du doublage', () => {
    const series = frieren({ [FRIEREN_S1]: S1_STATS, [FRIEREN_S1_DUB]: S1_DUB_STATS });
    expect(crunchyrollSignals(series, { episodeId: frierenEpisodeId(1, 5, true), seasonNumber: 1 })).toMatchObject({ seasonYear: 2023, seasonEpisodeCount: 28 });
  });

  it('épisodes de la saison non vus : année de lancement de la série à la place de celle de la saison', () => {
    expect(crunchyrollSignals(frieren(), { seasonNumber: 2 })).toEqual({ seriesYear: 2023, seasonEpisodeCount: 10, format: 'series', country: 'JP' });
  });

  it('saison inconnue ou ambiguë : série seule ; rien de vu : aucun signal', () => {
    expect(crunchyrollSignals(frieren(), { seasonNumber: null })).toEqual({ seriesYear: 2023 });
    expect(crunchyrollSignals(frieren({}, null), { seasonNumber: 7 })).toBeUndefined();
    expect(crunchyrollSignals({ seriesId: FRIEREN_SERIES_ID, launchYear: null, seasons: [] }, { seasonNumber: 1 })).toBeUndefined();
  });

  it('film publié comme saison d’une série (un épisode) : jamais « série » ; épisode de type film : « movie »', () => {
    const rows = reduceCrunchyrollSeasons(frierenSeasons([{ id: 'GLASTATK', number: 1, episodes: 1, audio: 'ja-JP', dubbed: false }])) ?? [];
    expect(crunchyrollSignals(mergeCrunchyrollSeries('GR751KNZY', 2013, rows, () => undefined), { seasonNumber: 1 })).not.toHaveProperty('format');
    const movie = reduceCrunchyrollEpisodes(frierenEpisodes(1, 1, { mediaType: 'movie' })) ?? undefined;
    expect(crunchyrollSignals(mergeCrunchyrollSeries('GR751KNZY', 2013, rows, () => movie), { seasonNumber: 1 })?.format).toBe('movie');
  });

  it('version originale dans une autre langue que le japonais : pas de pays', () => {
    const rows = reduceCrunchyrollSeasons(frierenSeasons([{ id: 'GDONGHUA1', number: 1, episodes: 12, audio: 'zh-CN', dubbed: false }])) ?? [];
    expect(crunchyrollSignals(mergeCrunchyrollSeries('GDONGHUA', 2020, rows, () => undefined), { seasonNumber: 1 })).not.toHaveProperty('country');
  });
});

describe('forme réelle (Attack on Titan, 2026-10-14) : une ligne par saison originale, doublages dans `versions`', () => {
  // Régression : `is_dubbed` vaut true sur la saison ORIGINALE (des doublages existent) ; lu comme « saison doublée »,
  // aucune saison originale n'était trouvée et aucune page Crunchyroll n'envoyait les signaux de sa saison
  const rows = reduceCrunchyrollSeasons(aotSeasons()) ?? [];
  const s3Stats = reduceCrunchyrollEpisodes(aotSeason3Episodes()) ?? undefined;
  const series = mergeCrunchyrollSeries(AOT_SERIES_ID, 2013, rows, (id) => (id === AOT_S3 ? s3Stats : undefined));

  it('saison listée = version originale (`versions[]` : sa propre entrée est `original`)', () => {
    expect(rows.map((r) => r.dubbed)).toEqual([false, false, false, false, false, false]);
  });

  it('page de série, saison 3 lue sur la page : signaux de la saison originale (2018, 22 épisodes, JP)', () => {
    expect(crunchyrollSignals(series, { seasonNumber: 3 })).toEqual({ seasonYear: 2018, seasonEpisodeCount: 22, episodeMinutes: 23.9, format: 'series', country: 'JP' });
  });

  it('épisode en version originale ou doublée : signaux de la saison originale', () => {
    expect(crunchyrollSignals(series, { episodeId: AOT_S3E1, seasonNumber: 3 })).toMatchObject({ seasonYear: 2018, seasonEpisodeCount: 22, country: 'JP' });
    expect(crunchyrollSignals(series, { episodeId: AOT_S3E1_DUB, seasonNumber: 3 })).toMatchObject({ seasonYear: 2018, seasonEpisodeCount: 22, country: 'JP' });
  });

  it('saison inconnue (six saisons originales) : série seule', () => {
    expect(crunchyrollSignals(series, { seasonNumber: null })).toEqual({ seriesYear: 2013 });
  });
});

describe('table des signaux (monde MAIN → script isolé)', () => {
  const series = frieren({ [FRIEREN_S1]: S1_STATS, [FRIEREN_S1_DUB]: S1_DUB_STATS, [FRIEREN_S2]: S2_STATS });
  const table = JSON.parse(JSON.stringify(crunchyrollSignalTable(series))) as unknown;

  it('lecture de la table = signaux calculés dans le monde MAIN (épisode, numéro, saison inconnue)', () => {
    const picks = [
      { episodeId: frierenEpisodeId(1, 5), seasonNumber: 1 },
      { episodeId: frierenEpisodeId(1, 5, true), seasonNumber: 1 },
      { episodeId: frierenEpisodeId(2, 3), seasonNumber: 2 },
      { episodeId: 'GUNKNOWN', seasonNumber: 2 },
      { seasonNumber: 1 },
      { seasonNumber: 2 },
      { seasonNumber: 5 },
      { seasonNumber: null },
    ];
    for (const pick of picks) expect(crunchyrollTableSignals(table, pick)).toEqual(crunchyrollSignals(series, pick));
  });

  it('table forgée par la page : valeurs invalides ou propriétés héritées jamais renvoyées', () => {
    expect(crunchyrollTableSignals(null, { seasonNumber: 1 })).toBeUndefined();
    expect(crunchyrollTableSignals({ keys: { n1: 0 }, signals: [{ seasonYear: 99_999 }] }, { seasonNumber: 1 })).toBeUndefined();
    expect(crunchyrollTableSignals({ keys: { n1: 'constructor' }, signals: [{}] }, { seasonNumber: 1 })).toBeUndefined();
    expect(crunchyrollTableSignals({ keys: {}, signals: { 0: { seasonYear: 2020 } } }, { episodeId: 'toString', seasonNumber: null })).toEqual({ seasonYear: 2020 });
  });

  it('taille bornée : une entrée par identifiant d’épisode, signaux dédupliqués', () => {
    const built = crunchyrollSignalTable(series);
    expect(built.signals.length).toBeLessThanOrEqual(FRIEREN_SEASONS.length + 2);
    expect(Object.keys(built.keys).filter((key) => key.startsWith('e'))).toHaveLength(new Set(series.seasons.flatMap((s) => s.episodeIds)).size);
  });
});
