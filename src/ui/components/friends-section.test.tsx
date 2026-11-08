// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale, t, tp } from '../../i18n';
import type { FriendEntry, FriendsSummary } from '../../shared/friends';
import type { PageListState } from '../../shared/page-media.types';
import type { FriendsView } from '../preact/use-friends';
import { aniListScore, FriendsSection, friendsEnabled, showsFriendsSection } from './friends-section';
import { FriendsSummaryLine } from './friends-summary';

// Section « Amis sur AniList » et sa ligne de résumé : quand la section est montée, bande de comparaison, 5 amis puis
// « Voir les N autres » sur place, statuts à la troisième personne, « — » sans note.

const friend = (id: number, score: number | null, status: FriendEntry['status'] = 'CURRENT'): FriendEntry => ({ id, name: `Ami${id}`, avatar: null, status, progress: 3, score });
const SUMMARY: FriendsSummary = { total: 7, averageScore: 8.6, scoredCount: 6, friends: [friend(1, 9), friend(2, 8), friend(3, 9), friend(4, 8), friend(5, 9), friend(6, 8), friend(7, null, 'PLANNING')] };
const ok = (summary: FriendsSummary = SUMMARY): FriendsView => ({ state: 'ok', summary, retry: () => undefined });

let container: HTMLElement;
const $ = (selector: string): HTMLElement | null => container.querySelector<HTMLElement>(selector);
const $$ = (selector: string): HTMLElement[] => [...container.querySelectorAll<HTMLElement>(selector)];

beforeEach(() => {
  setLocale('fr');
  container = document.createElement('div');
  document.body.append(container);
});

afterEach(async () => {
  await act(() => render(null, container));
  container.remove();
});

describe('règles de la section', () => {
  it('montée : amis lus ou erreur ; en chargement seulement déjà ouverte ; jamais sans ami ni session', () => {
    expect(showsFriendsSection('ok', false)).toBe(true);
    expect(showsFriendsSection('error', false)).toBe(true);
    expect(showsFriendsSection('loading', true)).toBe(true);
    expect(showsFriendsSection('loading', false)).toBe(false);
    expect(showsFriendsSection('none', true)).toBe(false);
    expect(showsFriendsSection('idle', true)).toBe(false);
  });

  it('session AniList = un état de liste AniList ; ta note = celle de la liste AniList', () => {
    const lists: PageListState[] = [
      { service: 'anilist', state: 'in-list', status: 'CURRENT', progress: 3, score: 7.5, notes: null, siteUrl: '' },
      { service: 'mal', state: 'in-list', status: 'CURRENT', progress: 3, score: 9, notes: null, siteUrl: '' },
    ];
    expect(friendsEnabled(lists)).toBe(true);
    expect(aniListScore(lists)).toBe(7.5);
    expect(friendsEnabled(lists.slice(1))).toBe(false);
    expect(aniListScore([{ service: 'anilist', state: 'not-in-list', siteUrl: '' }])).toBeNull();
  });
});

describe('FriendsSection', () => {
  it('5 amis, puis « Voir les 2 autres » les ajoute sur place ; statut à la troisième personne, « — » sans note', async () => {
    await act(() => render(<FriendsSection friends={ok()} yourScore={null} episodes={12} siteUrl="https://anilist.co/anime/1" />, container));
    expect($$('[data-friend]')).toHaveLength(5);
    expect($('[data-friends-band]')?.textContent).toContain('8,6');
    expect($('[data-friends-band]')?.textContent).toContain(t('friends.noScore'));
    const more = $('[data-focus="friends-more"]');
    expect(more?.textContent).toBe(tp('friends.more', 2));
    await act(() => more?.click());
    expect($$('[data-friend]')).toHaveLength(7);
    expect($('[data-focus="friends-more"]')).toBeNull();
    expect($('[data-friend="1"]')?.textContent).toContain(t('friends.status.CURRENT'));
    expect($('[data-friend="7"] [data-friend-score]')?.textContent).toBe('—');
    // Prévu sans épisode vu : pas de « Ép. 0 / 12 »
    expect($('[data-friend="7"]')?.textContent).not.toContain(t('watching.heroProgress', { progress: 0, total: 12 }));
    expect($('[data-friend="1"]')?.textContent).toContain(t('watching.heroProgress', { progress: 3, total: 12 }));
    expect($('[data-focus="friends-profile-1"]')?.getAttribute('href')).toBe('https://anilist.co/user/Ami1/');
  });

  it('pas de moyenne (moins de 2 notes) : pas de bande', async () => {
    await act(() => render(<FriendsSection friends={ok({ ...SUMMARY, averageScore: null })} yourScore={8} episodes={12} siteUrl="" />, container));
    expect($('[data-friends-band]')).toBeNull();
  });

  it('chargement : squelette aria-busy ; erreur : « Indisponible » et « Réessayer »', async () => {
    const retry = vi.fn();
    await act(() => render(<FriendsSection friends={{ state: 'loading', summary: null, retry }} yourScore={null} episodes={null} siteUrl="" />, container));
    expect($('[aria-busy="true"]')?.getAttribute('aria-label')).toBe(t('friends.loading'));
    await act(() => render(<FriendsSection friends={{ state: 'error', summary: null, retry }} yourScore={null} episodes={null} siteUrl="" />, container));
    expect($('[data-friends-section]')?.textContent).toContain(t('friends.unavailable'));
    await act(() => $('[data-focus="friends-retry"]')?.click());
    expect(retry).toHaveBeenCalledTimes(1);
  });
});

describe('FriendsSummaryLine', () => {
  it('« 7 amis · ★ 8,6 », trois avatars, le clic ouvre', async () => {
    const onOpen = vi.fn();
    await act(() => render(<FriendsSummaryLine summary={SUMMARY} onOpen={onOpen} />, container));
    expect($('[data-friends-summary]')?.textContent).toContain(`${tp('friends.summary', 7)} · ★ 8,6`);
    expect($$('[data-friend-avatar]')).toHaveLength(3);
    await act(() => $('[data-friends-summary]')?.click());
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('sans moyenne : le nombre seul', async () => {
    await act(() => render(<FriendsSummaryLine summary={{ ...SUMMARY, averageScore: null }} onOpen={() => undefined} />, container));
    expect($('[data-friends-summary]')?.textContent).toContain(tp('friends.summary', 7));
    expect($('[data-friends-summary]')?.textContent).not.toContain('★');
  });
});
