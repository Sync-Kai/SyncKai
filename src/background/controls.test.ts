import { describe, expect, it } from 'vitest';
import { decideAdjustment, shouldQueueRating } from './controls';
import { setLocale } from '../i18n';

// Textes attendus en français
setLocale('fr');

describe('decideAdjustment', () => {
  it('+1 avance et passe en cours', () => {
    expect(decideAdjustment({ status: 'CURRENT', progress: 3 }, 12, 1)).toEqual({ action: 'write', progress: 4, status: 'CURRENT' });
    expect(decideAdjustment(null, null, 1)).toEqual({ action: 'write', progress: 1, status: 'CURRENT' });
  });

  it('+1 sur le dernier épisode termine l’anime', () => {
    expect(decideAdjustment({ status: 'CURRENT', progress: 11 }, 12, 1)).toEqual({ action: 'write', progress: 12, status: 'COMPLETED' });
  });

  it('+1 au-delà du total est refusé', () => {
    expect(decideAdjustment({ status: 'COMPLETED', progress: 12 }, 12, 1)).toEqual({ action: 'skip', reason: 'Déjà au dernier épisode' });
  });

  it('−1 sur une entrée terminée la repasse en cours', () => {
    expect(decideAdjustment({ status: 'COMPLETED', progress: 12 }, 12, -1)).toEqual({ action: 'write', progress: 11, status: 'CURRENT' });
  });

  it('−1 à zéro (ou hors liste) ne fait rien', () => {
    expect(decideAdjustment({ status: 'CURRENT', progress: 0 }, 12, -1)).toEqual({ action: 'skip', reason: 'Aucun épisode à retirer' });
    expect(decideAdjustment(null, 12, -1)).toEqual({ action: 'skip', reason: 'Aucun épisode à retirer' });
  });

  it('total inconnu : jamais terminé automatiquement', () => {
    expect(decideAdjustment({ status: 'CURRENT', progress: 1100 }, null, 1)).toEqual({ action: 'write', progress: 1101, status: 'CURRENT' });
  });
});

describe('shouldQueueRating', () => {
  const completed = { result: { service: 'anilist', outcome: { status: 'updated', progress: 12, completed: true } }, scored: false } as const;
  const malUpToDate = { result: { service: 'mal', outcome: { status: 'up-to-date', progress: 12 } }, scored: false } as const;

  it('carte « À noter » après Terminé, sans note existante', () => {
    expect(shouldQueueRating('COMPLETED', [completed, malUpToDate], true)).toBe(true);
  });

  it('pas de carte si une note existe sur un service', () => {
    expect(shouldQueueRating('COMPLETED', [completed, { ...malUpToDate, scored: true }], true)).toBe(false);
  });

  it('pas de carte si la proposition de note est désactivée', () => {
    expect(shouldQueueRating('COMPLETED', [completed], false)).toBe(false);
  });

  it('pas de carte pour En pause / Abandonné, ni sans passage effectif en Terminé', () => {
    expect(shouldQueueRating('PAUSED', [completed], true)).toBe(false);
    expect(shouldQueueRating('DROPPED', [completed], true)).toBe(false);
    expect(shouldQueueRating('COMPLETED', [malUpToDate], true)).toBe(false);
  });
});
