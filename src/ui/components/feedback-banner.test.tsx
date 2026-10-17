// @vitest-environment happy-dom
import { render, type ComponentChild } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedbackBanner } from './feedback-banner';

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

describe('FeedbackBanner', () => {
  it('réussite : role="status", ton mint, détail en infobulle, sans bouton', async () => {
    await show(<FeedbackBanner tone="success" text="Ajoutée à En cours" detail="AniList : ajoutée · MyAnimeList : ajoutée" />);
    const banner = $('[data-feedback]');
    expect(banner?.getAttribute('role')).toBe('status');
    expect(banner?.className).toContain('text-mint');
    expect(banner?.getAttribute('title')).toBe('AniList : ajoutée · MyAnimeList : ajoutée');
    expect(banner?.textContent).toBe('Ajoutée à En cours');
    expect($('button')).toBeNull();
  });

  it('échec : role="alert", ton danger ; échec partiel : « Réessayer » nommé par les services', async () => {
    await show(<FeedbackBanner tone="error" text="Erreur inattendue lors de l’ajout à la liste." />);
    expect($('[data-feedback]')?.getAttribute('role')).toBe('alert');
    expect($('[data-feedback]')?.className).toContain('text-danger');
    const onClick = vi.fn<() => void>();
    await show(<FeedbackBanner tone="warning" text="Ép. 7 vu · échec MyAnimeList" retry={{ label: 'Réessayer', ariaLabel: 'Réessayer sur MyAnimeList', onClick }} focusKey="page-retry" />);
    const retry = $<HTMLButtonElement>('[data-focus="page-retry"]');
    expect(retry?.getAttribute('aria-label')).toBe('Réessayer sur MyAnimeList');
    await act(() => retry?.click());
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
