// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getLocale, setLocale, t } from '../../i18n';
import type { AiringCheckResult } from '../../shared/airing.types';
import { DEFAULT_SETTINGS, type SyncSettings } from '../../shared/settings';
import { createStore } from '../state';
import type { SettingsContext, SettingsData } from './context';
import { latestAiring, NotificationsPage } from './page-notifications';

const sent = vi.hoisted(() => ({ answer: vi.fn<() => Promise<unknown>>() }));
vi.mock('../../protocol/messages', () => ({ sendMessage: () => sent.answer() }));

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

  async function mount(settings: SyncSettings = DEFAULT_SETTINGS): Promise<void> {
    const data: SettingsData = {
      settings,
      settingsError: false,
      mappings: null,
      mappingsError: null,
      exclusions: { status: 'loading' },
      journalCount: null,
      airing: null,
      platformAccess: [],
    };
    const ctx = { state: createStore(data), update } as Partial<SettingsContext> as SettingsContext;
    await act(() => render(<NotificationsPage ctx={ctx} check={createStore({ pending: false, result: null })} />, container));
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
});
