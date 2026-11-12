// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '../../i18n';
import { ALL_RECO_FILTER, type RecoItem } from '../../shared/recommendations';
import type { RecoView } from '../reco-controller';
import { createStore, type Store } from '../state';
import { Discover, type DiscoverProps } from './discover';

// Onglet « Découvrir » : la carte de suggestion et ses états (chargement, démarrage à froid avec « En attendant »,
// note MAL seul, erreur + Réessayer, vide + « Revoir les écartées », aucun compte)

let container: HTMLElement;
const $ = <T extends HTMLElement = HTMLElement>(selector: string): T | null => container.querySelector<T>(selector);
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
});
afterEach(async () => {
  await act(() => render(null, container));
  container.remove();
});

const current: RecoItem = {
  card: { id: 7, idMal: 70, title: 'Dandadan', format: 'TV', year: 2024, episodes: 12, averageScore: 84, genres: ['Action'], tags: [], coverUrl: null, coverLarge: null, color: null, bannerUrl: null, siteUrl: 'https://anilist.co/anime/7', platforms: [] },
  score: 10,
  reason: { seedId: 1, seedTitle: 'Frieren', seedScore: 9, rated: true, matched: ['Action'] },
};
type Ready = Extract<RecoView, { status: 'ready' }>;
const ready = (over: Partial<Ready> = {}): RecoView => ({ status: 'ready', current, previous: [], cold: false, malOnly: false, added: null, dismissedTitle: null, filter: ALL_RECO_FILTER, genres: ['Action'], ...over });

const handlers = {
  onAnother: vi.fn<() => void>(),
  onAdd: vi.fn<() => void>(),
  onDismiss: vi.fn<() => void>(),
  onUndo: vi.fn<() => void>(),
  onRetry: vi.fn<() => void>(),
  onRestore: vi.fn<() => void>(),
  onEnable: vi.fn<() => void>(),
  onOpenAccounts: vi.fn<() => void>(),
  onClearFilter: vi.fn<() => void>(),
};
async function show(view: RecoView): Promise<Store<RecoView>> {
  const state = createStore<RecoView>(view);
  const props: DiscoverProps = { state, granted: [], ...handlers };
  await act(() => render(<Discover {...props} />, container));
  return state;
}
beforeEach(() => vi.clearAllMocks());

describe('Discover', () => {
  it('chargement : message visible, annoncé', async () => {
    await show({ status: 'loading' });
    expect($('[role="status"]')?.textContent).toContain(t('reco.loading'));
  });

  it('prêt : la carte, les actions branchées sur le contrôleur', async () => {
    await show(ready());
    expect(container.textContent).toContain('Dandadan');
    await act(() => $<HTMLButtonElement>('[data-focus="reco-dismiss"]')?.click());
    expect(handlers.onDismiss).toHaveBeenCalled();
    await act(() => $<HTMLButtonElement>('[data-focus="reco-another"]')?.click());
    expect(handlers.onAnother).toHaveBeenCalled();
    expect(container.textContent).not.toContain(t('reco.cold.title'));
    expect(container.textContent).not.toContain(t('reco.malOnly'));
  });

  it('démarrage à froid : explication puis « En attendant » avant la carte', async () => {
    await show(ready({ cold: true }));
    const text = container.textContent ?? '';
    expect(text).toContain(t('reco.cold.title'));
    expect(text).toContain(t('reco.cold.text'));
    expect(text.indexOf(t('reco.cold.meanwhile'))).toBeGreaterThan(text.indexOf(t('reco.cold.text')));
    expect(text.indexOf('Dandadan')).toBeGreaterThan(text.indexOf(t('reco.cold.meanwhile')));
  });

  it('MyAnimeList seul : note de catalogue', async () => {
    await show(ready({ malOnly: true }));
    expect(container.textContent).toContain(t('reco.malOnly'));
  });

  it('erreur : message et Réessayer', async () => {
    await show({ status: 'error', message: 'boom' });
    expect($('[data-alert]')?.getAttribute('data-alert')).toBe(t('reco.error', { error: 'boom' }));
    const retry = [...container.querySelectorAll('button')].find((b) => b.textContent === t('common.retry'));
    await act(() => retry?.click());
    expect(handlers.onRetry).toHaveBeenCalled();
  });

  it('vide : « Plus rien à suggérer » et « Revoir les écartées »', async () => {
    await show({ status: 'empty' });
    expect(container.textContent).toContain(t('reco.empty.title'));
    const review = [...container.querySelectorAll('button')].find((b) => b.textContent === t('reco.empty.action'));
    await act(() => review?.click());
    expect(handlers.onRestore).toHaveBeenCalled();
  });

  it('aucun compte : invitation à en connecter un', async () => {
    await show({ status: 'none' });
    expect(container.textContent).toContain(t('settings.summary.noAccount'));
    const connect = [...container.querySelectorAll('button')].find((b) => b.textContent === t('common.connect'));
    await act(() => connect?.click());
    expect(handlers.onOpenAccounts).toHaveBeenCalled();
  });

  it('suit le store : chargement puis fiche', async () => {
    const state = await show({ status: 'loading' });
    await act(() => state.set(ready()));
    expect(container.textContent).toContain('Dandadan');
  });

  it('filtered : « Aucune série pour ce filtre. » et « Retirer le filtre » appelle onClearFilter', async () => {
    await show({ status: 'filtered', filter: { genre: null, format: 'series' }, genres: ['Action'] });
    expect(container.textContent).toContain(t('compare.filter.empty'));
    expect(container.textContent).not.toContain(t('reco.empty.title'));
    await act(() => $<HTMLButtonElement>('[data-focus="reco-clear-filter"]')?.click());
    expect(handlers.onClearFilter).toHaveBeenCalledTimes(1);
    expect($('[data-focus="reco-clear-filter"]')?.textContent).toBe(t('reco.filter.clear'));
  });
});
