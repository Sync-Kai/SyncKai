// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n';
import type { TrackerId } from '../../shared/tracker.types';
import type { WatchingEntry } from '../../shared/watching.types';
import { createStore, hasOpenSession, LOGGED_OUT, type AccountState } from '../../ui/state';
import type { DormantState } from '../controllers/dormant';
import { DormantSection, type DormantHost } from './dormant-section';

// « Tout mettre en pause » : la confirmation nomme les seuls services où le lot écrira (session ouverte, jamais expirée)

const NOW = Date.UTC(2026, 10, 8, 12);
const DAY = 86_400_000;

function entry(mediaId: number, title: string): WatchingEntry {
  return {
    mediaId,
    malId: mediaId + 1,
    title,
    coverUrl: null,
    progress: 7,
    totalEpisodes: 23,
    updatedAt: NOW - 60 * DAY,
    nextEpisode: null,
    airingStatus: 'FINISHED',
    episodeMinutes: 24,
    listStatus: 'CURRENT',
    platforms: [],
    lastSync: null,
    siteUrl: `https://anilist.co/anime/${mediaId}`,
  };
}

const STATE: DormantState = { entries: [entry(1, 'Frieren'), entry(2, 'Vinland Saga')], thresholdDays: 30, busy: new Set(), bulk: false };

const host = (): DormantHost => ({
  state: createStore(STATE),
  prefs: createStore({ dormantOpen: true }),
  onToggle: vi.fn(),
  onPause: vi.fn(),
  onDrop: vi.fn(),
  onKeep: vi.fn(),
  onPauseAll: vi.fn(),
  onOpenThreshold: vi.fn(),
});

let container: HTMLElement;

beforeEach(() => {
  setLocale('fr');
  container = document.createElement('div');
  document.body.append(container);
});

afterEach(async () => {
  await act(() => render(null, container));
  container.remove();
});

async function confirmText(connected: readonly TrackerId[]): Promise<string> {
  await act(() => render(null, container));
  await act(() => render(<DormantSection host={host()} state={STATE} links={{ connected, preferred: 'anilist' }} now={NOW} />, container));
  const button = container.querySelector<HTMLButtonElement>('[data-focus="dormant-pause-all"]');
  if (!button) throw new Error('« Tout mettre en pause » absent');
  await act(() => button.click());
  return container.querySelector('[data-dormant-body]')?.textContent ?? '';
}

describe('DormantSection : confirmation de « Tout mettre en pause »', () => {
  it('nomme les services connectés, et eux seuls', async () => {
    expect(await confirmText(['anilist', 'mal'])).toContain('Sur AniList et MyAnimeList.');
    expect(await confirmText(['mal'])).toContain('Sur MyAnimeList.');
    expect(await confirmText(['mal'])).not.toContain('AniList et');
  });

  it('session expirée ou en lecture : jamais comptée comme ouverte (contexte des liens du popup)', () => {
    const open: AccountState<unknown> = { status: 'logged-in', viewer: null, error: null };
    expect(hasOpenSession(open)).toBe(true);
    expect(hasOpenSession({ ...LOGGED_OUT, expired: true })).toBe(false);
    expect(hasOpenSession(LOGGED_OUT)).toBe(false);
    expect(hasOpenSession({ status: 'loading' })).toBe(false);
  });
});
