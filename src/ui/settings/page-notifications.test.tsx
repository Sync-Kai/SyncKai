// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getLocale, setLocale, t } from '../../i18n';
import type { AiringCheckResult } from '../../shared/airing.types';
import type { SequelCheckResult } from '../../shared/sequels';
import { DEFAULT_SETTINGS, type SyncSettings } from '../../shared/settings';
import { createStore } from '../state';
import type { SettingsContext, SettingsData } from './context';
import { latestAiring, NotificationsPage } from './page-notifications';

const sent = vi.hoisted(() => ({ answer: vi.fn<(type?: string, payload?: unknown) => Promise<unknown>>() }));
vi.mock('../../protocol/messages', () => ({ sendMessage: (type: string, payload: unknown) => sent.answer(type, payload) }));

const result = (checkedAt: number, error: string | null = null): AiringCheckResult => ({ checkedAt, notified: 0, skipped: null, error });

describe('latestAiring', () => {
  it('le plus récent du stockage et de la vérification lancée ici (échec de secours compris), ou celui qui existe', () => {
    expect(latestAiring(null, null)).toBeNull();
    expect(latestAiring(result(1), null)).toEqual(result(1));
    expect(latestAiring(null, result(2, 'x'))).toEqual(result(2, 'x'));
    expect(latestAiring(result(5), result(2, 'x'))).toEqual(result(5));
    expect(latestAiring(result(1), result(2, 'x'))).toEqual(result(2, 'x'));
  });
});

describe('NotificationsPage (maquettes Notifications, NotificationsAlertes)', () => {
  const initial = getLocale();
  let container: HTMLElement;
  const update = vi.fn(async (_patch: Partial<SyncSettings>) => undefined);
  const $ = <T extends Element = HTMLElement>(selector: string): T | null => container.querySelector<T>(selector);

  const sequelResult = (patch: Partial<SequelCheckResult> = {}): SequelCheckResult => ({ checkedAt: Date.now() - 3 * 3_600_000, found: 0, notified: 0, skipped: null, error: null, ...patch });

  async function mount(settings: SyncSettings = DEFAULT_SETTINGS, extra: Partial<SettingsData> = {}, local: SequelCheckResult | null = null): Promise<void> {
    const data: SettingsData = {
      settings,
      settingsError: false,
      mappings: null,
      mappingsError: null,
      exclusions: { status: 'loading' },
      journalCount: null,
      airing: null,
      sequels: null,
      sequelsDismissed: 0,
      recoDismissed: 0,
      platformAccess: [],
      ...extra,
    };
    const ctx = { state: createStore(data), update } as Partial<SettingsContext> as SettingsContext;
    await act(() => render(<NotificationsPage ctx={ctx} check={createStore({ pending: false, result: null })} sequelCheck={createStore({ pending: false, result: local })} />, container));
  }

  beforeEach(() => {
    setLocale('fr');
    container = document.createElement('div');
    document.body.append(container);
    update.mockClear();
  });

  afterEach(async () => {
    await act(() => render(null, container));
    container.remove();
    setLocale(initial);
  });

  it('trois styles illustrés, légende pour le lecteur d’écran ; choisir un style l’enregistre', async () => {
    await mount();
    expect([...container.querySelectorAll('[data-notif-art]')].map((art) => art.getAttribute('data-notif-art'))).toEqual(['pill', 'bubble', 'alert']);
    expect($('legend')?.textContent).toBe(t('settings.notif.legend'));
    await act(() => $<HTMLElement>('[data-choice="alerts-only"]')?.click());
    expect(update).toHaveBeenCalledWith({ notificationLevel: 'alerts-only' });
  });

  it('alertes coupées : délai et « Vérifier maintenant » désactivés, consigne affichée', async () => {
    await mount({ ...DEFAULT_SETTINGS, airingAlerts: false });
    expect($<HTMLButtonElement>('[data-focus="airing-check"]')?.disabled).toBe(true);
    expect($<HTMLButtonElement>('[data-focus="delay-1"]')?.disabled).toBe(true);
    expect(container.textContent).toContain(t('settings.airing.enableFirst'));
  });

  it('« Vérifier maintenant » : en cours puis échec en rouge (service indisponible)', async () => {
    let fail: (error: Error) => void = () => undefined;
    sent.answer.mockImplementationOnce(() => new Promise((_resolve, reject) => (fail = reject)));
    await mount({ ...DEFAULT_SETTINGS, airingAlerts: true });
    expect($('[data-airing-status]')?.textContent).toBe(t('airing.status.never'));
    await act(() => $<HTMLButtonElement>('[data-focus="airing-check"]')?.click());
    expect($('[data-airing-status]')?.textContent).toBe(t('settings.airing.checking'));
    expect($('[data-focus="airing-check"]')?.getAttribute('aria-busy')).toBe('true');
    await act(async () => {
      fail(new Error('hors ligne'));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect($('[data-airing-status]')?.getAttribute('data-airing-status')).toBe('danger');
    expect($('[data-airing-status]')?.textContent).toContain(t('settings.airing.unavailable'));
  });

  describe('suites annoncées', () => {
    it('section après « Nouveaux épisodes » : interrupteurs enregistrés, notification grisée alertes coupées', async () => {
      await mount();
      const titles = [...container.querySelectorAll('section h2, h2')].map((h) => h.textContent);
      expect(titles.at(-1)).toBe(t('settings.section.sequels'));
      expect(titles.indexOf(t('settings.section.airing'))).toBeLessThan(titles.indexOf(t('settings.section.sequels')));
      expect($('[data-focus="sk-sequels"]')).not.toBeNull();
      await act(() => $<HTMLElement>('[data-focus="sk-sequels"]')?.click());
      expect(update).toHaveBeenCalledWith({ sequelAlerts: false });
      await act(() => $<HTMLElement>('[data-focus="sk-sequels-browser"]')?.click());
      expect(update).toHaveBeenCalledWith({ sequelNotifications: false });
      await mount({ ...DEFAULT_SETTINGS, sequelAlerts: false });
      expect($<HTMLButtonElement>('[data-focus="sk-sequels-browser"]')?.disabled).toBe(true);
    });

    it('ligne d’état : jamais vérifié, puis « Dernière vérification · N suites trouvées », raisons en clair, blocage en rouge', async () => {
      await mount();
      expect($('[data-sequels-status]')?.textContent).toBe(t('airing.status.never'));
      await mount(DEFAULT_SETTINGS, { sequels: sequelResult({ found: 2 }) });
      expect($('[data-sequels-status]')?.textContent).toContain(t('settings.sequels.found_other', { count: 2 }));
      await mount(DEFAULT_SETTINGS, { sequels: sequelResult({ skipped: 'not-connected' }) });
      expect($('[data-sequels-status]')?.textContent).toContain(t('airing.skip.notConnected'));
      expect($('[data-sequels-status]')?.getAttribute('data-sequels-status')).toBe('muted');
      await mount(DEFAULT_SETTINGS, { sequels: sequelResult({ skipped: 'not-due', found: 1 }) });
      expect($('[data-sequels-status]')?.textContent).toContain(t('settings.sequels.found_one', { count: 1 }));
      await mount(DEFAULT_SETTINGS, { sequels: sequelResult({ skipped: 'blocked' }) });
      expect($('[data-sequels-status]')?.getAttribute('data-sequels-status')).toBe('danger');
      expect($('[data-sequels-status]')?.textContent).toContain(t('airing.skip.blocked'));
      await mount(DEFAULT_SETTINGS, { sequels: sequelResult({ error: 'boom' }) });
      expect($('[data-sequels-status]')?.getAttribute('data-sequels-status')).toBe('danger');
      expect($('[data-sequels-status]')?.textContent).toContain(t('airing.status.failed', { error: 'boom' }));
    });

    it('ligne d’état : le plus récent du stockage et de la vérification lancée ici', async () => {
      const at = Date.now() - 5 * 3_600_000;
      await mount(DEFAULT_SETTINGS, { sequels: sequelResult({ checkedAt: at + 3_600_000, found: 4 }) }, sequelResult({ checkedAt: at, error: 'hors ligne' }));
      expect($('[data-sequels-status]')?.textContent).toContain(t('settings.sequels.found_other', { count: 4 }));
      expect($('[data-sequels-status]')?.getAttribute('data-sequels-status')).toBe('muted');
      await mount(DEFAULT_SETTINGS, { sequels: sequelResult({ checkedAt: at, found: 4 }) }, sequelResult({ checkedAt: at + 3_600_000, error: 'hors ligne' }));
      expect($('[data-sequels-status]')?.getAttribute('data-sequels-status')).toBe('danger');
    });

    it('« Vérifier maintenant » : réponse du service worker vide ou levée, le bouton redevient actif et l’échec s’affiche', async () => {
      sent.answer.mockResolvedValueOnce(undefined);
      await mount();
      await act(async () => {
        $<HTMLButtonElement>('[data-focus="sequels-check"]')?.click();
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect($('[data-focus="sequels-check"]')?.getAttribute('aria-busy')).not.toBe('true');
      expect($('[data-sequels-status]')?.getAttribute('data-sequels-status')).toBe('danger');
    });

    it('« Vérifier maintenant » envoie CHECK_SEQUELS puis affiche le résultat', async () => {
      sent.answer.mockClear();
      sent.answer.mockResolvedValueOnce(sequelResult({ checkedAt: Date.now(), found: 3 }));
      await mount();
      await act(async () => {
        $<HTMLButtonElement>('[data-focus="sequels-check"]')?.click();
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(sent.answer).toHaveBeenCalledWith('CHECK_SEQUELS', null);
      expect($('[data-sequels-status]')?.textContent).toContain(t('settings.sequels.found_other', { count: 3 }));
    });

    it('« Réafficher N suites » : visible seulement avec des suites masquées, envoie UPDATE_SEQUELS restore', async () => {
      await mount();
      expect($('[data-focus="sequels-restore"]')).toBeNull();
      sent.answer.mockClear();
      sent.answer.mockResolvedValueOnce(true);
      await mount(DEFAULT_SETTINGS, { sequelsDismissed: 2 });
      expect($('[data-focus="sequels-restore"]')?.textContent).toBe(t('settings.sequels.restore_other', { count: 2 }));
      await act(async () => {
        $<HTMLButtonElement>('[data-focus="sequels-restore"]')?.click();
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(sent.answer).toHaveBeenCalledWith('UPDATE_SEQUELS', { ids: [], state: 'restore' });
    });
  });
});
