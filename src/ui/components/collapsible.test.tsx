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

  it('en-tête de section (outils de dev d’Aide & à propos) : titre de section en <h2>, compte, bouton sur toute la largeur', async () => {
    await show(
      <Collapsible title="Trace de débogage" count={214} variant="section" focusKey="debug-trace-toggle">
        <p>Corps</p>
      </Collapsible>,
    );
    const header = $<HTMLButtonElement>('h2 > button');
    expect(header?.dataset.focus).toBe('debug-trace-toggle');
    expect(header?.className).toContain('w-full');
    expect(header?.className).toContain('uppercase');
    expect($('[data-collapsible-count]')?.textContent).toBe('214');
    expect($('[data-collapsible-body]')?.hidden).toBe(true);
    header?.click();
    await show(
      <Collapsible title="Trace de débogage" count={214} variant="section" focusKey="debug-trace-toggle">
        <p>Corps</p>
      </Collapsible>,
    );
    expect($('[data-collapsible-body]')?.hidden).toBe(false);
  });

  it('ligne de section d’une carte (panneau « En lecture ») : titre en gras sans capitales, compte en texte, chevron à droite', async () => {
    await show(
      <Collapsible title="Suites et histoires liées" count={2} variant="row" focusKey="panel-section-relations">
        <p>Corps</p>
      </Collapsible>,
    );
    const header = $<HTMLButtonElement>('button[data-focus="panel-section-relations"]');
    expect(header?.className).toContain('w-full');
    expect(header?.className).not.toContain('uppercase');
    expect($('h2')).toBeNull();
    expect($('[data-collapsible-count]')?.textContent).toBe('2');
    expect($('[data-collapsible-body]')?.hidden).toBe(true);
  });
});
