// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setLocale } from '../../i18n';
import type { FranchiseGraph, FranchiseNode } from '../../shared/franchise';
import type { PanelRecommendation } from '../../shared/panel-media.types';
import type { PageMediaInfo, PageMediaView } from '../../shared/page-media.types';
import { CLOSED_SECTIONS, DetailsCard } from './details-card';
import type { OrderState } from './now-playing-controller';

// Section « Ordre de visionnage » de la carte : première section, et aucun séparateur quand elle n'est pas dessinée

let container: HTMLElement;
const node = (id: number): FranchiseNode => ({ id, idMal: null, title: `T${id}`, format: 'TV', status: 'FINISHED', episodes: 12, duration: 24, coverUrl: null, siteUrl: `https://anilist.co/anime/${id}`, year: 2000 + id, month: 1, day: 1, season: null, seasonYear: null, platforms: [] });
const graph = (ids: number[]): FranchiseGraph => ({ startId: 1, nodes: Object.fromEntries(ids.map((id) => [id, node(id)])), main: ids, extras: [], capped: false, expanded: [] });
const ready = (ids: number[]): OrderState => ({ status: 'ready', graph: graph(ids), states: { anilist: null, mal: null } });

const page = { kind: 'series', platform: 'crunchyroll' } as unknown as PageMediaInfo;
const view = { media: { mediaId: 1, idMal: null, title: 'T1', siteUrl: 'https://anilist.co/anime/1', episodes: 12 }, lists: [], confidence: 'certain', source: 'cache', seasons: [], episodeProgress: null } as unknown as PageMediaView;

async function show(order: OrderState, similar: PanelRecommendation[] = []): Promise<void> {
  await act(() =>
    render(
      <DetailsCard
        page={page}
        view={view}
        details={null}
        entryLinks={{ preferred: 'anilist', connected: ['anilist'] }}
        preferred="crunchyroll"
        friends={{ state: 'idle', summary: null } as never}
        unlistedSequels={new Set()}
        order={order}
        similar={similar}
        onRetryOrder={() => undefined}
        busy={false}
        sections={CLOSED_SECTIONS}
        onToggle={() => undefined}
        onRate={() => undefined}
        onSaveNotes={async () => true}
      />,
      container,
    ),
  );
}
const sections = (): string[] => [...container.querySelectorAll('[data-details-card] [data-focus^="panel-section-"]')].map((el) => el.getAttribute('data-focus') ?? '');
const separators = (): number => container.querySelectorAll('[data-details-card] > span[aria-hidden="true"]').length;

beforeEach(() => {
  setLocale('en');
  container = document.createElement('div');
  document.body.append(container);
});
afterEach(() => {
  render(null, container);
  container.remove();
});

describe('DetailsCard : ordre de visionnage', () => {
  it('franchise à plusieurs entrées : section d’ordre en premier', async () => {
    await show(ready([1, 2]));
    expect(sections()).toEqual(['panel-section-order', 'panel-section-discussion']);
    expect(separators()).toBe(1);
  });

  it('une seule entrée ou ordre inactif : ni section ni séparateur en trop', async () => {
    await show(ready([1]));
    expect(sections()).toEqual(['panel-section-discussion']);
    expect(separators()).toBe(0);
    await show({ status: 'idle' });
    expect(sections()).toEqual(['panel-section-discussion']);
    expect(separators()).toBe(0);
  });

  it('chargement et erreur : section dessinée', async () => {
    await show({ status: 'loading' });
    expect(sections()[0]).toBe('panel-section-order');
    await show({ status: 'error', message: 'x' });
    expect(sections()[0]).toBe('panel-section-order');
  });
});

describe('DetailsCard : « Dans le même esprit »', () => {
  const reco = (mediaId: number): PanelRecommendation => ({ mediaId, idMal: null, title: `R${mediaId}`, format: 'TV', startYear: 2020, coverUrl: null, siteUrl: `https://anilist.co/anime/${mediaId}`, rating: 3, platforms: [], prequelIds: [], prequelMalIds: [] });

  it('section après l’ordre de visionnage, un séparateur par section', async () => {
    await show(ready([1, 2]), [reco(5)]);
    expect(sections()).toEqual(['panel-section-order', 'panel-section-similar', 'panel-section-discussion']);
    expect(separators()).toBe(2);
  });

  it('sans recommandation : ni section ni séparateur en trop', async () => {
    await show(ready([1]), []);
    expect(sections()).toEqual(['panel-section-discussion']);
    expect(separators()).toBe(0);
  });

  it('sans ordre : première section', async () => {
    await show({ status: 'idle' }, [reco(5)]);
    expect(sections()).toEqual(['panel-section-similar', 'panel-section-discussion']);
    expect(separators()).toBe(1);
  });
});
