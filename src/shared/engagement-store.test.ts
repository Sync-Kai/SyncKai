import { beforeEach, describe, expect, it } from 'vitest';
import { installFakeChrome } from '../test/fake-chrome';
import { REWATCH_DECLINE_MS, type PendingRating } from './engagement.types';
import { PENDING_RATINGS_KEY } from './storage-keys';
import type { ServiceResult } from './sync.types';

const fake = installFakeChrome();
const { addPendingRating, getPendingRatings, isDeclineActive, isPendingRating, isRatingSettled, purgeExpiredDeclines, removePendingRating } = await import(
  './engagement-store'
);
const { STORAGE_LOCK } = await import('./storage-lock-core');

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
    expect(isPendingRating({ ...rating, id: '' })).toBe(false);
    expect(isPendingRating({ ...rating, completedAt: 'hier' })).toBe(false);
    expect(isPendingRating({ ...rating, mediaId: null, malId: null })).toBe(false);
    expect(isPendingRating(null)).toBe(false);
  });

  it('garde unique (DATA-02, ARCH-06) : affiche en https seulement, comme l’affiche le popup', () => {
    expect(isPendingRating({ ...rating, coverUrl: 'https://s4.anilist.co/x.jpg' })).toBe(true);
    expect(isPendingRating({ ...rating, coverUrl: 'javascript:alert(1)' })).toBe(false);
    expect(isPendingRating({ ...rating, coverUrl: 'http://s4.anilist.co/x.jpg' })).toBe(false);
    expect(isPendingRating({ ...rating, coverUrl: `https://${'a'.repeat(2000)}` })).toBe(false);
  });

  it('une seule définition dans le code : la copie du popup a disparu', () => {
    const sources = import.meta.glob<string>(['../**/*.ts', '!../**/*.test.ts'], { query: '?raw', import: 'default', eager: true });
    const owners = Object.entries(sources)
      .filter(([, code]) => /function isPendingRating\b|const isPendingRating\b/.test(code))
      .map(([path]) => path);
    expect(owners).toEqual(['./engagement-store.ts']);
    expect(Object.keys(sources).some((path) => path.endsWith('popup/pending-ratings.ts'))).toBe(false);
  });
});

describe('cartes « À noter » : écritures verrouillées (DATA-02)', () => {
  const card = (mediaId: number, completedAt = mediaId): PendingRating => ({ id: `anilist:${mediaId}`, mediaId, malId: null, title: `Série ${mediaId}`, coverUrl: null, completedAt });
  /** Entrée que cette version ne sait pas lire */
  const unreadable = { id: 'future:1', kind: 'v3' };

  beforeEach(() => fake.reset());

  it('« Ignorer » : sous le verrou du stockage, sur le tableau brut (entrée illisible conservée)', async () => {
    fake.local.seed({ [PENDING_RATINGS_KEY]: [card(1), unreadable, card(2)] });
    expect(await removePendingRating('anilist:1')).toBe(true);
    expect(fake.locks.requested).toContain(STORAGE_LOCK);
    expect(fake.local.peek(PENDING_RATINGS_KEY)).toEqual([unreadable, card(2)]);
    expect(await removePendingRating('anilist:1')).toBe(false);
  });

  it('« Ignorer » pendant qu’une finale ajoute une carte : la nouvelle carte reste', async () => {
    fake.local.seed({ [PENDING_RATINGS_KEY]: [card(1)] });
    await Promise.all([addPendingRating(card(3, 10)), removePendingRating('anilist:1')]);
    expect(await getPendingRatings()).toEqual([card(3, 10)]);
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
