import { describe, expect, it } from 'vitest';
import { ApiError } from './api/errors';
import { MAL_WRITE_GAP_MS, RETRY_DELAYS_MS, transientKind } from './compare';

describe('erreurs passagères pendant un alignement', () => {
  it('429 persistant → limite de requêtes', () => {
    expect(transientKind(new ApiError('RATE_LIMITED', 'x'))).toBe('rate-limit');
  });

  it('502 / 503 / 504 et délai dépassé → service surchargé (nouvelle tentative 5 s puis 15 s)', () => {
    for (const status of [502, 503, 504]) expect(transientKind(new ApiError('API_ERROR', 'x', { httpStatus: status }))).toBe('server');
    expect(transientKind(new ApiError('NETWORK', 'x', { timedOut: true }))).toBe('server');
    expect(RETRY_DELAYS_MS.server).toEqual([5_000, 15_000]);
  });

  it('connexion perdue → réseau ; erreurs définitives → aucune nouvelle tentative', () => {
    expect(transientKind(new ApiError('NETWORK', 'x'))).toBe('network');
    expect(transientKind(new ApiError('API_ERROR', 'x', { httpStatus: 400 }))).toBeNull();
    expect(transientKind(new ApiError('TOKEN_INVALID', 'x'))).toBeNull();
    expect(transientKind(new Error('x'))).toBeNull();
  });

  it('écritures MyAnimeList espacées d’au moins 1 s', () => {
    expect(MAL_WRITE_GAP_MS).toBeGreaterThanOrEqual(1_000);
  });
});
