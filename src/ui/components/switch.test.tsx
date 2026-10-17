// @vitest-environment happy-dom
import { render, type ComponentChild } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Switch } from './switch';

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
});

describe('Switch', () => {
  const onChange = vi.fn<(checked: boolean) => void>();
  const key = (el: Element | null, type: 'keydown' | 'keyup', name: string): KeyboardEvent => {
    const event = new KeyboardEvent(type, { key: name, bubbles: true, cancelable: true });
    el?.dispatchEvent(event);
    return event;
  };

  beforeEach(() => {
    onChange.mockReset();
  });

  it('role="switch" et aria-checked, nom accessible', async () => {
    await show(<Switch checked label="Synchro automatique" onChange={onChange} />);
    const button = $('button');
    expect(button?.getAttribute('role')).toBe('switch');
    expect(button?.getAttribute('aria-checked')).toBe('true');
    expect(button?.getAttribute('aria-label')).toBe('Synchro automatique');
    await show(<Switch checked={false} label="Synchro automatique" onChange={onChange} />);
    expect(button?.getAttribute('aria-checked')).toBe('false');
  });

  it('clic : bascule vers la valeur inverse', async () => {
    await show(<Switch checked={false} label="Alertes" onChange={onChange} />);
    $('button')?.click();
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('Espace et Entrée basculent (clic natif annulé : une seule bascule)', async () => {
    await show(<Switch checked label="Alertes" onChange={onChange} />);
    const button = $('button');
    expect(key(button, 'keydown', 'Enter').defaultPrevented).toBe(true);
    expect(key(button, 'keydown', ' ').defaultPrevented).toBe(true);
    expect(key(button, 'keyup', ' ').defaultPrevented).toBe(true);
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenNthCalledWith(1, false);
    key(button, 'keydown', 'a');
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('nom par aria-labelledby et description par aria-describedby', async () => {
    await show(<Switch checked labelledBy="row-title" describedBy="row-desc" onChange={onChange} />);
    const button = $('button');
    expect(button?.getAttribute('aria-labelledby')).toBe('row-title');
    expect(button?.getAttribute('aria-describedby')).toBe('row-desc');
    expect(button?.hasAttribute('aria-label')).toBe(false);
  });

  it('disabled : ni clic ni clavier', async () => {
    await show(<Switch checked disabled label="Alertes" onChange={onChange} />);
    const button = $<HTMLButtonElement>('button');
    expect(button?.disabled).toBe(true);
    button?.click();
    key(button, 'keydown', 'Enter');
    expect(onChange).not.toHaveBeenCalled();
  });
});
