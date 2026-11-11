// @vitest-environment happy-dom
import { render, type ComponentChild } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ScreenTitle } from './screen-title';

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

describe('ScreenTitle', () => {
  it('h1 du titre d’écran (police d’affichage, jeton text-stat), tronqué sur une ligne avec le texte complet en bulle', async () => {
    await show(<ScreenTitle title="En cours" />);
    const heading = $('[data-screen-title] h1');
    expect(heading?.textContent).toBe('En cours');
    expect(heading?.className).toContain('font-display');
    expect(heading?.className).toContain('text-stat');
    expect(heading?.className).toContain('truncate');
    expect(heading?.getAttribute('title')).toBe('En cours');
  });

  it('actions à droite du titre (tri, menu)', async () => {
    await show(
      <ScreenTitle title="Activité">
        <button type="button" data-action="">
          Trier
        </button>
      </ScreenTitle>,
    );
    const row = $('[data-screen-title]');
    expect([...(row?.children ?? [])].map((child) => child.tagName)).toEqual(['H1', 'BUTTON']);
  });

  it('sous-titre facultatif sous le titre', async () => {
    await show(<ScreenTitle title="Pour toi" subtitle="D’après tes notes" />);
    expect($('[data-screen-title] h1')?.textContent).toBe('Pour toi');
    expect($('[data-screen-subtitle]')?.textContent).toBe('D’après tes notes');
    await show(<ScreenTitle title="Pour toi" />);
    expect($('[data-screen-subtitle]')).toBeNull();
  });
});
