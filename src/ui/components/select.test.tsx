// @vitest-environment happy-dom
import { render, type ComponentChild } from 'preact';
import { useState } from 'preact/hooks';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Select } from './select';

let container: HTMLElement;

const $ = <T extends HTMLElement = HTMLElement>(selector: string): T | null => container.querySelector<T>(selector);
const show = (node: ComponentChild): Promise<void> => act(() => render(node, container));
const press = (target: Element | null, key: string): Promise<void> =>
  act(() => {
    target?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  });

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
});

afterEach(async () => {
  await act(() => render(null, container));
  container.remove();
});

type Player = 'crunchyroll' | 'adn' | 'prime';
const OPTIONS = [
  { value: 'crunchyroll', label: 'Crunchyroll', leading: <img alt="" data-logo="crunchyroll" /> },
  { value: 'adn', label: 'ADN' },
  { value: 'prime', label: 'Prime Video', disabled: true, hint: 'Activer d’abord' },
] as const;

describe('Select', () => {
  const onChange = vi.fn<(value: Player) => void>();

  function Host() {
    const [value, setValue] = useState<Player>('crunchyroll');
    return (
      <Select
        label="Ouvrir les épisodes sur"
        options={OPTIONS}
        value={value}
        focusKey="player"
        onChange={(next) => {
          onChange(next);
          setValue(next);
        }}
      />
    );
  }

  beforeEach(() => onChange.mockReset());

  const trigger = (): HTMLButtonElement | null => $<HTMLButtonElement>('[data-focus="player"]');
  const list = (): HTMLElement | null => $('[role="listbox"]');
  const active = (): string | null | undefined => {
    const id = list()?.getAttribute('aria-activedescendant');
    return id ? container.querySelector(`#${CSS.escape(id)}`)?.getAttribute('data-focus') : null;
  };

  it('bouton nommé par le libellé et la valeur choisie (logo compris), liste fermée', async () => {
    await show(<Host />);
    const button = trigger();
    expect(button?.getAttribute('aria-haspopup')).toBe('listbox');
    expect(button?.getAttribute('aria-expanded')).toBe('false');
    const names = (button?.getAttribute('aria-labelledby') ?? '').split(' ').map((id) => container.querySelector(`#${CSS.escape(id)}`)?.textContent);
    expect(names).toEqual(['Ouvrir les épisodes sur', 'Crunchyroll']);
    expect(button?.querySelector('[data-logo="crunchyroll"]')).not.toBeNull();
    expect(list()).toBeNull();
  });

  it('ouverte : focus sur la liste, option choisie active et cochée, option indisponible annoncée avec son indication', async () => {
    await show(<Host />);
    await act(() => trigger()?.click());
    expect(trigger()?.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(list());
    expect(active()).toBe('player-crunchyroll');
    expect($('[data-focus="player-crunchyroll"]')?.getAttribute('aria-selected')).toBe('true');
    const prime = $('[data-focus="player-prime"]');
    expect(prime?.getAttribute('aria-disabled')).toBe('true');
    expect(prime?.textContent).toContain('Activer d’abord');
  });

  it('clavier : ↓ / Fin déplacent l’option active, Entrée choisit (focus rendu au bouton), option indisponible jamais choisie', async () => {
    await show(<Host />);
    trigger()?.focus();
    await press(trigger(), 'ArrowDown');
    expect(list()).not.toBeNull();
    await press(list(), 'End');
    expect(active()).toBe('player-prime');
    await press(list(), 'Enter');
    expect(onChange).not.toHaveBeenCalled();
    expect(list()).not.toBeNull();
    await press(list(), 'ArrowUp');
    expect(active()).toBe('player-adn');
    await press(list(), 'Enter');
    expect(onChange).toHaveBeenCalledWith('adn');
    expect(list()).toBeNull();
    expect(document.activeElement).toBe(trigger());
    expect($('[data-select-value]')?.textContent).toBe('ADN');
  });

  it('clic : une option disponible se choisit, une indisponible non ; Échap ferme sans choisir', async () => {
    await show(<Host />);
    await act(() => trigger()?.click());
    await act(() => $('[data-focus="player-prime"]')?.click());
    expect(onChange).not.toHaveBeenCalled();
    await act(() => $('[data-focus="player-adn"]')?.click());
    expect(onChange).toHaveBeenCalledWith('adn');
    expect(list()).toBeNull();

    await act(() => trigger()?.click());
    await act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    });
    expect(list()).toBeNull();
    expect(document.activeElement).toBe(trigger());
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('pointeur enfoncé hors de la liste : fermeture', async () => {
    await show(<Host />);
    await act(() => trigger()?.click());
    await act(() => {
      document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    });
    expect(list()).toBeNull();
  });
});
