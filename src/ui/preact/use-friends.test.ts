// @vitest-environment happy-dom
import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FriendsSummary } from '../../shared/friends';

// Amis AniList de la fiche affichée (popup, panneau) : demande envoyée seulement quand la fiche est restée la même 1,5 s
// (choix de saisons ou navigations rapides : rien), jamais sans session AniList, « Réessayer » aussitôt.

const worker = vi.hoisted(() => ({ send: vi.fn<(type: string, payload: unknown) => Promise<unknown>>() }));
vi.mock('../../protocol/messages', () => ({ sendMessage: (type: string, payload: unknown): Promise<unknown> => worker.send(type, payload) }));

const { FRIENDS_SETTLE_MS, useFriends } = await import('./use-friends');
type FriendsView = ReturnType<typeof useFriends>;

const SUMMARY: FriendsSummary = { total: 1, averageScore: null, scoredCount: 0, friends: [{ id: 1, name: 'Kai', avatar: null, status: 'CURRENT', progress: 3, score: null }] };

let container: HTMLElement;
let latest: FriendsView | null = null;

function Probe({ mediaId, enabled }: { mediaId: number | null; enabled: boolean }) {
  latest = useFriends(mediaId, enabled);
  return null;
}

const show = (mediaId: number | null, enabled = true): Promise<void> => act(() => render(h(Probe, { mediaId, enabled }), container));
/** Avance l'horloge simulée, puis laisse la réponse (promesse) et le rendu passer */
const advance = async (ms: number): Promise<void> => {
  await act(async () => {
    vi.advanceTimersByTime(ms);
    await Promise.resolve();
  });
  await act(async () => {
    await Promise.resolve();
  });
};
const view = (): FriendsView => {
  if (latest === null) throw new Error('hook jamais rendu');
  return latest;
};
const requests = (): unknown[] => worker.send.mock.calls.filter(([type]) => type === 'GET_ANILIST_FRIENDS').map(([, payload]) => payload);

beforeEach(() => {
  vi.useFakeTimers();
  worker.send.mockReset();
  worker.send.mockResolvedValue({ status: 'ok', summary: SUMMARY });
  container = document.createElement('div');
  document.body.append(container);
});

afterEach(async () => {
  await act(() => render(null, container));
  container.remove();
  latest = null;
  vi.useRealTimers();
});

describe('useFriends', () => {
  it('trois fiches en moins de 1,5 s : une seule demande, pour la dernière', async () => {
    await show(10);
    expect(view().state).toBe('loading');
    await advance(500);
    await show(11);
    await advance(500);
    await show(12);
    await advance(FRIENDS_SETTLE_MS - 1);
    expect(requests()).toEqual([]);
    await advance(1);
    expect(requests()).toEqual([{ mediaId: 12 }]);
    expect(view()).toMatchObject({ state: 'ok', summary: SUMMARY });
  });

  it('sans session AniList (enabled false) : idle, aucune demande', async () => {
    await show(10, false);
    await advance(FRIENDS_SETTLE_MS * 3);
    expect(requests()).toEqual([]);
    expect(view()).toMatchObject({ state: 'idle', summary: null });
  });

  it('aucune fiche : idle, aucune demande', async () => {
    await show(null);
    await advance(FRIENDS_SETTLE_MS * 2);
    expect(requests()).toEqual([]);
    expect(view().state).toBe('idle');
  });

  it('réponse none : état none (bloc masqué)', async () => {
    worker.send.mockResolvedValue({ status: 'none' });
    await show(10);
    await advance(FRIENDS_SETTLE_MS);
    expect(view()).toMatchObject({ state: 'none', summary: null });
  });

  it('erreur : retry() renvoie la demande aussitôt (sans attendre 1,5 s)', async () => {
    worker.send.mockResolvedValueOnce({ status: 'error', message: 'AniList injoignable' });
    await show(10);
    await advance(FRIENDS_SETTLE_MS);
    expect(view().state).toBe('error');
    expect(requests()).toHaveLength(1);
    await act(() => view().retry());
    expect(view().state).toBe('loading');
    await advance(0);
    expect(requests()).toEqual([{ mediaId: 10 }, { mediaId: 10 }]);
    expect(view()).toMatchObject({ state: 'ok', summary: SUMMARY });
  });

  it('service worker injoignable : erreur, jamais d’exception', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    worker.send.mockRejectedValue(new Error('Receiving end does not exist.'));
    await show(10);
    await advance(FRIENDS_SETTLE_MS);
    expect(view().state).toBe('error');
  });

  it('fiche changée pendant la demande : la réponse de l’ancienne fiche est ignorée', async () => {
    let answer: (value: unknown) => void = () => undefined;
    worker.send.mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)));
    await show(10);
    await advance(FRIENDS_SETTLE_MS);
    await show(11);
    await act(async () => answer({ status: 'ok', summary: SUMMARY }));
    expect(view()).toMatchObject({ state: 'loading', summary: null });
    await advance(FRIENDS_SETTLE_MS);
    expect(requests()).toEqual([{ mediaId: 10 }, { mediaId: 11 }]);
  });

  it('résultat d’une fiche jamais montré pour la suivante (même avant son effet)', async () => {
    await show(10);
    await advance(FRIENDS_SETTLE_MS);
    expect(view().state).toBe('ok');
    await show(11);
    expect(view()).toMatchObject({ state: 'loading', summary: null });
  });

  it('session fermée puis rouverte (autre compte) sur la même fiche : l’ancien résultat n’est jamais remontré', async () => {
    await show(10);
    await advance(FRIENDS_SETTLE_MS);
    expect(view().state).toBe('ok');
    await show(10, false);
    expect(view().state).toBe('idle');
    let answer: (value: unknown) => void = () => undefined;
    worker.send.mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)));
    await show(10, true);
    expect(view()).toMatchObject({ state: 'loading', summary: null });
    await advance(FRIENDS_SETTLE_MS);
    expect(view()).toMatchObject({ state: 'loading', summary: null });
    answer({ status: 'none' });
    await advance(0);
    expect(view()).toMatchObject({ state: 'none', summary: null });
    expect(requests()).toEqual([{ mediaId: 10 }, { mediaId: 10 }]);
  });

  it('démonté avant 1,5 s : aucune demande', async () => {
    await show(10);
    await act(() => render(null, container));
    await advance(FRIENDS_SETTLE_MS * 2);
    expect(requests()).toEqual([]);
  });
});
