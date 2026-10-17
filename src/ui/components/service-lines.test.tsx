// @vitest-environment happy-dom
import { render, type ComponentChild } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ServiceLines } from './service-lines';

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

describe('ServiceLines', () => {
  it('une ligne par service : logo nommé avec sa pastille, texte du ton', async () => {
    await show(
      <ServiceLines
        label="État dans tes listes"
        lines={[
          { service: 'anilist', serviceLabel: 'AniList', text: 'En cours · Ép. 6 / 28', state: 'in-list' },
          { service: 'mal', serviceLabel: 'MyAnimeList', text: 'Pas dans ta liste', state: 'absent' },
        ]}
      />,
    );
    expect($('ul')?.getAttribute('aria-label')).toBe('État dans tes listes');
    const anilist = $('[data-service-line="anilist"]');
    expect(anilist?.textContent).toBe('En cours · Ép. 6 / 28');
    expect(anilist?.className).toContain('text-ink');
    expect(anilist?.querySelector('img')?.getAttribute('alt')).toBe('AniList');
    expect(anilist?.querySelector('[data-badge]')?.getAttribute('data-badge')).toBe('ok');
    const mal = $('[data-service-line="mal"]');
    expect(mal?.className).toContain('text-muted');
    expect(mal?.querySelector('[data-badge]')).toBeNull();
  });

  it('erreur de lecture : texte danger, pastille rouge', async () => {
    await show(<ServiceLines label="État" lines={[{ service: 'mal', serviceLabel: 'MyAnimeList', text: 'MyAnimeList ne répond pas.', state: 'error' }]} />);
    expect($('[data-service-line="mal"]')?.className).toContain('text-danger');
    expect($('[data-badge]')?.getAttribute('data-badge')).toBe('error');
  });
});
