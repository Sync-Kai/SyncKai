// @vitest-environment happy-dom
import { render, type ComponentChild } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Button } from './button';

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

describe('Button', () => {
  it('bouton natif type="button", clic transmis', async () => {
    const onClick = vi.fn<() => void>();
    await show(<Button onClick={onClick}>Valider</Button>);
    const button = $<HTMLButtonElement>('button');
    expect(button?.type).toBe('button');
    expect(button?.textContent).toBe('Valider');
    button?.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('variante et taille dans data-variant / data-size, icône de tête décorative', async () => {
    await show(
      <Button variant="primary" size="sm" icon="check">
        Enregistrer
      </Button>,
    );
    const button = $('button');
    expect(button?.dataset.variant).toBe('primary');
    expect(button?.dataset.size).toBe('sm');
    expect(button?.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('variante par défaut : secondaire, taille md', async () => {
    await show(<Button>Annuler</Button>);
    expect($('button')?.dataset.variant).toBe('secondary');
    expect($('button')?.dataset.size).toBe('md');
  });

  it('busy : aria-busy et aria-disabled (le focus reste), clic ignoré', async () => {
    const onClick = vi.fn<() => void>();
    await show(
      <Button busy onClick={onClick}>
        Envoi
      </Button>,
    );
    const button = $<HTMLButtonElement>('button');
    expect(button?.getAttribute('aria-busy')).toBe('true');
    expect(button?.getAttribute('aria-disabled')).toBe('true');
    expect(button?.disabled).toBe(false);
    button?.click();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('disabled : bouton désactivé, clic ignoré', async () => {
    const onClick = vi.fn<() => void>();
    await show(
      <Button disabled onClick={onClick}>
        Rien
      </Button>,
    );
    const button = $<HTMLButtonElement>('button');
    expect(button?.disabled).toBe(true);
    button?.click();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('href : lien <a> (nouvel onglet sûr si target="_blank")', async () => {
    await show(
      <Button href="https://anilist.co/" target="_blank">
        AniList
      </Button>,
    );
    const link = $<HTMLAnchorElement>('a');
    expect($('button')).toBeNull();
    expect(link?.getAttribute('href')).toBe('https://anilist.co/');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('lien busy : clic annulé', async () => {
    await show(
      <Button href="https://anilist.co/" busy>
        AniList
      </Button>,
    );
    const link = $<HTMLAnchorElement>('a');
    expect(link?.getAttribute('aria-busy')).toBe('true');
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link?.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});
