// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale, t } from '../../i18n';
import type { PageMediaInfo, PageMediaView } from '../../shared/page-media.types';
import type { PanelMedia, PanelRelation } from '../../shared/panel-media.types';
import type { SyncOutcome } from '../../shared/sync.types';
import { DetailsCard, CLOSED_SECTIONS } from './details-card';

// Relations de la fiche : badge « Annoncée · date » / « En diffusion » sur les suites, « + À regarder » (ADD_TO_LIST) ;
// l'ajout réussi termine l'alerte (UPDATE_SEQUELS removed) et la ligne dit « Dans ta liste »

const addToPlanning = vi.hoisted(() => vi.fn<(target: { mediaId: number; malId: number | null }) => Promise<unknown>>());
const updateSequels = vi.hoisted(() => vi.fn<(ids: number[], state: string) => Promise<boolean>>());
vi.mock('../../ui/sequel-actions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../ui/sequel-actions')>()),
  addToPlanning,
  updateSequels,
}));

let container: HTMLElement;

const relation = (over: Partial<PanelRelation>): PanelRelation => ({
  relationType: 'SEQUEL',
  mediaId: 20,
  idMal: 200,
  title: 'Frieren 2',
  format: 'TV',
  coverUrl: null,
  siteUrl: 'https://anilist.co/anime/20',
  platforms: [],
  status: 'NOT_YET_RELEASED',
  startYear: 2027,
  startMonth: 1,
  startDay: 16,
  season: null,
  seasonYear: null,
  ...over,
});

const page = { kind: 'series', platform: 'crunchyroll' } as unknown as PageMediaInfo;
const view = { media: { mediaId: 1, idMal: null, title: 'Frieren', siteUrl: 'https://anilist.co/anime/1', episodes: 28 }, lists: [], confidence: 'certain', source: 'cache', seasons: [], episodeProgress: null } as unknown as PageMediaView;
const friends = { state: 'idle', summary: null } as never;

async function show(relations: PanelRelation[], unlisted: readonly number[] = [20], connected: ('anilist' | 'mal')[] = ['anilist']): Promise<void> {
  const details = { description: null, relations, romajiTitle: null } as unknown as PanelMedia;
  await act(() =>
    render(
      <DetailsCard
        page={page}
        view={view}
        details={details}
        entryLinks={{ preferredEntry: 'anilist', connected } as never}
        preferred="crunchyroll"
        friends={friends}
        unlistedSequels={new Set(unlisted)}
        busy={false}
        sections={{ ...CLOSED_SECTIONS, relations: true }}
        onToggle={() => undefined}
        onRate={() => undefined}
        onSaveNotes={async () => true}
      />,
      container,
    ),
  );
}

const synced = (results: { service: 'anilist' | 'mal'; status: 'updated' | 'error' | 'skipped' }[]): SyncOutcome =>
  ({ status: 'synced', results: results.map(({ service, status }) => ({ service, outcome: status === 'updated' ? { status } : status === 'skipped' ? { status, reason: 'x', code: 'already-in-list' } : { status, message: 'boom' } })) }) as unknown as SyncOutcome;

/** Clic sur « + À regarder », puis la fin de l'échange avec le service worker (simulé) */
async function clickAdd(): Promise<void> {
  await act(async () => {
    container.querySelector<HTMLButtonElement>('[data-focus="relation-add-20"]')?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

beforeEach(() => {
  setLocale('en');
  container = document.createElement('div');
  document.body.append(container);
  addToPlanning.mockReset();
  updateSequels.mockReset().mockResolvedValue(true);
});
afterEach(() => {
  render(null, container);
  container.remove();
});

describe('relations : badge des suites annoncées', () => {
  it('suite NOT_YET_RELEASED : « Annoncée · date » et « + À regarder »', async () => {
    await show([relation({})]);
    expect(container.querySelector('[data-relation-badge]')?.textContent).toContain(t('sequel.announced'));
    expect(container.querySelector('[data-relation-badge]')?.textContent).toContain('2027');
    expect(container.querySelector('[data-focus="relation-add-20"]')?.textContent).toBe(t('sequel.add'));
  });

  it('RELEASING hors de l’ensemble : ni badge ni bouton ; dans l’ensemble : « Déjà en diffusion » et le bouton', async () => {
    await show([relation({ status: 'RELEASING' })], []);
    expect(container.querySelector('[data-relation-badge]')).toBeNull();
    expect(container.querySelector('[data-focus="relation-add-20"]')).toBeNull();
    await show([relation({ status: 'RELEASING' })], [20]);
    expect(container.querySelector('[data-relation-badge]')?.textContent).toContain(t('sequel.airing'));
    expect(container.querySelector('[data-focus="relation-add-20"]')).not.toBeNull();
  });

  it('NOT_YET_RELEASED hors de l’ensemble : badge « Annoncée », pas de bouton', async () => {
    await show([relation({})], []);
    expect(container.querySelector('[data-relation-badge]')?.textContent).toContain(t('sequel.announced'));
    expect(container.querySelector('[data-focus="relation-add-20"]')).toBeNull();
  });

  it('ajout réussi mais UPDATE_SEQUELS en échec : « Ajoutée à À regarder » quand même', async () => {
    addToPlanning.mockResolvedValue(synced([{ service: 'anilist', status: 'updated' }]));
    updateSequels.mockResolvedValue(false);
    await show([relation({})]);
    await clickAdd();
    expect(container.textContent).toContain(t('sequel.added'));
  });

  it('déjà dans la liste : « Dans ta liste », pas « Ajoutée »', async () => {
    addToPlanning.mockResolvedValue(synced([{ service: 'anilist', status: 'skipped' }]));
    await show([relation({})]);
    await clickAdd();
    expect(container.textContent).toContain(t('sequel.inList'));
    expect(container.textContent).not.toContain(t('sequel.added'));
  });

  it('compte MyAnimeList seul et suite sans idMal : « pas encore sur MyAnimeList », aucun bouton d’ajout', async () => {
    await show([relation({ idMal: null })], [20], ['mal']);
    expect(container.textContent).toContain(t('sequel.notOnMal'));
    expect(container.querySelector('[data-focus="relation-add-20"]')).toBeNull();
    await show([relation({ idMal: 200 })], [20], ['mal']);
    expect(container.querySelector('[data-focus="relation-add-20"]')).not.toBeNull();
  });

  it('ni suite annoncée, ni badge : préquelle, suite terminée', async () => {
    await show([relation({ relationType: 'PREQUEL', status: 'NOT_YET_RELEASED' }), relation({ mediaId: 21, status: 'FINISHED' })]);
    expect(container.querySelector('[data-relation-badge]')).toBeNull();
    expect(container.querySelector('[data-focus="relation-add-20"]')).toBeNull();
  });

  it('ajout réussi : UPDATE_SEQUELS removed, la ligne dit « Ajoutée à À regarder » et le bouton disparaît', async () => {
    addToPlanning.mockResolvedValue(synced([{ service: 'anilist', status: 'updated' }]));
    await show([relation({})]);
    await clickAdd();
    expect(addToPlanning).toHaveBeenCalledWith({ mediaId: 20, malId: 200 });
    expect(updateSequels).toHaveBeenCalledWith([20], 'removed');
    expect(container.textContent).toContain(t('sequel.added'));
    expect(container.querySelector('[data-focus="relation-add-20"]')).toBeNull();
  });

  it('AniList écrit, MyAnimeList absent : « pas encore sur MyAnimeList »', async () => {
    addToPlanning.mockResolvedValue(synced([{ service: 'anilist', status: 'updated' }, { service: 'mal', status: 'error' }]));
    await show([relation({})]);
    await clickAdd();
    expect(container.textContent).toContain(t('sequel.notOnMal'));
  });

  it('échec : message, « Réessayer », alerte gardée', async () => {
    addToPlanning.mockResolvedValue({ status: 'error', message: 'Hors ligne' });
    await show([relation({})]);
    await clickAdd();
    expect(container.textContent).toContain('Hors ligne');
    expect(container.querySelector('[data-focus="relation-add-20"]')?.textContent).toBe(t('common.retry'));
    expect(updateSequels).not.toHaveBeenCalled();
  });
});
