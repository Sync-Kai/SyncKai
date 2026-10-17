// @vitest-environment happy-dom
import { render, type ComponentChild } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MediaHeader, MediaHeaderSkeleton } from './media-header';

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

describe('MediaHeader', () => {
  const entry = { href: 'https://anilist.co/anime/154587', label: 'Ouvrir la fiche de Frieren sur AniList' };

  it('jaquette 44 × 62 et titre : même lien vers la fiche, la jaquette hors tabulation et masquée', async () => {
    await show(<MediaHeader overline="Sur cette page" title="Frieren" coverUrl={null} entry={entry} titleFocusKey="page-entry" meta="Saison 1 · Crunchyroll" actions={<button type="button">⋯</button>} />);
    const title = $<HTMLAnchorElement>('[data-media-title] a');
    expect(title?.href).toBe(entry.href);
    expect(title?.getAttribute('aria-label')).toBe(entry.label);
    expect(title?.dataset.focus).toBe('page-entry');
    expect($('[data-media-title]')?.getAttribute('title')).toBe('Frieren');
    const cover = $<HTMLAnchorElement>('a[aria-hidden="true"]');
    expect(cover?.href).toBe(entry.href);
    expect(cover?.tabIndex).toBe(-1);
    expect($('[data-cover]')?.className).toContain('h-15.5 w-11');
    expect($('[data-media-meta]')?.textContent).toBe('Saison 1 · Crunchyroll');
    expect(container.textContent).toContain('Sur cette page');
    expect($('button')?.textContent).toBe('⋯');
  });

  it('prochain épisode : pastille du ton et date ; aucune pastille sans sortie', async () => {
    await show(<MediaHeader overline="Sur cette page" title="Frieren" coverUrl={null} airing={{ tone: 'info', text: 'Ép. 7 dans 18 h', date: 'sam. 17 oct., 18:00' }} />);
    expect($('[data-media-airing]')?.textContent).toBe('Ép. 7 dans 18 hsam. 17 oct., 18:00');
    expect($('[data-media-airing] span')?.className).toContain('text-lavender');
    await show(<MediaHeader overline="Sur cette page" title="Frieren" coverUrl={null} airing={null} />);
    expect($('[data-media-airing]')).toBeNull();
  });

  it('sans jaquette ni lien (introuvable, pas un anime) : titre seul, atténué si demandé', async () => {
    await show(<MediaHeader overline="Sur cette page" title="Arcane" muted />);
    expect($('[data-cover]')).toBeNull();
    expect($('a')).toBeNull();
    expect($('[data-media-title]')?.className).toContain('text-muted');
  });

  it('squelette : titre de la page atténué, jaquette grisée', async () => {
    await show(<MediaHeaderSkeleton overline="Sur cette page" title="Frieren" />);
    expect($('[data-media-skeleton]')?.textContent).toContain('Frieren');
  });
});
