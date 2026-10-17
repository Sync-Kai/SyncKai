// @vitest-environment happy-dom
import { render, type ComponentChild } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ServiceLogo } from './service-logo';

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

describe('ServiceLogo', () => {
  it('logo de service ou de plateforme ; sans libellé : décoratif', async () => {
    await show(<ServiceLogo id="anilist" />);
    expect($('img')?.getAttribute('src')).toBe('/brands/anilist.png');
    expect($('img')?.getAttribute('alt')).toBe('');
    await show(<ServiceLogo id="crunchyroll" />);
    expect($('img')?.getAttribute('src')).toBe('/brands/crunchyroll.png');
    expect(container.querySelectorAll('img')).toHaveLength(1);
  });

  it('libellé : texte alternatif (état compris)', async () => {
    await show(<ServiceLogo id="mal" label="MyAnimeList, session expirée" badge="expired" />);
    expect($('img')?.getAttribute('alt')).toBe('MyAnimeList, session expirée');
  });

  it('tailles 16, 18 et 22 px (jetons logo-sm / -md / -lg)', async () => {
    for (const [size, token] of [['sm', 'size-logo-sm'], ['md', 'size-logo-md'], ['lg', 'size-logo-lg']] as const) {
      await show(<ServiceLogo id="anilist" size={size} />);
      expect($('img')?.className).toContain(token);
    }
  });

  it('pastille d’état décorative dans le coin ; session expirée : logo grisé et point rouge', async () => {
    await show(<ServiceLogo id="anilist" />);
    expect($('[data-badge]')).toBeNull();
    for (const badge of ['ok', 'info', 'warn', 'error'] as const) {
      await show(<ServiceLogo id="anilist" badge={badge} />);
      expect($('[data-badge]')?.dataset.badge).toBe(badge);
      expect($('[data-badge]')?.getAttribute('aria-hidden')).toBe('true');
      expect($('img')?.dataset.dimmed).toBeUndefined();
    }
    await show(<ServiceLogo id="mal" badge="expired" />);
    expect($('[data-badge]')?.dataset.badge).toBe('expired');
    expect($('[data-badge]')?.className).toContain('bg-danger');
    expect($('img')?.dataset.dimmed).toBe('');
  });
});
