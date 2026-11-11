import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ALL_RECO_FILTER, type RecoBatch, type RecoFilter, type RecoItem, type RecoResult } from '../shared/recommendations';
import type { RecoView } from './reco-controller';

// Contrôleur des suggestions : faux service worker (réponses par type de message), tirage local et minuterie simulée.

const sw = vi.hoisted(() => ({ calls: [] as { type: string; payload: unknown }[], handler: (_type: string, _payload: unknown): unknown => undefined }));

vi.mock('../protocol/messages', () => ({
  sendMessage: (type: string, payload: unknown) => {
    sw.calls.push({ type, payload });
    return Promise.resolve(sw.handler(type, payload));
  },
}));

// chrome.storage.onChanged minimal : le contrôleur y écoute les changements de lot et de session
const storage = vi.hoisted(() => ({ listeners: new Set<(changes: Record<string, { oldValue?: unknown; newValue?: unknown }>, area: string) => void>() }));
vi.stubGlobal('chrome', { storage: { onChanged: { addListener: (l: never) => storage.listeners.add(l), removeListener: (l: never) => storage.listeners.delete(l) } } });
const emit = (changes: Record<string, { oldValue?: unknown; newValue?: unknown }>, area = 'local'): void => storage.listeners.forEach((l) => l(changes, area));

const { createRecoController } = await import('./reco-controller');
const { t } = await import('../i18n');

const item = (id: number, over: Partial<RecoItem['card']> = {}): RecoItem => ({
  card: { id, idMal: id + 1000, title: `Série ${id}`, format: 'TV', year: 2024, episodes: 12, averageScore: 80, genres: ['Action'], tags: [], coverUrl: null, coverLarge: null, color: null, bannerUrl: null, siteUrl: `https://anilist.co/anime/${id}`, platforms: [], ...over },
  score: 10,
  reason: { seedId: 1, seedTitle: 'Seed', seedScore: 9, rated: true, matched: ['Action'] },
});
const batchOf = (count: number, cold = false): RecoBatch => ({ items: Array.from({ length: count }, (_, i) => item(i + 1)), computedAt: 1, seedCount: 5, cold });
const okResult = (batch: RecoBatch, malOnly = false): RecoResult => ({ ok: true, batch, malOnly });
const added = { status: 'synced', results: [{ service: 'anilist', outcome: { status: 'updated' } }] };

async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}
const ready = (view: RecoView): Extract<RecoView, { status: 'ready' }> => {
  if (view.status !== 'ready') throw new Error(`état ${view.status}`);
  return view;
};
const types = (): string[] => sw.calls.map((c) => c.type);

beforeEach(() => {
  vi.useFakeTimers();
  sw.calls = [];
  sw.handler = (type) => (type === 'GET_RECOMMENDATIONS' ? okResult(batchOf(3)) : type === 'ADD_TO_LIST' ? added : true);
});
afterEach(() => vi.useRealTimers());

async function start(): Promise<ReturnType<typeof createRecoController>> {
  const controller = createRecoController();
  await settle();
  return controller;
}

describe('createRecoController', () => {
  it('charge une seule fois et tire une première suggestion', async () => {
    const c = await start();
    expect(sw.calls.filter((call) => call.type === 'GET_RECOMMENDATIONS')).toHaveLength(1);
    const view = ready(c.store.get());
    expect(view.current.card.id).toBeGreaterThan(0);
    expect(view.previous).toEqual([]);
    c.dispose();
  });

  it('commence en chargement', () => {
    const c = createRecoController();
    expect(c.store.get().status).toBe('loading');
    c.dispose();
  });

  it('« Autre » ne répète jamais une suggestion de la page puis passe à vide', async () => {
    const c = await start();
    const seen = [ready(c.store.get()).current.card.id];
    c.another();
    seen.push(ready(c.store.get()).current.card.id);
    c.another();
    seen.push(ready(c.store.get()).current.card.id);
    expect(new Set(seen).size).toBe(3);
    c.another();
    expect(c.store.get().status).toBe('empty');
    c.dispose();
  });

  it('garde les 8 dernières tirées, la plus récente d\'abord', async () => {
    sw.handler = () => okResult(batchOf(20));
    const c = await start();
    const drawn = [ready(c.store.get()).current.card.id];
    for (let i = 0; i < 10; i++) {
      c.another();
      drawn.push(ready(c.store.get()).current.card.id);
    }
    const previous = ready(c.store.get()).previous.map((i) => i.card.id);
    expect(previous).toHaveLength(8);
    expect(previous).toEqual(drawn.slice(2, 10).reverse());
    c.dispose();
  });

  it('ajouter : ADD_TO_LIST PLANNING puis UPDATE_RECOMMENDATION added, le bouton devient « Dans À regarder »', async () => {
    const c = await start();
    const id = ready(c.store.get()).current.card.id;
    await c.add();
    expect(sw.calls.find((call) => call.type === 'ADD_TO_LIST')?.payload).toEqual({ mediaId: id, malId: id + 1000, status: 'PLANNING' });
    expect(sw.calls.find((call) => call.type === 'UPDATE_RECOMMENDATION')?.payload).toEqual({ id, action: 'added' });
    expect(types().indexOf('ADD_TO_LIST')).toBeLessThan(types().indexOf('UPDATE_RECOMMENDATION'));
    expect(ready(c.store.get()).added).toBe(true);
    c.dispose();
  });

  it('ajout en échec : rien n\'est marqué, message visible', async () => {
    sw.handler = (type) => (type === 'GET_RECOMMENDATIONS' ? okResult(batchOf(3)) : { status: 'error', message: 'Réseau' });
    const c = await start();
    await c.add();
    const view = ready(c.store.get());
    expect(view.added).toBe(false);
    expect(view.addError).toBe('Réseau');
    expect(types()).not.toContain('UPDATE_RECOMMENDATION');
    c.dispose();
  });

  it('MyAnimeList seul et sans idMal : add() ne part pas', async () => {
    sw.handler = (type) => (type === 'GET_RECOMMENDATIONS' ? okResult({ ...batchOf(1), items: [item(1, { idMal: null })] }, true) : added);
    const c = await start();
    await c.add();
    expect(types()).not.toContain('ADD_TO_LIST');
    c.dispose();
  });

  it('écart non enregistré : l\'erreur reste visible', async () => {
    sw.handler = (type) => (type === 'GET_RECOMMENDATIONS' ? okResult(batchOf(3)) : false);
    const c = await start();
    await c.dismiss();
    expect(ready(c.store.get()).addError).toContain(t('popup.swUnreachable'));
    c.dispose();
  });

  it('écarter : UPDATE dismissed, « Annuler » 5 s puis le tirage suivant', async () => {
    const c = await start();
    const first = ready(c.store.get()).current;
    await c.dismiss();
    expect(sw.calls.find((call) => call.type === 'UPDATE_RECOMMENDATION')?.payload).toEqual({ id: first.card.id, action: 'dismissed' });
    expect(ready(c.store.get()).dismissedTitle).toBe(first.card.title);
    vi.advanceTimersByTime(4900);
    expect(ready(c.store.get()).dismissedTitle).toBe(first.card.title);
    vi.advanceTimersByTime(200);
    const view = ready(c.store.get());
    expect(view.dismissedTitle).toBeNull();
    expect(view.current.card.id).not.toBe(first.card.id);
    c.dispose();
  });

  it('une suggestion écartée ne figure pas dans « Déjà tirées »', async () => {
    const c = await start();
    const first = ready(c.store.get()).current;
    await c.dismiss();
    vi.advanceTimersByTime(5100);
    const view = ready(c.store.get());
    expect(view.current.card.id).not.toBe(first.card.id);
    expect(view.previous.map((i) => i.card.id)).not.toContain(first.card.id);
    c.dispose();
  });

  it('un id retiré du lot enregistré (ajout ailleurs) n\'est plus tiré', async () => {
    const c = await start();
    const shown = ready(c.store.get()).current.card.id;
    emit({ 'reco:batch': { newValue: batchOf(3) } });
    c.another();
    expect(ready(c.store.get()).current.card.id).not.toBe(shown);
    emit({ 'reco:batch': { newValue: { ...batchOf(3), items: batchOf(3).items.filter((i) => i.card.id === shown) } } });
    c.another();
    expect(c.store.get().status).toBe('empty');
    c.dispose();
  });

  it('autre compte (sessionEpoch) ou connexion : le lot est rechargé ; un jeton rafraîchi : rien', async () => {
    const c = await start();
    const loads = (): number => sw.calls.filter((call) => call.type === 'GET_RECOMMENDATIONS').length;
    emit({ anilistToken: { oldValue: 'a', newValue: 'b' } });
    await settle();
    expect(loads()).toBe(1);
    emit({ sessionEpoch: { oldValue: { anilist: 0 }, newValue: { anilist: 1 } } });
    await settle();
    expect(loads()).toBe(2);
    emit({ anilistToken: { newValue: 'c' } });
    await settle();
    expect(loads()).toBe(3);
    emit({ anilistToken: { oldValue: 'c', newValue: 'd' } }, 'sync');
    await settle();
    expect(loads()).toBe(3);
    c.dispose();
    expect(storage.listeners.size).toBe(0);
  });

  it('annuler : UPDATE undo, la suggestion reste et la minuterie est coupée', async () => {
    const c = await start();
    const first = ready(c.store.get()).current;
    await c.dismiss();
    await c.undo();
    expect(sw.calls.findLast((call) => call.type === 'UPDATE_RECOMMENDATION')?.payload).toEqual({ id: first.card.id, action: 'undo' });
    vi.advanceTimersByTime(6000);
    const view = ready(c.store.get());
    expect(view.dismissedTitle).toBeNull();
    expect(view.current.card.id).toBe(first.card.id);
    c.dispose();
  });

  it('écarter la dernière suggestion puis laisser passer 5 s : vide', async () => {
    sw.handler = (type) => (type === 'GET_RECOMMENDATIONS' ? okResult(batchOf(1)) : true);
    const c = await start();
    await c.dismiss();
    vi.advanceTimersByTime(5100);
    expect(c.store.get().status).toBe('empty');
    c.dispose();
  });

  it('lot vide : vide ; pas de compte : none ; échec : error puis retry', async () => {
    sw.handler = () => okResult(batchOf(0));
    const empty = await start();
    expect(empty.store.get().status).toBe('empty');
    empty.dispose();

    sw.handler = () => ({ ok: false, code: 'NO_ACCOUNT', message: 'x' });
    const none = await start();
    expect(none.store.get().status).toBe('none');
    none.dispose();

    sw.handler = () => ({ ok: false, code: 'FAILED', message: 'boom' });
    const failed = await start();
    expect(failed.store.get()).toEqual({ status: 'error', message: 'boom' });
    sw.handler = () => okResult(batchOf(2));
    failed.retry();
    expect(failed.store.get().status).toBe('loading');
    await settle();
    expect(failed.store.get().status).toBe('ready');
    failed.dispose();
  });

  it('SESSION_CHANGED : une seule relance silencieuse', async () => {
    let n = 0;
    sw.handler = () => (n++ === 0 ? { ok: false, code: 'SESSION_CHANGED', message: 'x' } : okResult(batchOf(2)));
    const c = await start();
    expect(c.store.get().status).toBe('ready');
    expect(sw.calls.filter((call) => call.type === 'GET_RECOMMENDATIONS')).toHaveLength(2);
    c.dispose();

    sw.calls = [];
    sw.handler = () => ({ ok: false, code: 'SESSION_CHANGED', message: 'x' });
    const twice = await start();
    expect(twice.store.get().status).toBe('error');
    expect(sw.calls.filter((call) => call.type === 'GET_RECOMMENDATIONS')).toHaveLength(2);
    twice.dispose();
  });

  it('transmet cold et malOnly', async () => {
    sw.handler = () => okResult(batchOf(2, true), true);
    const c = await start();
    const view = ready(c.store.get());
    expect(view.cold).toBe(true);
    expect(view.malOnly).toBe(true);
    c.dispose();
  });

  it('restore : RESTORE_RECOMMENDATIONS puis rechargement depuis zéro', async () => {
    const c = await start();
    c.another();
    c.another();
    c.another();
    expect(c.store.get().status).toBe('empty');
    await c.restore();
    await settle();
    expect(types()).toContain('RESTORE_RECOMMENDATIONS');
    const view = ready(c.store.get());
    expect(view.previous).toEqual([]);
    c.dispose();
  });

  it('dispose : plus de minuterie ni de réponse appliquée', async () => {
    const c = await start();
    await c.dismiss();
    const snapshot = c.store.get();
    c.dispose();
    vi.advanceTimersByTime(6000);
    expect(c.store.get()).toBe(snapshot);
  });

  describe('filtre', () => {
    afterEach(() => vi.restoreAllMocks());
    // 1 à 4 : films ; 5 à 7 : séries ; 8 : format inconnu
    const mixed = (): RecoBatch => ({
      items: [
        ...[1, 2, 3, 4].map((id) => item(id, { format: 'MOVIE', genres: id === 4 ? ['Drama'] : ['Action'] })),
        ...[5, 6, 7].map((id) => item(id, { format: 'TV', genres: ['Comedy', 'Action'] })),
        item(8, { format: null, genres: [] }),
      ],
      computedAt: 1,
      seedCount: 5,
      cold: false,
    });
    const movies: RecoFilter = { genre: null, format: 'movies' };
    const startWith = async (filter?: RecoFilter): Promise<ReturnType<typeof createRecoController>> => {
      sw.handler = (type) => (type === 'GET_RECOMMENDATIONS' ? okResult(mixed()) : true);
      const controller = createRecoController(filter ? { filter } : undefined);
      await settle();
      return controller;
    };

    it('sans option : vue ready avec ALL_RECO_FILTER (panneau inchangé)', async () => {
      const c = await startWith();
      const view = ready(c.store.get());
      expect(view.filter).toEqual(ALL_RECO_FILTER);
      expect(view.genres).toEqual(['Action', 'Comedy', 'Drama']);
      c.dispose();
    });

    it('filtre Films : la fiche tirée et « Autre » restent des films', async () => {
      const c = await startWith(movies);
      const seen: number[] = [];
      for (let i = 0; i < 4; i++) {
        const view = ready(c.store.get());
        expect(view.filter).toEqual(movies);
        expect(view.current.card.format).toBe('MOVIE');
        seen.push(view.current.card.id);
        c.another();
      }
      expect(new Set(seen).size).toBe(4);
      expect(c.store.get().status).toBe('filtered');
      c.dispose();
    });

    it('changer de filtre garde la fiche si elle correspond, sinon en tire une', async () => {
      // Tirage déterministe : la première fiche du réservoir
      vi.spyOn(Math, 'random').mockReturnValue(0);
      const c = await startWith();
      expect(ready(c.store.get()).current.card.id).toBe(1);
      c.setFilter({ genre: 'Action', format: 'all' });
      expect(ready(c.store.get()).current.card.id).toBe(1);
      c.setFilter({ genre: 'Drama', format: 'all' });
      expect(ready(c.store.get()).current.card.id).toBe(4);
      c.setFilter({ genre: null, format: 'series' });
      const view = ready(c.store.get());
      expect(view.current.card.id).toBe(5);
      expect(view.filter).toEqual({ genre: null, format: 'series' });
      c.dispose();
    });

    it('filtre sans fiche : état filtered ; ALL_RECO_FILTER redonne une fiche', async () => {
      const c = await startWith();
      const none: RecoFilter = { genre: 'Drama', format: 'series' };
      c.setFilter(none);
      const view = c.store.get();
      expect(view).toEqual({ status: 'filtered', filter: none, genres: ['Action', 'Comedy', 'Drama'] });
      c.setFilter(ALL_RECO_FILTER);
      expect(ready(c.store.get()).filter).toEqual(ALL_RECO_FILTER);
      c.dispose();
    });

    it('sans filtre, plus rien à tirer : vide (pas filtered)', async () => {
      const c = await startWith();
      for (let i = 0; i < 8; i++) c.another();
      expect(c.store.get().status).toBe('empty');
      c.dispose();
    });

    it('genre retenu absent du lot : filtre ramené à Tous, une fiche s’affiche', async () => {
      const c = await startWith({ genre: 'Horror', format: 'all' });
      expect(ready(c.store.get()).filter).toEqual(ALL_RECO_FILTER);
      c.dispose();
      // Le format retenu, lui, est gardé
      const films = await startWith({ genre: 'Horror', format: 'movies' });
      const view = ready(films.store.get());
      expect(view.filter).toEqual(movies);
      expect(view.current.card.format).toBe('MOVIE');
      films.dispose();
    });

    it('le filtre posé pendant le chargement s’applique au lot reçu', async () => {
      sw.handler = (type) => (type === 'GET_RECOMMENDATIONS' ? okResult(mixed()) : true);
      const c = createRecoController();
      c.setFilter(movies);
      expect(c.store.get().status).toBe('loading');
      await settle();
      expect(ready(c.store.get()).current.card.format).toBe('MOVIE');
      c.dispose();
    });
  });
});
