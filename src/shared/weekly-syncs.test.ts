import { describe, expect, it } from 'vitest';
import { addWeeklySyncs, currentWeekStart, MAX_WEEKLY_SYNCS, openWeeklySyncs, weeklySyncCount } from './weekly-syncs';

// Compteur « Synchro cette semaine » du menu du compte : épisodes synchronisés par service, semaine civile du lundi au
// dimanche en heure locale (comme l'Agenda), lié à la session du service

/** Heure locale (mois 0-indexés) */
const at = (y: number, m: number, d: number, h = 12): number => new Date(y, m, d, h).getTime();
// Jeudi 15 octobre 2026 ; lundi de sa semaine : 12 octobre
const THU = at(2026, 9, 15);

describe('semaine en cours', () => {
  it('du lundi 00:00 au dimanche 23:59 locaux', () => {
    expect(currentWeekStart(THU)).toBe('2026-10-12');
    expect(currentWeekStart(at(2026, 9, 12, 0))).toBe('2026-10-12');
    expect(currentWeekStart(at(2026, 9, 18, 23))).toBe('2026-10-12');
    // Dimanche soir puis lundi matin : nouvelle semaine
    expect(currentWeekStart(at(2026, 9, 19, 0))).toBe('2026-10-19');
  });
});

describe('addWeeklySyncs / weeklySyncCount', () => {
  it('compte un épisode par service écrit, pour la session qui l’a écrit', () => {
    let stored = addWeeklySyncs(undefined, ['anilist', 'mal'], { anilist: 0, mal: 2 }, THU);
    stored = addWeeklySyncs(stored, ['anilist'], { anilist: 0, mal: 2 }, THU + 60_000);
    expect(stored).toEqual({ anilist: { weekStart: '2026-10-12', count: 2, epoch: 0 }, mal: { weekStart: '2026-10-12', count: 1, epoch: 2 } });
    expect(weeklySyncCount(stored, 'anilist', 0, THU)).toBe(2);
    expect(weeklySyncCount(stored, 'mal', 2, THU)).toBe(1);
  });

  it('nouvelle semaine : remis à zéro (lecture comme écriture)', () => {
    const stored = addWeeklySyncs(undefined, ['anilist'], { anilist: 0 }, THU);
    const nextMonday = at(2026, 9, 19, 8);
    expect(weeklySyncCount(stored, 'anilist', 0, nextMonday)).toBe(0);
    expect(addWeeklySyncs(stored, ['anilist'], { anilist: 0 }, nextMonday).anilist).toEqual({ weekStart: '2026-10-19', count: 1, epoch: 0 });
  });

  it('autre session (déconnexion puis reconnexion, autre compte) : rien n’est repris', () => {
    const stored = addWeeklySyncs(undefined, ['anilist'], { anilist: 0 }, THU);
    expect(weeklySyncCount(stored, 'anilist', 1, THU)).toBe(0);
    expect(weeklySyncCount(stored, 'anilist', undefined, THU)).toBe(0);
    expect(addWeeklySyncs(stored, ['anilist'], { anilist: 1 }, THU).anilist).toEqual({ weekStart: '2026-10-12', count: 1, epoch: 1 });
  });

  it('service sans session relevée : non compté ; valeur illisible : repartie de zéro ; plafonnée', () => {
    expect(addWeeklySyncs(undefined, ['mal'], { anilist: 0 }, THU)).toEqual({});
    expect(addWeeklySyncs('x', ['anilist'], { anilist: 0 }, THU).anilist?.count).toBe(1);
    expect(addWeeklySyncs({ anilist: { weekStart: '2026-10-12', count: -3, epoch: 0 } }, ['anilist'], { anilist: 0 }, THU).anilist?.count).toBe(1);
    const full = { anilist: { weekStart: '2026-10-12', count: MAX_WEEKLY_SYNCS, epoch: 0 } };
    expect(addWeeklySyncs(full, ['anilist'], { anilist: 0 }, THU).anilist?.count).toBe(MAX_WEEKLY_SYNCS);
    expect(weeklySyncCount({ anilist: { weekStart: 'lundi', count: 4, epoch: 0 } }, 'anilist', 0, THU)).toBe(0);
  });

  it('purge à la déconnexion : seules les parts des sessions encore ouvertes restent', () => {
    const stored = addWeeklySyncs(undefined, ['anilist', 'mal'], { anilist: 0, mal: 2 }, THU);
    expect(openWeeklySyncs(stored, { anilist: 0, mal: 3 })).toEqual({ anilist: { weekStart: '2026-10-12', count: 1, epoch: 0 } });
    expect(openWeeklySyncs(stored, {})).toEqual({});
  });
});
