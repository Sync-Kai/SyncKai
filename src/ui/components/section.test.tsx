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

  it('compte à droite du titre (hors du nom de la section) ; ton danger (« Zone de danger »)', async () => {
    await show(
      <Section title="Crunchyroll" count={61} tone="danger">
        x
      </Section>,
    );
    const heading = $('h2');
    expect(heading?.textContent).toBe('Crunchyroll');
    expect(heading?.className).toContain('text-danger');
    expect($('[data-section-count]')?.textContent).toBe('61');
    expect($('[data-section-count]')?.className).toContain('tabular-nums');
  });

  it('Activité : titre teinté du ton, compte à la suite du titre et dans son nom (« ÉCHEC · 1 »)', async () => {
    await show(
      <Section title="Échec" count={1} countInline tone="danger">
        x
      </Section>,
    );
    expect($('h2')?.textContent).toBe('Échec · 1');
    expect($('h2')?.className).toContain('text-danger');
    expect($('h2 [data-section-count]')?.textContent).toBe(' · 1');
    for (const [tone, color] of [['info', 'text-lavender'], ['warn', 'text-butter'], ['accent', 'text-sakura']] as const) {
      await show(
        <Section title="À noter" tone={tone}>
          x
        </Section>,
      );
      expect($('h2')?.className).toContain(color);
    }
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

  it('deux racines Preact dans la page (popup et barre d’état, réglages) : chaque section nommée par son propre titre', async () => {
    const other = document.createElement('div');
    document.body.append(other);
    try {
      await show(<Section title="Dernières synchros">a</Section>);
      await act(() => render(<Section title="Délai">b</Section>, other));
      // Nom accessible tel que le résout le navigateur : aria-labelledby cherche l'id dans tout le document
      const name = (root: HTMLElement): string | null | undefined => {
        const id = root.querySelector('section')?.getAttribute('aria-labelledby');
        return id ? document.getElementById(id)?.textContent : undefined;
      };
      expect(container.querySelector('h2')?.id).not.toBe(other.querySelector('h2')?.id);
      expect(name(container)).toBe('Dernières synchros');
      expect(name(other)).toBe('Délai');
    } finally {
      await act(() => render(null, other));
      other.remove();
    }
  });

  it('titre de niveau 3 sous un titre de niveau 2 (groupes du tri « État »)', async () => {
    await show(
      <Section title="En diffusion" count={2} countInline level={3}>
        x
      </Section>,
    );
    expect($('h2')).toBeNull();
    expect($('h3')?.textContent).toBe('En diffusion · 2');
    expect($('section')?.getAttribute('aria-labelledby')).toBe($('h3')?.id);
  });
});
