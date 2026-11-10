// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getLocale, setLocale, tp } from '../../i18n';
import { DEFAULT_SETTINGS } from '../../shared/settings';
import { createStore } from '../state';
import type { SettingsContext, SettingsData } from './context';
import { DataPage } from './page-data';

const sent = vi.hoisted(() => ({ answer: vi.fn<(type?: string, payload?: unknown) => Promise<unknown>>() }));
vi.mock('../../protocol/messages', () => ({ sendMessage: (type: string, payload: unknown) => sent.answer(type, payload) }));

describe('DataPage › suggestions passées', () => {
  const initial = getLocale();
  let container: HTMLElement;
  const $ = <T extends Element = HTMLElement>(selector: string): T | null => container.querySelector<T>(selector);

  async function mount(recoDismissed: number): Promise<void> {
    const data: SettingsData = {
      settings: DEFAULT_SETTINGS,
      settingsError: false,
      mappings: null,
      mappingsError: null,
      exclusions: { status: 'loading' },
      journalCount: null,
      airing: null,
      sequels: null,
      sequelsDismissed: 0,
      recoDismissed,
      platformAccess: [],
    };
    const account = createStore({ status: 'loading' });
    const compare = { store: createStore({ result: null }) };
    const ctx = { state: createStore(data), host: { accounts: { anilist: account, mal: account }, compare: () => compare } } as unknown as SettingsContext;
    await act(() => render(<DataPage ctx={ctx} exportState={createStore('idle')} onExport={() => undefined} />, container));
  }

  beforeEach(() => {
    setLocale('en');
    sent.answer.mockReset();
    sent.answer.mockResolvedValue(true);
    container = document.createElement('div');
    document.body.append(container);
  });

  afterEach(async () => {
    await act(() => render(null, container));
    container.remove();
    setLocale(initial);
  });

  it('aucune suggestion passée : pas de bouton', async () => {
    await mount(0);
    expect($('[data-focus="reco-restore"]')).toBeNull();
  });

  it('« Réafficher N suggestions passées » envoie RESTORE_RECOMMENDATIONS', async () => {
    await mount(3);
    const button = $<HTMLButtonElement>('[data-focus="reco-restore"]');
    expect(button?.textContent).toContain(tp('settings.reco.restore', 3));
    await act(() => button?.click());
    expect(sent.answer).toHaveBeenCalledWith('RESTORE_RECOMMENDATIONS', null);
  });
});
