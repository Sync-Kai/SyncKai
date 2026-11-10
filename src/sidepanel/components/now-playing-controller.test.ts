import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FranchiseGraph, FranchiseNode, FranchiseResult, ListStates } from '../../shared/franchise';
import type { PageMediaContent } from '../../ui/page-media-controller';
import type { PanelMedia, PanelRecommendation } from '../../shared/panel-media.types';
import type { SessionEpochs } from '../../shared/session-epochs';
import type { InlineFeedback } from '../../ui/state';
import { STORAGE_KEYS } from '../../protocol/storage-keys';
import { SETTINGS_STORAGE_KEY } from '../../shared/settings';

// Ordre de visionnage dans le contrôleur de l'onglet « En lecture » : contrôleur de fiche et service worker simulés,
// chaque réponse est rendue à la main (séquence des messages GET_FRANCHISE / GET_LIST_STATES, courses de déconnexion).

interface Call {
  type: string;
  payload: unknown;
  resolve: (value: unknown) => void;
}

type ChangeListener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => void;

interface FakeOptions {
  onChange: () => void;
  onContent?: (content: PageMediaContent<PanelMedia>) => void;
  onActionDone?: () => void;
}

interface FakeState {
  calls: Call[];
  options: unknown;
  content: unknown;
  sessions: SessionEpochs;
  listeners: ChangeListener[];
  feedback: unknown;
  settings: Record<string, unknown>;
  stored: Record<string, unknown>;
}

const fake = vi.hoisted(
  (): FakeState => ({
    calls: [],
    options: null,
    content: { status: 'idle' },
    sessions: { anilist: 0 },
    listeners: [],
    feedback: null,
    settings: {},
    stored: {},
  }),
);


vi.mock('../../protocol/messages', () => ({
  sendMessage: (type: string, payload: unknown) => new Promise((resolve) => fake.calls.push({ type, payload, resolve })),
}));
vi.mock('../../browser/storage/sessions', () => ({ getOpenSessions: () => Promise.resolve(fake.sessions) }));
vi.mock('../../browser/storage/settings-access', async () => {
  const { DEFAULT_SETTINGS } = await import('../../shared/settings');
  return { getSettings: () => Promise.resolve({ ...DEFAULT_SETTINGS, ...fake.settings }) };
});
vi.mock('./live-progress', () => ({ createLiveProgress: () => ({ follow: () => undefined, store: {} }) }));
vi.mock('../../ui/page-media-controller', () => ({
  createPageMediaController: (options: unknown) => {
    fake.options = options;
    return {
      get content() {
        return fake.content;
      },
      actions: { busy: null, feedback: null },
      setTab: () => undefined,
      refresh: () => Promise.resolve(),
      retry: () => undefined,
      runAction: () => Promise.resolve(fake.feedback),
      pickSeason: () => undefined,
      dispose: () => undefined,
    };
  },
}));

vi.stubGlobal('chrome', {
  storage: {
    local: { get: (key: string) => Promise.resolve(key in fake.stored ? { [key]: fake.stored[key] } : {}) },
    onChanged: {
      addListener: (listener: ChangeListener) => void fake.listeners.push(listener),
      removeListener: (listener: ChangeListener) => void fake.listeners.splice(fake.listeners.indexOf(listener), 1),
    },
  },
});

const { createNowPlayingController } = await import('./now-playing-controller');

const flush = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

function node(id: number): FranchiseNode {
  return {
    id, idMal: id + 1000, title: `N${id}`, format: 'TV', status: 'FINISHED', episodes: 12, duration: 24, coverUrl: null, siteUrl: `https://anilist.co/anime/${id}`,
    year: 2000 + id, month: 1, day: 1, season: null, seasonYear: null, platforms: [],
  };
}

function graphOf(ids: number[], extras: number[] = []): FranchiseGraph {
  const nodes: Record<number, FranchiseNode> = {};
  for (const id of [...ids, ...extras]) nodes[id] = node(id);
  return { startId: ids[0], nodes, main: ids, extras: extras.map((id) => ({ id, relation: 'SIDE_STORY' as const, from: ids[0] })), capped: false, expanded: ids };
}

const STATES: ListStates = { anilist: { 1: { kind: 'watched', progress: null } }, mal: null };

const readyContent = (mediaId: number, over: { refreshing?: boolean; details?: PanelMedia | null; view?: object } = {}): PageMediaContent<PanelMedia> =>
  ({
    status: 'ready',
    page: {},
    view: over.view ?? { media: { mediaId } },
    details: over.details === undefined ? ({ mediaId, recommendations: [] } as unknown as PanelMedia) : over.details,
    detailsError: null,
    refreshing: over.refreshing ?? false,
  }) as unknown as PageMediaContent<PanelMedia>;

const emit = (content: PageMediaContent<PanelMedia>): void => {
  fake.content = content;
  (fake.options as FakeOptions).onContent?.(content);
  (fake.options as FakeOptions).onChange();
};

const callsOf = (type: string): Call[] => fake.calls.filter((c) => c.type === type);
const answer = async (type: string, value: unknown): Promise<void> => {
  const call = callsOf(type).find((c) => !('done' in c));
  if (!call) throw new Error(`Aucun appel ${type} en attente`);
  (call as Call & { done?: boolean }).done = true;
  call.resolve(value);
  await flush();
};
const pending = (type: string): Call[] => callsOf(type).filter((c) => !('done' in c));

let onChange: ReturnType<typeof vi.fn<() => void>>;
let ctl: ReturnType<typeof createNowPlayingController>;

beforeEach(() => {
  fake.calls = [];
  fake.content = { status: 'idle' };
  fake.sessions = { anilist: 0 };
  fake.listeners.length = 0;
  fake.feedback = null;
  fake.settings = {};
  fake.stored = {};
  onChange = vi.fn<() => void>();
  ctl = createNowPlayingController(onChange, { read: () => Promise.resolve([]) } as never);
});

const ok = (graph: FranchiseGraph): FranchiseResult => ({ ok: true, graph });

/** Fiche prête (détails reçus) puis ordre chargé */
async function loadedOrder(mediaId = 1, graph = graphOf([1, 2, 3], [9])): Promise<void> {
  emit(readyContent(mediaId));
  await flush();
  await answer('GET_FRANCHISE', ok(graph));
  await answer('GET_LIST_STATES', STATES);
}

describe('ordre de visionnage du panneau', () => {
  it('une fois les détails reçus : GET_FRANCHISE, puis GET_LIST_STATES avec les identifiants du graphe', async () => {
    emit(readyContent(1, { details: null }));
    await flush();
    expect(fake.calls).toHaveLength(0);
    emit(readyContent(1, { view: (fake.content as { view: object }).view }));
    await flush();
    expect(fake.calls.map((c) => c.type)).toEqual(['GET_FRANCHISE']);
    expect(fake.calls[0].payload).toEqual({ mediaId: 1 });
    expect(ctl.order).toEqual({ status: 'loading' });
    await answer('GET_FRANCHISE', ok(graphOf([1, 2], [9])));
    expect(callsOf('GET_LIST_STATES')[0].payload).toEqual({ mediaIds: [1, 2, 9], malIds: [1001, 1002, 1009] });
    await answer('GET_LIST_STATES', STATES);
    expect(ctl.order.status).toBe('ready');
    expect(ctl.order).toMatchObject({ states: STATES });
  });

  it('page changée vers une autre franchise : GET_FRANCHISE de nouveau', async () => {
    await loadedOrder(1, graphOf([1, 2]));
    emit(readyContent(50));
    await flush();
    expect(pending('GET_FRANCHISE')).toHaveLength(1);
    expect(callsOf('GET_FRANCHISE')[1].payload).toEqual({ mediaId: 50 });
  });

  it('page changée dans la même franchise : graphe gardé, états relus, aucun chargement affiché', async () => {
    await loadedOrder(1, graphOf([1, 2, 3], [9]));
    emit(readyContent(2, { details: null }));
    emit(readyContent(2));
    await flush();
    expect(callsOf('GET_FRANCHISE')).toHaveLength(1);
    expect(ctl.order.status).toBe('ready');
    expect(pending('GET_LIST_STATES')).toHaveLength(1);
    expect(pending('GET_LIST_STATES')[0].payload).toEqual({ mediaIds: [1, 2, 3, 9], malIds: [1001, 1002, 1003, 1009] });
  });

  it('relecture du panneau (Actualiser) : GET_LIST_STATES sans relire le graphe, sans fresh', async () => {
    await loadedOrder();
    emit(readyContent(1, { refreshing: true }));
    emit(readyContent(1));
    await flush();
    expect(callsOf('GET_FRANCHISE')).toHaveLength(1);
    expect(pending('GET_LIST_STATES')).toHaveLength(1);
    expect(pending('GET_LIST_STATES')[0].payload).not.toHaveProperty('fresh');
  });

  it('mise à jour des détails seule (même fiche) : aucune requête', async () => {
    await loadedOrder();
    emit(readyContent(1, { view: (fake.content as { view: object }).view }));
    await flush();
    expect(pending('GET_LIST_STATES')).toHaveLength(0);
  });

  it('action de liste réussie : GET_LIST_STATES avec fresh, une seule fois malgré la relecture de la fiche', async () => {
    await loadedOrder();
    const before = callsOf('GET_LIST_STATES').length;
    fake.feedback = { tone: 'success', text: '', detail: '' } satisfies InlineFeedback;
    const run = ctl.runAction({ kind: 'adjust', delta: 1 });
    // La fiche est relue pendant l'action : pas de lecture intermédiaire
    emit(readyContent(1, { refreshing: true }));
    emit(readyContent(1));
    await run;
    await flush();
    const sent = callsOf('GET_LIST_STATES').slice(before);
    expect(sent).toHaveLength(1);
    expect(sent[0].payload).toMatchObject({ fresh: true });
  });

  it.each([{ kind: 'rate', value: 8 }, { kind: 'notes', notes: 'x' }] as const)('$kind ne change ni statut ni progression : jamais de fresh', async (request) => {
    await loadedOrder();
    const before = callsOf('GET_LIST_STATES').length;
    fake.feedback = { tone: 'success', text: '', detail: '' } satisfies InlineFeedback;
    await ctl.runAction(request);
    await flush();
    for (const call of callsOf('GET_LIST_STATES').slice(before)) expect(call.payload).not.toHaveProperty('fresh');
  });

  it('lecteur préféré changé avec l\'ordre prêt : panneau redessiné (le « Regarder » de la chronologie suit)', async () => {
    await loadedOrder();
    await flush();
    onChange.mockClear();
    fake.settings = { preferredPlayer: 'adn' };
    fake.listeners.forEach((listener) => listener({ [SETTINGS_STORAGE_KEY]: {} }, 'local'));
    await flush();
    expect(ctl.preferred).toBe('adn');
    expect(onChange).toHaveBeenCalled();
  });

  it('page changée pendant le chargement du graphe, vers une entrée du graphe reçu : un seul GET_FRANCHISE', async () => {
    emit(readyContent(1));
    await flush();
    emit(readyContent(2));
    await flush();
    expect(callsOf('GET_FRANCHISE')).toHaveLength(1);
    await answer('GET_FRANCHISE', ok(graphOf([1, 2, 3])));
    await answer('GET_LIST_STATES', STATES);
    expect(callsOf('GET_FRANCHISE')).toHaveLength(1);
    expect(ctl.order.status).toBe('ready');
  });

  it('page changée pendant le chargement, vers une entrée absente du graphe reçu : GET_FRANCHISE pour elle', async () => {
    emit(readyContent(1));
    await flush();
    emit(readyContent(50));
    await flush();
    expect(callsOf('GET_FRANCHISE')).toHaveLength(1);
    await answer('GET_FRANCHISE', ok(graphOf([1, 2])));
    expect(callsOf('GET_FRANCHISE')).toHaveLength(2);
    expect(callsOf('GET_FRANCHISE')[1].payload).toEqual({ mediaId: 50 });
    expect(ctl.order.status).toBe('loading');
  });

  it('action de liste en échec : aucune relecture des états', async () => {
    await loadedOrder();
    const before = callsOf('GET_LIST_STATES').length;
    fake.feedback = { tone: 'error', text: '', detail: '' } satisfies InlineFeedback;
    await ctl.runAction({ kind: 'adjust', delta: 1 });
    await flush();
    expect(callsOf('GET_LIST_STATES')).toHaveLength(before);
  });

  it('comptes changés sans session restante : états nuls, aucune requête', async () => {
    await loadedOrder();
    const before = fake.calls.length;
    fake.sessions = {};
    for (const listener of fake.listeners) listener({ [STORAGE_KEYS.anilistToken]: {} }, 'local');
    await flush();
    expect(fake.calls).toHaveLength(before);
    expect(ctl.order).toMatchObject({ status: 'ready', states: { anilist: null, mal: null } });
  });

  it('comptes inchangés (renouvellement du token) : aucune requête', async () => {
    await loadedOrder();
    const before = fake.calls.length;
    for (const listener of fake.listeners) listener({ [STORAGE_KEYS.malToken]: {} }, 'local');
    await flush();
    expect(fake.calls).toHaveLength(before);
  });

  it('reconnexion : états relus', async () => {
    await loadedOrder();
    fake.sessions = {};
    for (const listener of fake.listeners) listener({ [STORAGE_KEYS.anilistToken]: {} }, 'local');
    await flush();
    fake.sessions = { anilist: 1 };
    for (const listener of fake.listeners) listener({ [STORAGE_KEYS.anilistToken]: {} }, 'local');
    await flush();
    expect(pending('GET_LIST_STATES')).toHaveLength(1);
  });

  it('réponse tardive d\'un ancien compte ignorée après déconnexion', async () => {
    await loadedOrder();
    emit(readyContent(1, { refreshing: true }));
    emit(readyContent(1));
    await flush();
    fake.sessions = {};
    for (const listener of fake.listeners) listener({ [STORAGE_KEYS.anilistToken]: {} }, 'local');
    await flush();
    await answer('GET_LIST_STATES', STATES);
    expect(ctl.order).toMatchObject({ status: 'ready', states: { anilist: null, mal: null } });
  });

  it('échec du graphe : erreur, puis retryOrder renvoie GET_FRANCHISE', async () => {
    emit(readyContent(1));
    await flush();
    await answer('GET_FRANCHISE', { ok: false, message: 'Boum' } satisfies FranchiseResult);
    expect(ctl.order).toEqual({ status: 'error', message: 'Boum' });
    ctl.retryOrder();
    await flush();
    expect(pending('GET_FRANCHISE')).toHaveLength(1);
    expect(ctl.order).toEqual({ status: 'loading' });
  });

  it('page changée pendant un parcours qui échoue : GET_FRANCHISE pour la nouvelle page, pas l\'erreur de l\'ancienne', async () => {
    emit(readyContent(1));
    await flush();
    emit(readyContent(50));
    await flush();
    await answer('GET_FRANCHISE', { ok: false, message: 'Boum' } satisfies FranchiseResult);
    expect(callsOf('GET_FRANCHISE')).toHaveLength(2);
    expect(callsOf('GET_FRANCHISE')[1].payload).toEqual({ mediaId: 50 });
    expect(ctl.order).toEqual({ status: 'loading' });
  });

  it('page changée pendant un parcours dont le service worker est injoignable : même reprise', async () => {
    emit(readyContent(1));
    await flush();
    emit(readyContent(50));
    await flush();
    fake.calls[0].resolve(Promise.reject(new Error('sw')));
    await flush();
    expect(callsOf('GET_FRANCHISE')).toHaveLength(2);
    expect(ctl.order).toEqual({ status: 'loading' });
  });

  it('lecture des états en échec : ordre prêt sans états', async () => {
    emit(readyContent(1));
    await flush();
    await answer('GET_FRANCHISE', ok(graphOf([1, 2])));
    fake.calls[1].resolve(Promise.reject(new Error('sw')));
    await flush();
    expect(ctl.order).toMatchObject({ status: 'ready', states: { anilist: null, mal: null } });
  });

  it('onglet quitté : ordre remis à zéro', async () => {
    await loadedOrder();
    emit({ status: 'idle' });
    expect(ctl.order).toEqual({ status: 'idle' });
  });
});

const recoOf = (mediaId: number, over: Partial<PanelRecommendation> = {}): PanelRecommendation => ({
  mediaId, idMal: mediaId + 1000, title: `R${mediaId}`, format: 'TV', startYear: 2020, coverUrl: null, siteUrl: `https://anilist.co/anime/${mediaId}`, rating: 5, platforms: [], prequelIds: [], prequelMalIds: [], ...over,
});
const withRecos = (mediaId: number, recommendations: PanelRecommendation[]): PageMediaContent<PanelMedia> =>
  readyContent(mediaId, { details: { mediaId, recommendations } as unknown as PanelMedia });

describe('« Dans le même esprit » du panneau', () => {
  it('sans recommandation : aucune requête', async () => {
    emit(readyContent(1));
    await flush();
    expect(pending('GET_LIST_STATES')).toHaveLength(0);
    expect(ctl.similar).toEqual([]);
  });

  it('GET_LIST_STATES avec les recommandations non écartées et leurs préquels, puis lignes filtrées', async () => {
    fake.stored = { [STORAGE_KEYS.recoDismissed]: [12] };
    emit(withRecos(1, [recoOf(10, { prequelIds: [100], prequelMalIds: [1100] }), recoOf(11), recoOf(12), recoOf(13, { prequelIds: [101], prequelMalIds: [null] })]));
    await flush();
    const call = callsOf('GET_LIST_STATES').find((c) => (c.payload as { mediaIds: number[] }).mediaIds.includes(10));
    expect(call?.payload).toEqual({ mediaIds: [10, 11, 13, 100, 101], malIds: [1010, 1011, 1013, 1100] });
    await answer('GET_FRANCHISE', ok(graphOf([1])));
    call?.resolve({ anilist: { 11: { kind: 'planned', progress: null }, 100: { kind: 'watched', progress: null }, 101: null }, mal: null } satisfies ListStates);
    await flush();
    expect(ctl.similar.map((r) => r.mediaId)).toEqual([10]);
  });

  it('aucune session : aucune requête, lignes non filtrées par les listes mais écartées retirées', async () => {
    fake.sessions = {};
    fake.stored = { [STORAGE_KEYS.recoDismissed]: [11] };
    emit(withRecos(1, [recoOf(10), recoOf(11)]));
    await flush();
    expect(callsOf('GET_LIST_STATES').filter((c) => (c.payload as { mediaIds: number[] }).mediaIds.includes(10))).toHaveLength(0);
    expect(ctl.similar.map((r) => r.mediaId)).toEqual([10]);
  });

  it('aucune session : une recommandation avec préquel est gardée', async () => {
    fake.sessions = {};
    emit(withRecos(1, [recoOf(10, { prequelIds: [100], prequelMalIds: [1100] })]));
    await flush();
    expect(ctl.similar.map((r) => r.mediaId)).toEqual([10]);
  });

  it('échec de lecture des états avec un compte connecté : aucune ligne (rien ne prouve qu\'elles ne sont pas en liste)', async () => {
    emit(withRecos(1, [recoOf(10)]));
    await flush();
    const call = callsOf('GET_LIST_STATES').find((c) => (c.payload as { mediaIds: number[] }).mediaIds.includes(10));
    call?.resolve(Promise.reject(new Error('sw')));
    await flush();
    expect(ctl.similar).toEqual([]);
  });

  it('page quittée : lignes vidées', async () => {
    fake.sessions = {};
    emit(withRecos(1, [recoOf(10)]));
    await flush();
    expect(ctl.similar).toHaveLength(1);
    emit({ status: 'idle' });
    expect(ctl.similar).toEqual([]);
  });
});
