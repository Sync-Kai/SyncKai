import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/errors';
import { budgetWaitEvent, isFatalError } from './runner';

describe('erreur définitive d’une tâche', () => {
  it('session expirée, réseau, limite persistante : arrêt ; service surchargé ou erreur ponctuelle : on continue', () => {
    expect(isFatalError(new ApiError('TOKEN_INVALID', 'x'))).toBe(true);
    expect(isFatalError(new ApiError('NETWORK', 'x'))).toBe(true);
    expect(isFatalError(new ApiError('RATE_LIMITED', 'x'))).toBe(true);
    expect(isFatalError(new ApiError('NETWORK', 'x', { timedOut: true }))).toBe(false);
    expect(isFatalError(new ApiError('API_ERROR', 'x', { httpStatus: 400 }))).toBe(false);
    expect(isFatalError(new Error('x'))).toBe(false);
  });
});

describe('attente du budget AniList → évènement de la tâche', () => {
  it('pause « quota » avec reprise estimée, reprise inconnue = pause échue (texte sans compte à rebours), fin = wait-end', () => {
    expect(budgetWaitEvent({ reason: 'budget', until: 13_000 }, 1_000)).toEqual({ type: 'pause', until: 13_000, reason: 'budget', service: 'anilist', at: 1_000 });
    expect(budgetWaitEvent({ reason: 'budget', until: null }, 1_000)).toEqual({ type: 'pause', until: 1_000, reason: 'budget', service: 'anilist', at: 1_000 });
    expect(budgetWaitEvent({ reason: 'rate-limit', until: 6_000 }, 1_000)).toMatchObject({ reason: 'rate-limit', until: 6_000 });
    expect(budgetWaitEvent(null, 2_000)).toEqual({ type: 'wait-end', at: 2_000 });
  });
});
