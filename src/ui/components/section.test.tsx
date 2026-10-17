// @vitest-environment happy-dom
import { render, type ComponentChild } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Section } from './section';

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

describe('Section', () => {
  it('titre de section (h2 en capitales, jeton text-section) qui nomme la section', async () => {
    await show(
      <Section title="Automatique">
        <p data-body="">Contenu</p>
      </Section>,
    );
    const section = $('section');
    const heading = $('h2');
    expect(heading?.textContent).toBe('Automatique');
    expect(heading?.className).toContain('text-section');
    expect(heading?.className).toContain('uppercase');
    expect(heading?.id).not.toBe('');
    expect(section?.getAttribute('aria-labelledby')).toBe(heading?.id);
    expect(section?.querySelector('[data-body]')?.textContent).toBe('Contenu');
  });

  it('deux sections : identifiants distincts', async () => {
    await show(
      <div>
        <Section title="A">a</Section>
        <Section title="B">b</Section>
      </div>,
    );
    const [first, second] = [...container.querySelectorAll('h2')];
    expect(first?.id).not.toBe(second?.id);
  });
});
