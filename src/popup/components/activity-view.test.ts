import { describe, expect, it } from 'vitest';
import { setLocale } from '../../i18n';
import { exclusionKey } from '../../platforms/series-identity';
import type { EpisodeInfo } from '../../shared/episode.types';
import type { SyncQueueItem } from '../../shared/queue.types';
import type { RecentSync } from '../../shared/review.types';
import { formatUntil, isRecentExcluded, queueRoute, queueTitle, recentTitle } from './activity-view';

setLocale('fr');

const NOW = Date.UTC(2026, 9, 17, 12);
const MIN = 60_000;

const EPISODE: EpisodeInfo = {
  platform: 'crunchyroll',
  episodeId: 'GDAN4',
  seriesId: 'DAN',
  seriesSlug: 'dandadan',
  animeTitle: 'Dandadan',
  seasonNumber: 1,
  seasonTitle: null,
  seasonEpisodeNumber: 4,
  displayedEpisodeNumber: 4,
  episodeTitle: null,
  url: 'https://www.crunchyroll.com/watch/GDAN4',
};

const item = (patch: Partial<SyncQueueItem> = {}): SyncQueueItem => ({
  id: 'crunchyroll:GDAN4',
  episode: EPISODE,
  services: null,
  attempts: 1,
  status: 'pending',
  nextAttemptAt: NOW + 5 * MIN,
  firstFailedAt: NOW - MIN,
  lastError: 'AniList est injoignable.',
  ...patch,
});

const sync = (patch: Partial<RecentSync> = {}): RecentSync => ({ key: 'crunchyroll:DAN:s1', episode: EPISODE, mediaId: 171018, mediaTitle: 'Dandadan', progress: 4, syncedAt: NOW, ...patch });

describe('Activité › synchros en attente', () => {
  it('délai de la prochaine tentative', () => {
    expect(formatUntil(NOW + 30_000, NOW)).toBe('imminent');
    expect(formatUntil(NOW + 4.2 * MIN, NOW)).toBe('dans 5 min');
    expect(formatUntil(NOW + 125 * MIN, NOW)).toBe('dans 2 h');
    expect(formatUntil(NOW + 2 * 24 * 60 * MIN, NOW)).toBe('dans 2 jours');
  });

  it('titre « série · S1 E4 », route plateforme → services restants', () => {
    expect(queueTitle(EPISODE)).toBe('Dandadan · S1 E4');
    expect(queueTitle({ ...EPISODE, seasonNumber: null, seasonEpisodeNumber: null, displayedEpisodeNumber: 1122 })).toBe('Dandadan · E1122');
    expect(queueTitle({ ...EPISODE, seasonNumber: null, seasonEpisodeNumber: null, displayedEpisodeNumber: null })).toBe('Dandadan');
    expect(queueRoute(item())).toBe('Crunchyroll → AniList · MyAnimeList');
    expect(queueRoute(item({ services: ['mal'] }))).toBe('Crunchyroll → MyAnimeList');
  });
});

describe('Activité › dernières synchros', () => {
  it('titre avec le numéro affiché par la plateforme', () => {
    expect(recentTitle(sync({ episode: { ...EPISODE, displayedEpisodeNumber: 30, seasonEpisodeNumber: 5 } }))).toBe('Dandadan · E30');
    expect(recentTitle(sync({ episode: { ...EPISODE, displayedEpisodeNumber: null, seasonEpisodeNumber: null } }))).toBe('Dandadan');
  });

  it('série exclue : par la clé de la plateforme ou par la fiche AniList', () => {
    const excluded = (platformKey: string | null, mediaId: number | null) => ({ status: 'ready' as const, items: [{ id: 'x', platformKey, mediaId, label: 'Dandadan', excludedAt: NOW }] });
    expect(isRecentExcluded(sync(), { status: 'loading' })).toBe(false);
    expect(isRecentExcluded(sync(), { status: 'ready', items: [] })).toBe(false);
    expect(isRecentExcluded(sync(), excluded(exclusionKey(EPISODE), null))).toBe(true);
    expect(isRecentExcluded(sync(), excluded(null, 171018))).toBe(true);
    expect(isRecentExcluded(sync(), excluded('crunchyroll:OTHER', 1))).toBe(false);
  });
});
