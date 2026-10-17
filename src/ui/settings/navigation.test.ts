import { afterEach, describe, expect, it } from 'vitest';
import { getLocale, setLocale } from '../../i18n';
import { INITIAL_SETTINGS_NAV, SETTINGS_CATEGORIES, SETTINGS_PAGE_PARENTS, settingsDepth, settingsNavReducer, settingsPath } from './navigation';

describe('settingsNavReducer', () => {
  it('ouvre une sous-page et demande le focus sur son titre', () => {
    const { state, effect } = settingsNavReducer(INITIAL_SETTINGS_NAV, { type: 'open', page: 'notifications' });
    expect(state).toEqual({ page: 'notifications' });
    expect(effect).toEqual({ kind: 'focus-heading' });
  });

  it('sous-page déjà affichée : rien ne change', () => {
    const current = { page: 'data' } as const;
    expect(settingsNavReducer(current, { type: 'open', page: 'data' })).toEqual({ state: current, effect: { kind: 'none' } });
  });

  it('retour depuis une catégorie : accueil, focus rendu à sa ligne', () => {
    const { state, effect } = settingsNavReducer({ page: 'sync' }, { type: 'back' });
    expect(state).toEqual(INITIAL_SETTINGS_NAV);
    expect(effect).toEqual({ kind: 'focus-row', page: 'sync' });
  });

  it('page de second niveau (Affichage › Langue) : le retour mène à la page parente, focus sur la ligne quittée', () => {
    const opened = settingsNavReducer({ page: 'display' }, { type: 'open', page: 'language' });
    expect(opened).toEqual({ state: { page: 'language' }, effect: { kind: 'focus-heading' } });
    expect(settingsNavReducer({ page: 'shortcuts' }, { type: 'back' })).toEqual({ state: { page: 'display' }, effect: { kind: 'focus-row', page: 'shortcuts' } });
  });

  it('page ouverte directement (pastille de compte, lien d’une autre page) : retour vers son parent, pas vers la page d’origine', () => {
    expect(settingsNavReducer({ page: 'accounts' }, { type: 'back' }).effect).toEqual({ kind: 'focus-row', page: 'accounts' });
    expect(settingsNavReducer(settingsNavReducer({ page: 'sync' }, { type: 'open', page: 'shortcuts' }).state, { type: 'back' }).state).toEqual({ page: 'display' });
  });

  it('retour depuis l’accueil : sortie des réglages', () => {
    expect(settingsNavReducer(INITIAL_SETTINGS_NAV, { type: 'back' })).toEqual({ state: INITIAL_SETTINGS_NAV, effect: { kind: 'exit' } });
  });

  it('reset : accueil sans effet de focus', () => {
    expect(settingsNavReducer({ page: 'help' }, { type: 'reset' })).toEqual({ state: INITIAL_SETTINGS_NAV, effect: { kind: 'none' } });
  });
});

describe('arbre des pages', () => {
  it('catégories de l’accueil dans l’ordre de la maquette Main', () => {
    expect(SETTINGS_CATEGORIES).toEqual(['accounts', 'sync', 'platforms', 'notifications', 'display', 'data', 'help']);
  });

  it('chaque catégorie a l’accueil pour parent ; Langue et Raccourcis sous Affichage, Écarts sous Mes données', () => {
    for (const category of SETTINGS_CATEGORIES) expect(SETTINGS_PAGE_PARENTS[category]).toBe('home');
    expect(SETTINGS_PAGE_PARENTS.language).toBe('display');
    expect(SETTINGS_PAGE_PARENTS.shortcuts).toBe('display');
    expect(SETTINGS_PAGE_PARENTS.mappings).toBe('sync');
    expect(SETTINGS_PAGE_PARENTS.exclusions).toBe('sync');
    expect(SETTINGS_PAGE_PARENTS.compare).toBe('data');
    expect(settingsDepth('home')).toBe(0);
    expect(settingsDepth('display')).toBe(1);
    expect(settingsDepth('language')).toBe(2);
  });
});

describe('settingsPath (UX-06)', () => {
  const initial = getLocale();
  afterEach(() => setLocale(initial));

  it('chemin construit depuis les titres réels, parents compris', () => {
    setLocale('fr');
    expect(settingsPath('platforms')).toBe('Réglages › Plateformes');
    expect(settingsPath('shortcuts')).toBe('Réglages › Affichage › Raccourcis');
    expect(settingsPath('exclusions')).toBe('Réglages › Synchronisation › Séries exclues');
    expect(settingsPath('compare')).toBe('Réglages › Mes données › Écarts AniList ↔ MAL');
    setLocale('en');
    expect(settingsPath('platforms')).toBe('Settings › Platforms');
    expect(settingsPath('data')).toBe('Settings › My data');
    setLocale('de');
    expect(settingsPath('data')).toBe('Einstellungen › Meine Daten');
  });
});
