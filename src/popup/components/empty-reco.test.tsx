// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale, t } from '../../i18n';
import type { RecoBatch, RecoItem, RecoResult } from '../../shared/recommendations';

// Suggestion de l'état vide de « Mes séries » : une fiche compacte tirée du lot (lu par le service worker, une seule
// demande), « Plus d'idées dans le panneau › » rendu dans le clic, rien sans compte ni sans lot

const sw = vi.hoisted(() => ({ calls: [] as { type: string; payload: unknown }[], handler: (_type: string, _payload: unknown): unknown => undefined }));
vi.mock('../../protocol/messages', () => ({
  sendMessage: (type: string, payload: unknown) => {
    sw.calls.push({ type, payload });
    return Promise.resolve(sw.handler(type, payload));
  },
}));

const { EmptyReco } = await import('./empty-reco');

const item = (id: number): RecoItem => ({
  card: { id, idMal: id + 1000, title: `Série ${id}`, format: 'TV', year: 2024, episodes: 12, averageScore: 80, genres: ['Action'], tags: [], coverUrl: null, coverLarge: null, color: null, bannerUrl: null, siteUrl: `https://anilist.co/anime/${id}`, platforms: [], ...{} },
  score: 10,
  reason: { seedId: 1, seedTitle: 'Frieren', seedScore: 9, matched: ['Action'] },
});
const batch: RecoBatch = { items: [item(1)], computedAt: 1, seedCount: 5, cold: false };
const ok: RecoResult = { ok: true, batch, malOnly: false };

let container: HTMLElement;
const onMore = vi.fn<() => void>();

async function mount(): Promise<void> {
  await act(() => render(<EmptyReco granted={[]} onEnable={() => undefined} onMore={onMore} />, container));
  await act(async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  });
}

beforeEach(() => {
  setLocale('fr');
  sw.calls = [];
  sw.handler = () => ok;
  onMore.mockClear();
  container = document.createElement('div');
  document.body.append(container);
});
afterEach(async () => {
  await act(() => render(null, container));
  container.remove();
});

describe('EmptyReco', () => {
  it('une seule demande GET_RECOMMENDATIONS, une fiche et le lien du panneau', async () => {
    await mount();
    expect(sw.calls.filter((c) => c.type === 'GET_RECOMMENDATIONS')).toHaveLength(1);
    expect(container.textContent).toContain('Série 1');
    expect(container.textContent).toContain(t('reco.idea'));
    expect(container.querySelector('[data-reco]')).not.toBeNull();
  });

  it('« Plus d’idées dans le panneau » appelle onMore dans le clic, sans attendre', async () => {
    await mount();
    const more = [...container.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.includes(t('reco.morePanel')));
    expect(more).toBeDefined();
    more?.click();
    expect(onMore).toHaveBeenCalledTimes(1);
  });

  it('aucun compte, erreur ou lot vide : rien (et pas de titre « Une idée ? »)', async () => {
    sw.handler = () => ({ ok: false, code: 'NO_ACCOUNT', message: '' });
    await mount();
    expect(container.textContent).toBe('');
    sw.handler = () => ({ ok: false, code: 'FAILED', message: 'x' });
    await act(() => render(null, container));
    await mount();
    expect(container.textContent).toBe('');
  });
});
