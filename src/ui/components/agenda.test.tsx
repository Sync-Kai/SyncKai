// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale, t, upperFirst } from '../../i18n';
import { shiftWeek, weekRange, type AgendaSeries, type AiringSchedule } from '../../shared/agenda';
import { DEFAULT_SETTINGS, type SyncSettings } from '../../shared/settings';
import type { ListedEntry, SequelRecord } from '../../shared/sequels';
import type { SyncOutcome } from '../../shared/sync.types';
import { createStore } from '../state';
import type { AgendaStatus } from '../agenda-controller';
import { Agenda, type AgendaSnapshot } from './agenda';

// Onglet « Agenda » (rendu Preact) : jours dans l'ordre, ligne « 18:00 Crunchyroll · Japon 17:00 », « ● Vu », menu « ⋯ »,
// éditeur de délai (bornes, échec, focus rendu au « ⋯ » à la fermeture : audit 4-A2), états sans programme

let container: HTMLElement;
const $ = <T extends HTMLElement = HTMLElement>(selector: string): T | null => container.querySelector<T>(selector);

const $$ = (selector: string): HTMLElement[] => [...container.querySelectorAll<HTMLElement>(selector)];

/** Vendredi 16 octobre 2026, 12 h ; semaine du lundi 12 au dimanche 18 */
const NOW = new Date(2026, 9, 16, 12).getTime();
const RANGE = weekRange(NOW, 1);
const at = (day: number, hour: number, minute = 0): number => Math.floor(new Date(2026, 9, day, hour, minute).getTime() / 1000);

function series(mediaId: number, title: string, progress: number, platform: 'crunchyroll' | 'netflix' | null): AgendaSeries {
  const link = platform ? { platform, url: `https://example.com/${mediaId}` } : null;
  return { mediaId, malId: null, progress, title, coverUrl: null, platforms: link ? [link] : [], link };
}

const SCHEDULES: AiringSchedule[] = [
  { scheduleId: 71, mediaId: 1, episode: 7, airingAt: at(16, 17), title: 'Frieren', coverUrl: null },
  { scheduleId: 52, mediaId: 2, episode: 5, airingAt: at(16, 18, 30), title: 'Dandadan', coverUrl: null },
  { scheduleId: 98, mediaId: 3, episode: 98, airingAt: at(18, 11, 25), title: 'Pokémon Horizons', coverUrl: null },
];
const SERIES = new Map<number, AgendaSeries>([
  [1, series(1, 'Frieren', 7, 'crunchyroll')],
  [2, series(2, 'Dandadan', 4, 'netflix')],
  [3, series(3, 'Pokémon Horizons', 97, null)],
]);
const SETTINGS: SyncSettings = { ...DEFAULT_SETTINGS, seriesOffsets: { 2: { minutes: 75, at: 1 } } };

function snapshot(status: AgendaStatus, patch: Partial<AgendaSnapshot> = {}): AgendaSnapshot {
  return { range: RANGE, firstDay: 1, status, settings: SETTINGS, player: 'crunchyroll', series: SERIES, connected: ['anilist'], ...patch };
}
const READY = { kind: 'ready', cache: { weekStart: RANGE.key, fetchedAt: NOW, mediaIds: [1, 2, 3], schedules: SCHEDULES }, refreshing: false, error: null as string | null } satisfies AgendaStatus;

const onSaveOffset = vi.fn<(mediaId: number, offset: number | null) => Promise<void>>();
const onRetry = vi.fn<() => void>();

const worker = vi.hoisted(() => ({ send: vi.fn<(type: string, payload: unknown) => Promise<unknown>>() }));
vi.mock('../../protocol/messages', () => ({ sendMessage: (type: string, payload: unknown): Promise<unknown> => worker.send(type, payload) }));

function sequel(id: number, state: SequelRecord['state'], patch: Partial<SequelRecord['snapshot']>): SequelRecord {
  return {
    snapshot: { id, idMal: null, title: `Suite ${id}`, format: 'TV', status: 'NOT_YET_RELEASED', coverUrl: null, siteUrl: `https://anilist.co/anime/${id}`, year: null, month: null, day: null, season: null, seasonYear: null, sourceId: 1, sourceTitle: 'Source', ...patch },
    state,
    firstSeenAt: 1000 - id,
  };
}

function listedEntry(id: number, listStatus: ListedEntry['listStatus'], patch: Partial<ListedEntry> = {}): ListedEntry {
  const { sourceId: _sourceId, sourceTitle: _sourceTitle, ...rest } = sequel(id, 'seen', {}).snapshot;
  return { ...rest, listStatus, ...patch };
}

let sequelStore = createStore<SequelRecord[]>([]);
let listedStore = createStore<ListedEntry[]>([]);

const onDiscover = vi.fn<() => void>();

async function show(status: AgendaStatus = READY, sequels: SequelRecord[] = [], patch: Partial<AgendaSnapshot> = {}, listed: ListedEntry[] = []): Promise<void> {
  const state = createStore<AgendaSnapshot | null>(snapshot(status, patch));
  sequelStore = createStore(sequels);
  listedStore = createStore(listed);
  await act(() => render(<Agenda state={state} sequels={sequelStore} listed={listedStore} granted={[]} onStep={() => undefined} onChoose={() => undefined} onRetry={onRetry} onSaveOffset={onSaveOffset} onDiscover={onDiscover} />, container));
}

async function click(selector: string): Promise<void> {
  const el = $(selector);
  if (!el) throw new Error(`${selector} absent`);
  await act(() => el.click());
}

async function key(name: string): Promise<void> {
  await act(() => {
    (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
  });
}

async function type(value: string): Promise<void> {
  const input = $<HTMLInputElement>('[data-focus^="agenda-offset-"]');
  if (!input) throw new Error('champ absent');
  await act(() => {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

const focusKey = (): string | null => (document.activeElement instanceof HTMLElement ? (document.activeElement.dataset.focus ?? null) : null);
const text = (selector: string): string => ($(selector)?.textContent ?? '').replace(/\s/g, ' ');

async function openEditor(scheduleId: number): Promise<void> {
  await click(`[data-focus="agenda-menu-${scheduleId}"]`);
  await click(`[data-focus="agenda-adjust-${scheduleId}"]`);
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
  setLocale('fr');
  container = document.createElement('div');
  document.body.append(container);
  onSaveOffset.mockReset();
  onRetry.mockReset();
});

afterEach(async () => {
  await act(() => render(null, container));
  container.remove();
  vi.useRealTimers();
});

describe('Agenda', () => {
  it('jours du lundi au dimanche, jour vide = « Aucun épisode » sans carte, aujourd’hui marqué, jours passés atténués', async () => {
    await show();
    const days = [...container.querySelectorAll<HTMLElement>('[data-agenda-day]')];
    expect(days.map((day) => day.dataset.agendaDay)).toEqual(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']);
    expect(days[0]?.textContent).toBe(`Lundi 12${t('agenda.day.none')}`);
    expect(days[0]?.querySelector('ul')).toBeNull();
    expect(days[0]?.querySelector('h3')?.className).toContain('text-muted');
    expect(days[4]?.querySelector('[data-agenda-today]')?.textContent).toContain(t('agenda.day.today'));
    expect(days[5]?.querySelector('h3')?.className).toContain('text-ink');
  });

  it('ligne : titre · Ép. N, heure de la plateforme en gras (lavande si réglée), plateforme, Japon ; vu : « ● Vu »', async () => {
    await show();
    expect(text('[data-agenda-row="71"] [data-agenda-times]')).toBe('Vu · 18:00 Crunchyroll · Japon 17:00');
    expect($('[data-agenda-row="71"] [data-agenda-watched]')).not.toBeNull();
    expect($('[data-agenda-row="71"] [data-cover]')?.parentElement?.className).toContain('opacity-55');
    expect(text('[data-agenda-row="52"] [data-agenda-times]')).toBe('19:45 Netflix · Japon 18:30');
    expect($('[data-agenda-row="52"] [data-agenda-estimate]')?.className).toContain('text-lavender');
    // Sans plateforme ni délai : l'heure japonaise seule, en gras
    expect(text('[data-agenda-row="98"] [data-agenda-times]')).toBe('Japon 11:25');
    expect($('[data-agenda-row="98"] [data-agenda-jp] strong')?.textContent).toBe('11:25');
    expect(text('[data-agenda-row="52"] .text-row-title')).toBe(`Dandadan · ${t('agenda.episode', { episode: 5 })}`);
    expect($('[data-focus="agenda-open-52"]')?.getAttribute('href')).toBe('https://example.com/2');
    expect($('[data-focus="agenda-entry-52"]')?.getAttribute('href')).toBe('https://anilist.co/anime/2');
  });

  it('menu « ⋯ » : « Ajuster l’heure » avec l’heure et l’origine du délai, « Ouvrir la fiche › », « Chercher sur… › » (plateformes sans lien)', async () => {
    await show();
    await click('[data-focus="agenda-menu-52"]');
    expect(text('[data-focus="agenda-adjust-52"] [data-menu-description]')).toBe(`19:45 Netflix · ${t('agenda.adjust.custom')}`);
    expect($('[data-focus="agenda-site-52"]')).not.toBeNull();
    expect($('[data-focus="agenda-search-52"]')).not.toBeNull();
    await key('Escape');
    await click('[data-focus="agenda-menu-71"]');
    expect(text('[data-focus="agenda-adjust-71"] [data-menu-description]')).toBe(`18:00 Crunchyroll · ${t('agenda.adjust.default')}`);
  });

  it('éditeur : focus dans le champ, aperçu et phrase du délai ; Échap puis Annuler rendent le focus au « ⋯ » de la série (4-A2)', async () => {
    await show();
    await openEditor(52);
    expect(focusKey()).toBe('agenda-offset-52');
    expect($<HTMLInputElement>('[data-focus="agenda-offset-52"]')?.value).toBe('75');
    expect(text('[data-agenda-preview]')).toBe('≈19:45');
    // ↑ ↓ : 5 minutes, aperçu suivi
    await key('ArrowUp');
    expect($<HTMLInputElement>('[data-focus="agenda-offset-52"]')?.value).toBe('80');
    expect(text('[data-agenda-preview]')).toBe('≈19:50');
    await key('ArrowDown');
    expect($('[data-agenda-editor]')?.textContent).toContain(t('agenda.estimate.custom', { offset: '+1 h 15 min' }).replace(/\s/g, ' ').slice(0, 20));
    await key('Escape');
    expect($('[data-agenda-editor]')).toBeNull();
    expect(focusKey()).toBe('agenda-menu-52');

    await openEditor(71);
    // Délai de la plateforme : pas de « Par défaut », phrase de la plateforme
    expect($('[data-focus="agenda-reset-71"]')).toBeNull();
    expect($('[data-agenda-editor]')?.textContent).toContain('Crunchyroll');
    await click('[data-focus="agenda-cancel-71"]');
    expect($('[data-agenda-editor]')).toBeNull();
    expect(focusKey()).toBe('agenda-menu-71');
  });

  it('valeur hors bornes ou vide : champ invalide, rien n’est envoyé', async () => {
    await show();
    await openEditor(52);
    await type('20000');
    expect($('[data-focus="agenda-offset-52"]')?.getAttribute('aria-invalid')).toBe('true');
    expect($('[data-agenda-preview]')).toBeNull();
    await click('[data-focus="agenda-save-52"]');
    await type('');
    await key('Enter');
    expect($('[data-focus="agenda-offset-52"]')?.getAttribute('aria-invalid')).toBe('true');
    expect(onSaveOffset).not.toHaveBeenCalled();
  });

  it('enregistré : délai envoyé une fois, éditeur fermé, focus au « ⋯ » ; « Par défaut » envoie null', async () => {
    let finish = (): void => undefined;
    onSaveOffset.mockImplementation(() => new Promise<void>((resolve) => (finish = resolve)));
    await show();
    await openEditor(52);
    await type('90');
    await key('Enter');
    await key('Enter');
    expect(onSaveOffset.mock.calls).toEqual([[2, 90]]);
    expect($<HTMLInputElement>('[data-focus="agenda-offset-52"]')?.disabled).toBe(true);
    expect($('[data-focus="agenda-save-52"]')?.getAttribute('aria-busy')).toBe('true');
    await act(async () => finish());
    expect($('[data-agenda-editor]')).toBeNull();
    expect(focusKey()).toBe('agenda-menu-52');

    onSaveOffset.mockResolvedValue(undefined);
    await openEditor(52);
    await click('[data-focus="agenda-reset-52"]');
    expect(onSaveOffset).toHaveBeenLastCalledWith(2, null);
  });

  it('échec de l’enregistrement : « Non enregistré, réessaie », éditeur ouvert', async () => {
    onSaveOffset.mockRejectedValue(new Error('stockage'));
    await show();
    await openEditor(52);
    await click('[data-focus="agenda-save-52"]');
    await act(async () => undefined);
    expect($('[data-agenda-editor] [data-alert]')?.textContent).toBe(t('agenda.adjust.saveFailed'));
    expect($<HTMLInputElement>('[data-focus="agenda-offset-52"]')?.disabled).toBe(false);
  });

  it('états : chargement (squelette), aucun compte, erreur avec « Réessayer », programme enregistré affiché avec l’erreur', async () => {
    await show({ kind: 'loading' });
    expect($('[data-agenda-skeleton]')?.getAttribute('aria-busy')).toBe('true');
    await show({ kind: 'not-connected' });
    expect(text('[data-agenda-state]')).toBe(t('agenda.notConnected'));
    await show({ kind: 'error', message: 'AniList est injoignable.' });
    expect($('[data-agenda-state="error"]')?.textContent).toContain(t('agenda.error', { error: 'AniList est injoignable.' }));
    await click('[data-focus="agenda-retry"]');
    expect(onRetry).toHaveBeenCalledTimes(1);
    await show({ ...READY, error: 'AniList est injoignable.' });
    expect($('[data-alert]')?.textContent).toContain(t('agenda.stale', { error: 'AniList est injoignable.' }));
    expect($('[data-agenda-row="52"]')).not.toBeNull();
  });

  it('semaine en cours : pas de bouton « Aujourd’hui » ; actualisation : spinner dans le bouton de la semaine', async () => {
    await show({ ...READY, refreshing: true });
    expect($('[data-focus="agenda-today"]')).toBeNull();
    expect($('[data-week-busy]')).not.toBeNull();
  });

  describe('semaine vide : « Une idée ? »', () => {
    const EMPTY = { ...READY, cache: { ...READY.cache, schedules: [] } } satisfies AgendaStatus;

    it('le lien suit le texte de la semaine vide et ouvre Découvrir', async () => {
      onDiscover.mockClear();
      await show(EMPTY);
      expect($('[data-agenda-state]')?.textContent).toContain(t('agenda.empty.week'));
      const link = $<HTMLButtonElement>('[data-focus="agenda-discover"]');
      expect(link?.textContent).toContain(t('reco.idea'));
      await act(() => link?.click());
      expect(onDiscover).toHaveBeenCalledTimes(1);
    });

    it('semaine remplie, aucun compte ou erreur : pas de lien', async () => {
      await show(READY);
      expect($('[data-focus="agenda-discover"]')).toBeNull();
      await show({ kind: 'not-connected' });
      expect($('[data-focus="agenda-discover"]')).toBeNull();
    });
  });

  describe('vue « Annoncées »', () => {
    const SEQUELS = [
      sequel(1, 'new', { year: 2027, month: 1, day: 10 }),
      sequel(2, 'seen', { season: 'WINTER', seasonYear: 2027 }),
      sequel(3, 'seen', { year: 2027 }),
      sequel(4, 'seen', {}),
      sequel(5, 'seen', { season: 'FALL', seasonYear: 2026 }),
    ];
    const headings = (): string[] => [...container.querySelectorAll('[data-sequel-group] > h3')].map((h) => h.textContent ?? '');
    const radio = (name: string): HTMLElement => [...container.querySelectorAll<HTMLElement>('[role="radio"]')].find((el) => el.textContent === name) as HTMLElement;

    it('« Semaine » par défaut ; « Annoncées » liste les groupes par saison, « Nouveau » sur les nouvelles seulement', async () => {
      await show(READY, SEQUELS);
      expect(radio(t('agenda.view.week')).getAttribute('aria-checked')).toBe('true');
      expect($('[data-agenda-day]')).not.toBeNull();
      expect($('[data-sequel]')).toBeNull();
      await act(() => radio(t('agenda.view.announced')).click());
      expect($('[data-agenda-day]')).toBeNull();
      expect(headings()).toEqual([t('panel.nowPlaying.season.FALL', { year: 2026 }), t('panel.nowPlaying.season.WINTER', { year: 2027 }), '2027', t('sequel.dateUnknown')]);
      expect(container.querySelectorAll('[data-sequel]')).toHaveLength(5);
      expect([...container.querySelectorAll('[data-sequel-new]')].map((el) => el.closest('[data-sequel]')?.getAttribute('data-sequel'))).toEqual(['1']);
    });

    it('sans suite : message vide ; retour à « Semaine » : la semaine est intacte', async () => {
      await show(READY, []);
      await act(() => radio(t('agenda.view.announced')).click());
      expect($('[data-agenda-state]')?.textContent).toContain(t('agenda.announced.empty'));
      await act(() => radio(t('agenda.view.week')).click());
      expect($$('[data-agenda-day]')).toHaveLength(7);
    });

    it('« Alertes de suites » coupé : une ligne de raison à la place de la liste', async () => {
      await show(READY, SEQUELS, { settings: { ...SETTINGS, sequelAlerts: false } });
      await act(() => radio(t('agenda.view.announced')).click());
      expect($('[data-sequel]')).toBeNull();
      expect($('[data-agenda-state]')?.textContent).toContain(upperFirst(t('airing.skip.disabled')));
      expect($('[data-agenda-state]')?.textContent).not.toContain(t('agenda.announced.empty'));
    });

    it('× puis ajout : le focus passe à la ligne voisine, jamais au body', async () => {
      await show(READY, SEQUELS);
      await act(() => radio(t('agenda.view.announced')).click());
      $('[data-sequel="2"] [data-focus="sequel-dismiss-2"]')?.focus();
      expect(document.activeElement?.getAttribute('data-focus')).toBe('sequel-dismiss-2');
      await act(() => sequelStore.set(SEQUELS.filter((r) => r.snapshot.id !== 2)));
      expect(document.activeElement).not.toBe(document.body);
      expect(document.activeElement?.closest('[data-sequel]')).not.toBeNull();
    });

    it('« Nouveau » seulement tant que l’enregistrement est « new » dans le stockage (ligne gardée pour sa mention : sans pastille)', async () => {
      worker.send.mockImplementation(async (type) => {
        if (type === 'ADD_TO_LIST') return { status: 'synced', mediaTitle: 'S', results: [{ service: 'anilist', outcome: { status: 'updated', progress: 0, completed: false } }, { service: 'mal', outcome: { status: 'error', message: 'x' } }] } satisfies SyncOutcome;
        if (type === 'UPDATE_SEQUELS') sequelStore.set([]);
        return true;
      });
      await show(READY, [sequel(1, 'new', { year: 2027, month: 1, day: 10 })]);
      await act(() => radio(t('agenda.view.announced')).click());
      expect($('[data-sequel="1"] [data-sequel-new]')).not.toBeNull();
      await act(async () => {
        $('[data-focus="sequel-add-1"]')?.click();
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect($('[data-sequel="1"]')?.textContent).toContain(t('sequel.notOnMal'));
      expect($('[data-sequel="1"] [data-sequel-new]')).toBeNull();
    });

    it('ajout réussi : la ligne reste avec son résultat ; compte MAL seul sans idMal : mention, pas de bouton', async () => {
      worker.send.mockImplementation(async (type) => {
        if (type === 'ADD_TO_LIST') return { status: 'synced', mediaTitle: 'S', results: [{ service: 'anilist', outcome: { status: 'updated', progress: 0, completed: false } }] } satisfies SyncOutcome;
        if (type === 'UPDATE_SEQUELS') sequelStore.set([]);
        return true;
      });
      await show(READY, [sequel(1, 'seen', {}), sequel(2, 'seen', {})]);
      await act(() => radio(t('agenda.view.announced')).click());
      await act(async () => {
        $('[data-focus="sequel-add-1"]')?.click();
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect($('[data-sequel="1"]')?.textContent).toContain(t('sequel.added'));
      await show(READY, [sequel(3, 'seen', {})], { connected: ['mal'] });
      await act(() => radio(t('agenda.view.announced')).click());
      expect($('[data-sequel="3"]')?.textContent).toContain(t('sequel.notOnMal'));
      expect($('[data-focus="sequel-add-3"]')).toBeNull();
    });

    it('ouvrir « Annoncées » demande une fois la vérification des suites affichées contre les listes', async () => {
      worker.send.mockReset();
      worker.send.mockResolvedValue(null);
      await show(READY, SEQUELS);
      expect(worker.send).not.toHaveBeenCalledWith('CHECK_SHOWN_SEQUELS', null);
      await act(() => radio(t('agenda.view.announced')).click());
      await act(() => sequelStore.set(SEQUELS.slice(1)));
      expect(worker.send.mock.calls.filter(([type]) => type === 'CHECK_SHOWN_SEQUELS')).toEqual([['CHECK_SHOWN_SEQUELS', null]]);
    });

    it('visible=false (écran du popup masqué) : aucune revérification ; elle part une fois l’écran affiché', async () => {
      worker.send.mockReset();
      worker.send.mockResolvedValue(null);
      const state = createStore<AgendaSnapshot | null>(snapshot(READY));
      sequelStore = createStore(SEQUELS);
      const mount = (visible: boolean): Promise<void> =>
        act(() => render(<Agenda state={state} sequels={sequelStore} listed={createStore<ListedEntry[]>([])} granted={[]} visible={visible} onStep={() => undefined} onChoose={() => undefined} onRetry={onRetry} onSaveOffset={onSaveOffset} onDiscover={onDiscover} />, container));
      await mount(false);
      await act(() => radio(t('agenda.view.announced')).click());
      expect(worker.send.mock.calls.filter(([type]) => type === 'CHECK_SHOWN_SEQUELS')).toEqual([]);
      await mount(true);
      expect(worker.send.mock.calls.filter(([type]) => type === 'CHECK_SHOWN_SEQUELS')).toEqual([['CHECK_SHOWN_SEQUELS', null]]);
    });

    it('séries de la liste : groupées avec les suites, « Dans ta liste · statut », sans bouton ni × ni « Nouveau » ; un id des deux : la ligne de la liste seule', async () => {
      await show(READY, [sequel(1, 'new', { year: 2027, month: 1, day: 10 }), sequel(2, 'new', { year: 2027, month: 2 })], {}, [
        listedEntry(2, 'PLANNING', { year: 2027, month: 2 }),
        listedEntry(3, 'CURRENT', { year: 2027, month: 1, day: 5 }),
      ]);
      await act(() => radio(t('agenda.view.announced')).click());
      expect(headings()).toEqual([t('panel.nowPlaying.season.WINTER', { year: 2027 })]);
      expect($$('[data-sequel]').map((row) => row.getAttribute('data-sequel'))).toEqual(['3', '1', '2']);
      expect($('[data-sequel="3"]')?.textContent).toContain(t('sequel.listedAs', { status: t('page.status.CURRENT') }));
      expect($('[data-sequel="2"]')?.textContent).toContain(t('sequel.listedAs', { status: t('page.status.PLANNING') }));
      for (const id of [2, 3]) {
        expect($(`[data-focus="sequel-add-${id}"]`)).toBeNull();
        expect($(`[data-focus="sequel-dismiss-${id}"]`)).toBeNull();
        expect($(`[data-sequel="${id}"] [data-sequel-new]`)).toBeNull();
      }
      expect($('[data-focus="sequel-add-1"]')).not.toBeNull();
    });

    it('« + À regarder » terminé : la ligne devient celle de la liste sans disparaître (UPDATE_SEQUELS listed)', async () => {
      const row = sequel(1, 'seen', { year: 2027, month: 1, day: 10 });
      worker.send.mockImplementation(async (type) => {
        if (type === 'ADD_TO_LIST') return { status: 'synced', mediaTitle: 'S', results: [{ service: 'anilist', outcome: { status: 'updated', progress: 0, completed: false } }] } satisfies SyncOutcome;
        if (type === 'UPDATE_SEQUELS') {
          sequelStore.set([]);
          listedStore.set([listedEntry(1, 'PLANNING', { year: 2027, month: 1, day: 10 })]);
        }
        return true;
      });
      await show(READY, [row]);
      await act(() => radio(t('agenda.view.announced')).click());
      const before = $('[data-sequel="1"]');
      await act(async () => {
        $('[data-focus="sequel-add-1"]')?.click();
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(worker.send).toHaveBeenCalledWith('UPDATE_SEQUELS', { ids: [1], state: 'listed' });
      // Même élément : la ligne n'a jamais été démontée (ni doublon de la ligne gardée pour sa mention)
      expect($('[data-sequel="1"]')).toBe(before);
      expect($$('[data-sequel]')).toHaveLength(1);
      expect($('[data-sequel="1"]')?.textContent).not.toContain(t('sequel.added'));
      expect($('[data-sequel="1"]')?.textContent).toContain(t('sequel.listedAs', { status: t('page.status.PLANNING') }));
      expect($('[data-focus="sequel-add-1"]')).toBeNull();
    });

    it('seulement des séries de la liste : pas de message vide, et la vérification contre les listes est demandée', async () => {
      worker.send.mockReset();
      worker.send.mockResolvedValue(null);
      await show(READY, [], {}, [listedEntry(3, 'PLANNING')]);
      await act(() => radio(t('agenda.view.announced')).click());
      expect($('[data-agenda-state]')).toBeNull();
      expect($$('[data-sequel]')).toHaveLength(1);
      expect(worker.send.mock.calls.filter(([type]) => type === 'CHECK_SHOWN_SEQUELS')).toEqual([['CHECK_SHOWN_SEQUELS', null]]);
    });

    it('× masque la suite (UPDATE_SEQUELS dismissed)', async () => {
      worker.send.mockResolvedValue(true);
      await show(READY, SEQUELS);
      await act(() => radio(t('agenda.view.announced')).click());
      await click('[data-sequel="1"] [data-focus="sequel-dismiss-1"]');
      expect(worker.send).toHaveBeenCalledWith('UPDATE_SEQUELS', { ids: [1], state: 'dismissed' });
    });
  });

  it('changement de semaine : la zone [data-scroll-root] revient en haut', async () => {
    const root = document.createElement('div');
    root.dataset.scrollRoot = '';
    container.append(root);
    const state = createStore<AgendaSnapshot | null>(snapshot(READY));
    const mount = (): Promise<void> =>
      act(() => render(<Agenda state={state} sequels={createStore<SequelRecord[]>([])} listed={createStore<ListedEntry[]>([])} granted={[]} onStep={() => undefined} onChoose={() => undefined} onRetry={onRetry} onSaveOffset={onSaveOffset} onDiscover={onDiscover} />, root));
    await mount();
    root.scrollTop = 300;
    const next = shiftWeek(RANGE, 1);
    await act(() => state.set(snapshot({ ...READY, cache: { ...READY.cache, weekStart: next.key, schedules: [] } }, { range: next })));
    expect(root.scrollTop).toBe(0);
    await act(() => render(null, root));
  });

  it('inset popup : navigation collante en -mx-4 px-4 ; défaut panneau en -mx-3 px-3', async () => {
    await show();
    const nav = (): string => $('[data-agenda-nav]')?.className ?? '';
    expect(nav()).toContain('-mx-3');
    expect(nav()).toContain('px-3');
    const state = createStore<AgendaSnapshot | null>(snapshot(READY));
    await act(() => render(<Agenda state={state} sequels={createStore<SequelRecord[]>([])} listed={createStore<ListedEntry[]>([])} granted={[]} inset="popup" onStep={() => undefined} onChoose={() => undefined} onRetry={onRetry} onSaveOffset={onSaveOffset} onDiscover={onDiscover} />, container));
    expect(nav()).toContain('-mx-4');
    expect(nav()).toContain('px-4');
    expect(nav()).not.toContain('-mx-3');
  });
});
