// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getLocale, setLocale, t } from '../../i18n';
import { DEFAULT_SETTINGS } from '../../shared/settings';
import type { SettingsData } from './context';
import { SettingsHome, type SettingsHomeProps } from './home';

const DATA: SettingsData = {
  settings: DEFAULT_SETTINGS,
  settingsError: false,
  mappings: null,
  mappingsError: null,
  exclusions: { status: 'loading' },
  journalCount: 0,
  airing: null,
  platformAccess: ['netflix'],
};

describe('SettingsHome (maquettes Main, ReglagesEtats)', () => {
  const initial = getLocale();
  let container: HTMLElement;
  const onOpen = vi.fn();
  const onUpdate = vi.fn();
  const $ = (selector: string): HTMLElement | null => container.querySelector<HTMLElement>(selector);
  const show = (props: Partial<SettingsHomeProps> = {}): Promise<void> =>
    act(() => render(<SettingsHome data={DATA} accounts={{ anilist: 'connected', mal: 'connected' }} version="2.4.0" onOpen={onOpen} onUpdate={onUpdate} {...props} />, container));

  beforeEach(() => {
    setLocale('fr');
    container = document.createElement('div');
    document.body.append(container);
    onOpen.mockReset();
    onUpdate.mockReset();
  });

  afterEach(async () => {
    await act(() => render(null, container));
    container.remove();
    setLocale(initial);
  });

  it('carte Comptes, interrupteurs rapides, puis les catégories dans l’ordre de la maquette', async () => {
    await show();
    expect($('[data-account-summary]')?.textContent).toBe(t('settings.summary.bothConnected'));
    expect($('[data-account-summary]')?.dataset.accountSummary).toBe('ok');
    const rows = [...container.querySelectorAll<HTMLElement>('[data-focus^="settings-cat-"]')].map((row) => row.dataset.focus);
    expect(rows).toEqual(['accounts', 'sync', 'platforms', 'notifications', 'display', 'data', 'help'].map((id) => `settings-cat-${id}`));
    expect($('[data-focus="settings-cat-platforms"]')?.textContent).toContain('3 sur 5 actives · lecteur Crunchyroll');
    expect($('[data-focus="settings-cat-help"]')?.textContent).toContain('Version 2.4.0 · aucune erreur');
    $('[data-focus="settings-cat-display"]')?.click();
    expect(onOpen).toHaveBeenCalledWith('display');
    $('[data-focus="settings-cat-accounts"]')?.click();
    expect(onOpen).toHaveBeenLastCalledWith('accounts');
    // Interrupteur rapide : bascule enregistrée par l'hôte
    $('[data-focus="sk-quick-airing"]')?.click();
    expect(onUpdate).toHaveBeenCalledWith({ airingAlerts: false });
  });

  it('session expirée : résumé rouge ; aucun compte : point neutre', async () => {
    await show({ accounts: { anilist: 'connected', mal: 'expired' } });
    expect($('[data-account-summary]')?.dataset.accountSummary).toBe('danger');
    expect($('[data-account-summary]')?.className).toContain('text-danger');
    await show({ accounts: { anilist: 'disconnected', mal: 'disconnected' } });
    expect($('[data-account-summary]')?.textContent).toBe(t('settings.summary.noAccount'));
    expect($('[data-account-summary]')?.dataset.accountSummary).toBe('muted');
  });

  it('réglages en lecture : squelette et « Chargement… » ; illisibles : alerte, résumés qui en dépendent masqués', async () => {
    await show({ data: { ...DATA, settings: null } });
    expect($('[data-settings-skeleton]')?.getAttribute('aria-label')).toBe(t('settings.loading'));
    expect($('[data-focus="settings-cat-sync"]')?.textContent).toContain(t('settings.summary.loading'));
    expect($('[data-focus="sk-quick-auto"]')).toBeNull();
    await show({ data: { ...DATA, settings: null, settingsError: true } });
    expect($('[data-alert]')?.dataset.alert).toBe(t('settings.loadError'));
    expect($('[data-focus="settings-cat-sync"] [data-row-description]')).toBeNull();
    expect($('[data-focus="settings-cat-display"] [data-row-description]')?.textContent).toBe(t('settings.summary.display'));
  });
});
