// @vitest-environment happy-dom
import { render } from 'preact';
import { useRef } from 'preact/hooks';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n';
import type { SequelRecord } from '../../shared/sequels';
import type { SyncOutcome } from '../../shared/sync.types';
import { useFocusFallback, useStore } from '../../ui/preact/hooks';
import { createStore, type Store } from '../../ui/state';
import { SequelsSection } from './sequels-section';

const worker = vi.hoisted(() => ({ send: vi.fn<(type: string, payload: unknown) => Promise<unknown>>() }));
vi.mock('../../protocol/messages', () => ({ sendMessage: (type: string, payload: unknown): Promise<unknown> => worker.send(type, payload) }));

setLocale('en');

let container: HTMLElement;
const $ = <T extends HTMLElement = HTMLElement>(selector: string): T | null => container.querySelector<T>(selector);
const rows = (): string[] => [...container.querySelectorAll('[data-sequel]')].map((row) => row.getAttribute('data-sequel') ?? '');

const record = (id: number, patch: Partial<SequelRecord['snapshot']> = {}): SequelRecord => ({
  snapshot: { id, idMal: id + 1000, title: `Suite ${id}`, format: 'TV', status: 'NOT_YET_RELEASED', coverUrl: null, siteUrl: `https://anilist.co/anime/${id}`, year: 2027, month: 1, day: 10, season: null, seasonYear: null, sourceId: 1, sourceTitle: 'Source', ...patch },
  state: 'new',
  firstSeenAt: 1000 - id,
});

const syncedWith = (anilist: 'updated' | 'error', mal: 'updated' | 'error' | null): SyncOutcome => ({
  status: 'synced',
  mediaTitle: 'Suite',
  results: [
    { service: 'anilist', outcome: anilist === 'updated' ? { status: 'updated', progress: 0, completed: false } : { status: 'error', message: 'Échec AniList' } },
    ...(mal === null ? [] : [{ service: 'mal' as const, outcome: mal === 'updated' ? ({ status: 'updated', progress: 0, completed: false } as const) : ({ status: 'error', message: 'Échec MAL' } as const) }]),
  ],
});

let store: Store<SequelRecord[]>;

/** Hôte comme ActivityScreen : le repli du focus est posé par l'écran, pas par la section */
function Host() {
  const root = useRef<HTMLDivElement>(null);
  useFocusFallback(root);
  const records = useStore(store);
  return (
    <div ref={root}>
      <SequelsSection records={records} />
    </div>
  );
}
const mount = (records: SequelRecord[]): Promise<void> => {
  store = createStore(records);
  return act(() => render(<Host />, container));
};
const flush = (): Promise<void> => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
async function click(selector: string): Promise<void> {
  const el = $(selector);
  if (!el) throw new Error(`Introuvable : ${selector}`);
  await act(async () => { el.click(); await Promise.resolve(); });
  await flush();
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  worker.send.mockReset();
  worker.send.mockResolvedValue(true);
});

afterEach(async () => {
  await act(() => render(null, container));
  container.remove();
});

describe('SequelsSection', () => {
  it('sans suite visible : rien', async () => {
    await mount([]);
    expect(container.querySelector('[data-sequel]')).toBeNull();
  });

  it('jusqu’à 3 lignes sans repli, avec le titre de la section', async () => {
    await mount([record(1), record(2), record(3)]);
    expect(container.querySelector('h2')?.textContent).toBe('Announced sequels');
    expect(rows()).toEqual(['1', '2', '3']);
    expect($('[data-sequels-more]')).toBeNull();
  });

  it('5 suites : 3 lignes puis « 2 more announced sequels » qui déplie le reste', async () => {
    await mount([1, 2, 3, 4, 5].map((id) => record(id)));
    expect(rows()).toEqual(['1', '2', '3']);
    expect($('[data-sequels-more]')?.textContent).toBe('2 more announced sequels');
    await click('[data-sequels-more]');
    expect(rows()).toEqual(['1', '2', '3', '4', '5']);
    expect($('[data-sequels-more]')).toBeNull();
  });

  it('ligne : date à la précision connue, format, et point gris quand la date est inconnue', async () => {
    await mount([record(1), record(2, { year: null, month: null, day: null })]);
    expect($('[data-sequel="1"]')?.textContent).toContain('Jan 10, 2027 · TV');
    expect($('[data-sequel="1"] [data-sequel-dot]')?.className).toContain('bg-lavender');
    expect($('[data-sequel="2"]')?.textContent).toContain('Date to be announced');
    expect($('[data-sequel="2"] [data-sequel-dot]')?.className).toContain('bg-muted');
  });

  it('× : UPDATE_SEQUELS dismissed, puis le focus passe à la ligne voisine', async () => {
    await mount([record(1), record(2), record(3)]);
    worker.send.mockImplementation(async () => {
      store.set(store.get().filter((r) => r.snapshot.id !== 2));
      return true;
    });
    const dismiss = $<HTMLButtonElement>('[data-focus="sequel-dismiss-2"]');
    expect(dismiss?.getAttribute('aria-label')).toBe('Hide Suite 2');
    dismiss?.focus();
    await click('[data-focus="sequel-dismiss-2"]');
    expect(worker.send).toHaveBeenCalledWith('UPDATE_SEQUELS', { ids: [2], state: 'dismissed' });
    expect(rows()).toEqual(['1', '3']);
    expect(container.contains(document.activeElement)).toBe(true);
    expect(document.activeElement?.closest('[data-sequel]')).not.toBeNull();
  });

  it('+ Plan to watch : ADD_TO_LIST puis UPDATE_SEQUELS removed ; la ligne part avec le stockage', async () => {
    await mount([record(1)]);
    worker.send.mockImplementation(async (type) => {
      if (type === 'ADD_TO_LIST') return syncedWith('updated', 'updated');
      store.set([]);
      return true;
    });
    expect($('[data-focus="sequel-add-1"]')?.getAttribute('aria-label')).toBe('Add Suite 1 to Plan to watch');
    await click('[data-focus="sequel-add-1"]');
    expect(worker.send).toHaveBeenNthCalledWith(1, 'ADD_TO_LIST', { mediaId: 1, malId: 1001, status: 'PLANNING' });
    expect(worker.send).toHaveBeenNthCalledWith(2, 'UPDATE_SEQUELS', { ids: [1], state: 'removed' });
    expect(container.querySelector('[data-sequel]')).toBeNull();
  });

  it('AniList réussi, MyAnimeList en échec : l’alerte est terminée et la ligne dit « not on MyAnimeList yet »', async () => {
    await mount([record(1)]);
    worker.send.mockImplementation(async (type) => {
      if (type === 'ADD_TO_LIST') return syncedWith('updated', 'error');
      store.set([]);
      return true;
    });
    await click('[data-focus="sequel-add-1"]');
    expect(worker.send).toHaveBeenCalledWith('UPDATE_SEQUELS', { ids: [1], state: 'removed' });
    expect($('[data-sequel="1"]')?.textContent).toContain('not on MyAnimeList yet');
    expect($('[data-focus="sequel-add-1"]')).toBeNull();
  });

  it('échec total : la ligne reste avec « Retry » et le message, rien n’est retiré', async () => {
    await mount([record(1)]);
    worker.send.mockResolvedValue(syncedWith('error', null));
    await click('[data-focus="sequel-add-1"]');
    expect(worker.send).toHaveBeenCalledTimes(1);
    expect($('[data-focus="sequel-add-1"]')?.textContent).toBe('Retry');
    expect($('[data-sequel="1"]')?.textContent).toContain('Échec AniList');
  });

  it('déjà dans la liste : l’alerte est terminée comme après un ajout', async () => {
    await mount([record(1)]);
    worker.send.mockImplementation(async (type) => {
      if (type === 'ADD_TO_LIST') return { status: 'synced', mediaTitle: 'Suite', results: [{ service: 'anilist', outcome: { status: 'skipped', reason: 'Déjà', code: 'already-in-list' } }] } satisfies SyncOutcome;
      store.set([]);
      return true;
    });
    await click('[data-focus="sequel-add-1"]');
    expect(worker.send).toHaveBeenCalledWith('UPDATE_SEQUELS', { ids: [1], state: 'removed' });
  });
});
