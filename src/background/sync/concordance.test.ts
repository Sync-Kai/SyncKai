import { describe, expect, it } from 'vitest';
import { checkGroup, concordanceVerdict, contradictingSignal, formatCheck, type ConcordanceEntry, type SignalGroup } from './concordance';

// Concordance signaux de la plateforme ↔ groupes de saison AniList (règles pures, sans résolution).

function entry(id: number, year: number | null, overrides: Partial<ConcordanceEntry> = {}): ConcordanceEntry {
  return { id, format: 'TV', episodes: 12, startDate: year === null ? null : year * 10_000 + 401, titles: [`Entry ${id}`], endYear: year, status: 'FINISHED', duration: 24, country: 'JP', ...overrides };
}

const group = (entries: ConcordanceEntry[], chain = 0, first = true): SignalGroup => ({ entries, chain, first });
const NOT_ABSOLUTE = { absolute: false };

describe('checkGroup', () => {
  it('année de la saison : égale, à un an, pendant la diffusion d’une fiche longue ou en cours, sinon contradiction', () => {
    expect(checkGroup(group([entry(1, 2016)]), { seasonYear: 2016 }, NOT_ABSOLUTE).seasonYear).toBe('agree');
    expect(checkGroup(group([entry(1, 2016)]), { seasonYear: 2017 }, NOT_ABSOLUTE).seasonYear).toBe('weak-agree');
    expect(checkGroup(group([entry(1, 1997)]), { seasonYear: 2016 }, NOT_ABSOLUTE).seasonYear).toBe('contradict');
    // One Piece (1999, en cours) : arc de 2026 au milieu de la fiche
    expect(checkGroup(group([entry(21, 1999, { episodes: null, status: 'RELEASING', endYear: null })]), { seasonYear: 2026 }, NOT_ABSOLUTE).seasonYear).toBe('unknown');
    // Naruto Shippuden (2007–2017) : saison Netflix de 2010
    expect(checkGroup(group([entry(1735, 2007, { endYear: 2017 })]), { seasonYear: 2010 }, NOT_ABSOLUTE).seasonYear).toBe('unknown');
    expect(checkGroup(group([entry(1, null)]), { seasonYear: 2016 }, NOT_ABSOLUTE).seasonYear).toBe('unknown');
  });

  it('année de la série : premier groupe de la franchise comparé, suite contredite seulement si la série commence après', () => {
    expect(checkGroup(group([entry(1, 2022)]), { seriesYear: 2022 }, NOT_ABSOLUTE).seriesYear).toBe('agree');
    expect(checkGroup(group([entry(2, 2023)], 0, false), { seriesYear: 2022 }, NOT_ABSOLUTE).seriesYear).toBe('unknown');
    expect(checkGroup(group([entry(2, 2023)], 0, false), { seriesYear: 2025 }, NOT_ABSOLUTE).seriesYear).toBe('contradict');
    // Premier groupe de sa franchise contredit (autre franchise au même titre) : ses suites aussi
    expect(checkGroup(group([entry(2, 2023)], 0, false), { seriesYear: 2022 }, NOT_ABSOLUTE, 'contradict').seriesYear).toBe('contradict');
  });

  it('nombre d’épisodes : total du groupe à ±2, groupe terminé plus court contredit, jamais en numérotation absolue ni en cours de diffusion', () => {
    const mushoku2 = group([entry(146065, 2023, { episodes: 13 }), entry(166873, 2024, { episodes: 12 })]);
    expect(checkGroup(mushoku2, { seasonEpisodeCount: 25 }, NOT_ABSOLUTE).episodeCount).toBe('agree');
    expect(checkGroup(group([entry(1, 2023, { episodes: 13 })]), { seasonEpisodeCount: 25 }, NOT_ABSOLUTE).episodeCount).toBe('contradict');
    expect(checkGroup(group([entry(1, 2023, { episodes: 13 })]), { seasonEpisodeCount: 25 }, { absolute: true }).episodeCount).toBe('unknown');
    expect(checkGroup(group([entry(1, 2026, { episodes: 10 })]), { seasonEpisodeCount: 13, airing: true }, NOT_ABSOLUTE).episodeCount).toBe('unknown');
    // Plateforme plus courte (saison en cours, publication partielle) : rien à conclure
    expect(checkGroup(group([entry(1, 2026, { episodes: 12 })]), { seasonEpisodeCount: 4 }, NOT_ABSOLUTE).episodeCount).toBe('unknown');
    expect(checkGroup(group([entry(1, 2026, { episodes: null, status: 'RELEASING' })]), { seasonEpisodeCount: 30 }, NOT_ABSOLUTE).episodeCount).toBe('unknown');
  });

  it('durée : ±30 %, format court contre normal contredit', () => {
    expect(checkGroup(group([entry(1, 2024, { duration: 23 })]), { episodeMinutes: 23.7 }, NOT_ABSOLUTE).episodeMinutes).toBe('agree');
    expect(checkGroup(group([entry(1, 2024, { duration: 3 })]), { episodeMinutes: 24 }, NOT_ABSOLUTE).episodeMinutes).toBe('contradict');
    expect(checkGroup(group([entry(1, 2024, { duration: 24 })]), { episodeMinutes: 12 }, NOT_ABSOLUTE).episodeMinutes).toBe('unknown');
    expect(checkGroup(group([entry(1, 2024, { duration: null })]), { episodeMinutes: 24 }, NOT_ABSOLUTE).episodeMinutes).toBe('unknown');
  });

  it('pays : indice faible seulement ; titre original : preuve', () => {
    expect(checkGroup(group([entry(1, 2024, { country: 'CN' })]), { country: 'JP' }, NOT_ABSOLUTE).country).toBe('weak-contradict');
    expect(checkGroup(group([entry(1, 2024)]), { country: 'JP' }, NOT_ABSOLUTE).country).toBe('weak-agree');
    expect(checkGroup(group([entry(1, 2024, { titles: ['Tougen Anki', '桃源暗鬼'] })]), { originalTitle: '桃源暗鬼' }, NOT_ABSOLUTE).originalTitle).toBe('agree');
    expect(checkGroup(group([entry(1, 2024)]), { originalTitle: '桃源暗鬼' }, NOT_ABSOLUTE).originalTitle).toBe('unknown');
  });
});

describe('formatCheck', () => {
  it('film contre série de plusieurs épisodes ; ONA d’un épisode publiée comme film acceptée ; spécial jamais contredit', () => {
    expect(formatCheck('movie', [entry(1, 2014, { episodes: 13 })])).toBe('contradict');
    expect(formatCheck('movie', [entry(1, 2024, { format: 'ONA', episodes: 1 })])).toBe('unknown');
    expect(formatCheck('movie', [entry(1, 2010, { format: 'MOVIE', episodes: 1 })])).toBe('weak-agree');
    expect(formatCheck('series', [entry(1, 2010, { format: 'MOVIE', episodes: 1 })])).toBe('contradict');
    expect(formatCheck('series', [entry(1, 2010, { format: 'OVA', episodes: 2 })])).toBe('unknown');
    expect(formatCheck('special', [entry(1, 2014, { episodes: 13 })])).toBe('unknown');
  });
});

describe('concordanceVerdict', () => {
  it('Mushoku Tensei S2 Netflix (2023, 25 épisodes) : seul le groupe II + II Part 2 est gardé, prouvé', () => {
    const groups = [
      group([entry(108465, 2021, { episodes: 11 }), entry(127720, 2021, { episodes: 12 })]),
      group([entry(146065, 2023, { episodes: 13 }), entry(166873, 2024, { episodes: 12 })], 0, false),
      group([entry(178789, 2026, { episodes: 14 }), entry(217434, 2027, { episodes: null, status: 'NOT_YET_RELEASED' })], 0, false),
    ];
    const verdict = concordanceVerdict(groups, { seasonYear: 2023, seasonEpisodeCount: 25 }, { absolute: true });
    expect(verdict.kept.map((g) => g.entries[0]?.id)).toEqual([146065]);
    expect(verdict.proven).toBe(true);
    expect(verdict.kept[0]?.checks).toEqual({ seasonYear: 'agree', episodeCount: 'agree' });
  });

  it('année à un an près contredite quand un autre groupe tombe juste (Berserk 2016 contre « Berserk 2 », 2017)', () => {
    const groups = [group([entry(33, 1997)], 0), group([entry(21560, 2016)], 1), group([entry(97643, 2017)], 1, false)];
    const verdict = concordanceVerdict(groups, { seasonYear: 2016 }, { absolute: false });
    expect(verdict.kept.map((g) => g.entries[0]?.id)).toEqual([21560]);
    expect(verdict.groups.find((g) => g.entries[0]?.id === 97643)?.checks.seasonYear).toBe('contradict');
    expect(verdict.proven).toBe(true);
  });

  it('année à un an près sans groupe exact : gardée, jamais une preuve', () => {
    const verdict = concordanceVerdict([group([entry(1, 2016)])], { seasonYear: 2017 }, { absolute: false });
    expect(verdict.kept).toHaveLength(1);
    expect(verdict.proven).toBe(false);
  });

  it('plusieurs groupes sans contradiction, ou indice contraire (pays) : pas de preuve ; tout contredit : allContradict', () => {
    expect(concordanceVerdict([group([entry(1, 2023)]), group([entry(2, null)], 0, false)], { seriesYear: 2023 }, { absolute: false }).proven).toBe(false);
    expect(concordanceVerdict([group([entry(1, 2023, { country: 'KR' })])], { seasonYear: 2023, country: 'JP' }, { absolute: false }).proven).toBe(false);
    const all = concordanceVerdict([group([entry(1, 1997)]), group([entry(2, 2005)], 1)], { seasonYear: 2016 }, { absolute: false });
    expect(all.allContradict).toBe(true);
    expect(all.best).toBeNull();
  });
});

describe('contradictingSignal (correspondance en cache)', () => {
  it('écarte une fiche d’une autre année, d’un autre format ou d’une autre durée ; jamais une partie suivante', () => {
    expect(contradictingSignal(entry(178789, 2026, { episodes: 14 }), { seasonYear: 2023, seasonEpisodeCount: 25 })).toBe('seasonYear');
    // « II Part 2 » (2024) d'une saison Netflix de 2023 : le nombre d'épisodes n'est pas comparé
    expect(contradictingSignal(entry(166873, 2024, { episodes: 12 }), { seasonYear: 2023, seasonEpisodeCount: 25 })).toBeNull();
    expect(contradictingSignal(entry(19603, 2014, { episodes: 13 }), { format: 'movie' })).toBe('format');
    expect(contradictingSignal(entry(1, 2014, { duration: 3 }), { episodeMinutes: 24 })).toBe('episodeMinutes');
    expect(contradictingSignal(entry(1, 2014), { seriesYear: 2020 })).toBe('seriesYear');
    expect(contradictingSignal(entry(1, 2014), { seriesYear: 2010 })).toBeNull();
  });
});
