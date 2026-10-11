import { describe, expect, it } from 'vitest';
import { REWATCH_DECLINE_MS } from './engagement.types';
import { isDeclineActive, isPendingRating, isRatingSettled, purgeExpiredDeclines } from './engagement-store';
import type { ServiceResult } from './sync.types';

const NOW = 1_800_000_000_000;

describe('refus de revisionnage', () => {
  it('reste actif pendant 30 jours', () => {
    expect(isDeclineActive(NOW - 1000, NOW)).toBe(true);
    expect(isDeclineActive(NOW - REWATCH_DECLINE_MS, NOW)).toBe(false);
    expect(isDeclineActive(undefined, NOW)).toBe(false);
  });

  it('purge les refus expirés', () => {
    expect(purgeExpiredDeclines({ 'anilist:1': NOW - 10, 'mal:2': NOW - REWATCH_DECLINE_MS - 1 }, NOW)).toEqual({ 'anilist:1': NOW - 10 });
  });
});

describe('isPendingRating', () => {
  const rating = { id: 'anilist:21', mediaId: 21, malId: 21, title: 'One Piece', coverUrl: null, completedAt: NOW };

  it('accepte une note en attente valide', () => {
    expect(isPendingRating(rating)).toBe(true);
    expect(isPendingRating({ ...rating, id: 'mal:5', mediaId: null, malId: 5 })).toBe(true);
  });

  it('refuse un identifiant incohérent ou des champs invalides', () => {
    expect(isPendingRating({ ...rating, id: 'anilist:22' })).toBe(false);
    expect(isPendingRating({ ...rating, completedAt: 'hier' })).toBe(false);
    expect(isPendingRating({ ...rating, mediaId: null, malId: null })).toBe(false);
  });
});

describe('isRatingSettled (retrait de la carte « À noter »)', () => {
  const saved: ServiceResult = { service: 'anilist', outcome: { status: 'updated', progress: 12, completed: true } };
  const malSaved: ServiceResult = { service: 'mal', outcome: { status: 'updated', progress: 12, completed: true } };
  const malError: ServiceResult = { service: 'mal', outcome: { status: 'error', message: 'Erreur 500', code: 'API_ERROR' } };
  const skipped = (service: ServiceResult['service']): ServiceResult => ({ service, outcome: { status: 'skipped', reason: 'Absente de ta liste' } });

  it('retirée quand chaque service a enregistré la note (ou en est légitimement absent)', () => {
    expect(isRatingSettled([saved, malSaved])).toBe(true);
    expect(isRatingSettled([saved, skipped('mal')])).toBe(true);
  });

  it('conservée tant qu’un service est en erreur, même si un autre a réussi', () => {
    expect(isRatingSettled([saved, malError])).toBe(false);
    expect(isRatingSettled([malError])).toBe(false);
  });

  it('conservée si tous les services sont skipped (note enregistrée nulle part)', () => {
    expect(isRatingSettled([skipped('anilist'), skipped('mal')])).toBe(false);
    expect(isRatingSettled([])).toBe(false);
  });
});
