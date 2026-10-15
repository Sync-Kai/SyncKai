import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PageMediaView } from '../shared/page-media.types';
import { isSafeImageUrl } from '../shared/url';

// Changement de statut depuis « Sur cette page » / le panneau : l'affiche jointe pour la carte « À noter » doit passer
// la validation du message (hôtes d'images autorisés), sinon tout le message serait refusé.

const sent = vi.hoisted(() => ({ calls: [] as { type: string; payload: unknown }[] }));
vi.mock('../protocol/messages', () => ({
  sendMessage: (type: string, payload: unknown): Promise<unknown> => {
    sent.calls.push({ type, payload });
    return Promise.resolve({ status: 'synced', mediaTitle: 'Frieren', results: [] });
  },
}));

const { runMediaAction } = await import('./media-action-requests');

function view(coverUrl: string | null): PageMediaView {
  return {
    media: { mediaId: 154587, idMal: 52991, title: 'Frieren', coverUrl, episodes: 28, format: 'TV', year: 2023, airingStatus: 'FINISHED', nextEpisode: null, siteUrl: 'https://anilist.co/anime/154587' },
    lists: [],
    confidence: 'certain',
    source: 'page',
    seasons: [],
    episodeProgress: null,
  };
}

const coverSent = (): unknown => (sent.calls.at(-1)?.payload as { coverUrl?: unknown } | undefined)?.coverUrl;

beforeEach(() => {
  sent.calls = [];
});

describe('SET_LIST_STATUS : affiche de la carte « À noter »', () => {
  it('affiche AniList : envoyée telle quelle (acceptée par la validation)', async () => {
    const cover = 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587.jpg';
    await runMediaAction({ kind: 'status', status: 'COMPLETED' }, view(cover));
    expect(sent.calls).toMatchObject([{ type: 'SET_LIST_STATUS', payload: { mediaId: 154587, malId: 52991, status: 'COMPLETED', coverUrl: cover } }]);
    expect(isSafeImageUrl(coverSent())).toBe(true);
  });

  it('affiche https d’un hôte non autorisé : retirée (null), le changement de statut part quand même', async () => {
    await runMediaAction({ kind: 'status', status: 'PAUSED' }, view('https://example.com/cover.jpg'));
    expect(sent.calls).toMatchObject([{ type: 'SET_LIST_STATUS', payload: { status: 'PAUSED', coverUrl: null } }]);
  });

  it('sans affiche ou hors https : null', async () => {
    await runMediaAction({ kind: 'status', status: 'DROPPED' }, view(null));
    await runMediaAction({ kind: 'status', status: 'DROPPED' }, view('http://s4.anilist.co/x.jpg'));
    expect(sent.calls.map((call) => (call.payload as { coverUrl: unknown }).coverUrl)).toEqual([null, null]);
  });
});
