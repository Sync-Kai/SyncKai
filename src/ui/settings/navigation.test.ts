import { describe, expect, it } from 'vitest';
import { INITIAL_SETTINGS_NAV, isSettingsPage, settingsNavReducer, SETTINGS_CATEGORIES } from './navigation';

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
