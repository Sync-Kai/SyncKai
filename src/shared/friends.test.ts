import { describe, expect, it } from 'vitest';
import { isFriendsQueryData, reduceFriends, type FriendsSummary } from './friends';

// Réponse de la requête « amis » (Page.mediaList, isFollowing: true) : forme du schéma AniList, valeurs inventées
const AVATAR = 'https://s4.anilist.co/file/anilistcdn/user/avatar/medium/b5-x.png';

function entry(id: number, status: unknown, score: unknown, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { status, progress: 3, score, user: { id, name: `ami${id}`, avatar: { medium: AVATAR } }, ...extra };
}

const page = (mediaList: unknown[], total?: unknown): unknown => ({ Page: { pageInfo: total === undefined ? {} : { total }, mediaList } });

describe('reduceFriends (amis AniList qui ont la série)', () => {
  it('moyenne sur les notes > 0 seulement, arrondie au dixième', () => {
    const summary = reduceFriends(page([entry(1, 'COMPLETED', 8), entry(2, 'CURRENT', 9.4), entry(3, 'PLANNING', 0)], 3));
    expect(summary).toMatchObject({ total: 3, scoredCount: 2, averageScore: 8.7 });
    expect(summary?.friends.map((f) => f.score)).toEqual([8, 9.4, null]);
  });

  it('moins de 2 notes : pas de moyenne (scoredCount gardé)', () => {
    expect(reduceFriends(page([entry(1, 'COMPLETED', 7.5), entry(2, 'CURRENT', 0)], 2))).toMatchObject({ averageScore: null, scoredCount: 1 });
    expect(reduceFriends(page([entry(1, 'COMPLETED', 0)], 1))).toMatchObject({ averageScore: null, scoredCount: 0 });
  });

  it('utilisateur absent ou illisible ignoré, avatar absent → null, statut inconnu ignoré', () => {
    const summary = reduceFriends(
      page(
        [
          entry(1, 'CURRENT', 8, { user: null }),
          entry(2, 'CURRENT', 8, { user: { id: 2, name: 'sans-avatar' } }),
          entry(3, 'WATCHING', 8),
          entry(4, 'REPEATING', 8, { user: { id: 4, name: 'Kai', avatar: { medium: 'https://evil.example/a.png' } } }),
          entry(5, 'PAUSED', 'neuf', { progress: -2 }),
          'pas une entrée',
        ],
        6,
      ),
    );
    const expected: FriendsSummary['friends'] = [
      { id: 2, name: 'sans-avatar', avatar: null, status: 'CURRENT', progress: 3, score: 8 },
      { id: 4, name: 'Kai', avatar: null, status: 'REPEATING', progress: 3, score: 8 },
      { id: 5, name: 'ami5', avatar: AVATAR, status: 'PAUSED', progress: 0, score: null },
    ];
    expect(summary?.friends).toEqual(expected);
  });

  it('total lu dans pageInfo.total (au-delà des 50 de la page), jamais moins que les amis lus', () => {
    expect(reduceFriends(page([entry(1, 'COMPLETED', 8)], 73))?.total).toBe(73);
    expect(reduceFriends(page([entry(1, 'COMPLETED', 8), entry(2, 'CURRENT', 0)]))?.total).toBe(2);
    expect(reduceFriends(page([entry(1, 'COMPLETED', 8), entry(2, 'CURRENT', 0)], 'x'))?.total).toBe(2);
  });

  it('liste vide : résumé vide ; réponse illisible : null', () => {
    expect(reduceFriends(page([], 0))).toEqual({ total: 0, averageScore: null, scoredCount: 0, friends: [] });
    for (const data of [null, {}, { Page: null }, { Page: { mediaList: 'x' } }]) expect(reduceFriends(data), JSON.stringify(data)).toBeNull();
  });

  it('notes hors échelle ignorées, un même ami compté une fois', () => {
    const summary = reduceFriends(page([entry(1, 'COMPLETED', 11), entry(2, 'COMPLETED', 6), entry(2, 'CURRENT', 9), entry(3, 'CURRENT', 10)], 3));
    expect(summary?.friends.map((f) => [f.id, f.score])).toEqual([[1, null], [2, 6], [3, 10]]);
    expect(summary).toMatchObject({ scoredCount: 2, averageScore: 8 });
  });

  it('garde de la requête : Page.mediaList doit être un tableau', () => {
    expect(isFriendsQueryData(page([]))).toBe(true);
    expect(isFriendsQueryData({ Page: {} })).toBe(false);
    expect(isFriendsQueryData(null)).toBe(false);
  });
});
