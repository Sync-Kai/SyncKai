import { afterAll, describe, expect, it, vi } from 'vitest';
import {
  ACTIVITY_DAYS,
  activitySummary,
  addActivity,
  MAX_DAY_EPISODES,
  mergeActivityHistory,
  parseActivityHistory,
  readActivityHistory,
  withoutOtherAccount,
  type ActivityHistory,
} from './activity-history';

// Historique local de l'activité (écran Stats) : épisodes et minutes synchronisés par jour local, par service et par
// compte. Fuseau fixe : changement d'heure européen le 25 octobre 2026 (jour de 25 h)
vi.stubEnv('TZ', 'Europe/Paris');
afterAll(() => {
  vi.unstubAllEnvs();
});

const local = (y: number, m: number, d: number, h = 12, min = 0): number => new Date(y, m - 1, d, h, min).getTime();
const ANILIST_7 = { service: 'anilist', accountId: 7 } as const;
const MAL_9 = { service: 'mal', accountId: 9 } as const;

describe('addActivity', () => {
  it('un épisode et ses minutes au jour local, par service', () => {
    let history = addActivity(undefined, [ANILIST_7, MAL_9], 24, local(2026, 10, 15));
    history = addActivity(history, [ANILIST_7], 23, local(2026, 10, 15, 20));
    expect(history).toEqual({
      anilist: { accountId: 7, days: { '2026-10-15': [2, 47] } },
      mal: { accountId: 9, days: { '2026-10-15': [1, 24] } },
    });
    // Durée inconnue, négative ou non finie : l'épisode compte, 0 minute
    expect(addActivity(undefined, [ANILIST_7], Number.NaN, local(2026, 10, 15)).anilist?.days).toEqual({ '2026-10-15': [1, 0] });
    expect(addActivity(undefined, [ANILIST_7], -3, local(2026, 10, 15)).anilist?.days).toEqual({ '2026-10-15': [1, 0] });
  });

  it('23:59 puis 00:01 : deux jours', () => {
    let history = addActivity(undefined, [ANILIST_7], 24, local(2026, 10, 15, 23, 59));
    history = addActivity(history, [ANILIST_7], 24, local(2026, 10, 16, 0, 1));
    expect(history.anilist?.days).toEqual({ '2026-10-15': [1, 24], '2026-10-16': [1, 24] });
  });

  it('autre compte sur le service : part remplacée à l’écriture, résumé vide à la lecture', () => {
    const history = addActivity(undefined, [ANILIST_7, MAL_9], 24, local(2026, 10, 15));
    // Lecture pour le compte 8 (reconnexion à un autre compte avant la relecture du profil) : rien du compte 7
    const foreign = activitySummary(history, 'anilist', 8, '7d', local(2026, 10, 15));
    expect(foreign).toMatchObject({ episodes: 0, minutes: 0, firstDay: null });
    expect(foreign.bars.every((bar) => bar.episodes === 0 && bar.minutes === 0)).toBe(true);
    expect(activitySummary(history, 'anilist', null, '7d', local(2026, 10, 15))).toMatchObject({ episodes: 0, firstDay: null });
    // Écriture du compte 8 : la part du compte 7 est remplacée, celle de MAL reste
    const next = addActivity(history, [{ service: 'anilist', accountId: 8 }], 12, local(2026, 10, 16));
    expect(next).toEqual({ anilist: { accountId: 8, days: { '2026-10-16': [1, 12] } }, mal: history.mal });
  });

  it('400 jours au plus ; jours futurs gardés mais hors des résumés', () => {
    const now = local(2026, 10, 15);
    const stored: ActivityHistory = {
      anilist: {
        accountId: 7,
        days: {
          // 400 jours se terminant aujourd'hui : du 2025-09-11 au 2026-10-15
          '2025-09-10': [1, 10],
          '2025-09-11': [2, 20],
          // Horloge avancée puis corrigée : jour futur
          '2026-10-20': [5, 50],
        },
      },
      mal: { accountId: 9, days: { '2025-01-01': [1, 1] } },
    };
    const next = addActivity(stored, [ANILIST_7], 24, now);
    expect(ACTIVITY_DAYS).toBe(400);
    expect(next.anilist?.days).toEqual({ '2025-09-11': [2, 20], '2026-10-15': [1, 24], '2026-10-20': [5, 50] });
    // Les jours trop anciens de l'autre service partent aussi ; la part reste (même compte)
    expect(next.mal).toEqual({ accountId: 9, days: {} });
    const all = activitySummary(next, 'anilist', 7, 'all', now);
    expect(all).toMatchObject({ episodes: 3, minutes: 44, firstDay: '2025-09-11', unit: 'month' });
    expect(all.bars.at(-1)).toEqual({ key: '2026-10', episodes: 1, minutes: 24 });
  });

  it('plafond MAX_DAY_EPISODES', () => {
    const full: ActivityHistory = { anilist: { accountId: 7, days: { '2026-10-15': [MAX_DAY_EPISODES, 100] } } };
    expect(addActivity(full, [ANILIST_7], 24, local(2026, 10, 15)).anilist?.days['2026-10-15']).toEqual([MAX_DAY_EPISODES, 100]);
    expect(readActivityHistory({ anilist: { accountId: 7, days: { '2026-10-15': [MAX_DAY_EPISODES + 1, 0] } } }).anilist?.days).toEqual({});
  });
});

describe('activitySummary', () => {
  it('7d sur une semaine de changement d’heure : 7 barres consécutives, jours vides à zéro', () => {
    // 28 octobre à 23:30 : en retranchant 24 h par jour, le 24 manquerait et le 25 serait compté deux fois
    const now = local(2026, 10, 28, 23, 30);
    const history: ActivityHistory = { anilist: { accountId: 7, days: { '2026-10-21': [9, 90], '2026-10-24': [1, 24], '2026-10-25': [2, 48], '2026-10-28': [1, 24] } } };
    const week = activitySummary(history, 'anilist', 7, '7d', now);
    expect(week.unit).toBe('day');
    expect(week.bars.map((bar) => bar.key)).toEqual(['2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28']);
    expect(week.bars.map((bar) => bar.episodes)).toEqual([0, 0, 1, 2, 0, 0, 1]);
    expect(week).toMatchObject({ episodes: 4, minutes: 96, firstDay: '2026-10-21' });
    const month = activitySummary(history, 'anilist', 7, '30d', now);
    expect(month.bars).toHaveLength(30);
    expect(month.bars[0]?.key).toBe('2026-09-29');
    expect(month).toMatchObject({ episodes: 13, minutes: 186 });
  });

  it('12m : 12 barres mensuelles ; all : par mois depuis le premier jour, firstDay renseigné', () => {
    const now = local(2026, 10, 15);
    const history: ActivityHistory = { mal: { accountId: 9, days: { '2025-10-31': [3, 60], '2025-11-01': [1, 20], '2026-03-29': [2, 46], '2026-10-01': [1, 24] } } };
    const year = activitySummary(history, 'mal', 9, '12m', now);
    expect(year.unit).toBe('month');
    expect(year.bars.map((bar) => bar.key)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
    expect(year.bars.map((bar) => bar.episodes)).toEqual([1, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 1]);
    expect(year).toMatchObject({ episodes: 4, minutes: 90, firstDay: '2025-10-31' });
    const all = activitySummary(history, 'mal', 9, 'all', now);
    expect(all.bars).toHaveLength(13);
    expect(all.bars[0]).toEqual({ key: '2025-10', episodes: 3, minutes: 60 });
    expect(all).toMatchObject({ episodes: 7, minutes: 150, firstDay: '2025-10-31', unit: 'month' });
    // Rien d'enregistré : aucune barre pour « tout », premier jour inconnu
    expect(activitySummary({}, 'mal', 9, 'all', now)).toEqual({ episodes: 0, minutes: 0, firstDay: null, unit: 'month', bars: [] });
    expect(activitySummary({}, 'mal', 9, '12m', now).bars).toHaveLength(12);
  });
});

describe('withoutOtherAccount', () => {
  it('part d’un autre compte retirée ; même compte ou part absente : null', () => {
    const history = addActivity(undefined, [ANILIST_7, MAL_9], 24, local(2026, 10, 15));
    expect(withoutOtherAccount(history, 'anilist', 8)).toEqual({ mal: history.mal });
    expect(withoutOtherAccount(history, 'anilist', 7)).toBeNull();
    expect(withoutOtherAccount({ mal: history.mal }, 'anilist', 8)).toBeNull();
  });
});

describe('mergeActivityHistory', () => {
  it('mergeActivityHistory : maximum par jour pour le même compte, l’existant gagne contre un autre compte', () => {
    const current: ActivityHistory = {
      anilist: { accountId: 7, days: { '2026-10-14': [2, 10], '2026-10-15': [1, 50] } },
      mal: { accountId: 9, days: { '2026-10-15': [1, 24] } },
    };
    const incoming: ActivityHistory = {
      anilist: { accountId: 7, days: { '2026-10-15': [3, 20], '2026-10-16': [1, 24] } },
      mal: { accountId: 4, days: { '2026-10-15': [8, 200] } },
    };
    expect(mergeActivityHistory(current, incoming, 'merge')).toEqual({
      anilist: { accountId: 7, days: { '2026-10-14': [2, 10], '2026-10-15': [3, 50], '2026-10-16': [1, 24] } },
      mal: current.mal,
    });
    // Part absente de l'existant : l'entrante ; remplacement : l'entrant seul
    expect(mergeActivityHistory({}, incoming, 'merge')).toEqual(incoming);
    expect(mergeActivityHistory(current, {}, 'merge')).toEqual(current);
    expect(mergeActivityHistory(current, { mal: incoming.mal }, 'replace')).toEqual({ mal: incoming.mal });
  });
});

describe('parseActivityHistory', () => {
  it('parseActivityHistory compte les parts et jours illisibles', () => {
    expect(parseActivityHistory(undefined)).toEqual({ value: {}, invalid: 0 });
    expect(parseActivityHistory([1])).toEqual({ value: {}, invalid: 1 });
    const raw = {
      anilist: { accountId: 7, days: { '2026-10-15': [1, 24], '2026-02-30': [1, 1], __proto__x: [1, 1], '2026-10-16': [1], '2026-10-17': [-1, 0], '2026-10-18': [1, 2.5] } },
      mal: { accountId: '9', days: {} },
      kitsu: { accountId: 1, days: {} },
    };
    expect(parseActivityHistory(raw)).toEqual({ value: { anilist: { accountId: 7, days: { '2026-10-15': [1, 24] } } }, invalid: 7 });
    expect(readActivityHistory(raw)).toEqual({ anilist: { accountId: 7, days: { '2026-10-15': [1, 24] } } });
    expect(parseActivityHistory({ anilist: { accountId: 0, days: {} }, mal: { accountId: 3, days: [] } })).toEqual({ value: {}, invalid: 2 });
  });
});
