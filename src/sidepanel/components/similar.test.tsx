// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n';
import type { PanelRecommendation } from '../../shared/panel-media.types';
import type { SyncOutcome } from '../../shared/sync.types';

const addToPlanning = vi.hoisted(() => vi.fn<(target: { mediaId: number; malId: number | null }) => Promise<SyncOutcome>>());
const updateRecommendation = vi.hoisted(() => vi.fn<(id: number) => Promise<boolean>>(() => Promise.resolve(true)));
vi.mock('../../ui/sequel-actions', async (importActual) => ({ ...(await importActual<typeof import('../../ui/sequel-actions')>()), addToPlanning, markRecommendationAdded: updateRecommendation }));

const { Similar, showsSimilar } = await import('./similar');

const reco = (mediaId: number, over: Partial<PanelRecommendation> = {}): PanelRecommendation => ({
  mediaId, idMal: mediaId + 1000, title: `Reco ${mediaId}`, format: 'TV', startYear: 2021, coverUrl: 'https://s4.anilist.co/c.jpg', siteUrl: `https://anilist.co/anime/${mediaId}`, rating: 12, platforms: [], prequelIds: [], ...over,
});
const synced: SyncOutcome = { status: 'synced', results: [{ service: 'anilist', outcome: { status: 'updated' } }] } as unknown as SyncOutcome;

let container: HTMLElement;
const show = (items: PanelRecommendation[], over: { connected?: ('anilist' | 'mal')[]; open?: boolean } = {}): Promise<void> =>
  act(() =>
    render(
      <Similar items={items} title="Frieren" links={{ preferred: 'anilist', connected: over.connected ?? ['anilist'] }} preferred="crunchyroll" open={over.open ?? true} onToggle={() => undefined} />,
      container,
    ),
  );
const rows = (): HTMLElement[] => [...container.querySelectorAll<HTMLElement>('[data-similar-row]')];

beforeEach(() => {
  setLocale('en');
  addToPlanning.mockReset();
  updateRecommendation.mockClear();
  container = document.createElement('div');
  document.body.append(container);
});
afterEach(() => {
  render(null, container);
  container.remove();
});

describe('Similar', () => {
  it('cachée sans recommandation', async () => {
    expect(showsSimilar([])).toBe(false);
    expect(showsSimilar([reco(1)])).toBe(true);
    await show([]);
    expect(container.querySelector('[data-focus="panel-section-similar"]')).toBeNull();
  });

  it('une ligne par série : jaquette, titre en lien, fans avec la note et le titre courant', async () => {
    await show([reco(1), reco(2, { rating: 1 })]);
    expect(container.textContent).toContain('In the same spirit');
    expect(rows()).toHaveLength(2);
    const link = rows()[0].querySelector('a');
    expect(link?.getAttribute('href')).toBe('https://anilist.co/anime/1');
    expect(rows()[0].querySelector('img')?.getAttribute('src')).toBe('https://s4.anilist.co/c.jpg');
    expect(rows()[0].textContent).toContain('12 fans of Frieren');
    expect(rows()[1].textContent).toContain('1 fan of Frieren');
  });

  it('« Regarder » seulement avec un lien de plateforme', async () => {
    await show([reco(1, { platforms: [{ platform: 'crunchyroll', url: 'https://www.crunchyroll.com/series/X/y' }] }), reco(2)]);
    expect(rows()[0].querySelector('[data-focus="similar-watch-1"]')?.getAttribute('href')).toBe('https://www.crunchyroll.com/series/X/y');
    expect(rows()[1].querySelector('[data-focus^="similar-watch-"]')).toBeNull();
  });

  it('« + À regarder » : ajoute, prévient le lot de Découvrir, puis affiche l’ajout', async () => {
    addToPlanning.mockResolvedValue(synced);
    await show([reco(1)]);
    await act(() => rows()[0].querySelector<HTMLButtonElement>('[data-focus="similar-add-1"]')?.click());
    await act(() => Promise.resolve());
    expect(addToPlanning).toHaveBeenCalledWith({ mediaId: 1, malId: 1001 });
    expect(updateRecommendation).toHaveBeenCalledWith(1);
    expect(rows()[0].querySelector('[data-focus="similar-add-1"]')).toBeNull();
    expect(rows()[0].textContent).toContain('Added');
  });

  it('échec de l’ajout : message et « Réessayer », Découvrir non prévenu', async () => {
    addToPlanning.mockResolvedValue({ status: 'error', message: 'Boom' } as unknown as SyncOutcome);
    await show([reco(1)]);
    await act(() => rows()[0].querySelector<HTMLButtonElement>('[data-focus="similar-add-1"]')?.click());
    await act(() => Promise.resolve());
    expect(updateRecommendation).not.toHaveBeenCalled();
    expect(rows()[0].textContent).toContain('Boom');
    expect(rows()[0].querySelector('[data-focus="similar-add-1"]')).not.toBeNull();
  });

  it('MyAnimeList seul et sans idMal : pas de bouton, « Pas sur MyAnimeList »', async () => {
    await show([reco(1, { idMal: null })], { connected: ['mal'] });
    expect(rows()[0].querySelector('[data-focus="similar-add-1"]')).toBeNull();
    expect(rows()[0].textContent).toContain('MyAnimeList');
  });

  it('sans compte connecté : pas de « + À regarder »', async () => {
    await show([reco(1)], { connected: [] });
    expect(rows()[0].querySelector('[data-focus="similar-add-1"]')).toBeNull();
  });
});
