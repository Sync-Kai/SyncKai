import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createVisibleTimer } from './toast';

// Fermeture automatique d'un toast (2-R12) : dans un onglet caché, l'animation d'entrée (requestAnimationFrame) ne
// s'exécute pas ; le délai ne doit courir qu'une fois la page visible, sinon la pastille disparaît sans avoir été vue.

class FakeDocument extends EventTarget {
  visibilityState: DocumentVisibilityState = 'visible';

  show(state: DocumentVisibilityState): void {
    this.visibilityState = state;
    this.dispatchEvent(new Event('visibilitychange'));
  }
}

let doc: FakeDocument;

beforeEach(() => {
  vi.useFakeTimers();
  doc = new FakeDocument();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createVisibleTimer', () => {
  it('page visible : délai depuis l’affichage', () => {
    const onTimeout = vi.fn();
    createVisibleTimer(doc, new AbortController().signal, onTimeout)(3_000);
    vi.advanceTimersByTime(2_999);
    expect(onTimeout).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onTimeout).toHaveBeenCalledOnce();
  });

  it('onglet caché : le délai ne court qu’une fois la page visible', () => {
    doc.visibilityState = 'hidden';
    const onTimeout = vi.fn();
    createVisibleTimer(doc, new AbortController().signal, onTimeout)(3_000);
    vi.advanceTimersByTime(60_000);
    expect(onTimeout).not.toHaveBeenCalled();
    doc.show('visible');
    vi.advanceTimersByTime(2_999);
    expect(onTimeout).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onTimeout).toHaveBeenCalledOnce();
  });

  it('nouveau délai (mise à jour du toast) : remplace le précédent ; aucun délai : toast gardé ; annulé : rien', () => {
    const onTimeout = vi.fn();
    const controller = new AbortController();
    const arm = createVisibleTimer(doc, controller.signal, onTimeout);
    arm(1_000);
    arm(5_000);
    vi.advanceTimersByTime(4_000);
    expect(onTimeout).not.toHaveBeenCalled();
    arm(undefined);
    vi.advanceTimersByTime(10_000);
    expect(onTimeout).not.toHaveBeenCalled();
    doc.visibilityState = 'hidden';
    arm(1_000);
    controller.abort();
    doc.show('visible');
    vi.advanceTimersByTime(10_000);
    expect(onTimeout).not.toHaveBeenCalled();
  });
});
