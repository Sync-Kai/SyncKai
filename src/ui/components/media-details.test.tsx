// @vitest-environment happy-dom
import { render, type ComponentChild } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MediaDetails } from './media-details';

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

describe('MediaDetails', () => {
  it('replié : bouton aria-expanded="false" lié à la section masquée, contenu non monté ; déplié : contenu visible', async () => {
    const onToggle = vi.fn<() => void>();
    await show(
      <MediaDetails label="Détails : saison, note, commentaire" open={false} onToggle={onToggle} focusKey="page-details">
        <p data-test-content="">Saison</p>
      </MediaDetails>,
    );
    const button = $<HTMLButtonElement>('[data-focus="page-details"]');
    expect(button?.textContent).toBe('Détails : saison, note, commentaire');
    expect(button?.getAttribute('aria-expanded')).toBe('false');
    const panel = container.querySelector(`#${CSS.escape(button?.getAttribute('aria-controls') ?? '')}`);
    expect(panel?.hasAttribute('hidden')).toBe(true);
    expect($('[data-test-content]')).toBeNull();
    await act(() => button?.click());
    expect(onToggle).toHaveBeenCalledTimes(1);

    await show(
      <MediaDetails label="Détails : saison, note, commentaire" open onToggle={onToggle} focusKey="page-details">
        <p data-test-content="">Saison</p>
      </MediaDetails>,
    );
    expect($('[data-focus="page-details"]')?.getAttribute('aria-expanded')).toBe('true');
    expect($('[data-test-content]')?.textContent).toBe('Saison');
  });
});
