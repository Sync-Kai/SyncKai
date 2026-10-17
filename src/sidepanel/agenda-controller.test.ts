import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { shiftWeek, type AiringWeekCache, type IsoWeekday } from '../shared/agenda';
import type { WatchingEntry, WatchingList } from '../shared/watching.types';
import { DEFAULT_SETTINGS } from '../shared/settings';
import { STORAGE_KEYS } from '../protocol/storage-keys';
import type { StreamingPlatform } from '../platforms/registry';
import type { PlatformAccessStore } from '../ui/platform-access-store';

// Données de l'Agenda (sans rendu) : comptes, séries en cours, cache de la semaine, requête GET_AGENDA en cours jamais
// jetée par un chargement automatique, écouteur du stockage retiré par dispose

interface PendingCall {
  type: string;
  payload: unknown;
  resolve: (value: unknown) => void;
}

type ChangeListener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => void;

const fake = vi.hoisted(() => ({
  calls: [] as PendingCall[],
  anilist: true,
  mal: false,
  watching: null as WatchingList | null,
  weekCache: null as AiringWeekCache | null,
  preferred: null as StreamingPlatform | null,
  listeners: [] as ChangeListener[],
  offsets: [] as { mediaId: number; offset: number | null }[],
}));

/** Premier jour de la semaine de la locale (relu à chaque affichage de l'onglet) */
let firstDay: IsoWeekday = 1;

vi.mock('../protocol/messages', () => ({
  sendMessage: (type: string, payload: unknown) => new Promise((resolve) => fake.calls.push({ type, payload, resolve })),
}));
vi.mock('../browser/storage/settings-access', () => ({ getSettings: () => Promise.resolve({ ...DEFAULT_SETTINGS, ...(fake.preferred ? { preferredPlayer: fake.preferred } : {}) }) }));
vi.mock('../browser/storage/tokens', () => ({ hasValidAniListToken: () => Promise.resolve(fake.anilist), hasMalToken: () => Promise.resolve(fake.mal) }));
vi.mock('../browser/storage/watching-cache', () => ({ getCachedWatching: (service: string) => Promise.resolve(service === 'anilist' ? fake.watching : null) }));
vi.mock('../browser/storage/agenda-store', () => ({
  agendaFirstDay: () => firstDay,
  readWeekCache: () => Promise.resolve(fake.weekCache),
  saveSeriesOffset: (mediaId: number, offset: number | null) => {
    fake.offsets.push({ mediaId, offset });
    return Promise.resolve();
  },
}));
vi.mock('../shared/exclusions', async (importOriginal) => ({ ...(await importOriginal<typeof import('../shared/exclusions')>()), getExcludedSeries: () => Promise.resolve([]) }));

vi.stubGlobal('chrome', {
  storage: {
    onChanged: {
      addListener: (listener: ChangeListener) => void fake.listeners.push(listener),
      removeListener: (listener: ChangeListener) => void fake.listeners.splice(fake.listeners.indexOf(listener), 1),
    },
  },
});

const { createAgendaController, NAV_DEBOUNCE_MS, STORAGE_DEBOUNCE_MS } = await import('./agenda-controller');

function access(granted: readonly StreamingPlatform[]): PlatformAccessStore {
  return {
    get: () => granted,
    subscribe: () => () => true,
    refresh: () => Promise.resolve(granted),
    read: () => Promise.resolve(granted),
    has: (platform) => Promise.resolve(granted.includes(platform)),
    onPermissionsChange: () => () => true,
    dispose: () => undefined,
  };
}

function entry(mediaId: number): WatchingEntry {
  return {
    mediaId,
    malId: null,
    title: `Série ${mediaId}`,
    coverUrl: null,
    progress: 3,
    totalEpisodes: 12,
    updatedAt: null,
    nextEpisode: null,
    airingStatus: 'RELEASING',
    platforms: [],
    lastSync: null,
    siteUrl: `https://anilist.co/anime/${mediaId}`,
  };
}

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function answerAgenda(value: unknown): void {
  const call = fake.calls.find((c) => c.type === 'GET_AGENDA');
  if (!call) throw new Error('Aucun GET_AGENDA en attente');
  fake.calls.splice(fake.calls.indexOf(call), 1);
  call.resolve(value);
}

const agendaCalls = (): PendingCall[] => fake.calls.filter((c) => c.type === 'GET_AGENDA');

beforeEach(() => {
  fake.calls.length = 0;
  fake.anilist = true;
  fake.mal = false;
  fake.watching = { service: 'anilist', entries: [entry(1)], fetchedAt: 1 };
  fake.weekCache = null;
  fake.preferred = null;
  fake.listeners.length = 0;
  fake.offsets.length = 0;
  firstDay = 1;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createAgendaController', () => {
  it('aucun compte connecté : « non connecté », aucune requête', async () => {
    fake.anilist = false;
    const ctl = createAgendaController({ platformAccess: access([]), onChange: () => undefined });
    await ctl.load(false);
    expect(ctl.status).toEqual({ kind: 'not-connected' });
    expect(agendaCalls()).toHaveLength(0);
  });

  it('aucune série en cours : plateformes optionnelles accordées reprises du store de la page', async () => {
    fake.watching = { service: 'anilist', entries: [], fetchedAt: 1 };
    const ctl = createAgendaController({ platformAccess: access(['netflix']), onChange: () => undefined });
    await ctl.load(false);
    expect(ctl.status).toEqual({ kind: 'no-series', optional: ['netflix'] });
  });

  it('lecteur préféré Netflix sans l’accès : lecteur par défaut', async () => {
    fake.preferred = 'netflix';
    const ctl = createAgendaController({ platformAccess: access([]), onChange: () => undefined });
    const load = ctl.load(false);
    await settle();
    answerAgenda({ ok: true, data: { weekStart: ctl.range.key, fetchedAt: Date.now(), mediaIds: [1], schedules: [] } });
    await load;
    expect(ctl.player).toBe(DEFAULT_SETTINGS.preferredPlayer);
    expect(ctl.connected).toEqual(['anilist']);
  });

  it('sans cache : GET_AGENDA demandé, programme affiché à la réponse', async () => {
    const changes = vi.fn();
    const ctl = createAgendaController({ platformAccess: access([]), onChange: changes });
    const load = ctl.load(false);
    await settle();
    expect(ctl.status).toEqual({ kind: 'loading' });
    expect(agendaCalls()).toHaveLength(1);
    const data: AiringWeekCache = { weekStart: ctl.range.key, fetchedAt: Date.now(), mediaIds: [1], schedules: [] };
    answerAgenda({ ok: true, data });
    await load;
    expect(ctl.status).toEqual({ kind: 'ready', cache: data, refreshing: false, error: null });
    expect(changes).toHaveBeenCalled();
  });

  it('chargement automatique pendant la requête : jamais jetée, rejoué après sa réponse ; échec retenu sans nouvelle requête', async () => {
    vi.useFakeTimers();
    const ctl = createAgendaController({ platformAccess: access([]), onChange: () => undefined });
    const first = ctl.load(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(agendaCalls()).toHaveLength(1);
    // Écriture du stockage pendant la requête (liste « En cours » relue) : chargement mis en file
    await ctl.load(false);
    expect(agendaCalls()).toHaveLength(1);
    answerAgenda({ ok: false, code: 'API_ERROR', message: 'AniList indisponible' });
    await first;
    expect(ctl.status).toEqual({ kind: 'error', message: 'AniList indisponible' });
    // Chargement rejoué : requête récente en échec, erreur gardée (REFETCH_GUARD_MS), pas de boucle
    await vi.advanceTimersByTimeAsync(STORAGE_DEBOUNCE_MS);
    expect(agendaCalls()).toHaveLength(0);
    expect(ctl.status).toEqual({ kind: 'error', message: 'AniList indisponible' });
  });

  it('« Réessayer » (force) : nouvelle requête malgré l’échec récent', async () => {
    const ctl = createAgendaController({ platformAccess: access([]), onChange: () => undefined });
    const first = ctl.load(false);
    await settle();
    answerAgenda({ ok: false, code: 'API_ERROR', message: 'x' });
    await first;
    const retry = ctl.load(true);
    await settle();
    expect(agendaCalls()).toHaveLength(1);
    answerAgenda({ ok: true, data: { weekStart: ctl.range.key, fetchedAt: Date.now(), mediaIds: [1], schedules: [] } });
    await retry;
    expect(ctl.status.kind).toBe('ready');
  });

  it('autre semaine : état de la vue oublié, squelette, puis chargement après la rafale', async () => {
    vi.useFakeTimers();
    const week = vi.fn();
    const ctl = createAgendaController({ platformAccess: access([]), onChange: () => undefined, onWeekChange: week });
    const next = shiftWeek(ctl.range, 1);
    ctl.step(1);
    expect(week).toHaveBeenCalledTimes(1);
    expect(ctl.range).toEqual(next);
    expect(ctl.status).toEqual({ kind: 'loading' });
    expect(agendaCalls()).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(300);
    expect(agendaCalls()).toHaveLength(1);
    ctl.dispose();
  });

  it('activate : écouteur du stockage posé une fois ; dispose le retire', async () => {
    vi.useFakeTimers();
    const ctl = createAgendaController({ platformAccess: access([]), onChange: () => undefined });
    ctl.activate();
    ctl.activate();
    expect(fake.listeners).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(0);
    answerAgenda({ ok: true, data: { weekStart: ctl.range.key, fetchedAt: Date.now(), mediaIds: [1], schedules: [] } });
    await vi.advanceTimersByTimeAsync(0);
    ctl.dispose();
    expect(fake.listeners).toHaveLength(0);
    // Aucun chargement après la destruction (minuit, stockage)
    await vi.advanceTimersByTimeAsync(2 * 24 * 3_600_000);
    expect(agendaCalls()).toHaveLength(0);
  });

  it('écriture du stockage pertinente (liste « En cours ») : rechargement regroupé', async () => {
    vi.useFakeTimers();
    fake.weekCache = { weekStart: '', fetchedAt: Date.now(), mediaIds: [1], schedules: [] };
    const ctl = createAgendaController({ platformAccess: access([]), onChange: () => undefined });
    fake.weekCache = { ...fake.weekCache, weekStart: ctl.range.key };
    ctl.activate();
    await vi.advanceTimersByTimeAsync(0);
    expect(ctl.status.kind).toBe('ready');
    fake.watching = { service: 'anilist', entries: [], fetchedAt: 2 };
    for (const listener of fake.listeners) listener({ [STORAGE_KEYS.watchingCache]: { newValue: {} } }, 'local');
    for (const listener of fake.listeners) listener({ other: { newValue: 1 } }, 'local');
    await vi.advanceTimersByTimeAsync(STORAGE_DEBOUNCE_MS);
    expect(ctl.status.kind).toBe('no-series');
    ctl.dispose();
  });

  it('liste « En cours » jamais chargée : demandée une seule fois au service worker', async () => {
    fake.watching = null;
    const ctl = createAgendaController({ platformAccess: access([]), onChange: () => undefined });
    await ctl.load(false);
    await ctl.load(false);
    expect(fake.calls.filter((c) => c.type === 'GET_WATCHING').map((c) => c.payload)).toEqual([{ service: 'anilist' }]);
  });

  it('session refusée par le service worker : « non connecté », sans échec retenu', async () => {
    const ctl = createAgendaController({ platformAccess: access([]), onChange: () => undefined });
    const load = ctl.load(false);
    await settle();
    answerAgenda({ ok: false, code: 'NOT_AUTHENTICATED', message: 'Session expirée' });
    await load;
    expect(ctl.status).toEqual({ kind: 'not-connected' });
  });

  it('échec avec le programme en cache : programme gardé, erreur affichée à côté', async () => {
    fake.weekCache = { weekStart: '', fetchedAt: 0, mediaIds: [1], schedules: [] };
    const ctl = createAgendaController({ platformAccess: access([]), onChange: () => undefined });
    const cache: AiringWeekCache = { weekStart: ctl.range.key, fetchedAt: 0, mediaIds: [1], schedules: [] };
    fake.weekCache = cache;
    const load = ctl.load(true);
    await settle();
    answerAgenda({ ok: false, code: 'API_ERROR', message: 'AniList indisponible' });
    await load;
    expect(ctl.status).toEqual({ kind: 'ready', cache, refreshing: false, error: 'AniList indisponible' });
  });

  it('exception pendant le chargement : message de l’erreur affiché', async () => {
    const ctl = createAgendaController({ platformAccess: access([]), onChange: () => undefined });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const load = ctl.load(false);
    await settle();
    const call = agendaCalls()[0];
    if (!call) throw new Error('Aucun GET_AGENDA en attente');
    fake.calls.splice(fake.calls.indexOf(call), 1);
    call.resolve(Promise.reject(new Error('Réseau coupé')));
    await load;
    warn.mockRestore();
    expect(ctl.status.kind).toBe('error');
  });

  it('minuit : redessin (« Aujourd’hui » change), puis l’alarme suivante est armée', async () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 14, 23, 59, 0) });
    const changes = vi.fn();
    const ctl = createAgendaController({ platformAccess: access([]), onChange: changes });
    ctl.activate();
    await vi.advanceTimersByTimeAsync(0);
    answerAgenda({ ok: true, data: { weekStart: ctl.range.key, fetchedAt: Date.now(), mediaIds: [1], schedules: [] } });
    await vi.advanceTimersByTimeAsync(0);
    const before = changes.mock.calls.length;
    await vi.advanceTimersByTimeAsync(2 * 60_000);
    expect(changes.mock.calls.length).toBeGreaterThan(before);
    ctl.dispose();
  });

  it('délai d’une série enregistré : stockage, réglages relus, vue prévenue', async () => {
    const changes = vi.fn();
    const ctl = createAgendaController({ platformAccess: access([]), onChange: changes });
    fake.preferred = 'adn';
    await ctl.saveOffset(7, 75);
    expect(fake.offsets).toEqual([{ mediaId: 7, offset: 75 }]);
    expect(ctl.settings?.preferredPlayer).toBe('adn');
    expect(changes).toHaveBeenCalled();
  });

  it('réglages relus à la demande', async () => {
    const ctl = createAgendaController({ platformAccess: access([]), onChange: () => undefined });
    fake.preferred = 'netflix';
    await ctl.reloadSettings();
    expect(ctl.settings?.preferredPlayer).toBe('netflix');
  });
});

describe('createAgendaController : échecs, réponses dépassées, semaine et premier jour', () => {
  it('séries en cours exposées à la vue (identifiants, titres)', async () => {
    fake.weekCache = { weekStart: '', fetchedAt: Date.now(), mediaIds: [1, 2], schedules: [] };
    fake.watching = { service: 'anilist', entries: [entry(1), entry(2)], fetchedAt: 1 };
    const ctl = createAgendaController({ platformAccess: access([]), onChange: () => undefined });
    fake.weekCache = { ...fake.weekCache, weekStart: ctl.range.key };
    await ctl.load(false);
    expect(ctl.status.kind).toBe('ready');
    expect([...ctl.series.keys()]).toEqual([1, 2]);
    expect(ctl.series.get(2)?.title).toBe('Série 2');
  });

  it('liste « En cours » indisponible (service worker en échec) : avertissement, l’Agenda continue', async () => {
    fake.watching = null;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const ctl = createAgendaController({ platformAccess: access([]), onChange: () => undefined });
    await ctl.load(false);
    const call = fake.calls.find((c) => c.type === 'GET_WATCHING');
    if (!call) throw new Error('Aucun GET_WATCHING en attente');
    call.resolve(Promise.reject(new Error('Service worker absent')));
    await settle();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    expect(ctl.status).toEqual({ kind: 'no-series', optional: [] });
  });

  it('réponse d’une requête remplacée par « Réessayer » : ignorée, seule la plus récente s’affiche', async () => {
    const ctl = createAgendaController({ platformAccess: access([]), onChange: () => undefined });
    const first = ctl.load(false);
    await settle();
    const retry = ctl.load(true);
    await settle();
    const [stale, fresh] = agendaCalls();
    if (!stale || !fresh) throw new Error('Deux GET_AGENDA attendus');
    const data: AiringWeekCache = { weekStart: ctl.range.key, fetchedAt: Date.now(), mediaIds: [1], schedules: [] };
    fresh.resolve({ ok: true, data });
    await retry;
    stale.resolve({ ok: false, code: 'API_ERROR', message: 'Ancienne requête' });
    await first;
    expect(ctl.status).toEqual({ kind: 'ready', cache: data, refreshing: false, error: null });
  });

  it('lecture locale en échec avant la requête : message de l’erreur affiché', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const broken: PlatformAccessStore = { ...access([]), read: () => Promise.reject(new Error('permissions illisibles')) };
    const ctl = createAgendaController({ platformAccess: broken, onChange: () => undefined });
    await ctl.load(false);
    warn.mockRestore();
    expect(ctl.status).toEqual({ kind: 'error', message: 'permissions illisibles' });
    expect(agendaCalls()).toHaveLength(0);
  });

  it('programme affiché puis échec local : programme gardé, erreur à côté', async () => {
    fake.weekCache = { weekStart: '', fetchedAt: Date.now(), mediaIds: [1], schedules: [] };
    let fail = false;
    const flaky: PlatformAccessStore = { ...access([]), read: () => (fail ? Promise.reject(new Error('')) : Promise.resolve([])) };
    const ctl = createAgendaController({ platformAccess: flaky, onChange: () => undefined });
    const cache: AiringWeekCache = { ...fake.weekCache, weekStart: ctl.range.key };
    fake.weekCache = cache;
    await ctl.load(false);
    expect(ctl.status.kind).toBe('ready');
    fail = true;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await ctl.load(false);
    warn.mockRestore();
    // Erreur sans message : texte générique
    const status = ctl.status;
    if (status.kind !== 'ready') throw new Error('Programme attendu');
    expect(status.cache).toBe(cache);
    expect(status.refreshing).toBe(false);
    expect(status.error).toBeTruthy();
  });

  it('changement du stockage hors `local` (session, sync) : aucun rechargement', async () => {
    vi.useFakeTimers();
    fake.weekCache = { weekStart: '', fetchedAt: Date.now(), mediaIds: [1], schedules: [] };
    const ctl = createAgendaController({ platformAccess: access([]), onChange: () => undefined });
    fake.weekCache = { ...fake.weekCache, weekStart: ctl.range.key };
    ctl.activate();
    await vi.advanceTimersByTimeAsync(0);
    fake.watching = { service: 'anilist', entries: [], fetchedAt: 2 };
    for (const listener of fake.listeners) listener({ [STORAGE_KEYS.watchingCache]: { newValue: {} } }, 'session');
    await vi.advanceTimersByTimeAsync(STORAGE_DEBOUNCE_MS);
    expect(ctl.status.kind).toBe('ready');
    ctl.dispose();
  });

  it('langue changée entre deux affichages : premier jour de la semaine relu, semaine recalée', async () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 14, 12, 0, 0) }); // mercredi
    const ctl = createAgendaController({ platformAccess: access([]), onChange: () => undefined });
    expect(ctl.firstDay).toBe(1);
    expect(new Date(ctl.range.start).getDay()).toBe(1);
    firstDay = 7;
    ctl.activate();
    expect(ctl.firstDay).toBe(7);
    // Semaine commençant le dimanche 11 octobre
    expect(new Date(ctl.range.start).getDay()).toBe(0);
    expect(new Date(ctl.range.start).getDate()).toBe(11);
    ctl.dispose();
  });

  it('minuit du dimanche au lundi, semaine en cours affichée : la nouvelle semaine suit', async () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 18, 23, 59, 0) }); // dimanche
    const week = vi.fn();
    const ctl = createAgendaController({ platformAccess: access([]), onChange: () => undefined, onWeekChange: week });
    const sunday = ctl.range;
    ctl.activate();
    await vi.advanceTimersByTimeAsync(2 * 60_000);
    expect(week).toHaveBeenCalledTimes(1);
    expect(ctl.range.key).not.toBe(sunday.key);
    expect(new Date(ctl.range.start).getDate()).toBe(19);
    ctl.dispose();
  });
});

describe('createAgendaController : budget de requêtes (semaines, calendrier)', () => {
  const week = (ctl: { range: { key: string } }, mediaIds: number[] = [1]): AiringWeekCache => ({ weekStart: ctl.range.key, fetchedAt: Date.now(), mediaIds, schedules: [] });
  const agendaWeeks = (): unknown[] => agendaCalls().map((c) => c.payload);

  /** Semaine affichée chargée par une réponse GET_AGENDA (sans cache du stockage : semaine lointaine) */
  async function loaded(ctl: ReturnType<typeof createAgendaController>): Promise<AiringWeekCache> {
    await vi.advanceTimersByTimeAsync(NAV_DEBOUNCE_MS);
    const data = week(ctl);
    answerAgenda({ ok: true, data });
    await vi.advanceTimersByTimeAsync(0);
    expect(ctl.status).toEqual({ kind: 'ready', cache: data, refreshing: false, error: null });
    return data;
  }

  it('‹ › en rafale : aucune requête pendant les clics, une seule pour la semaine finale (300 ms après le dernier)', async () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 14, 12, 0, 0) });
    const ctl = createAgendaController({ platformAccess: access([]), onChange: () => undefined });
    const start = ctl.range;
    for (let i = 0; i < 4; i++) {
      ctl.step(-1);
      await vi.advanceTimersByTimeAsync(100);
    }
    ctl.step(1);
    await vi.advanceTimersByTimeAsync(NAV_DEBOUNCE_MS - 1);
    expect(agendaCalls()).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(agendaWeeks()).toEqual([{ weekStart: shiftWeek(start, -3).key }]);
    expect(ctl.range.key).toBe(shiftWeek(start, -3).key);
    ctl.dispose();
  });

  it('semaine choisie dans le calendrier : une seule requête, envoyée sans attendre ; un ‹ › en attente est annulé', async () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 14, 12, 0, 0) });
    const ctl = createAgendaController({ platformAccess: access([]), onChange: () => undefined });
    const chosen = shiftWeek(ctl.range, -9);
    ctl.step(1);
    ctl.choose(chosen);
    expect(ctl.range).toBe(chosen);
    await vi.advanceTimersByTimeAsync(0);
    expect(agendaWeeks()).toEqual([{ weekStart: chosen.key }]);
    await vi.advanceTimersByTimeAsync(NAV_DEBOUNCE_MS);
    expect(agendaCalls()).toHaveLength(1);
    ctl.dispose();
  });

  it('semaine déjà chargée par la page : revue sans requête (même après la garde de 60 s), affichée aussitôt sans squelette', async () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 14, 12, 0, 0) });
    const ctl = createAgendaController({ platformAccess: access([]), onChange: () => undefined });
    ctl.choose(shiftWeek(ctl.range, -8));
    const far = await loaded(ctl);
    ctl.step(-1);
    await loaded(ctl);
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    ctl.step(1);
    // Programme en mémoire : affiché dès le clic, sans attendre la fin de la rafale
    expect(ctl.status).toEqual({ kind: 'ready', cache: far, refreshing: false, error: null });
    await vi.advanceTimersByTimeAsync(NAV_DEBOUNCE_MS);
    expect(agendaCalls()).toHaveLength(0);
    expect(ctl.status).toEqual({ kind: 'ready', cache: far, refreshing: false, error: null });
    ctl.dispose();
  });

  it('réponse d’une semaine quittée avant son arrivée : gardée, le retour sur cette semaine ne la redemande pas', async () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 14, 12, 0, 0) });
    const ctl = createAgendaController({ platformAccess: access([]), onChange: () => undefined });
    const far = shiftWeek(ctl.range, -8);
    ctl.choose(far);
    await vi.advanceTimersByTimeAsync(0);
    const late = fake.calls.find((c) => c.type === 'GET_AGENDA');
    if (!late) throw new Error('GET_AGENDA attendu');
    ctl.step(-1);
    await vi.advanceTimersByTimeAsync(NAV_DEBOUNCE_MS);
    expect(agendaCalls()).toHaveLength(2);
    // Réponse de la semaine quittée, arrivée après le départ : non affichée, mais retenue
    const data: AiringWeekCache = { weekStart: far.key, fetchedAt: Date.now(), mediaIds: [1], schedules: [] };
    fake.calls.splice(fake.calls.indexOf(late), 1);
    late.resolve({ ok: true, data });
    await vi.advanceTimersByTimeAsync(0);
    expect(ctl.status).toEqual({ kind: 'loading' });
    answerAgenda({ ok: true, data: week(ctl) });
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    ctl.step(1);
    await vi.advanceTimersByTimeAsync(NAV_DEBOUNCE_MS);
    expect(agendaCalls()).toHaveLength(0);
    expect(ctl.status).toEqual({ kind: 'ready', cache: data, refreshing: false, error: null });
    ctl.dispose();
  });

  it('semaine en mémoire qui ne couvre pas une nouvelle série en cours : redemandée', async () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 14, 12, 0, 0) });
    const ctl = createAgendaController({ platformAccess: access([]), onChange: () => undefined });
    ctl.choose(shiftWeek(ctl.range, -8));
    await loaded(ctl);
    ctl.step(-1);
    await loaded(ctl);
    fake.watching = { service: 'anilist', entries: [entry(1), entry(2)], fetchedAt: 2 };
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    ctl.step(1);
    await vi.advanceTimersByTimeAsync(NAV_DEBOUNCE_MS);
    expect(agendaCalls()).toHaveLength(1);
    ctl.dispose();
  });

  it('« Réessayer » sur une semaine en mémoire : nouvelle requête', async () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 14, 12, 0, 0) });
    const ctl = createAgendaController({ platformAccess: access([]), onChange: () => undefined });
    ctl.choose(shiftWeek(ctl.range, -8));
    await loaded(ctl);
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    void ctl.load(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(agendaCalls()).toHaveLength(1);
    ctl.dispose();
  });
});
