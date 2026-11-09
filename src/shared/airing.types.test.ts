import { describe, expect, it } from 'vitest';
import { formatAiringStatus, isAiringCheckResult, type AiringCheckResult } from './airing.types';
import { setLocale } from '../i18n';

// Textes attendus en français
setLocale('fr');

const NOW = Date.UTC(2026, 9, 1, 12, 0, 0);
const MIN = 60_000;

function result(overrides: Partial<AiringCheckResult> = {}): AiringCheckResult {
  return { checkedAt: NOW - 12 * MIN, notified: 0, skipped: null, error: null, ...overrides };
}

describe('isAiringCheckResult', () => {
  it('accepte un résumé valide', () => {
    expect(isAiringCheckResult(result())).toBe(true);
    expect(isAiringCheckResult(result({ skipped: 'no-series' }))).toBe(true);
    expect(isAiringCheckResult(result({ error: 'Réseau' }))).toBe(true);
  });

  it('rejette les valeurs invalides', () => {
    expect(isAiringCheckResult(null)).toBe(false);
    expect(isAiringCheckResult({ ...result(), checkedAt: '1' })).toBe(false);
    expect(isAiringCheckResult({ ...result(), notified: -1 })).toBe(false);
    expect(isAiringCheckResult({ ...result(), notified: 1.5 })).toBe(false);
    expect(isAiringCheckResult({ ...result(), skipped: 'other' })).toBe(false);
    expect(isAiringCheckResult({ ...result(), error: 42 })).toBe(false);
    const { error: _error, ...missing } = result();
    expect(isAiringCheckResult(missing)).toBe(false);
  });
});

describe('formatAiringStatus', () => {
  it('jamais vérifié', () => {
    expect(formatAiringStatus(null, NOW)).toEqual({ text: 'Jamais vérifié', tone: 'muted' });
  });

  it('aucun nouvel épisode', () => {
    expect(formatAiringStatus(result(), NOW)).toEqual({ text: 'Dernière vérification : il y a 12 min · aucun nouvel épisode', tone: 'muted' });
  });

  it('épisodes notifiés (singulier / pluriel)', () => {
    expect(formatAiringStatus(result({ notified: 1 }), NOW).text).toBe('Dernière vérification : il y a 12 min · 1 épisode notifié');
    expect(formatAiringStatus(result({ notified: 2 }), NOW).text).toBe('Dernière vérification : il y a 12 min · 2 épisodes notifiés');
  });

  it('raisons d’abandon', () => {
    expect(formatAiringStatus(result({ skipped: 'disabled' }), NOW).text).toContain('alertes désactivées');
    expect(formatAiringStatus(result({ skipped: 'not-connected' }), NOW).text).toContain('aucun compte connecté');
    expect(formatAiringStatus(result({ skipped: 'no-series' }), NOW).text).toContain('aucune série en cours en cache — ouvre l’onglet En cours');
    // Notifications bloquées dans Chrome : en rouge, la vérification ne sert à rien tant qu'elles le restent
    expect(formatAiringStatus(result({ skipped: 'blocked' }), NOW)).toEqual({ text: 'Dernière vérification : il y a 12 min · notifications bloquées par le navigateur — autorise-les pour SyncKai dans ses réglages', tone: 'danger' });
  });

  it('erreur en couleur danger', () => {
    expect(formatAiringStatus(result({ error: 'AniList injoignable' }), NOW)).toEqual({
      text: 'Dernière vérification : il y a 12 min · échec : AniList injoignable',
      tone: 'danger',
    });
  });
});
