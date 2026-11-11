// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale, t, tp } from '../../i18n';
import { activitySummary, type ActivityHistory } from '../../shared/activity-history';
import type { AniListViewer } from '../../shared/anilist.types';
import type { MalViewer } from '../../shared/mal.types';
import type { ProfileStats } from '../../shared/profile-stats';
import type { TrackerId } from '../../shared/tracker.types';
import { createStore, LOGGED_OUT } from '../../ui/state';
import type { StatsView } from '../controllers/stats';
import { scoreBuckets, StatsScreen, StatsServiceControl, type StatsScreenProps } from './stats-screen';

// Écran Stats du popup : activité locale (période, barres, « depuis le … »), « En cours », puis les blocs du profil
// « Depuis le début » ; MAL n'a ni genres, ni formats, ni notes, ni studios, ni décennies

let container: HTMLElement;
const $ = <T extends HTMLElement = HTMLElement>(selector: string): T | null => container.querySelector<T>(selector);
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

const NOW = new Date(2026, 10, 11, 12).getTime();

const ANILIST_PROFILE: ProfileStats = {
  scoreFormat: 'POINT_10',
  meanScore100: 76,
  statuses: [
    { status: 'COMPLETED', count: 168 },
    { status: 'CURRENT', count: 12 },
  ],
  formats: [
    { format: 'TV', count: 152 },
    { format: 'MOVIE', count: 21 },
  ],
  genres: [
    { genre: 'Action', count: 112, meanScore100: 77 },
    { genre: 'Isekai', count: 3, meanScore100: null },
  ],
  scores: [
    { score: 7, count: 41 },
    { score: 8, count: 58 },
  ],
  studios: [{ name: 'MAPPA', count: 14 }],
  decades: [
    { decade: 2010, count: 92 },
    { decade: 2020, count: 80 },
  ],
  rewatched: null,
};
const MAL_PROFILE: ProfileStats = { ...ANILIST_PROFILE, formats: [], genres: [], scores: [], studios: [], decades: [], meanScore100: 78, rewatched: 14 };
const ANILIST: AniListViewer = { id: 7, name: 'A', siteUrl: 'https://anilist.co/user/7', avatarUrl: null, stats: { animeCount: 196, episodes: 3482, days: 58 }, profile: ANILIST_PROFILE };
const MAL: MalViewer = { id: 9, name: 'M', pictureUrl: null, stats: { animeCount: 231, episodes: 3910, days: 65 }, profile: MAL_PROFILE };
const HISTORY: ActivityHistory = { anilist: { accountId: 7, days: { '2026-10-26': [5, 118], '2026-11-10': [1, 24] } }, mal: { accountId: 9, days: { '2026-11-09': [2, 48] } } };

function view(overrides: Partial<StatsView> = {}): StatsView {
  const service = overrides.service === undefined ? 'anilist' : overrides.service;
  const period = overrides.period ?? '30d';
  return {
    service,
    services: ['anilist', 'mal'],
    period,
    account: { status: 'logged-in', viewer: service === 'mal' ? MAL : ANILIST, error: null },
    refreshing: false,
    activity: activitySummary(HISTORY, service ?? 'anilist', service === 'mal' ? 9 : 7, period, NOW),
    remaining: '≈ 6 h à rattraper · 4 séries',
    ...overrides,
  };
}

const handlers = {
  onService: vi.fn<(service: TrackerId) => void>(),
  onPeriod: vi.fn(),
  onReconnect: vi.fn<(service: TrackerId) => void>(),
  onRetry: vi.fn(),
  onOpenAccounts: vi.fn(),
};

async function show(state: StatsView): Promise<void> {
  const props: StatsScreenProps = { state: createStore(state), now: NOW, ...handlers };
  await act(() => render(<StatsScreen {...props} />, container));
}

const textOf = (): string => container.textContent ?? '';

describe('StatsScreen', () => {
  it('contrôle AniList / MAL seulement avec deux comptes', async () => {
    await act(() => render(<StatsServiceControl state={createStore(view())} onService={handlers.onService} />, container));
    const group = $('[role="radiogroup"]');
    expect(group?.getAttribute('aria-label')).toBe(t('stats.service'));
    expect($$('[role="radio"]').map((radio) => radio.textContent)).toEqual(['AniList', 'MAL']);
    await act(() => $$('[role="radio"]')[1]?.click());
    expect(handlers.onService).toHaveBeenCalledWith('mal');
    await act(() => render(<StatsServiceControl state={createStore(view({ services: ['anilist'] }))} onService={handlers.onService} />, container));
    expect($('[role="radiogroup"]')).toBeNull();
    await act(() => render(<StatsServiceControl state={createStore<StatsView | null>(null)} onService={handlers.onService} />, container));
    expect($('[role="radiogroup"]')).toBeNull();
  });

  it('AniList : tuiles, statuts, note moyenne et notes, genres (nom brut inconnu), formats, studios, décennies', async () => {
    await show(view());
    const text = textOf();
    expect(text).toContain(t('stats.allTime'));
    expect(text).toContain(new Intl.NumberFormat('fr').format(3482));
    for (const key of ['stats.statuses', 'stats.scores', 'stats.meanScore', 'panel.nowPlaying.genres', 'stats.formats', 'stats.studios', 'stats.decades'] as const) expect(text).toContain(t(key));
    expect(text).toContain(t('page.status.COMPLETED'));
    expect(text).toContain('7,6');
    expect(text).toContain(t('genre.action'));
    expect(text).toContain('Isekai');
    expect(text).toContain(t('review.format.movie'));
    expect(text).toContain('MAPPA');
    expect(text).toContain(t('stats.decade', { decade: 2010 }));
    // Terminé avant En cours (ordre fixe), barre de la valeur la plus grande à 100 %
    const rows = $$('[data-stats-block="statuses"] [data-bar-row]');
    expect(rows.map((row) => row.dataset.barRow)).toEqual(['CURRENT', 'COMPLETED']);
    expect(rows[1]?.querySelector<HTMLElement>('[data-bar]')?.style.width).toBe('100%');
  });

  it('MAL : ni genres, ni formats, ni notes, ni studios, ni décennies ; revisionnages affichés', async () => {
    await show(view({ service: 'mal' }));
    const text = textOf();
    for (const key of ['panel.nowPlaying.genres', 'stats.formats', 'stats.scores', 'stats.studios', 'stats.decades'] as const) expect(text).not.toContain(t(key));
    expect(text).toContain(tp('stats.rewatched', 14));
    expect(text).toContain(t('stats.meanScore'));
    expect(text).toContain('7,8');
    expect(text).toContain(t('page.status.COMPLETED'));
  });

  it('« depuis le … » quand la période commence avant le premier jour', async () => {
    // Premier jour le 26 oct. : 30 j (depuis le 13 oct.) commence avant, 7 j (depuis le 5 nov.) après
    await show(view());
    expect($('[data-activity-since]')?.textContent).toBe(t('stats.since', { date: '26 oct.' }));
    await show(view({ period: '7d', activity: activitySummary(HISTORY, 'anilist', 7, '7d', NOW) }));
    expect($('[data-activity-since]')).toBeNull();
    // Rien d'enregistré : depuis aujourd'hui, et le message à la place des barres
    await show(view({ activity: activitySummary({}, 'anilist', 7, '30d', NOW) }));
    expect($('[data-activity-since]')?.textContent).toBe(t('stats.since', { date: '11 nov.' }));
    expect(textOf()).toContain(t('stats.activity.empty'));
    expect($('[data-stats-block="activity"] [data-bar-columns]')).toBeNull();
  });

  it('session expirée : Reconnecter, activité locale toujours affichée', async () => {
    await show(view({ account: { ...LOGGED_OUT, expired: true } }));
    expect(textOf()).toContain(t('common.sessionExpired'));
    expect(textOf()).toContain(tp('accountMenu.week.value', 6));
    expect(textOf()).not.toContain(t('stats.allTime'));
    const reconnect = $$('button').find((button) => button.textContent === t('common.reconnect'));
    await act(() => reconnect?.click());
    expect(handlers.onReconnect).toHaveBeenCalledWith('anilist');
  });

  it('aucun compte : Connecter', async () => {
    await show(view({ service: null, services: [], account: LOGGED_OUT }));
    expect(textOf()).toContain(t('settings.summary.noAccount'));
    expect(textOf()).not.toContain(t('stats.activity'));
    const connect = $$('button').find((button) => button.textContent === t('common.connect'));
    await act(() => connect?.click());
    expect(handlers.onOpenAccounts).toHaveBeenCalledTimes(1);
  });

  it('profil illisible sans cache : alerte et Réessayer ; en lecture : pavés', async () => {
    await show(view({ account: { status: 'logged-in', viewer: null, error: 'AniList injoignable' } }));
    expect(textOf()).toContain('AniList injoignable');
    const retry = $$('button').find((button) => button.textContent === t('common.retry'));
    await act(() => retry?.click());
    expect(handlers.onRetry).toHaveBeenCalledTimes(1);
    await show(view({ account: { status: 'logged-in', viewer: null, error: null } }));
    expect($$('[data-skeleton]').length).toBeGreaterThan(0);
    expect($('[data-stats-block="statuses"]')).toBeNull();
  });

  it('barres : aria-hidden, valeurs lisibles en texte', async () => {
    await show(view());
    const chart = $('[data-stats-block="activity"] [data-bar-columns]');
    expect(chart?.getAttribute('aria-hidden')).toBe('true');
    // 30 barres, hauteur en % du pic (5 épisodes le 26 oct.)
    const bars = $$('[data-stats-block="activity"] [data-bar-columns] [data-bar]');
    expect(bars).toHaveLength(30);
    expect(bars.map((bar) => bar.style.height).filter((height) => height !== '')).toEqual(['100%', '20%']);
    expect(bars.every((bar) => bar.closest('[title]') !== null)).toBe(true);
    // Équivalent texte : un élément par barre non vide
    const spoken = $$('[data-stats-block="activity"] [data-bar-list] li').map((item) => item.textContent);
    expect(spoken).toHaveLength(2);
    expect(spoken[0]).toContain('26 oct.');
    expect(spoken[0]).toContain(tp('accountMenu.week.value', 5));
    // Lignes : la barre seule est masquée, libellé et valeur restent lus
    const row = $('[data-stats-block="statuses"] [data-bar-row="COMPLETED"]');
    expect(row?.querySelector('[data-bar]')?.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(row?.textContent).toContain('168');
  });
});

describe('scoreBuckets', () => {
  it('POINT_100 : paliers de 5 regroupés par 10 ; POINT_10_DECIMAL par point ; POINT_3 : 1 à 3', () => {
    const hundred = scoreBuckets(
      [
        { score: 5, count: 1 },
        { score: 10, count: 2 },
        { score: 65, count: 3 },
        { score: 70, count: 4 },
        { score: 100, count: 5 },
      ],
      'POINT_100',
    );
    expect(hundred.map((bucket) => bucket.score)).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    expect(hundred.map((bucket) => bucket.count)).toEqual([3, 0, 0, 0, 0, 3, 4, 0, 0, 5]);
    const decimal = scoreBuckets([{ score: 6.5, count: 2 }, { score: 7, count: 1 }], 'POINT_10_DECIMAL');
    expect(decimal).toHaveLength(10);
    expect(decimal[5]).toEqual({ score: 6, count: 2 });
    expect(decimal[6]).toEqual({ score: 7, count: 1 });
    // Palier [n, n+1) : 7,5 reste dans la colonne 7, 85 (POINT_100) dans la colonne 80
    expect(scoreBuckets([{ score: 7.5, count: 1 }], 'POINT_10_DECIMAL')[6]).toEqual({ score: 7, count: 1 });
    expect(scoreBuckets([{ score: 85, count: 1 }], 'POINT_100')[7]).toEqual({ score: 80, count: 1 });
    expect(scoreBuckets([{ score: 2, count: 4 }], 'POINT_3')).toEqual([
      { score: 1, count: 0 },
      { score: 2, count: 4 },
      { score: 3, count: 0 },
    ]);
  });
});
