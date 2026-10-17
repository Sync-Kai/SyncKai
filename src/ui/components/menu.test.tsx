// @vitest-environment happy-dom
import { render, type ComponentChild } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Menu, MenuItem, MenuSeparator, SUBMENU_CLOSE_DELAY_MS, SUBMENU_OPEN_DELAY_MS, SubMenu } from './menu';

let container: HTMLElement;

const $ = <T extends HTMLElement = HTMLElement>(selector: string): T | null => container.querySelector<T>(selector);
const show = (node: ComponentChild): Promise<void> => act(() => render(node, container));

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
});

afterEach(async () => {
  await act(() => render(null, container));
  container.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const onPause = vi.fn<() => void>();
const onRemove = vi.fn<() => void>();

function RowMenu({ defaultOpen = false }: { defaultOpen?: boolean }) {
  return (
    <Menu label="Plus d’actions pour Dandadan" menuLabel="Dandadan" defaultOpen={defaultOpen}>
      <MenuItem icon="pause" onSelect={onPause}>
        Mettre en pause
      </MenuItem>
      <SubMenu icon="external" label="Ouvrir la fiche">
        <MenuItem service="anilist" href="https://anilist.co/anime/171018">
          AniList
        </MenuItem>
        <MenuItem service="mal" href="https://myanimelist.net/anime/57334">
          MyAnimeList
        </MenuItem>
      </SubMenu>
      <MenuSeparator />
      <MenuItem icon="trash" danger onSelect={onRemove}>
        Retirer de la liste
      </MenuItem>
    </Menu>
  );
}

const trigger = (): HTMLButtonElement | null => $<HTMLButtonElement>('[data-menu-trigger]');
const menu = (): HTMLElement | null => $('[data-menu]');
const items = (): HTMLElement[] => [...(menu()?.querySelectorAll<HTMLElement>(':scope > [role="menuitem"], :scope > [data-submenu] > [role="menuitem"]') ?? [])];
const subTrigger = (): HTMLElement | null => $('[data-submenu] > [role="menuitem"]');
const subMenu = (): HTMLElement | null => $('[data-submenu] [role="menu"]');
const subItems = (): HTMLElement[] => [...(subMenu()?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
const press = async (key: string, target: Element | null = document.activeElement): Promise<KeyboardEvent> => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  await act(() => {
    (target ?? document.body).dispatchEvent(event);
  });
  return event;
};
const openMenu = async (): Promise<void> => {
  await act(() => trigger()?.click());
};

beforeEach(() => {
  onPause.mockReset();
  onRemove.mockReset();
});

describe('Menu', () => {
  it('bouton « ⋯ » : aria-haspopup="menu", aria-expanded, nom ; menu absent tant qu’il est fermé', async () => {
    await show(<RowMenu />);
    expect(trigger()?.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger()?.getAttribute('aria-expanded')).toBe('false');
    expect(trigger()?.getAttribute('aria-label')).toBe('Plus d’actions pour Dandadan');
    expect(menu()).toBeNull();
  });

  it('ouverture : role="menu" nommé, options role="menuitem" hors tabulation, focus sur la première', async () => {
    await show(<RowMenu />);
    await openMenu();
    expect(trigger()?.getAttribute('aria-expanded')).toBe('true');
    expect(menu()?.getAttribute('role')).toBe('menu');
    expect(menu()?.getAttribute('aria-label')).toBe('Dandadan');
    expect(items()).toHaveLength(3);
    expect(items().every((item) => item.tabIndex === -1)).toBe(true);
    expect(document.activeElement).toBe(items()[0]);
    expect($('[role="separator"]')).not.toBeNull();
  });

  it('flèches en boucle, Début, Fin : options du menu seulement (pas celles du sous-menu fermé)', async () => {
    await show(<RowMenu />);
    await openMenu();
    await press('ArrowDown');
    expect(document.activeElement).toBe(items()[1]);
    await press('ArrowDown');
    expect(document.activeElement).toBe(items()[2]);
    await press('ArrowDown');
    expect(document.activeElement).toBe(items()[0]);
    await press('ArrowUp');
    expect(document.activeElement).toBe(items()[2]);
    await press('Home');
    expect(document.activeElement).toBe(items()[0]);
    await press('End');
    expect(document.activeElement).toBe(items()[2]);
  });

  it('Échap : fermeture, focus rendu au bouton, sans atteindre l’hôte', async () => {
    const host = vi.fn<() => void>();
    container.addEventListener('keydown', host);
    await show(<RowMenu />);
    await openMenu();
    const event = await press('Escape');
    expect(event.defaultPrevented).toBe(true);
    expect(host).not.toHaveBeenCalled();
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(trigger());
    container.removeEventListener('keydown', host);
  });

  it('Tab : fermeture ; pointeur enfoncé dehors : fermeture ; dedans : rien', async () => {
    await show(<RowMenu />);
    await openMenu();
    await press('Tab');
    expect(menu()).toBeNull();
    await openMenu();
    await act(() => {
      items()[0]?.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    });
    expect(menu()).not.toBeNull();
    await act(() => {
      document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    });
    expect(menu()).toBeNull();
  });

  it('choix d’une option : action, fermeture, focus au bouton ; option de danger marquée', async () => {
    await show(<RowMenu />);
    await openMenu();
    expect(items()[2]?.dataset.danger).toBe('');
    expect(items()[2]?.className).toContain('text-danger');
    await act(() => items()[2]?.click());
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it('Entrée sur une option : même action que le clic (bouton natif)', async () => {
    await show(<RowMenu />);
    await openMenu();
    expect(items()[0]?.tagName).toBe('BUTTON');
    await act(() => items()[0]?.click());
    expect(onPause).toHaveBeenCalledTimes(1);
  });

  it('ouvert d’emblée (defaultOpen)', async () => {
    await show(<RowMenu defaultOpen />);
    expect(menu()).not.toBeNull();
  });
});

describe('SubMenu', () => {
  it('entrée : aria-haspopup="menu", aria-expanded="false" ; → ouvre et focalise la première option ; ← referme', async () => {
    await show(<RowMenu />);
    await openMenu();
    await press('ArrowDown');
    expect(document.activeElement).toBe(subTrigger());
    expect(subTrigger()?.getAttribute('aria-haspopup')).toBe('menu');
    expect(subTrigger()?.getAttribute('aria-expanded')).toBe('false');
    expect(subMenu()).toBeNull();
    await press('ArrowRight');
    expect(subTrigger()?.getAttribute('aria-expanded')).toBe('true');
    expect(subMenu()?.getAttribute('aria-label')).toBe('Ouvrir la fiche');
    expect(document.activeElement).toBe(subItems()[0]);
    await press('ArrowDown');
    expect(document.activeElement).toBe(subItems()[1]);
    await press('ArrowDown');
    expect(document.activeElement).toBe(subItems()[0]);
    await press('ArrowLeft');
    expect(subMenu()).toBeNull();
    expect(document.activeElement).toBe(subTrigger());
  });

  it('Entrée et clic ouvrent ; Échap dans le sous-menu ne referme que lui', async () => {
    await show(<RowMenu />);
    await openMenu();
    await press('ArrowDown');
    await press('Enter');
    expect(subMenu()).not.toBeNull();
    expect(document.activeElement).toBe(subItems()[0]);
    await press('Escape');
    expect(subMenu()).toBeNull();
    expect(menu()).not.toBeNull();
    expect(document.activeElement).toBe(subTrigger());
    await act(() => subTrigger()?.click());
    expect(subMenu()).not.toBeNull();
    await act(() => subTrigger()?.click());
    expect(subMenu()).toBeNull();
  });

  it('options du sous-menu : liens dans un nouvel onglet, logo du service ; le choix ferme tout le menu', async () => {
    await show(<RowMenu />);
    await openMenu();
    await act(() => subTrigger()?.click());
    const link = subItems()[0];
    expect(link?.tagName).toBe('A');
    expect(link?.getAttribute('href')).toBe('https://anilist.co/anime/171018');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link?.querySelector('img')?.getAttribute('src')).toBe('/brands/anilist.png');
    await act(() => {
      link?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(menu()).toBeNull();
  });

  it('survol : ouverture après le délai d’intention ; survol trop bref : rien ; survol d’une autre option : fermeture différée', async () => {
    vi.useFakeTimers();
    await show(<RowMenu />);
    await openMenu();
    const entry = (): HTMLElement | null => $('[data-submenu]');
    await act(() => {
      entry()?.dispatchEvent(new MouseEvent('mouseenter'));
    });
    await act(() => {
      vi.advanceTimersByTime(SUBMENU_OPEN_DELAY_MS - 10);
    });
    await act(() => {
      entry()?.dispatchEvent(new MouseEvent('mouseleave'));
    });
    await act(() => {
      vi.advanceTimersByTime(SUBMENU_OPEN_DELAY_MS);
    });
    expect(subMenu()).toBeNull();

    await act(() => {
      entry()?.dispatchEvent(new MouseEvent('mouseenter'));
    });
    await act(() => {
      vi.advanceTimersByTime(SUBMENU_OPEN_DELAY_MS);
    });
    expect(subMenu()).not.toBeNull();
    // Le survol ouvre sans voler le focus clavier
    expect(document.activeElement).toBe(items()[0]);

    await act(() => {
      entry()?.dispatchEvent(new MouseEvent('mouseleave'));
      items()[0]?.dispatchEvent(new MouseEvent('mouseenter'));
    });
    await act(() => {
      vi.advanceTimersByTime(SUBMENU_CLOSE_DELAY_MS - 10);
    });
    expect(subMenu()).not.toBeNull();
    await act(() => {
      vi.advanceTimersByTime(20);
    });
    expect(subMenu()).toBeNull();
  });

  it('retour sur l’entrée avant la fermeture différée : le sous-menu reste ouvert', async () => {
    vi.useFakeTimers();
    await show(<RowMenu />);
    await openMenu();
    const entry = (): HTMLElement | null => $('[data-submenu]');
    await act(() => subTrigger()?.click());
    await act(() => {
      entry()?.dispatchEvent(new MouseEvent('mouseleave'));
    });
    await act(() => {
      vi.advanceTimersByTime(SUBMENU_CLOSE_DELAY_MS / 2);
    });
    await act(() => {
      entry()?.dispatchEvent(new MouseEvent('mouseenter'));
    });
    await act(() => {
      vi.advanceTimersByTime(SUBMENU_CLOSE_DELAY_MS * 2);
    });
    expect(subMenu()).not.toBeNull();
  });
});

describe('Menu : nettoyage', () => {
  it('écouteurs du document posés à l’ouverture seulement, retirés à la fermeture et au démontage', async () => {
    const add = vi.spyOn(document, 'addEventListener');
    const remove = vi.spyOn(document, 'removeEventListener');
    await show(<RowMenu />);
    expect(add).not.toHaveBeenCalled();
    await openMenu();
    const added = add.mock.calls.map(([type]) => type).sort();
    expect(added).toEqual(['keydown', 'pointerdown']);
    await press('Escape');
    expect(remove.mock.calls.map(([type]) => type)).toEqual(expect.arrayContaining(['keydown', 'pointerdown']));

    remove.mockClear();
    await openMenu();
    await act(() => render(null, container));
    expect(remove.mock.calls.map(([type]) => type)).toEqual(expect.arrayContaining(['keydown', 'pointerdown']));
  });

  it('démontage pendant un délai de survol : minuterie annulée', async () => {
    vi.useFakeTimers();
    await show(<RowMenu />);
    await openMenu();
    await act(() => {
      $('[data-submenu]')?.dispatchEvent(new MouseEvent('mouseenter'));
    });
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    await act(() => render(null, container));
    expect(vi.getTimerCount()).toBe(0);
  });
});
