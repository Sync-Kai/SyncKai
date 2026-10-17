// @vitest-environment happy-dom
import { render, type ComponentChild } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ElementSlot } from './vanilla-slot';

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
