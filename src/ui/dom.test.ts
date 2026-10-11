import { describe, expect, it, vi } from 'vitest';
import { busyAttrs, createMemo, createRenderScheduler, pickFocusKey } from './dom';

describe('busyAttrs', () => {
  it('action en cours : aria-disabled (bouton focalisable), jamais disabled', () => {
    expect(busyAttrs(true)).toEqual({ 'aria-disabled': 'true' });
    expect(busyAttrs(true, true)).toEqual({ 'aria-disabled': 'true', 'aria-busy': 'true' });
    expect(busyAttrs(false, true)).toEqual({});
  });
});

describe('pickFocusKey', () => {
  const before = ['sort-trigger', 'plus-a', 'more-a', 'plus-b', 'more-b', 'plus-c', 'more-c'];
  const availableAmong =
    (...keys: string[]) =>
    (key: string): boolean =>
      keys.includes(key);

  it('élément toujours disponible (même recréé, ou aria-disabled) : il garde le focus', () => {
    expect(pickFocusKey('plus-b', before, [], availableAmong(...before))).toBe('plus-b');
  });

  it('élément retiré : repli déclaré (data-focus-fallback) en priorité', () => {
    const available = availableAmong('sort-trigger', 'plus-a', 'more-a', 'plus-c', 'more-c', 'section-title');
    expect(pickFocusKey('more-b', before, ['missing', 'section-title'], available)).toBe('section-title');
  });

  it('élément retiré sans repli : voisin suivant, puis précédent', () => {
    expect(pickFocusKey('plus-b', before, [], availableAmong('sort-trigger', 'plus-a', 'more-a', 'plus-c', 'more-c'))).toBe('plus-c');
    // Dernière ligne retirée : voisin précédent
    expect(pickFocusKey('more-c', before, [], availableAmong('sort-trigger', 'plus-a', 'more-a'))).toBe('more-a');
  });

  it('élément désactivé (disabled natif) : voisin le plus proche', () => {
    // « +1 » arrivé au dernier épisode : focus sur le menu « … » de la même ligne
    expect(pickFocusKey('plus-b', before, [], (key) => key !== 'plus-b')).toBe('more-b');
  });

  it('plus rien de disponible ou clé inconnue : null', () => {
    expect(pickFocusKey('plus-b', before, [], () => false)).toBeNull();
    expect(pickFocusKey('unknown', before, [], (key) => key !== 'unknown')).toBeNull();
  });
});

describe('createMemo', () => {
  it('signale un changement seulement si une entrée diffère (comparaison stricte)', () => {
    const changed = createMemo();
    const state = { items: [] };
    expect(changed([state, 1])).toBe(true);
    expect(changed([state, 1])).toBe(false);
    expect(changed([{ items: [] }, 1])).toBe(true);
    expect(changed([{ items: [] }, 1, 'x'])).toBe(true);
    expect(changed([Number.NaN])).toBe(true);
    expect(changed([Number.NaN])).toBe(false);
  });
});

describe('createRenderScheduler', () => {
  it('regroupe les demandes d’un même tour en un seul rendu', async () => {
    const render = vi.fn();
    const { schedule } = createRenderScheduler(render);
    schedule();
    schedule();
    schedule();
    expect(render).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(render).toHaveBeenCalledTimes(1);
    schedule();
    await Promise.resolve();
    expect(render).toHaveBeenCalledTimes(2);
  });

  it('flush dessine tout de suite le rendu en attente, sans second rendu ensuite', async () => {
    const render = vi.fn();
    const { schedule, flush } = createRenderScheduler(render);
    flush();
    expect(render).not.toHaveBeenCalled();
    schedule();
    flush();
    expect(render).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    expect(render).toHaveBeenCalledTimes(1);
  });
});
