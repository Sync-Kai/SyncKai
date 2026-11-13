// @vitest-environment happy-dom
import { render } from 'preact';
import { useRef } from 'preact/hooks';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale, t, tp } from '../../i18n';
import type { FranchiseGraph, FranchiseNode, ListState, ListStates } from '../../shared/franchise';
import type { SyncOutcome } from '../../shared/sync.types';
import { useFocusFallback } from '../../ui/preact/hooks';
import type { OrderState } from './now-playing-controller';
import { WatchOrder, type WatchOrderProps } from './watch-order';

// Section « Ordre de visionnage » : en-tête replié (compte, barre, « Ensuite »), liste dépliée dans l'ordre de sortie, interrupteur
// « Série principale / Tout », séries vues regroupées, « Afficher N de plus », chargement / erreur, badge et « + À regarder » des suites.

const addToPlanning = vi.hoisted(() => vi.fn<(target: { mediaId: number; malId: number | null }) => Promise<unknown>>());
const updateSequels = vi.hoisted(() => vi.fn<(ids: number[], state: string) => Promise<boolean>>());
vi.mock('../../ui/sequel-actions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../ui/sequel-actions')>()),
  addToPlanning,
  updateSequels,
}));

let container: HTMLElement;

const node = (id: number, over: Partial<FranchiseNode> = {}): FranchiseNode => ({
  id,
  idMal: id * 10,
  title: `Frieren ${id}`,
  format: 'TV',
  status: 'FINISHED',
  episodes: 12,
  duration: 24,
  coverUrl: null,
  siteUrl: `https://anilist.co/anime/${id}`,
  year: 2000 + id,
  month: 1,
  day: 1,
  season: null,
  seasonYear: null,
  platforms: [],
  ...over,
});

const graphOf = (main: FranchiseNode[], extras: { node: FranchiseNode }[] = [], capped = false): FranchiseGraph => ({
  startId: main[0]?.id ?? 0,
  nodes: Object.fromEntries([...main, ...extras.map((e) => e.node)].map((n) => [n.id, n])),
  main: main.map((n) => n.id),
  extras: extras.map((e) => ({ id: e.node.id, relation: 'SIDE_STORY' as const, from: main[0]?.id ?? 0 })),
  capped,
  expanded: [],
});

const watched: ListState = { kind: 'watched', progress: null };
const statesOf = (anilist: Record<number, ListState> | null, mal: Record<number, ListState> | null = null): ListStates => ({ anilist, mal });
const ready = (graph: FranchiseGraph, states: ListStates): OrderState => ({ status: 'ready', graph, states });

async function show(order: OrderState, over: Partial<WatchOrderProps> = {}): Promise<void> {
  const props: WatchOrderProps = {
    order,
    currentId: 1,
    links: { connected: ['anilist'], preferred: 'anilist' },
    preferred: 'crunchyroll',
    unlistedSequels: new Set<number>(),
    open: false,
    onToggle: () => undefined,
    onRetry: () => undefined,
    ...over,
  };
  await act(() => render(<WatchOrder {...props} />, container));
}

/** Hôte du panneau (panel-app.tsx) : repli du focus sur l'onglet affiché */
function PanelHost({ order, currentId }: { order: OrderState; currentId: number }) {
  const root = useRef<HTMLDivElement>(null);
  useFocusFallback(root, 'tab-nowPlaying');
  return (
    <div ref={root}>
      <button type="button" data-focus="tab-nowPlaying">
        En lecture
      </button>
      <WatchOrder
        order={order}
        currentId={currentId}
        links={{ connected: ['anilist'], preferred: 'anilist' }}
        preferred="crunchyroll"
        unlistedSequels={new Set<number>()}
        open
        onToggle={() => undefined}
        onRetry={() => undefined}
      />
    </div>
  );
}
const showInPanel = (order: OrderState, currentId = 1): Promise<void> => act(() => render(<PanelHost order={order} currentId={currentId} />, container));
const focused = (): string | null => (document.activeElement instanceof HTMLElement ? (document.activeElement.dataset.focus ?? null) : null);

const rows = (): HTMLElement[] => [...container.querySelectorAll<HTMLElement>('[data-order-row]')];
const click = async (selector: string): Promise<void> => {
  await act(async () => {
    container.querySelector<HTMLElement>(selector)?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};
/** Huit entrées sorties, les trois premières vues */
const eight = (): FranchiseNode[] => Array.from({ length: 8 }, (_, i) => node(i + 1));

/** Panneau étroit simulé : `matchMedia` répond à `(max-width: 339px)` */
const narrow = (matches: boolean): void => {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: matches && query.includes('339'), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
};

beforeEach(() => {
  narrow(false);
  setLocale('en');
  container = document.createElement('div');
  document.body.append(container);
  addToPlanning.mockReset();
  updateSequels.mockReset().mockResolvedValue(true);
});
afterEach(() => {
  vi.unstubAllGlobals();
  render(null, container);
  container.remove();
});

describe('Ordre de visionnage : en-tête replié', () => {
  it('« 3 / 8 vus », une cellule par entrée sortie avec son état, « Ensuite : … »', async () => {
    const main = eight();
    await show(ready(graphOf(main), statesOf({ 1: watched, 2: watched, 3: { kind: 'watched', progress: null }, 4: { kind: 'inProgress', progress: 5 } })));
    expect(container.textContent).toContain(t('panel.order.title'));
    expect(container.textContent).toContain(tp('panel.order.watched', 3, { count: 3, total: 8 }));
    const cells = [...container.querySelectorAll<HTMLElement>('[data-order-cell]')];
    expect(cells).toHaveLength(8);
    expect(cells.map((c) => c.dataset.orderCell).slice(0, 5)).toEqual(['watched', 'watched', 'watched', 'inProgress', 'none']);
    expect(container.textContent).toContain(t('panel.order.next', { title: 'Frieren 5' }));
  });

  it('entrée annoncée : cellule pointillée en plus, hors du compte', async () => {
    const main = [node(1), node(2, { status: 'NOT_YET_RELEASED', year: 2030 })];
    await show(ready(graphOf(main), statesOf({ 1: watched })));
    expect(container.textContent).toContain(tp('panel.order.watched', 1, { count: 1, total: 1 }));
    expect([...container.querySelectorAll<HTMLElement>('[data-order-cell]')].map((c) => c.dataset.orderCell)).toEqual(['watched', 'announced']);
  });

  it('tout vu : « Tout vu » à la place de « Ensuite »', async () => {
    await show(ready(graphOf([node(1), node(2)]), statesOf({ 1: watched, 2: watched })));
    expect(container.textContent).toContain(t('panel.order.allWatched'));
    expect(container.textContent).not.toContain(t('panel.order.next', { title: 'x' }).split(':')[0] + ':');
  });

  it('aucun compte : ni compte, ni « Ensuite »', async () => {
    await show(ready(graphOf([node(1), node(2)]), statesOf(null)));
    expect(container.textContent).not.toContain('/ 2');
    expect(container.textContent).not.toContain(t('panel.order.allWatched'));
    expect(container.querySelector('[data-order-cell]')).toBeNull();
  });

  it('franchise à une seule entrée : pas de section', async () => {
    await show(ready(graphOf([node(1)]), statesOf({})));
    expect(container.textContent).toBe('');
  });

  it('inactif : pas de section ; chargement : aria-busy ; erreur : message et « Réessayer »', async () => {
    await show({ status: 'idle' });
    expect(container.textContent).toBe('');
    await show({ status: 'loading' }, { open: true });
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    const onRetry = vi.fn();
    await show({ status: 'error', message: 'Hors ligne' }, { open: true, onRetry });
    expect(container.textContent).toContain('Hors ligne');
    await click('[data-focus="order-retry"]');
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('erreur sans message : texte générique', async () => {
    await show({ status: 'error' }, { open: true });
    expect(container.textContent).toContain(t('panel.order.error'));
  });

  it('graphe prêt sans la page courante : rien n’est dessiné (jamais de squelette éternel)', async () => {
    await show(ready(graphOf([node(1), node(2)]), statesOf({})), { currentId: 99, open: true });
    expect(container.textContent).toBe('');
    expect(container.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it('l’en-tête appelle onToggle', async () => {
    const onToggle = vi.fn();
    await show(ready(graphOf([node(1), node(2)]), statesOf({})), { onToggle });
    await click('[data-focus="panel-section-order"]');
    expect(onToggle).toHaveBeenCalledWith(true);
  });
});

describe('Ordre de visionnage : liste dépliée', () => {
  it('<ol> dans l’ordre de sortie, « Ici » et aria-current sur la page, note d’ordre de sortie', async () => {
    const main = [node(3, { year: 2003 }), node(1, { year: 2001 }), node(2, { year: 2002 })];
    await show(ready(graphOf(main), statesOf({})), { open: true, currentId: 2 });
    expect(container.querySelector('ol')).not.toBeNull();
    expect(rows().map((r) => r.dataset.orderRow)).toEqual(['1', '2', '3']);
    const here = rows()[1];
    expect(here?.getAttribute('aria-current')).toBe('true');
    expect(here?.textContent).toContain(t('panel.order.here'));
    expect(rows()[0]?.hasAttribute('aria-current')).toBe(false);
    expect(container.textContent).toContain(t('panel.order.releaseNote'));
  });

  it('interrupteur : « Tout » ajoute les extras, « Série principale » les retire', async () => {
    const graph = graphOf([node(1), node(2)], [{ node: node(9, { year: 2001, month: 6, format: 'OVA' }) }]);
    await show(ready(graph, statesOf({})), { open: true });
    await click('[data-focus="order-mode-main"]');
    expect(rows()).toHaveLength(2);
    await click('[data-focus="order-mode-all"]');
    expect(rows().map((r) => r.dataset.orderRow)).toEqual(['1', '9', '2']);
    await click('[data-focus="order-mode-main"]');
    expect(rows()).toHaveLength(2);
  });

  it('titre court (titre racine retiré) avec le titre complet en infobulle, état et infobulle de l’autre service', async () => {
    const main = [node(1, { title: 'Frieren' }), node(2, { title: 'Frieren: Season 2' })];
    await show(ready(graphOf(main), statesOf({ 1: watched, 2: { kind: 'inProgress', progress: 4 } }, { 10: { kind: 'planned', progress: null } })), { open: true });
    const second = rows()[1];
    const title = second?.querySelector<HTMLElement>('[data-order-title]');
    expect(title?.textContent).toBe('Season 2');
    expect(title?.getAttribute('title')).toBe('Frieren: Season 2');
    expect(second?.textContent).toContain(t('panel.order.state.inProgress', { progress: 4 }));
    const first = rows()[0]?.querySelector<HTMLElement>('[data-order-state]');
    expect(first?.textContent).toBe(t('panel.order.state.watched'));
    expect(first?.getAttribute('title')).toBe(t('panel.order.otherService', { service: 'MyAnimeList', state: t('panel.order.state.planned') }));
  });

  it('ORD-07 : AniList sans état et MyAnimeList « Vu » : « MyAnimeList : Vu » visible, en texte discret', async () => {
    await show(ready(graphOf([node(1), node(2)]), statesOf({ 1: watched }, { 10: watched, 20: watched })), { open: true });
    const state = rows()[1]?.querySelector<HTMLElement>('[data-order-state]');
    expect(state?.textContent).toBe(t('panel.order.otherService', { service: 'MyAnimeList', state: t('panel.order.state.watched') }));
    expect(state?.classList.contains('sr-only')).toBe(false);
  });

  it('ligne vue sans autre service : « Vu » seulement pour les lecteurs d’écran (la coche suffit à l’œil)', async () => {
    await show(ready(graphOf([node(1), node(2)]), statesOf({ 1: watched, 2: { kind: 'planned', progress: null } })), { open: true });
    const seen = rows()[0]?.querySelector<HTMLElement>('[data-order-state]');
    expect(seen?.textContent).toBe(t('panel.order.state.watched'));
    expect(seen?.classList.contains('sr-only')).toBe(true);
    expect(rows()[1]?.querySelector<HTMLElement>('[data-order-state]')?.classList.contains('sr-only')).toBe(false);
  });

  it('« Regarder » compact : bouton sm avec logo et nom accessible', async () => {
    const withPlatform = node(2, { platforms: [{ platform: 'crunchyroll', url: 'https://www.crunchyroll.com/series/X' }] });
    await show(ready(graphOf([node(1), withPlatform]), statesOf({})), { open: true });
    const watch = container.querySelector<HTMLElement>('[data-focus="order-watch-2"]');
    expect(watch?.dataset.size).toBe('sm');
    expect(watch?.querySelector('img, svg')).not.toBeNull();
  });

  it('3 entrées vues d’affilée : une ligne « N vus » dépliable', async () => {
    const main = eight();
    await show(ready(graphOf(main), statesOf({ 1: watched, 2: watched, 3: watched, 4: watched })), { open: true, currentId: 8 });
    expect(rows().map((r) => r.dataset.orderRow)).toEqual(['5', '6', '7', '8']);
    expect(container.querySelector('[data-order-run]')?.textContent).toContain(tp('panel.order.watchedRun', 4, { count: 4 }));
    await click('[data-order-run]');
    expect(rows()).toHaveLength(8);
  });

  it('deux entrées vues seulement : pas de regroupement ; la page courante n’est jamais regroupée', async () => {
    await show(ready(graphOf(eight()), statesOf({ 1: watched, 2: watched })), { open: true });
    expect(container.querySelector('[data-order-run]')).toBeNull();
    await show(ready(graphOf(eight()), statesOf({ 1: watched, 2: watched, 3: watched })), { open: true, currentId: 2 });
    expect(container.querySelector('[data-order-run]')).toBeNull();
    expect(rows().some((r) => r.dataset.orderRow === '2')).toBe(true);
  });

  it('« Afficher N de plus » après 5 lignes', async () => {
    await show(ready(graphOf(eight()), statesOf({})), { open: true });
    expect(rows()).toHaveLength(5);
    expect(container.querySelector('[data-order-more]')?.textContent).toBe(tp('panel.order.more', 3, { count: 3 }));
    await click('[data-order-more]');
    expect(rows()).toHaveLength(8);
    expect(container.querySelector('[data-order-more]')).toBeNull();
  });

  it('« Afficher N de plus » au clavier : focus sur la première ligne révélée, ni <body> ni l’onglet', async () => {
    await showInPanel(ready(graphOf(eight()), statesOf({})));
    const more = container.querySelector<HTMLElement>('[data-order-more]');
    more?.focus();
    await click('[data-order-more]');
    expect(rows()).toHaveLength(8);
    expect(focused()).toBe('order-entry-6');
  });

  it('« N vus » au clavier : focus sur la première ligne dépliée', async () => {
    await showInPanel(ready(graphOf(eight()), statesOf({ 1: watched, 2: watched, 3: watched, 4: watched })), 8);
    container.querySelector<HTMLElement>('[data-order-run]')?.focus();
    await click('[data-order-run]');
    expect(rows()).toHaveLength(8);
    expect(focused()).toBe('order-entry-1');
  });

  it('panneau étroit (< 340 px) : 3 lignes avant « Afficher N de plus »', async () => {
    narrow(true);
    await show(ready(graphOf(eight()), statesOf({})), { open: true });
    expect(rows()).toHaveLength(3);
    expect(container.querySelector('[data-order-more]')?.textContent).toBe(tp('panel.order.more', 5, { count: 5 }));
  });

  it('page sur un extra : ouvert en « Tout », « Ici » visible ; sur une entrée principale : « Série principale »', async () => {
    const graph = graphOf([node(1), node(2)], [{ node: node(9, { year: 2001, month: 6, format: 'OVA' }) }]);
    await show(ready(graph, statesOf({})), { open: true, currentId: 9 });
    expect(rows().find((r) => r.dataset.orderRow === '9')?.getAttribute('aria-current')).toBe('true');
    expect(container.querySelector('[data-focus="order-mode-all"]')?.getAttribute('aria-checked')).toBe('true');
    await click('[data-focus="order-mode-main"]');
    await show(ready(graph, statesOf({})), { open: true, currentId: 1 });
    expect(rows().some((r) => r.dataset.orderRow === '9')).toBe(false);
  });

  it('la page courante au-delà de la 5e ligne reste visible', async () => {
    await show(ready(graphOf(eight()), statesOf({})), { open: true, currentId: 7 });
    expect(rows().some((r) => r.dataset.orderRow === '7')).toBe(true);
  });

  it('graphe plafonné : avertissement avec le nombre d’entrées', async () => {
    await show(ready(graphOf([node(1), node(2)], [], true), statesOf({})), { open: true });
    expect(container.textContent).toContain(t('panel.order.tooLong', { count: 2 }));
  });

  it('« Regarder » sur le lecteur préféré et lien vers la fiche', async () => {
    const withPlatform = node(2, { platforms: [{ platform: 'crunchyroll', url: 'https://www.crunchyroll.com/series/X' }] });
    await show(ready(graphOf([node(1), withPlatform]), statesOf({})), { open: true });
    expect(container.querySelector<HTMLAnchorElement>('[data-focus="order-watch-2"]')?.href).toBe('https://www.crunchyroll.com/series/X');
    expect(container.querySelector('[data-focus="order-watch-1"]')).toBeNull();
    expect(container.querySelector<HTMLAnchorElement>('[data-order-row="2"] [data-order-title]')?.closest('a')?.href).toBe('https://anilist.co/anime/2');
  });
});

const announced = (over: Partial<FranchiseNode> = {}): FranchiseNode => node(20, { title: 'Frieren S2', status: 'NOT_YET_RELEASED', year: 2027, month: 1, day: 16, ...over });
const synced = (results: { service: 'anilist' | 'mal'; status: 'updated' | 'error' | 'skipped' }[]): SyncOutcome =>
  ({ status: 'synced', results: results.map(({ service, status }) => ({ service, outcome: status === 'updated' ? { status } : status === 'skipped' ? { status, reason: 'x', code: 'already-in-list' } : { status, message: 'boom' } })) }) as unknown as SyncOutcome;
const showSequel = (over: Partial<FranchiseNode>, unlisted: number[] = [20], connected: ('anilist' | 'mal')[] = ['anilist']): Promise<void> =>
  show(ready(graphOf([node(1), announced(over)]), statesOf({})), { open: true, unlistedSequels: new Set(unlisted), links: { connected, preferred: connected[0] ?? 'anilist' } });

describe('Ordre de visionnage : suites annoncées (badge et « + À regarder »)', () => {
  it('NOT_YET_RELEASED : « Annoncée · date » et « + À regarder »', async () => {
    await showSequel({});
    expect(container.querySelector('[data-relation-badge]')?.textContent).toContain(t('sequel.announced'));
    expect(container.querySelector('[data-relation-badge]')?.textContent).toContain('2027');
    expect(container.querySelector('[data-focus="relation-add-20"]')?.textContent).toBe(t('sequel.add'));
  });

  it('RELEASING hors de l’ensemble : ni badge ni bouton ; dans l’ensemble : « Déjà en diffusion » et le bouton', async () => {
    await showSequel({ status: 'RELEASING' }, []);
    expect(container.querySelector('[data-relation-badge]')).toBeNull();
    expect(container.querySelector('[data-focus="relation-add-20"]')).toBeNull();
    await showSequel({ status: 'RELEASING' }, [20]);
    expect(container.querySelector('[data-relation-badge]')?.textContent).toContain(t('sequel.airing'));
    expect(container.querySelector('[data-focus="relation-add-20"]')).not.toBeNull();
  });

  it('NOT_YET_RELEASED hors de l’ensemble : badge « Annoncée », pas de bouton', async () => {
    await showSequel({}, []);
    expect(container.querySelector('[data-relation-badge]')?.textContent).toContain(t('sequel.announced'));
    expect(container.querySelector('[data-focus="relation-add-20"]')).toBeNull();
  });

  it('entrée terminée : ni badge ni bouton', async () => {
    await showSequel({ status: 'FINISHED' });
    expect(container.querySelector('[data-relation-badge]')).toBeNull();
    expect(container.querySelector('[data-focus="relation-add-20"]')).toBeNull();
  });

  it('ajout réussi : UPDATE_SEQUELS listed, « Ajoutée à À regarder », le bouton disparaît', async () => {
    addToPlanning.mockResolvedValue(synced([{ service: 'anilist', status: 'updated' }]));
    await showSequel({});
    await click('[data-focus="relation-add-20"]');
    expect(addToPlanning).toHaveBeenCalledWith({ mediaId: 20, malId: 200 });
    expect(updateSequels).toHaveBeenCalledWith([20], 'listed');
    expect(container.textContent).toContain(t('sequel.added'));
    expect(container.querySelector('[data-focus="relation-add-20"]')).toBeNull();
  });

  it('ajout réussi mais UPDATE_SEQUELS en échec : « Ajoutée à À regarder » quand même', async () => {
    addToPlanning.mockResolvedValue(synced([{ service: 'anilist', status: 'updated' }]));
    updateSequels.mockResolvedValue(false);
    await showSequel({});
    await click('[data-focus="relation-add-20"]');
    expect(container.textContent).toContain(t('sequel.added'));
  });

  it('déjà dans la liste : « Dans ta liste », pas « Ajoutée »', async () => {
    addToPlanning.mockResolvedValue(synced([{ service: 'anilist', status: 'skipped' }]));
    await showSequel({});
    await click('[data-focus="relation-add-20"]');
    expect(container.textContent).toContain(t('sequel.inList'));
    expect(container.textContent).not.toContain(t('sequel.added'));
  });

  it('AniList écrit, MyAnimeList absent : « pas encore sur MyAnimeList »', async () => {
    addToPlanning.mockResolvedValue(synced([{ service: 'anilist', status: 'updated' }, { service: 'mal', status: 'error' }]));
    await showSequel({});
    await click('[data-focus="relation-add-20"]');
    expect(container.textContent).toContain(t('sequel.notOnMal'));
  });

  it('MyAnimeList seul et entrée sans idMal : « pas encore sur MyAnimeList », aucun bouton d’ajout', async () => {
    await showSequel({ idMal: null }, [20], ['mal']);
    expect(container.textContent).toContain(t('sequel.notOnMal'));
    expect(container.querySelector('[data-focus="relation-add-20"]')).toBeNull();
    await showSequel({ idMal: 200 }, [20], ['mal']);
    expect(container.querySelector('[data-focus="relation-add-20"]')).not.toBeNull();
  });

  it('échec : message, « Réessayer »', async () => {
    addToPlanning.mockResolvedValue({ status: 'error', message: 'Hors ligne' });
    await showSequel({});
    await click('[data-focus="relation-add-20"]');
    expect(container.textContent).toContain('Hors ligne');
    expect(container.querySelector('[data-focus="relation-add-20"]')?.textContent).toBe(t('common.retry'));
    expect(updateSequels).not.toHaveBeenCalled();
    // SEQ-03 : échec annoncé par la zone live, nom accessible construit autour du texte visible
    expect(container.querySelector('[data-alert]')?.getAttribute('data-alert')).toBe('Hors ligne');
    expect(container.querySelector('[data-focus="relation-add-20"]')?.getAttribute('aria-label')).toContain(t('common.retry'));
  });
});
