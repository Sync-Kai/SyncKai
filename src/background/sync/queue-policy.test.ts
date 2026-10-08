import { describe, expect, it } from 'vitest';
import type { EpisodeInfo } from '../../shared/episode.types';
import type { SyncQueueItem } from '../../shared/queue.types';
import type { SyncOutcome } from '../../shared/sync.types';
import {
  backoffDelay,
  classifyOutcome,
  decideAfterRetry,
  dueItems,
  MAX_AGE_MS,
  mergeServices,
  MIN_ALARM_DELAY_MS,
  nextAlarmTime,
  shouldAbandon,
  upsertFailure,
  withoutServices,
} from './queue-policy';
import { setLocale } from '../../i18n';

// Textes attendus en français
setLocale('fr');

const MIN = 60_000;
const NOW = 1_800_000_000_000;

const episode: EpisodeInfo = {
  platform: 'crunchyroll',
  episodeId: 'GE001',
  seriesId: 'GR001',
  seriesSlug: 'one-piece',
  animeTitle: 'One Piece',
  seasonNumber: 1,
  seasonTitle: null,
  seasonEpisodeNumber: 3,
  displayedEpisodeNumber: 3,
  episodeTitle: null,
  url: 'https://www.crunchyroll.com/watch/GE001',
};

function item(overrides: Partial<SyncQueueItem> = {}): SyncQueueItem {
  return {
    id: 'crunchyroll:GE001',
    episode,
    services: null,
    attempts: 1,
    status: 'pending',
    nextAttemptAt: NOW,
    firstFailedAt: NOW - MIN,
    lastError: 'Hors ligne',
    ...overrides,
  };
}

const networkError: SyncOutcome = { status: 'error', message: 'Connexion impossible.', code: 'NETWORK' };
const sessionExpired: SyncOutcome = { status: 'error', message: 'Session expirée.', code: 'TOKEN_INVALID' };
const success: SyncOutcome = {
  status: 'synced',
  mediaTitle: 'One Piece',
  results: [{ service: 'anilist', outcome: { status: 'updated', progress: 3, completed: false } }],
};

describe('classifyOutcome', () => {
  it('relance les erreurs globales passagères pour les services demandés', () => {
    for (const code of ['NETWORK', 'RATE_LIMITED', 'API_ERROR'] as const) {
      expect(classifyOutcome({ status: 'error', message: 'x', code }, null)).toEqual({ kind: 'retry', services: null, message: 'x' });
    }
    expect(classifyOutcome(networkError, ['mal'])).toMatchObject({ kind: 'retry', services: ['mal'] });
  });

  it('ne relance pas les erreurs définitives ou métier', () => {
    expect(classifyOutcome(sessionExpired, null).kind).toBe('final');
    expect(classifyOutcome({ status: 'error', message: 'x', code: 'NOT_AUTHENTICATED' }, null).kind).toBe('final');
    expect(classifyOutcome({ status: 'error', message: 'x', code: 'INVALID_RESPONSE' }, null).kind).toBe('final');
    expect(classifyOutcome({ status: 'error', message: 'Introuvable' }, null).kind).toBe('final');
  });

  it('considère vérification, déconnexion, exclusion et série ignorée comme résolues', () => {
    expect(classifyOutcome({ status: 'needs-review', reason: 'x' }, null).kind).toBe('resolved');
    expect(classifyOutcome({ status: 'not-connected' }, null).kind).toBe('resolved');
    expect(classifyOutcome({ status: 'excluded', mediaTitle: 'x' }, null).kind).toBe('resolved');
    expect(classifyOutcome({ status: 'ignored' }, null).kind).toBe('resolved');
  });

  it('ne relance que les services en échec passager d’un résultat synced', () => {
    const partial: SyncOutcome = {
      status: 'synced',
      mediaTitle: 'One Piece',
      results: [
        { service: 'anilist', outcome: { status: 'updated', progress: 3, completed: false } },
        { service: 'mal', outcome: { status: 'error', message: 'Trop de requêtes', code: 'RATE_LIMITED' } },
      ],
    };
    expect(classifyOutcome(partial, null)).toEqual({ kind: 'retry', services: ['mal'], message: 'MyAnimeList : Trop de requêtes' });
    expect(classifyOutcome(success, null).kind).toBe('success');
  });

  it('classe final un résultat synced dont les erreurs sont définitives', () => {
    const outcome: SyncOutcome = {
      status: 'synced',
      mediaTitle: 'x',
      results: [{ service: 'anilist', outcome: { status: 'error', message: 'Session expirée', code: 'TOKEN_INVALID' } }],
    };
    expect(classifyOutcome(outcome, null).kind).toBe('final');
  });
});

describe('backoff et abandon', () => {
  it('suit 1 min, 5 min, 15 min, 1 h, 6 h puis plafonne à 6 h', () => {
    expect([1, 2, 3, 4, 5, 6, 10].map(backoffDelay)).toEqual([MIN, 5 * MIN, 15 * MIN, 60 * MIN, 360 * MIN, 360 * MIN, 360 * MIN]);
  });

  it('abandonne après 6 tentatives ou 24 h', () => {
    expect(shouldAbandon(5, NOW, NOW)).toBe(false);
    expect(shouldAbandon(6, NOW, NOW)).toBe(true);
    expect(shouldAbandon(2, NOW - MAX_AGE_MS, NOW)).toBe(true);
  });
});

describe('upsertFailure', () => {
  it('crée une entrée pending à la première tentative', () => {
    expect(upsertFailure(null, episode, null, 'Hors ligne', NOW)).toEqual(
      item({ attempts: 1, nextAttemptAt: NOW + MIN, firstFailedAt: NOW, lastError: 'Hors ligne' }),
    );
  });

  it('fusionne avec l’entrée pending existante en conservant compteur et premier échec', () => {
    const existing = item({ services: ['anilist'], attempts: 3, firstFailedAt: NOW - 10 * MIN });
    const merged = upsertFailure(existing, episode, ['mal'], 'Erreur', NOW);
    expect(merged).toMatchObject({ services: ['anilist', 'mal'], attempts: 3, firstFailedAt: NOW - 10 * MIN, nextAttemptAt: NOW + 15 * MIN });
  });

  it('repart de zéro si l’entrée existante était abandonnée', () => {
    const existing = item({ status: 'failed', attempts: 6, firstFailedAt: NOW - MAX_AGE_MS });
    expect(upsertFailure(existing, episode, null, 'x', NOW)).toMatchObject({ status: 'pending', attempts: 1, firstFailedAt: NOW });
  });
});

describe('services', () => {
  it('mergeServices : null absorbe tout', () => {
    expect(mergeServices(null, ['mal'])).toBeNull();
    expect(mergeServices(['anilist'], ['anilist', 'mal'])).toEqual(['anilist', 'mal']);
  });

  it('withoutServices retire les services réussis', () => {
    expect(withoutServices(item({ services: ['anilist', 'mal'] }), ['anilist'])).toMatchObject({ services: ['mal'] });
    expect(withoutServices(item({ services: ['anilist'] }), ['anilist'])).toBeNull();
    expect(withoutServices(item(), null)).toBeNull();
  });
});

describe('decideAfterRetry', () => {
  it('retire l’entrée en cas de succès ou de vérification manuelle', () => {
    expect(decideAfterRetry(item(), success, NOW)).toEqual({ action: 'remove' });
    expect(decideAfterRetry(item(), { status: 'needs-review', reason: 'x' }, NOW)).toEqual({ action: 'remove' });
  });

  it('replanifie un échec passager avec le backoff suivant', () => {
    expect(decideAfterRetry(item({ attempts: 2 }), networkError, NOW)).toEqual({
      action: 'save',
      item: item({ attempts: 3, nextAttemptAt: NOW + 15 * MIN, lastError: 'Connexion impossible.' }),
    });
  });

  it('abandonne à la 6e tentative ou après 24 h', () => {
    expect(decideAfterRetry(item({ attempts: 5 }), networkError, NOW)).toMatchObject({ item: { status: 'failed', attempts: 6 } });
    expect(decideAfterRetry(item({ firstFailedAt: NOW - MAX_AGE_MS }), networkError, NOW)).toMatchObject({ item: { status: 'failed' } });
  });

  it('abandonne immédiatement sur une erreur définitive', () => {
    expect(decideAfterRetry(item(), sessionExpired, NOW)).toMatchObject({ item: { status: 'failed', lastError: 'Session expirée.' } });
  });

  it('« Réessayer » remet en pending une entrée abandonnée sur échec passager', () => {
    const failed = item({ status: 'failed', attempts: 6, firstFailedAt: NOW - MAX_AGE_MS });
    expect(decideAfterRetry(failed, networkError, NOW, true)).toMatchObject({ item: { status: 'pending', attempts: 7, nextAttemptAt: NOW + 360 * MIN } });
  });
});

describe('alarme', () => {
  it('vise la plus proche tentative pending, au moins 30 s plus tard', () => {
    const items = [item({ nextAttemptAt: NOW + 10 * MIN }), item({ nextAttemptAt: NOW + 2 * MIN }), item({ status: 'failed', nextAttemptAt: NOW })];
    expect(nextAlarmTime(items, NOW)).toBe(NOW + 2 * MIN);
    expect(nextAlarmTime([item({ nextAttemptAt: NOW - MIN })], NOW)).toBe(NOW + MIN_ALARM_DELAY_MS);
  });

  it('aucune alarme sans entrée pending', () => {
    expect(nextAlarmTime([item({ status: 'failed' })], NOW)).toBeNull();
    expect(nextAlarmTime([], NOW)).toBeNull();
  });

  it('dueItems ne garde que les pending échues', () => {
    const due = item({ id: 'a', nextAttemptAt: NOW });
    expect(dueItems([due, item({ id: 'b', nextAttemptAt: NOW + 1 }), item({ id: 'c', status: 'failed', nextAttemptAt: 0 })], NOW)).toEqual([due]);
  });
});
