import { describe, expect, it } from 'vitest';
import { initialPanelTab, isPanelTab, nextTabIndex, PANEL_TABS } from './tabs';

describe('nextTabIndex', () => {
  it('flèches en boucle', () => {
    expect(nextTabIndex(0, 'ArrowRight', 2)).toBe(1);
    expect(nextTabIndex(1, 'ArrowRight', 2)).toBe(0);
    expect(nextTabIndex(0, 'ArrowLeft', 2)).toBe(1);
    expect(nextTabIndex(1, 'ArrowLeft', 2)).toBe(0);
  });

  it('Début / Fin', () => {
    expect(nextTabIndex(1, 'Home', 3)).toBe(0);
    expect(nextTabIndex(0, 'End', 3)).toBe(2);
  });

  it('autres touches ou liste vide → null', () => {
    expect(nextTabIndex(0, 'Enter', 2)).toBeNull();
    expect(nextTabIndex(0, 'ArrowDown', 2)).toBeNull();
    expect(nextTabIndex(0, 'ArrowRight', 0)).toBeNull();
  });
});

describe('PANEL_TABS', () => {
  it('« En lecture » puis « Agenda »', () => {
    expect(PANEL_TABS).toEqual(['nowPlaying', 'agenda']);
    expect(isPanelTab('agenda')).toBe(true);
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
    expect(initialPanelTab('last', undefined)).toBe('nowPlaying');
    expect(initialPanelTab('last', 'settings')).toBe('nowPlaying');
  });
});
