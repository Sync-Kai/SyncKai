// @vitest-environment happy-dom
import { render, type ComponentChild } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Collapsible } from './collapsible';

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

describe('Collapsible', () => {
  it('fermé par défaut : aria-expanded="false", aria-controls vers le contenu masqué', async () => {
    await show(
      <Collapsible title="Détails">
        <p>Corps</p>
      </Collapsible>,
    );
    const header = $<HTMLButtonElement>('button');
    const body = $('[data-collapsible-body]');
    expect(header?.getAttribute('aria-expanded')).toBe('false');
    expect(header?.getAttribute('aria-controls')).toBe(body?.id);
    expect(body?.hidden).toBe(true);
  });

  it('clic : ouvre puis referme ; onToggle reçoit le nouvel état', async () => {
    const onToggle = vi.fn<(open: boolean) => void>();
    await show(
      <Collapsible title="Trace" onToggle={onToggle}>
        corps
      </Collapsible>,
    );
    await act(() => $('button')?.click());
    expect($('button')?.getAttribute('aria-expanded')).toBe('true');
    expect($('[data-collapsible-body]')?.hidden).toBe(false);
    await act(() => $('button')?.click());
    expect($('button')?.getAttribute('aria-expanded')).toBe('false');
    expect(onToggle.mock.calls).toEqual([[true], [false]]);
  });

  it('ouvert d’emblée ; compte affiché dans l’en-tête', async () => {
    await show(
      <Collapsible title="Diagnostic" count={12} defaultOpen>
        corps
      </Collapsible>,
    );
    expect($('button')?.getAttribute('aria-expanded')).toBe('true');
    expect($('[data-collapsible-count]')?.textContent).toBe('12');
  });

  it('contrôlé : l’état suit `open`, le clic ne fait qu’appeler onToggle', async () => {
    const onToggle = vi.fn<(open: boolean) => void>();
    await show(
      <Collapsible title="Contrôlé" open={false} onToggle={onToggle}>
        corps
      </Collapsible>,
    );
    await act(() => $('button')?.click());
    expect(onToggle).toHaveBeenCalledWith(true);
    expect($('button')?.getAttribute('aria-expanded')).toBe('false');
    await show(
      <Collapsible title="Contrôlé" open onToggle={onToggle}>
        corps
      </Collapsible>,
    );
    expect($('button')?.getAttribute('aria-expanded')).toBe('true');
  });
});
