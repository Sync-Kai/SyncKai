// @vitest-environment happy-dom
import { render, type ComponentChild } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ElementSlot, VanillaSlot } from './vanilla-slot';

let container: HTMLElement;

const show = (node: ComponentChild): Promise<void> => act(() => render(node, container));

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
});

afterEach(async () => {
  await act(() => render(null, container));
  container.remove();
});

function button(key: string, label: string): HTMLElement {
  const el = document.createElement('button');
  el.dataset.focus = key;
  el.textContent = label;
  return el;
}

describe('VanillaSlot', () => {
  it('nœud reconstruit seulement quand les entrées changent ; focus retrouvé par sa clé data-focus', async () => {
    const build = vi.fn((label: string) => button('more', label));
    await show(<VanillaSlot build={() => build('a')} inputs={['a']} attrs={{ 'data-slot': '' }} />);
    expect(container.querySelector('[data-slot] button')?.textContent).toBe('a');
    container.querySelector<HTMLElement>('[data-focus="more"]')?.focus();

    await show(<VanillaSlot build={() => build('a')} inputs={['a']} attrs={{ 'data-slot': '' }} />);
    expect(build).toHaveBeenCalledTimes(1);

    await show(<VanillaSlot build={() => build('b')} inputs={['b']} attrs={{ 'data-slot': '' }} />);
    expect(build).toHaveBeenCalledTimes(2);
    const rebuilt = container.querySelector<HTMLElement>('[data-focus="more"]');
    expect(rebuilt?.textContent).toBe('b');
    expect(document.activeElement).toBe(rebuilt);
  });

  it('null : conteneur vide', async () => {
    await show(<VanillaSlot build={() => null} inputs={[]} attrs={{ 'data-slot': '' }} />);
    expect(container.querySelector('[data-slot]')?.childNodes.length).toBe(0);
  });
});

describe('ElementSlot', () => {
  it('élément persistant inséré une fois, jamais recréé ; null : retiré', async () => {
    const editor = document.createElement('textarea');
    let current: HTMLElement | null = editor;
    await show(<ElementSlot element={() => current} attrs={{ 'data-slot': '' }} />);
    expect(container.querySelector('[data-slot] > textarea')).toBe(editor);
    editor.focus();
    await show(<ElementSlot element={() => current} attrs={{ 'data-slot': '' }} />);
    expect(document.activeElement).toBe(editor);
    current = null;
    await show(<ElementSlot element={() => current} attrs={{ 'data-slot': '' }} />);
    expect(container.querySelector('textarea')).toBeNull();
  });
});
