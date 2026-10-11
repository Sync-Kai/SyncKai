import { afterEach, describe, expect, it } from 'vitest';
import { getLocale, setLocale, t } from '../../i18n';
import { INITIAL_SETTINGS_NAV, isSettingsPage, settingsNavReducer, settingsPath, SETTINGS_CATEGORIES } from './navigation';

describe('settingsNavReducer', () => {
  it('ouvre une sous-page et demande le focus sur son titre', () => {
    const { state, effect } = settingsNavReducer(INITIAL_SETTINGS_NAV, { type: 'open', category: 'notifications' });
    expect(state).toEqual({ page: 'notifications', origin: 'notifications' });
    expect(effect).toEqual({ kind: 'focus-heading' });
  });

  it('sous-page déjà affichée : rien ne change', () => {
    const current = { page: 'data', origin: 'data' } as const;
    expect(settingsNavReducer(current, { type: 'open', category: 'data' })).toEqual({ state: current, effect: { kind: 'none' } });
  });

  it('retour depuis une sous-page : accueil, focus rendu à la ligne d’origine', () => {
    const { state, effect } = settingsNavReducer({ page: 'sync', origin: 'sync' }, { type: 'back' });
    expect(state).toEqual(INITIAL_SETTINGS_NAV);
    expect(effect).toEqual({ kind: 'focus-row', category: 'sync' });
  });

  it('retour depuis une sous-page ouverte directement (sans ligne d’origine) : focus sur sa ligne', () => {
    expect(settingsNavReducer({ page: 'accounts', origin: null }, { type: 'back' }).effect).toEqual({ kind: 'focus-row', category: 'accounts' });
  });

  it('retour depuis l’accueil : sortie des réglages', () => {
    expect(settingsNavReducer(INITIAL_SETTINGS_NAV, { type: 'back' })).toEqual({ state: INITIAL_SETTINGS_NAV, effect: { kind: 'exit' } });
  });

  it('reset : accueil sans effet de focus', () => {
    expect(settingsNavReducer({ page: 'help', origin: 'help' }, { type: 'reset' })).toEqual({ state: INITIAL_SETTINGS_NAV, effect: { kind: 'none' } });
  });
});

describe('isSettingsPage', () => {
  it('accepte l’accueil et les catégories, rejette le reste', () => {
    expect(SETTINGS_CATEGORIES.every(isSettingsPage)).toBe(true);
    expect(isSettingsPage('home')).toBe(true);
    expect(isSettingsPage('activity')).toBe(false);
    expect(isSettingsPage(null)).toBe(false);
  });
});

describe('settingsPath (UX-06)', () => {
  const initial = getLocale();
  afterEach(() => setLocale(initial));

  it('chemin de l’astuce construit depuis le titre réel de la catégorie, dans les 3 langues', () => {
    setLocale('fr');
    expect(settingsPath('sync')).toBe('Réglages › Lecture & synchro');
    setLocale('en');
    expect(settingsPath('sync')).toBe('Settings › Playback & sync');
    setLocale('de');
    expect(settingsPath('sync')).toBe(`${t('nav.settings')} › ${t('settings.cat.sync')}`);
    expect(settingsPath('data')).toBe('Einstellungen › Meine Daten');
  });
});
