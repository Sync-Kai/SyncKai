import { describe, expect, it } from 'vitest';
import { followPageContext, requestedTabState, initialPanelTab, isPanelTab, PANEL_TABS } from './tabs';

describe('PANEL_TABS', () => {
  it('« En lecture », « Agenda » puis « Découvrir »', () => {
    expect(PANEL_TABS).toEqual(['nowPlaying', 'agenda', 'discover']);
    expect(isPanelTab('agenda')).toBe(true);
    expect(isPanelTab('discover')).toBe(true);
    expect(isPanelTab('settings')).toBe(false);
  });
});

describe('initialPanelTab', () => {
  it('onglet imposé par le réglage, quel que soit le dernier onglet', () => {
    expect(initialPanelTab('agenda', 'nowPlaying')).toBe('agenda');
    expect(initialPanelTab('nowPlaying', 'agenda')).toBe('nowPlaying');
  });

  it('« Dernier onglet ouvert » : onglet mémorisé, « En lecture » s’il est absent ou inconnu', () => {
    expect(initialPanelTab('last', 'agenda')).toBe('agenda');
    // Le dernier onglet peut être « Découvrir » même si le réglage n'offre pas ce choix
    expect(initialPanelTab('last', 'discover')).toBe('discover');
    expect(initialPanelTab('last', undefined)).toBe('nowPlaying');
    expect(initialPanelTab('last', 'settings')).toBe('nowPlaying');
  });
});

describe('followPageContext', () => {
  it('hors page de streaming : « En lecture » cède la place à l’Agenda (choix automatique)', () => {
    expect(followPageContext({ tab: 'nowPlaying', auto: false }, false)).toEqual({ tab: 'agenda', auto: true });
  });

  it('retour sur une page de streaming : « En lecture » revient si l’Agenda était automatique', () => {
    expect(followPageContext({ tab: 'agenda', auto: true }, true)).toEqual({ tab: 'nowPlaying', auto: false });
  });

  it('Agenda choisi par l’utilisateur ou par le réglage : conservé partout', () => {
    expect(followPageContext({ tab: 'agenda', auto: false }, true)).toEqual({ tab: 'agenda', auto: false });
    expect(followPageContext({ tab: 'agenda', auto: false }, false)).toEqual({ tab: 'agenda', auto: false });
  });

  it('page de streaming sur « En lecture » : inchangé', () => {
    expect(followPageContext({ tab: 'nowPlaying', auto: false }, true)).toEqual({ tab: 'nowPlaying', auto: false });
  });
});

describe('followPageContext et « Découvrir »', () => {
  it('jamais choisi par le panneau, jamais quitté seul', () => {
    expect(followPageContext({ tab: 'discover', auto: false }, false)).toEqual({ tab: 'discover', auto: false });
    expect(followPageContext({ tab: 'discover', auto: false }, true)).toEqual({ tab: 'discover', auto: false });
    expect(followPageContext({ tab: 'nowPlaying', auto: false }, false)).toEqual({ tab: 'agenda', auto: true });
  });
});

describe('requestedTabState (« Plus d\'idées dans le panneau »)', () => {
  it('affiche l\'onglet demandé, choix de l\'utilisateur, et ferme les Réglages', () => {
    expect(requestedTabState('discover')).toEqual({ tab: 'discover', auto: false, settingsOpen: false });
  });
});
