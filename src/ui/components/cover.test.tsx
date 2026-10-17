// @vitest-environment happy-dom
import { render, type ComponentChild } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Cover } from './cover';

let container: HTMLElement;

const $ = <T extends HTMLElement = HTMLElement>(selector: string): T | null => container.querySelector<T>(selector);
const show = (node: ComponentChild): Promise<void> => act(() => render(node, container));

const IMAGE = 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx171018.jpg';

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
});

afterEach(async () => {
  await act(() => render(null, container));
  container.remove();
});

describe('Cover', () => {
  it('image d’un hôte autorisé, décorative ; initiales en dessous', async () => {
    await show(<Cover size="row" title="Dandadan" src={IMAGE} />);
    const img = $<HTMLImageElement>('img');
    expect(img?.getAttribute('src')).toBe(IMAGE);
    expect(img?.getAttribute('alt')).toBe('');
    expect(img?.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect($('[data-cover-initials]')?.textContent).toBe('D');
  });

  it('sans image ou hôte hors liste : initiales seules, aucune requête', async () => {
    await show(<Cover size="agenda" title="One Piece" src={null} />);
    expect($('img')).toBeNull();
    expect($('[data-cover-initials]')?.textContent).toBe('OP');
    await show(<Cover size="agenda" title="One Piece" src="https://evil.example/x.jpg" />);
    expect($('img')).toBeNull();
  });

  it('image en échec : retirée, initiales visibles', async () => {
    await show(<Cover size="row" title="Frieren" src={IMAGE} />);
    await act(() => {
      $('img')?.dispatchEvent(new Event('error'));
    });
    expect($('img')).toBeNull();
    expect($('[data-cover-initials]')?.textContent).toBe('F');
  });

  it('tailles row (42 × 57) et agenda (32 × 44)', async () => {
    await show(<Cover size="row" title="A" src={null} />);
    expect($('[data-cover]')?.className).toContain('h-cover-row-h');
    expect($('[data-cover]')?.className).toContain('w-cover-row-w');
    await show(<Cover size="agenda" title="A" src={null} />);
    expect($('[data-cover]')?.className).toContain('h-cover-agenda-h');
  });

  it('barre de progression : role="progressbar", bornes et largeur', async () => {
    await show(<Cover size="row" title="Dandadan" src={null} progress={{ value: 4, total: 12, label: 'Progression' }} />);
    const bar = $('[role="progressbar"]');
    expect(bar?.getAttribute('aria-label')).toBe('Progression');
    expect(bar?.getAttribute('aria-valuemin')).toBe('0');
    expect(bar?.getAttribute('aria-valuemax')).toBe('12');
    expect(bar?.getAttribute('aria-valuenow')).toBe('4');
    expect(bar?.querySelector<HTMLElement>('span')?.style.width).toBe('33.33%');
  });

  it('progression au-delà du total : bornée ; total inconnu ou nul : pas de barre', async () => {
    await show(<Cover size="row" title="A" src={null} progress={{ value: 14, total: 12, label: 'Progression' }} />);
    expect($('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('12');
    await show(<Cover size="row" title="One Piece" src={null} progress={{ value: 1180, total: null, label: 'Progression' }} />);
    expect($('[role="progressbar"]')).toBeNull();
    await show(<Cover size="row" title="A" src={null} progress={{ value: 0, total: 0, label: 'Progression' }} />);
    expect($('[role="progressbar"]')).toBeNull();
  });

  it('taille `card` (carte « Sur cette page ») : 44 × 62', async () => {
    await show(<Cover size="card" title="Frieren" src={null} />);
    expect($('[data-cover]')?.className).toContain('h-15.5 w-11');
  });

  it('taille `hero` (en-tête de « En lecture » du panneau) : 64 × 90', async () => {
    await show(<Cover size="hero" title="Frieren" src={null} />);
    expect($('[data-cover]')?.className).toContain('h-22.5 w-16');
  });
});
