import { afterEach, describe, expect, it } from 'vitest';
import { episodesToCatchUp, formatRemaining, remainingMinutes } from './remaining-time';
import type { WatchingEntry } from './watching.types';
import { setLocale } from '../i18n';

// Textes attendus en français, sauf mention contraire
setLocale('fr');
afterEach(() => setLocale('fr'));

const NOW = Date.UTC(2026, 10, 8, 12, 0, 0);
const HOUR = 3_600_000;

function entry(overrides: Partial<WatchingEntry> = {}): WatchingEntry {
  return {
    mediaId: 1,
    malId: 10,
    title: 'Anime',
    coverUrl: null,
    progress: 0,
    totalEpisodes: null,
    updatedAt: null,
    nextEpisode: null,
    airingStatus: null,
    episodeMinutes: 24,
    platforms: [],
    lastSync: null,
    siteUrl: 'https://anilist.co/anime/1',
    ...overrides,
  };
}

const finished = (overrides: Partial<WatchingEntry> = {}): WatchingEntry => entry({ airingStatus: 'FINISHED', totalEpisodes: 23, progress: 7, ...overrides });
const airing = (overrides: Partial<WatchingEntry> = {}): WatchingEntry =>
  entry({ airingStatus: 'RELEASING', totalEpisodes: 12, progress: 2, nextEpisode: { episode: 5, airingAt: NOW + 2 * HOUR }, ...overrides });
/** Série terminée dont le reste vaut exactement `minutes` (1 épisode de cette durée) */
const lasting = (minutes: number): WatchingEntry => finished({ totalEpisodes: 2, progress: 1, episodeMinutes: minutes });

describe('episodesToCatchUp', () => {
  it('série terminée : total − progression', () => {
    expect(episodesToCatchUp(finished(), NOW)).toBe(16);
  });

  it('série annulée : total − progression', () => {
    expect(episodesToCatchUp(finished({ airingStatus: 'CANCELLED' }), NOW)).toBe(16);
  });

  it('en diffusion, prochain épisode E5 pas encore sorti : 4 sortis − 2 vus', () => {
    expect(episodesToCatchUp(airing(), NOW)).toBe(2);
  });

  it('en diffusion, E5 annoncé dans le passé (cache) : 5 sortis − 2 vus', () => {
    expect(episodesToCatchUp(airing({ nextEpisode: { episode: 5, airingAt: NOW - HOUR } }), NOW)).toBe(3);
  });

  it('épisodes sortis inconnus : null', () => {
    expect(episodesToCatchUp(airing({ nextEpisode: null }), NOW)).toBeNull();
    expect(episodesToCatchUp(entry({ airingStatus: 'HIATUS', totalEpisodes: 12, progress: 2 }), NOW)).toBeNull();
    expect(episodesToCatchUp(entry({ airingStatus: 'NOT_YET_RELEASED', totalEpisodes: 12 }), NOW)).toBeNull();
    expect(episodesToCatchUp(finished({ totalEpisodes: null }), NOW)).toBeNull();
  });

  it('à jour ou en avance : 0', () => {
    expect(episodesToCatchUp(finished({ progress: 23 }), NOW)).toBe(0);
    expect(episodesToCatchUp(airing({ progress: 6 }), NOW)).toBe(0);
  });
});

describe('remainingMinutes', () => {
  it('épisodes à rattraper × durée', () => {
    expect(remainingMinutes(finished(), NOW)).toBe(384);
    expect(remainingMinutes(airing(), NOW)).toBe(48);
  });

  it('en diffusion sans date, en pause ou pas encore sortie : null', () => {
    expect(remainingMinutes(airing({ nextEpisode: null }), NOW)).toBeNull();
    expect(remainingMinutes(entry({ airingStatus: 'HIATUS', totalEpisodes: 12, progress: 2 }), NOW)).toBeNull();
    expect(remainingMinutes(entry({ airingStatus: 'NOT_YET_RELEASED', totalEpisodes: 12 }), NOW)).toBeNull();
    expect(remainingMinutes(entry({ airingStatus: 'NOT_YET_RELEASED', nextEpisode: { episode: 1, airingAt: NOW + HOUR } }), NOW)).toBeNull();
  });

  it('à jour ou en avance : null', () => {
    expect(remainingMinutes(finished({ progress: 23 }), NOW)).toBeNull();
    expect(remainingMinutes(airing({ progress: 4 }), NOW)).toBeNull();
    expect(remainingMinutes(airing({ progress: 7 }), NOW)).toBeNull();
  });

  it('durée d\'épisode inconnue (absente, null ou invalide) : null', () => {
    const { episodeMinutes: _omitted, ...withoutMinutes } = finished();
    expect(remainingMinutes(withoutMinutes, NOW)).toBeNull();
    expect(remainingMinutes(finished({ episodeMinutes: null }), NOW)).toBeNull();
    expect(remainingMinutes(finished({ episodeMinutes: 0 }), NOW)).toBeNull();
  });
});

describe('formatRemaining', () => {
  it('série terminée 7/23 à 24 min : « ≈ 6,5 h », lu et détaillé', () => {
    // Unité longue d'Intl.NumberFormat : espace insécable entre le nombre et « heures » en français
    expect(formatRemaining(finished(), NOW)).toEqual({ text: '≈ 6,5 h', spoken: 'Environ 6,5 heures pour finir', detail: '16 épisodes × 24 min' });
  });

  it('série en diffusion : détail des épisodes sortis à voir', () => {
    expect(formatRemaining(airing(), NOW)?.detail).toBe('2 épisodes sortis à voir × 24 min');
    expect(formatRemaining(airing({ progress: 3 }), NOW)?.detail).toBe('1 épisode sorti à voir × 24 min');
  });

  it('un seul épisode d\'une série terminée : singulier', () => {
    expect(formatRemaining(lasting(24), NOW)?.detail).toBe('1 épisode × 24 min');
  });

  it('moins d\'une heure : arrondi à 5 min, 5 min au minimum', () => {
    expect(formatRemaining(lasting(3), NOW)?.text).toBe('≈ 5 min');
    expect(formatRemaining(lasting(47), NOW)?.text).toBe('≈ 45 min');
    expect(formatRemaining(lasting(47), NOW)?.spoken).toBe('Environ 45 minutes pour finir');
  });

  it('de 1 h à moins de 10 h : demi-heure la plus proche, une décimale', () => {
    expect(formatRemaining(lasting(95), NOW)?.text).toBe('≈ 1,5 h');
    expect(formatRemaining(lasting(60), NOW)?.text).toBe('≈ 1 h');
  });

  it('10 h et plus : heures entières', () => {
    expect(formatRemaining(lasting(1240), NOW)?.text).toBe('≈ 21 h');
  });

  it('rien à afficher : null', () => {
    expect(formatRemaining(finished({ progress: 23 }), NOW)).toBeNull();
    expect(formatRemaining(finished({ episodeMinutes: null }), NOW)).toBeNull();
  });

  it('allemand : « ≈ 6,5 Std. »', () => {
    setLocale('de');
    expect(formatRemaining(finished(), NOW)?.text).toBe('≈ 6,5 Std.');
  });

  it('japonais : « 約6.5時間 », sans espace', () => {
    setLocale('ja');
    expect(formatRemaining(finished(), NOW)?.text).toBe('約6.5時間');
  });

  it('anglais : point décimal et détail au pluriel', () => {
    setLocale('en');
    expect(formatRemaining(finished(), NOW)).toEqual({ text: '≈ 6.5 h', spoken: 'About 6.5 hours to finish', detail: '16 episodes × 24 min' });
  });
});
