import { afterEach, describe, expect, it } from 'vitest';
import { getLocale, setLocale } from '../../i18n';
import { shortcutRows } from './page-shortcuts';

const initial = getLocale();
afterEach(() => setLocale(initial));

describe('shortcutRows (Réglages › Raccourcis)', () => {
  it('touches définies : touche mise en forme, indication AZERTY du chiffre, « Modifier », repères de focus', () => {
    setLocale('fr');
    expect(shortcutRows({ shortcut: 'Alt+Shift+K', panelShortcut: 'Alt+Shift+1' }, 'chrome')).toEqual([
      {
        kind: 'episode',
        section: 'Pendant la lecture',
        label: 'Valider l’épisode en cours',
        key: 'Alt+Maj+K',
        keyHint: null,
        value: null,
        loading: false,
        action: 'Modifier',
        editAria: 'Modifier le raccourci clavier (réglages du navigateur)',
        focus: 'shortcut',
      },
      {
        kind: 'panel',
        section: 'Navigation',
        label: 'Ouvrir ou fermer le panneau latéral',
        key: 'Alt+Maj+1',
        keyHint: 'touche &',
        value: null,
        loading: false,
        action: 'Modifier',
        editAria: 'Modifier le raccourci du panneau latéral (réglages du navigateur)',
        focus: 'panel-shortcut',
      },
    ]);
  });

  it('indication AZERTY en français uniquement', () => {
    const data = { shortcut: 'Alt+Shift+K', panelShortcut: 'Alt+Shift+1' };
    setLocale('en');
    expect(shortcutRows(data, 'chrome').map((row) => row.keyHint)).toEqual([null, null]);
    setLocale('de');
    expect(shortcutRows(data, 'chrome').map((row) => [row.key, row.keyHint])).toEqual([
      ['Alt+Umschalt+K', null],
      ['Alt+Umschalt+1', null],
    ]);
  });

  it('touche non définie : « Non défini » et « Définir » ; en lecture : « Chargement… »', () => {
    setLocale('fr');
    const [episode, panel] = shortcutRows({ shortcut: '', panelShortcut: undefined }, 'chrome');
    expect(episode).toMatchObject({ key: null, keyHint: null, value: 'Non défini', action: 'Définir' });
    expect(panel).toMatchObject({ key: null, value: 'Chargement…', loading: true, action: 'Définir' });
    expect(episode?.loading).toBe(false);
    setLocale('en');
    expect(shortcutRows({ shortcut: '', panelShortcut: 'Alt+Shift+1' }, 'chrome').map((row) => [row.value ?? row.key, row.action])).toEqual([
      ['Not set', 'Set'],
      ['Alt+Shift+1', 'Change'],
    ]);
    setLocale('de');
    expect(shortcutRows({ shortcut: 'Alt+Shift+K', panelShortcut: '' }, 'firefox').map((row) => [row.value ?? row.key, row.action])).toEqual([
      ['Alt+Umschalt+K', 'Ändern'],
      ['Nicht festgelegt', 'Festlegen'],
    ]);
  });

  it('Firefox : le panneau s’affiche ou se masque (commande native de la barre latérale)', () => {
    const labels = (target: 'chrome' | 'firefox'): string[] => shortcutRows({ shortcut: 'Alt+Shift+K', panelShortcut: 'Alt+Shift+1' }, target).map((row) => row.label);
    setLocale('fr');
    expect(labels('firefox')).toEqual(['Valider l’épisode en cours', 'Afficher ou masquer le panneau latéral']);
    expect(labels('chrome')).toEqual(['Valider l’épisode en cours', 'Ouvrir ou fermer le panneau latéral']);
    setLocale('en');
    expect(labels('firefox')).toEqual(['Mark the current episode as watched', 'Show or hide the side panel']);
    setLocale('de');
    expect(labels('chrome')).toEqual(['Aktuelle Folge abschließen', 'Seitenleiste öffnen oder schließen']);
    expect(labels('firefox')[1]).toBe('Seitenleiste ein- oder ausblenden');
  });
});
