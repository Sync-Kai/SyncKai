import { describe, expect, it } from 'vitest';
import { decideAgendaLoad, REFETCH_GUARD_MS, type AgendaLoadInput } from './agenda-load';

const NOW = 1_800_000_000_000;

const input = (patch: Partial<AgendaLoadInput>): AgendaLoadInput => ({
  hasCache: true,
  fresh: false,
  force: false,
  lastFetchAt: null,
  now: NOW,
  lastError: null,
  showingResult: false,
  ...patch,
});

describe('decideAgendaLoad', () => {
  it('cache valable : affiché sans requête ni erreur', () => {
    expect(decideAgendaLoad(input({ fresh: true, lastFetchAt: NOW - 1_000, lastError: 'AniList 429' }))).toEqual({ kind: 'show', error: null });
  });

  it('cache expiré sans requête récente : requête', () => {
    expect(decideAgendaLoad(input({}))).toEqual({ kind: 'fetch' });
    expect(decideAgendaLoad(input({ lastFetchAt: NOW - REFETCH_GUARD_MS }))).toEqual({ kind: 'fetch' });
  });

  it('UI-03 : requête récente en échec, nouveau chargement automatique → « données périmées » conservé', () => {
    expect(decideAgendaLoad(input({ lastFetchAt: NOW - 5_000, lastError: 'AniList 429' }))).toEqual({ kind: 'show', error: 'AniList 429' });
  });

  it('requête récente réussie : cache affiché sans erreur ni nouvelle requête', () => {
    expect(decideAgendaLoad(input({ lastFetchAt: NOW - 5_000 }))).toEqual({ kind: 'show', error: null });
  });

  it('sans cache, résultat récent affiché (erreur ou programme) : conservé, pas de seconde requête', () => {
    expect(decideAgendaLoad(input({ hasCache: false, lastFetchAt: NOW - 5_000, lastError: 'réseau', showingResult: true }))).toEqual({ kind: 'keep' });
    expect(decideAgendaLoad(input({ hasCache: false, lastFetchAt: NOW - 5_000, showingResult: true }))).toEqual({ kind: 'keep' });
  });

  it('« Réessayer » (force) : toujours une requête, même récente', () => {
    expect(decideAgendaLoad(input({ force: true, lastFetchAt: NOW - 1_000, lastError: 'AniList 429' }))).toEqual({ kind: 'fetch' });
    expect(decideAgendaLoad(input({ hasCache: false, force: true, lastFetchAt: NOW - 1_000, showingResult: true }))).toEqual({ kind: 'fetch' });
  });
});
