// @vitest-environment happy-dom
import { render, type ComponentChild } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StatusText } from './status-text';

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

describe('StatusText', () => {
  it('point décoratif + texte tronqué, infobulle = texte complet', async () => {
    await show(<StatusText tone="ok">Disponible</StatusText>);
    const root = $('[data-status-text]');
    expect(root?.getAttribute('title')).toBe('Disponible');
    expect(root?.querySelector('[aria-hidden="true"]')).not.toBeNull();
    expect(root?.querySelector('.truncate')?.textContent).toBe('Disponible');
  });

  it('couleur du ton : mint, lavender, butter, danger, muted', async () => {
    const tones = { ok: 'text-mint', info: 'text-lavender', warn: 'text-butter', error: 'text-danger', muted: 'text-muted' } as const;
    for (const [tone, color] of Object.entries(tones) as [keyof typeof tones, string][]) {
      await show(<StatusText tone={tone}>Texte</StatusText>);
      expect($('[data-status-text]')?.className).toContain(color);
      expect($('[data-status-text]')?.dataset.tone).toBe(tone);
    }
  });

  it('infobulle personnalisée', async () => {
    await show(
      <StatusText tone="info" title="Samedi 18:00 (heure de la plateforme)">
        Sam. 18:00
      </StatusText>,
    );
    expect($('[data-status-text]')?.getAttribute('title')).toBe('Samedi 18:00 (heure de la plateforme)');
  });
});
