// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '../../i18n';
import type { ImportActions } from '../actions';
import { state, type PageState, type StepAlert } from '../state';
import { PlatformChoice } from './platform-choice';

let container: HTMLElement;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
});

afterEach(async () => {
  await act(() => render(null, container));
  container.remove();
});

function actions(): ImportActions {
  return {
    choosePlatform: vi.fn(),
    openPlatform: vi.fn(),
    requestAccess: vi.fn(),
    read: vi.fn(),
    stopReading: vi.fn(),
    showTab: vi.fn(),
    reloadTab: vi.fn(),
    cancelJob: vi.fn(),
    restart: vi.fn(),
    toggleItem: vi.fn(),
    toggleAll: vi.fn(),
    applySelected: vi.fn(),
    toggleReview: vi.fn(),
    createReviews: vi.fn(),
    setUpToDateOpen: vi.fn(),
    dismissJob: vi.fn(),
  };
}

function page(patch: Partial<PageState> = {}): PageState {
  return {
    ...state,
    loaded: true,
    platforms: {
      crunchyroll: { access: true, tabId: 7, tabTitle: 'Crunchyroll' },
      adn: { access: true, tabId: null, tabTitle: null },
      netflix: { access: false, tabId: null, tabTitle: null },
    },
    ...patch,
  };
}

async function show(p: PageState, a: ImportActions, opening = false, alert: StepAlert | null = null): Promise<void> {
  await act(() => render(<PlatformChoice page={p} step={{ kind: 'connect', opening, alert }} actions={a} />, container));
}

const tiles = (): string[] => [...container.querySelectorAll<HTMLElement>('[data-platform-tile]')].map((el) => `${el.dataset.platformTile}:${el.dataset.status}`);
const focus = (key: string): HTMLElement | null => container.querySelector(`[data-focus="${key}"]`);

describe('import, étape 1 : choix de la plateforme', () => {
  it('une tuile par plateforme avec son état ; la plateforme choisie est cochée', async () => {
    await show(page(), actions());
    expect(tiles()).toEqual(['crunchyroll:ready', 'adn:none', 'netflix:access']);
    expect((focus('platform-crunchyroll') as HTMLInputElement).checked).toBe(true);
    expect(container.querySelector('[data-platform-tile="adn"]')?.textContent).toContain(t('crImport.tile.none'));
  });

  it('autre tuile choisie : l’action reçoit la plateforme', async () => {
    const a = actions();
    await show(page(), a);
    await act(() => focus('platform-adn')?.click());
    expect(a.choosePlatform).toHaveBeenCalledWith('adn');
  });

  it('onglet prêt : règles et « Lire mon historique » sur cet onglet', async () => {
    const a = actions();
    await show(page(), a);
    expect(container.textContent).toContain(t('crImport.rule.never'));
    expect(container.querySelector('[data-action-bar]')?.textContent).toContain(t('crImport.connect.foundTitled', { platform: 'Crunchyroll', site: 'www.crunchyroll.com', title: 'Crunchyroll' }));
    await act(() => focus('cr-read')?.click());
    expect(a.read).toHaveBeenCalledWith(7);
  });

  it('aucun onglet, puis en attente de l’onglet ouvert : « Ouvrir ADN », occupé pendant l’attente', async () => {
    const a = actions();
    await show(page({ platform: 'adn' }), a);
    expect(container.querySelector('[data-action-bar]')?.getAttribute('data-action-bar')).toBe('none');
    await act(() => focus('cr-open')?.click());
    expect(a.openPlatform).toHaveBeenCalledTimes(1);
    await show(page({ platform: 'adn' }), a, true);
    expect(tiles()[1]).toBe('adn:waiting');
    expect(focus('cr-open')?.getAttribute('aria-busy')).toBe('true');
  });

  it('accès à autoriser (Netflix) : ni règles ni lecture, « Autoriser l’accès » demande l’accès de Netflix', async () => {
    const a = actions();
    await show(page({ platform: 'netflix' }), a);
    expect(container.textContent).toContain(t('crImport.connect.netflixAccess'));
    expect(container.textContent).not.toContain(t('crImport.rule.never'));
    expect(focus('cr-read')).toBeNull();
    await act(() => focus('cr-access')?.click());
    expect(a.requestAccess).toHaveBeenCalledWith('netflix');
  });

  it('aucun compte connecté : les tuiles et l’alerte seulement', async () => {
    await show(page({ connected: false }), actions());
    expect(tiles()).toHaveLength(3);
    expect(container.querySelector('[data-alert]')?.getAttribute('data-alert')).toBe(t('crImport.error.notConnected'));
    expect(container.querySelector('[data-action-bar]')).toBeNull();
    expect(container.textContent).not.toContain(t('crImport.rule.never'));
  });

  it('lecture refusée : erreur avec « Afficher l’onglet », ou « Recharger l’onglet » quand le lecteur est muet', async () => {
    const a = actions();
    await show(page(), a, false, { text: 'Connecte-toi', tone: 'error', reloadTabId: null });
    await act(() => focus('cr-show-tab')?.click());
    expect(a.showTab).toHaveBeenCalledWith(7);
    await show(page(), a, false, { text: 'Muet', tone: 'error', reloadTabId: 7 });
    expect(focus('cr-show-tab')).toBeNull();
    await act(() => focus('cr-reload')?.click());
    expect(a.reloadTab).toHaveBeenCalledWith(7);
  });

  it('historique vide : information, pas une alerte', async () => {
    await show(page(), actions(), false, { text: 'Aucun épisode terminé', tone: 'info', reloadTabId: null });
    expect(container.querySelector('[data-feedback="info"]')?.textContent).toBe('Aucun épisode terminé');
    expect(container.querySelector('[data-alert]')).toBeNull();
  });
});
