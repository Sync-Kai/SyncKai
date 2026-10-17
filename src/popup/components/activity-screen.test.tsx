// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n';
import { exclusionKey } from '../../platforms/series-identity';
import type { PendingRating } from '../../shared/engagement.types';
import type { EpisodeInfo } from '../../shared/episode.types';
import type { SyncQueueItem } from '../../shared/queue.types';
import type { PendingReview, RecentSync } from '../../shared/review.types';
import type { CompareState } from '../../ui/compare-controller';
import { createStore, type AccountState, type ExclusionsState } from '../../ui/state';
import type { QueueState, RatingsState, SyncData } from '../state';
import { ActivityScreen, type ActivityScreenProps } from './activity-screen';
import type { WatchingContext } from './watching-screen';

setLocale('fr');

const NOW = Date.UTC(2026, 9, 17, 12);
const MIN = 60_000;

let container: HTMLElement;
const $ = <T extends HTMLElement = HTMLElement>(selector: string): T | null => container.querySelector<T>(selector);
const key = <T extends HTMLElement = HTMLElement>(focus: string): T | null => $<T>(`[data-focus="${focus}"]`);
const headings = (): string[] => [...container.querySelectorAll('h2')].map((h) => h.textContent ?? '');

const episode = (title: string, number: number): EpisodeInfo => ({
  platform: 'crunchyroll',
  episodeId: `${title}${number}`,
  seriesId: title,
  seriesSlug: title.toLowerCase(),
  animeTitle: title,
  seasonNumber: 1,
  seasonTitle: null,
  seasonEpisodeNumber: number,
  displayedEpisodeNumber: number,
  episodeTitle: null,
  url: `https://www.crunchyroll.com/watch/${title}${number}`,
});

const queueItem = (id: string, status: SyncQueueItem['status']): SyncQueueItem => ({
  id,
  episode: episode(id, 4),
  services: status === 'failed' ? ['mal'] : null,
  attempts: 3,
  status,
  nextAttemptAt: NOW + 5 * MIN,
  firstFailedAt: NOW - 60 * MIN,
  lastError: 'MyAnimeList ne répond pas (délai dépassé).',
});

const RATING: PendingRating = { id: 'anilist:21', mediaId: 21, malId: 33, title: 'Berserk (2016)', coverUrl: null, completedAt: NOW - 120 * MIN };
const REVIEW: PendingReview = {
  key: 'crunchyroll:Mushoku:s2',
  episode: episode('Mushoku', 5),
  reason: 'Trouvée par le titre seul',
  suggestion: null,
  candidates: [{ id: 146065, title: 'Mushoku Tensei II', format: 'TV', episodes: 12, year: 2023, coverUrl: null }],
  previous: null,
  createdAt: 1,
};
const sync = (k: string, title: string, mediaId: number): RecentSync => ({ key: k, episode: episode(title, 6), mediaId, malId: mediaId + 1, mediaTitle: `${title} (fiche)`, progress: 6, syncedAt: NOW });

const loggedIn: AccountState<unknown> = { status: 'logged-in', viewer: null } as unknown as AccountState<unknown>;
const loggedOut: AccountState<unknown> = { status: 'logged-out' } as unknown as AccountState<unknown>;

interface Setup {
  props: ActivityScreenProps;
  sync: ReturnType<typeof createStore<SyncData>>;
  queue: ReturnType<typeof createStore<QueueState>>;
  ratings: ReturnType<typeof createStore<RatingsState>>;
}

function setup(patch: { mal?: AccountState<unknown>; anilist?: AccountState<unknown>; exclusions?: ExclusionsState; compare?: Partial<CompareState> } = {}): Setup {
  const sync = createStore<SyncData>({ reviews: [], recentSyncs: [], busyKey: null, recentError: null });
  const queue = createStore<QueueState>({ items: [], busyIds: new Set(), notice: null, error: null });
  const ratings = createStore<RatingsState>({ items: [], busyIds: new Set(), errors: new Map(), notice: null, error: null });
  const context: WatchingContext = { preferredPlayer: 'crunchyroll', optionalPlatforms: [], entryLinks: { connected: ['anilist', 'mal'], preferred: 'anilist' } };
  const compare: CompareState = { result: null, job: null, requesting: null, error: null, confirm: null, filter: 'all', shown: 20, ...patch.compare };
  const props: ActivityScreenProps = {
    accounts: { anilist: createStore(patch.anilist ?? loggedIn), mal: createStore(patch.mal ?? loggedIn) },
    sync,
    queue,
    ratings,
    exclusions: createStore<ExclusionsState>(patch.exclusions ?? { status: 'ready', items: [] }),
    context: createStore(context),
    compare: createStore(compare),
    now: NOW,
    reviewActions: { search: vi.fn(), confirm: vi.fn(), dismiss: vi.fn(), exclude: vi.fn() },
    onRetryQueued: vi.fn(),
    onAbandonQueued: vi.fn(),
    onRate: vi.fn(),
    onIgnoreRating: vi.fn(),
    onCorrect: vi.fn(),
    onExcludeRecent: vi.fn(),
    onOpenCompare: vi.fn(),
  };
  return { props, sync, queue, ratings };
}

const mount = (props: ActivityScreenProps): Promise<void> => act(() => render(<ActivityScreen {...props} />, container));

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
});

afterEach(async () => {
  await act(() => render(null, container));
  container.remove();
});

describe('ActivityScreen', () => {
  it('vide : « À vérifier » et « Dernières synchros » seules, avec leur état vide ; ligne des écarts sans compteur', async () => {
    const { props } = setup();
    await mount(props);
    expect(headings()).toEqual(['À vérifier', 'Dernières synchros']);
    expect($('[data-review-empty]')?.textContent).toBe('Rien à vérifier pour le moment.');
    expect(container.textContent).toContain('Aucune synchro pour l’instant.');
    expect(key('activity-compare')).not.toBeNull();
    expect($('[data-diff-count]')).toBeNull();
  });

  it('écarts : compteur après une analyse ; un seul compte : pas de ligne', async () => {
    const { props } = setup({ compare: { result: { items: [{}, {}, {}] } as unknown as CompareState['result'] } });
    await mount(props);
    expect($('[data-diff-count]')?.textContent).toBe('3');
    await act(() => key('activity-compare')?.click());
    expect(props.onOpenCompare).toHaveBeenCalled();
    await act(() => render(null, container));
    await mount(setup({ mal: loggedOut }).props);
    expect(key('activity-compare')).toBeNull();
  });

  it('file : « Échec » puis « En attente », compte dans le titre ; Réessayer / Abandonner ; envoi : indicateur, Abandonner grisé', async () => {
    const { props, queue } = setup();
    queue.set({ items: [queueItem('Frieren', 'pending'), queueItem('Dandadan', 'failed')], busyIds: new Set(), notice: null, error: null });
    await mount(props);
    expect(headings().slice(0, 2)).toEqual(['Échec · 1', 'En attente · 1']);
    const failed = $('[data-queue-item="failed"]');
    expect(failed?.textContent).toContain('Dandadan · S1 E4');
    expect(failed?.textContent).toContain('Crunchyroll → MyAnimeList');
    expect(failed?.textContent).toContain('Échec — abandonné');
    expect(key('queue-retry-Dandadan')?.getAttribute('data-variant')).toBe('primary');
    expect($('[data-queue-item="pending"]')?.textContent).toContain('Nouvel essai dans 5 min');
    expect(key('queue-retry-Frieren')?.getAttribute('data-variant')).toBe('secondary');
    await act(() => key('queue-retry-Dandadan')?.click());
    expect(props.onRetryQueued).toHaveBeenCalledWith('Dandadan');
    await act(() => key('queue-drop-Frieren')?.click());
    expect(props.onAbandonQueued).toHaveBeenCalledWith('Frieren');

    await act(() => queue.set({ ...queue.get(), busyIds: new Set(['Dandadan']) }));
    expect(key('queue-retry-Dandadan')?.getAttribute('aria-busy')).toBe('true');
    expect(key<HTMLButtonElement>('queue-drop-Dandadan')?.disabled).toBe(true);
  });

  it('file vidée après un réessai : le résultat reste affiché seul quelques secondes ; erreur de lecture', async () => {
    const { props, queue } = setup();
    queue.set({ items: [], busyIds: new Set(), notice: { tone: 'success', text: 'Frieren : AniList : épisode 7 enregistré', detail: 'détail' }, error: 'Impossible de lire les synchros en attente.' });
    await mount(props);
    expect($('[data-feedback="success"]')?.textContent).toBe('Frieren : AniList : épisode 7 enregistré');
    expect($('[data-alert]')?.textContent).toBe('Impossible de lire les synchros en attente.');
    expect(headings()[0]).toBe('À vérifier');
  });

  it('À noter : 10 étoiles, clic envoie la note ; envoi : indicateur à la place d’« Ignorer » ; échec sous la carte ; lien de la fiche', async () => {
    const { props, ratings } = setup();
    ratings.set({ items: [RATING], busyIds: new Set(), errors: new Map(), notice: null, error: null });
    await mount(props);
    expect(headings()[0]).toBe('À noter · 1');
    expect(container.textContent).toContain('Terminé il y a 2 h');
    expect(key('rate-entry-anilist:21')?.getAttribute('href')).toBe('https://anilist.co/anime/21');
    const slider = key('rate-anilist:21');
    expect(slider?.getAttribute('role')).toBe('slider');
    expect(slider?.getAttribute('aria-label')).toBe('Noter Berserk (2016)');
    expect(slider?.querySelectorAll('[data-star]')).toHaveLength(10);
    await act(() => {
      slider?.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    });
    await act(() => {
      slider?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(props.onRate).toHaveBeenCalledWith(RATING, 10);
    await act(() => key('rate-ignore-anilist:21')?.click());
    expect(props.onIgnoreRating).toHaveBeenCalledWith(RATING);

    await act(() => ratings.set({ ...ratings.get(), busyIds: new Set([RATING.id]) }));
    expect(key('rate-ignore-anilist:21')).toBeNull();
    expect($('[role="status"][aria-label="Enregistrement de la note…"]')).not.toBeNull();
    expect(slider?.getAttribute('aria-disabled')).toBe('true');
    expect($('[data-star-value]')?.textContent).toBe('10/10');

    await act(() => ratings.set({ ...ratings.get(), busyIds: new Set(), errors: new Map([[RATING.id, 'Échec sur MyAnimeList, réessaie']]) }));
    expect($('[data-rating-item] [data-alert]')?.textContent).toBe('Échec sur MyAnimeList, réessaie');
    expect($('[data-star-value]')?.textContent).toBe('10/10');
  });

  it('À noter : note enregistrée (carte partie) : bandeau seul ; erreur de lecture', async () => {
    const { props, ratings } = setup();
    ratings.set({ items: [], busyIds: new Set(), errors: new Map(), notice: { tone: 'success', text: 'Note 8,5/10 enregistrée · Berserk (2016)', detail: '' }, error: null });
    await mount(props);
    expect(headings()[0]).toBe('À noter');
    expect($('[data-feedback="success"]')?.textContent).toBe('Note 8,5/10 enregistrée · Berserk (2016)');
  });

  it('À vérifier : compte dans le titre, une carte par saison', async () => {
    const { props, sync } = setup();
    sync.set({ reviews: [REVIEW], recentSyncs: [], busyKey: null, recentError: null });
    await mount(props);
    expect(headings()[0]).toBe('À vérifier · 1');
    expect($(`[data-review="${REVIEW.key}"]`)).not.toBeNull();
  });

  it('aucun compte connecté : ni file, ni notes, ni cartes', async () => {
    const { props, sync, queue, ratings } = setup({ anilist: loggedOut, mal: loggedOut });
    sync.set({ reviews: [REVIEW], recentSyncs: [], busyKey: null, recentError: null });
    queue.set({ items: [queueItem('Frieren', 'failed')], busyIds: new Set(), notice: null, error: null });
    ratings.set({ items: [RATING], busyIds: new Set(), errors: new Map(), notice: null, error: null });
    await mount(props);
    expect(headings()).toEqual(['À vérifier', 'Dernières synchros']);
    expect($('[data-review]')).toBeNull();
  });

  it('dernières synchros : lien, « Corriger », « À vérifier ↑ » déjà ouverte, correction en cours, série exclue', async () => {
    const frieren = sync('cr:frieren', 'Frieren', 154587);
    const mushoku = { ...sync(REVIEW.key, 'Mushoku', 146065) };
    const onePiece = sync('cr:op', 'One Piece', 21);
    const { props, sync: store } = setup({ exclusions: { status: 'ready', items: [{ id: 'x', platformKey: exclusionKey(onePiece.episode), mediaId: null, label: 'One Piece', excludedAt: NOW }] } });
    store.set({ reviews: [REVIEW], recentSyncs: [frieren, mushoku, onePiece], busyKey: null, recentError: null });
    await mount(props);
    expect(key('recent-entry-cr:frieren')?.textContent).toBe('Frieren · E6');
    expect(key('recent-entry-cr:frieren')?.getAttribute('href')).toBe('https://anilist.co/anime/154587');
    expect($('[data-recent="cr:frieren"]')?.textContent).toContain('→ Frieren (fiche) · épisode 6');
    await act(() => key('correct-cr:frieren')?.click());
    expect(props.onCorrect).toHaveBeenCalledWith('cr:frieren');
    expect(key(`correct-${REVIEW.key}`)?.textContent).toBe('À vérifier ↑');
    expect(key<HTMLButtonElement>(`correct-${REVIEW.key}`)?.disabled).toBe(true);
    expect($('[data-recent="cr:op"] [data-recent-excluded]')?.textContent).toBe('Exclue');
    expect(key('exclude-cr:op')).toBeNull();
    await act(() => key('exclude-cr:frieren')?.click());
    expect(props.onExcludeRecent).toHaveBeenCalledWith(frieren);

    await act(() => store.set({ ...store.get(), busyKey: 'cr:frieren', recentError: 'Synchronisation introuvable.' }));
    expect(key('correct-cr:frieren')?.getAttribute('aria-busy')).toBe('true');
    expect(key<HTMLButtonElement>('correct-cr:op')?.disabled).toBe(true);
    expect($('[data-alert]')?.textContent).toBe('Synchronisation introuvable.');
  });
});
