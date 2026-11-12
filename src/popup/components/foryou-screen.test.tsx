// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '../../i18n';
import { genreKey } from '../../shared/genres';
import { ALL_RECO_FILTER, type RecoFilter, type RecoItem } from '../../shared/recommendations';
import type { RecoView } from '../../ui/reco-controller';
import { createStore } from '../../ui/state';
import { ForYouScreen, MAX_GENRE_CHIPS, type ForYouScreenProps } from './foryou-screen';

// « Pour toi » du popup : puces de genre et de format (seulement avec un lot), puis la vue Discover (le sous-titre est
// celui du titre d'écran, popup-app.tsx)

let container: HTMLElement;
const $ = <T extends HTMLElement = HTMLElement>(selector: string): T | null => container.querySelector<T>(selector);
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  vi.clearAllMocks();
});
afterEach(async () => {
  await act(() => render(null, container));
  container.remove();
});

const current: RecoItem = {
  card: { id: 7, idMal: 70, title: 'Dandadan', format: 'TV', year: 2024, episodes: 12, averageScore: 84, genres: ['Action'], tags: [], coverUrl: null, coverLarge: null, color: null, bannerUrl: null, siteUrl: 'https://anilist.co/anime/7', platforms: [] },
  score: 10,
  reason: null,
};
const GENRES = ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Mystery', 'Romance', 'Sci-Fi', 'Thriller'];
const ready = (filter: RecoFilter = ALL_RECO_FILTER, genres: readonly string[] = GENRES): RecoView => ({ status: 'ready', current, previous: [], cold: false, malOnly: false, added: null, dismissedTitle: null, filter, genres });

const label = (name: string): string => {
  const key = genreKey(name);
  return key ? t(key) : name;
};
const onFilter = vi.fn<(filter: RecoFilter) => void>();
async function show(view: RecoView): Promise<void> {
  const props: ForYouScreenProps = {
    state: createStore<RecoView>(view),
    granted: [],
    onAnother: () => undefined,
    onAdd: () => undefined,
    onDismiss: () => undefined,
    onUndo: () => undefined,
    onRetry: () => undefined,
    onRestore: () => undefined,
    onEnable: () => undefined,
    onOpenAccounts: () => undefined,
    onFilter,
  };
  await act(() => render(<ForYouScreen {...props} />, container));
}
const genreGroup = (): HTMLElement | null => $(`[role="group"][aria-label="${t('panel.nowPlaying.genres')}"]`);
const genreButtons = (): HTMLButtonElement[] => [...(genreGroup()?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
const formatRadios = (): HTMLElement[] => [...container.querySelectorAll<HTMLElement>(`[role="radiogroup"][aria-label="${t('reco.filter.format')}"] [role="radio"]`)];

describe('ForYouScreen', () => {
  it('puces : Tout + 8 genres au plus, le genre choisi toujours présent, aria-pressed ; format Tout / Séries / Films ; onFilter reçoit le filtre complet', async () => {
    expect(MAX_GENRE_CHIPS).toBe(8);
    await show(ready());
    let buttons = genreButtons();
    expect(buttons.map((b) => b.textContent)).toEqual([t('reco.filter.all'), ...GENRES.slice(0, 8).map(label)]);
    expect(buttons[0]?.getAttribute('aria-pressed')).toBe('true');
    expect(buttons.slice(1).every((b) => b.getAttribute('aria-pressed') === 'false')).toBe(true);

    // Un genre au-delà des 8 premiers, choisi : ajouté, pressé
    await show(ready({ genre: 'Thriller', format: 'all' }));
    buttons = genreButtons();
    expect(buttons).toHaveLength(MAX_GENRE_CHIPS + 2);
    expect(buttons.at(-1)?.textContent).toBe(label('Thriller'));
    expect(buttons.filter((b) => b.getAttribute('aria-pressed') === 'true')).toEqual([buttons.at(-1)]);
    expect(buttons[0]?.getAttribute('aria-pressed')).toBe('false');

    // Clic sur un genre : le filtre complet (le format est gardé)
    await show(ready({ genre: null, format: 'movies' }));
    await act(() => genreButtons()[2]?.click());
    expect(onFilter).toHaveBeenLastCalledWith({ genre: GENRES[1], format: 'movies' });
    // Clic sur le genre déjà choisi ou sur « Tout » : genre retiré
    await show(ready({ genre: 'Action', format: 'series' }));
    await act(() => genreButtons()[0]?.click());
    expect(onFilter).toHaveBeenLastCalledWith({ genre: null, format: 'series' });

    // Format : Tout / Séries / Films
    expect(formatRadios().map((r) => r.textContent)).toEqual([t('reco.filter.all'), t('reco.filter.series'), t('reco.filter.movies')]);
    expect(formatRadios()[1]?.getAttribute('aria-checked')).toBe('true');
    await act(() => formatRadios()[2]?.click());
    expect(onFilter).toHaveBeenLastCalledWith({ genre: 'Action', format: 'movies' });
  });

  it('aucune puce pendant le chargement, l’erreur, sans compte', async () => {
    for (const view of [{ status: 'loading' }, { status: 'error', message: 'x' }, { status: 'none' }, { status: 'empty' }] satisfies RecoView[]) {
      await show(view);
      expect(genreGroup()).toBeNull();
      expect(formatRadios()).toHaveLength(0);
    }
  });

  it('filtered : les puces restent, « Retirer le filtre » remet ALL_RECO_FILTER', async () => {
    await show({ status: 'filtered', filter: { genre: null, format: 'movies' }, genres: GENRES });
    expect(genreButtons().length).toBeGreaterThan(1);
    expect(formatRadios()).toHaveLength(3);
    await act(() => $<HTMLButtonElement>('[data-focus="reco-clear-filter"]')?.click());
    expect(onFilter).toHaveBeenLastCalledWith(ALL_RECO_FILTER);
  });
});
