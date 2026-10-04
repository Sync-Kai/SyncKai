import { describe, expect, it } from 'vitest';
import { fromMalStatus, malProgressBody, malStatusBody, parseMalListStatus, toMalStatus } from './mal';

describe('statuts MyAnimeList', () => {
  it('convertit les statuts MAL vers les statuts communs', () => {
    expect(fromMalStatus('watching', false)).toBe('CURRENT');
    expect(fromMalStatus('completed', false)).toBe('COMPLETED');
    expect(fromMalStatus('on_hold', false)).toBe('PAUSED');
    expect(fromMalStatus('dropped', false)).toBe('DROPPED');
    expect(fromMalStatus('plan_to_watch', undefined)).toBe('PLANNING');
    expect(fromMalStatus('inconnu', false)).toBeNull();
  });

  it('traite un revisionnage MAL comme REPEATING', () => {
    expect(fromMalStatus('completed', true)).toBe('REPEATING');
  });

  it('convertit les statuts écrits par SyncKai', () => {
    expect(toMalStatus('CURRENT')).toBe('watching');
    expect(toMalStatus('COMPLETED')).toBe('completed');
    expect(toMalStatus('REPEATING')).toBe('completed');
  });

  it('lit my_list_status (absent = anime hors liste)', () => {
    expect(parseMalListStatus({ status: 'watching', num_episodes_watched: 4, is_rewatching: false })).toEqual({ status: 'CURRENT', progress: 4 });
    expect(parseMalListStatus(undefined)).toBeNull();
    expect(parseMalListStatus({ status: 'plan_to_watch' })).toEqual({ status: 'PLANNING', progress: 0 });
  });

  it('lit le compteur de revisionnages', () => {
    expect(parseMalListStatus({ status: 'completed', num_episodes_watched: 3, is_rewatching: true, num_times_rewatched: 1 })).toEqual({
      status: 'REPEATING',
      progress: 3,
      repeat: 1,
    });
  });

  it('construit le corps du PATCH de progression', () => {
    expect(Object.fromEntries(malProgressBody(4, 'CURRENT'))).toEqual({ status: 'watching', num_watched_episodes: '4' });
    expect(Object.fromEntries(malProgressBody(2, 'REPEATING'))).toEqual({ status: 'completed', num_watched_episodes: '2', is_rewatching: 'true' });
    expect(Object.fromEntries(malProgressBody(12, 'COMPLETED', 2))).toEqual({
      status: 'completed',
      num_watched_episodes: '12',
      is_rewatching: 'false',
      num_times_rewatched: '2',
    });
  });
});

describe('changement de statut MyAnimeList', () => {
  it('convertit les statuts du popup vers les statuts MAL', () => {
    expect(malStatusBody('PAUSED', 5).get('status')).toBe('on_hold');
    expect(malStatusBody('DROPPED', 5).get('status')).toBe('dropped');
    expect(malStatusBody('COMPLETED', 12).get('status')).toBe('completed');
  });

  it('construit le corps du PATCH (sortie de revisionnage, compteur si fourni)', () => {
    expect(Object.fromEntries(malStatusBody('PAUSED', 5))).toEqual({ status: 'on_hold', num_watched_episodes: '5', is_rewatching: 'false' });
    expect(Object.fromEntries(malStatusBody('COMPLETED', 12, 2))).toEqual({
      status: 'completed',
      num_watched_episodes: '12',
      is_rewatching: 'false',
      num_times_rewatched: '2',
    });
  });

  it('lit la note (0 = non notée)', () => {
    expect(parseMalListStatus({ status: 'watching', num_episodes_watched: 4, score: 8 })).toEqual({ status: 'CURRENT', progress: 4, score: 8 });
    expect(parseMalListStatus({ status: 'watching', num_episodes_watched: 4, score: 0 })).toEqual({ status: 'CURRENT', progress: 4 });
  });
});

describe('ajout à la liste MyAnimeList (fiche de la page)', () => {
  it('plan_to_watch / watching à 0 épisode', () => {
    expect(Object.fromEntries(malStatusBody('PLANNING', 0))).toEqual({ status: 'plan_to_watch', num_watched_episodes: '0', is_rewatching: 'false' });
    expect(Object.fromEntries(malStatusBody('CURRENT', 0))).toEqual({ status: 'watching', num_watched_episodes: '0', is_rewatching: 'false' });
  });
});
