// @vitest-environment happy-dom
import { render, type ComponentChild } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IconButton } from './icon-button';

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

describe('IconButton', () => {
  it('libellé obligatoire : aria-label et title', async () => {
    const onClick = vi.fn<() => void>();
    await show(<IconButton icon="gear" label="Réglages" onClick={onClick} />);
    const button = $<HTMLButtonElement>('button');
    expect(button?.getAttribute('aria-label')).toBe('Réglages');
    expect(button?.getAttribute('title')).toBe('Réglages');
    expect(button?.type).toBe('button');
    button?.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('menu : aria-haspopup et aria-expanded transmis ; disabled', async () => {
    await show(<IconButton icon="more" label="Plus d’actions" haspopup="menu" expanded disabled />);
    const button = $<HTMLButtonElement>('button');
    expect(button?.getAttribute('aria-haspopup')).toBe('menu');
    expect(button?.getAttribute('aria-expanded')).toBe('true');
    expect(button?.disabled).toBe(true);
  });
});
