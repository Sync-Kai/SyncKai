// @vitest-environment happy-dom
import { render, type ComponentChild } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AccountAvatar } from './account-avatar';

let container: HTMLElement;
const show = (node: ComponentChild): Promise<void> => act(() => render(node, container));
const $ = <T extends Element = HTMLElement>(selector: string): T | null => container.querySelector<T>(selector);

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
});

afterEach(async () => {
  await act(() => render(null, container));
  container.remove();
});

describe('AccountAvatar', () => {
  it('photo du profil (sans référent) et logo du service dans le coin', async () => {
    await show(<AccountAvatar service="anilist" url="https://s4.anilist.co/file/avatar.png" size="md" ring="surface" />);
    expect($('[data-avatar]')?.getAttribute('data-avatar')).toBe('connected');
    expect($('[data-avatar]')?.className).toContain('size-11');
    const img = $<HTMLImageElement>('img.object-cover');
    expect(img?.getAttribute('src')).toBe('https://s4.anilist.co/file/avatar.png');
    expect(img?.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(img?.getAttribute('alt')).toBe('');
    expect(container.querySelectorAll('img').length).toBe(2);
  });

  it('sans image, ou image en échec : dégradé de la marque ; session expirée : grisé', async () => {
    await show(<AccountAvatar service="mal" url={null} state="expired" />);
    expect($('[data-avatar]')?.className).toContain('size-9');
    const face = $('[data-avatar] > span');
    expect(face?.className).toContain('from-mint');
    expect(face?.className).toContain('opacity-55');

    await show(<AccountAvatar service="anilist" url="https://s4.anilist.co/broken.png" />);
    await act(() => {
      $('img.object-cover')?.dispatchEvent(new Event('error'));
    });
    expect($('img.object-cover')).toBeNull();
    expect($('[data-avatar] > span')?.className).toContain('from-lavender');
  });

  it('non connecté : cercle en pointillés, ni photo ni couleur de marque', async () => {
    await show(<AccountAvatar service="anilist" url="https://s4.anilist.co/file/avatar.png" state="disconnected" />);
    expect($('[data-avatar]')?.getAttribute('data-avatar')).toBe('disconnected');
    expect($('img.object-cover')).toBeNull();
    expect($('[data-avatar] > span')?.className).toContain('border-dashed');
  });
});
