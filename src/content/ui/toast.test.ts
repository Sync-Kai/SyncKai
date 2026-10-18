import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { canReplace, createToastTimer, toastTop } from './toast';

// Fermeture automatique d'un toast (2-R12) : dans un onglet caché, l'animation d'entrée (requestAnimationFrame) ne
// s'exécute pas ; le délai ne doit courir qu'une fois la page visible, sinon la pastille disparaît sans avoir été vue.
// Refonte des bulles (2026-10-18) : le délai ne court que page visible, et s'arrête sous le pointeur ou le focus.

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

describe('createToastTimer', () => {
  it('page visible : délai depuis l’affichage', () => {
    const onTimeout = vi.fn();
    createToastTimer(doc, new AbortController().signal, onTimeout).arm(3_000);
    vi.advanceTimersByTime(2_999);
    expect(onTimeout).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onTimeout).toHaveBeenCalledOnce();
  });

  it('onglet caché : le délai ne court qu’une fois la page visible', () => {
    doc.visibilityState = 'hidden';
    const onTimeout = vi.fn();
    createToastTimer(doc, new AbortController().signal, onTimeout).arm(3_000);
    vi.advanceTimersByTime(60_000);
    expect(onTimeout).not.toHaveBeenCalled();
    doc.show('visible');
    vi.advanceTimersByTime(2_999);
    expect(onTimeout).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onTimeout).toHaveBeenCalledOnce();
  });

  it('onglet caché en cours de route : le temps restant est gardé, compté au retour', () => {
    const onTimeout = vi.fn();
    createToastTimer(doc, new AbortController().signal, onTimeout).arm(5_000);
    vi.advanceTimersByTime(2_000);
    doc.show('hidden');
    vi.advanceTimersByTime(60_000);
    expect(onTimeout).not.toHaveBeenCalled();
    doc.show('visible');
    vi.advanceTimersByTime(2_999);
    expect(onTimeout).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onTimeout).toHaveBeenCalledOnce();
  });

  it('pointeur sur la bulle : délai en pause, repris avec le temps restant', () => {
    const onTimeout = vi.fn();
    const timer = createToastTimer(doc, new AbortController().signal, onTimeout);
    timer.arm(3_000);
    vi.advanceTimersByTime(2_000);
    timer.hold('hover', true);
    vi.advanceTimersByTime(30_000);
    expect(onTimeout).not.toHaveBeenCalled();
    timer.hold('hover', false);
    vi.advanceTimersByTime(999);
    expect(onTimeout).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onTimeout).toHaveBeenCalledOnce();
  });

  it('focus et pointeur : le délai ne reprend qu’une fois les deux partis', () => {
    const onTimeout = vi.fn();
    const timer = createToastTimer(doc, new AbortController().signal, onTimeout);
    timer.arm(1_000);
    timer.hold('focus', true);
    timer.hold('hover', true);
    timer.hold('hover', false);
    vi.advanceTimersByTime(10_000);
    expect(onTimeout).not.toHaveBeenCalled();
    timer.hold('focus', false);
    vi.advanceTimersByTime(1_000);
    expect(onTimeout).toHaveBeenCalledOnce();
  });

  it('signale quand le délai court ou s’arrête (barre de délai)', () => {
    const onRun = vi.fn();
    const timer = createToastTimer(doc, new AbortController().signal, () => undefined, onRun);
    timer.arm(3_000);
    expect(onRun).toHaveBeenLastCalledWith(true);
    timer.hold('hover', true);
    expect(onRun).toHaveBeenLastCalledWith(false);
    timer.hold('hover', false);
    expect(onRun).toHaveBeenLastCalledWith(true);
    doc.show('hidden');
    expect(onRun).toHaveBeenLastCalledWith(false);
  });

  it('nouveau délai (mise à jour du toast) : remplace le précédent ; aucun délai : toast gardé ; annulé : rien', () => {
    const onTimeout = vi.fn();
    const controller = new AbortController();
    const timer = createToastTimer(doc, controller.signal, onTimeout);
    timer.arm(1_000);
    timer.arm(5_000);
    vi.advanceTimersByTime(4_000);
    expect(onTimeout).not.toHaveBeenCalled();
    timer.arm(undefined);
    vi.advanceTimersByTime(10_000);
    expect(onTimeout).not.toHaveBeenCalled();
    doc.visibilityState = 'hidden';
    timer.arm(1_000);
    controller.abort();
    doc.show('visible');
    vi.advanceTimersByTime(10_000);
    expect(onTimeout).not.toHaveBeenCalled();
  });
});

describe('toastTop', () => {
  it('72 px du haut, 56 px quand la fenêtre fait moins de 600 px de haut', () => {
    expect(toastTop(800)).toBe(72);
    expect(toastTop(600)).toBe(72);
    expect(toastTop(599)).toBe(56);
    expect(toastTop(360)).toBe(56);
  });
});

describe('canReplace', () => {
  const info = { waitsForClick: false, alert: false };
  const waiting = { waitsForClick: true, alert: false };
  const alert = { waitsForClick: false, alert: true };
  const failed = { waitsForClick: true, alert: true };

  it('rien d’affiché, ou une simple information : toute bulle prend sa place', () => {
    for (const next of [info, waiting, alert, failed]) {
      expect(canReplace(null, next)).toBe(true);
      expect(canReplace(info, next)).toBe(true);
      expect(canReplace(alert, next)).toBe(true);
    }
  });

  it('une bulle qui attend un clic n’est jamais chassée par une simple information', () => {
    expect(canReplace(waiting, info)).toBe(false);
    expect(canReplace(failed, info)).toBe(false);
  });

  it('une alerte ou une autre bulle à bouton la remplace', () => {
    expect(canReplace(waiting, alert)).toBe(true);
    expect(canReplace(waiting, waiting)).toBe(true);
    expect(canReplace(failed, failed)).toBe(true);
  });
});
