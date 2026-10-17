// @vitest-environment happy-dom
import { render, type ComponentChild } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LogoButton } from './logo-button';

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

describe('LogoButton', () => {
  it('lien vers la plateforme dans un nouvel onglet, nommé par `label`, logo décoratif', async () => {
    await show(<LogoButton platform="crunchyroll" href="https://www.crunchyroll.com/series/x" label="Ouvrir Dandadan sur Crunchyroll" title="Ouvrir sur Crunchyroll" />);
    const link = $<HTMLAnchorElement>('a');
    expect(link?.getAttribute('href')).toBe('https://www.crunchyroll.com/series/x');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link?.getAttribute('aria-label')).toBe('Ouvrir Dandadan sur Crunchyroll');
    expect(link?.getAttribute('title')).toBe('Ouvrir sur Crunchyroll');
    const img = link?.querySelector('img');
    expect(img?.getAttribute('src')).toBe('/brands/crunchyroll.png');
    expect(img?.getAttribute('alt')).toBe('');
  });

  it('sans title : le libellé sert d’infobulle ; logo remplacé quand la plateforme change', async () => {
    await show(<LogoButton platform="adn" href="https://animationdigitalnetwork.com/" label="Ouvrir sur ADN" />);
    expect($('a')?.getAttribute('title')).toBe('Ouvrir sur ADN');
    await show(<LogoButton platform="netflix" href="https://www.netflix.com/title/1" label="Ouvrir sur Netflix" />);
    expect($('a')?.querySelectorAll('img')).toHaveLength(1);
    expect($('img')?.getAttribute('src')).toBe('/brands/netflix.png');
  });
});
