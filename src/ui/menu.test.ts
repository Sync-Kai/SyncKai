import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMenuDismiss } from './menu';

// Fermeture des menus : faux document (EventTarget de Node), éléments simulés par une classe Element minimale.

class FakeElement {
  readonly name: string;
  constructor(name: string) {
    this.name = name;
  }
}
vi.stubGlobal('Element', FakeElement);

/** Évènement dispatché sur le faux document, cible et touche fixées comme par le navigateur */
function fire(doc: EventTarget, type: string, init: { target?: FakeElement; key?: string } = {}): Event {
  const event = new Event(type, { cancelable: true });
  Object.defineProperty(event, 'target', { value: init.target ?? null });
  if (init.key !== undefined) Object.defineProperty(event, 'key', { value: init.key });
  doc.dispatchEvent(event);
  return event;
}

describe('createMenuDismiss', () => {
  let doc: EventTarget;
  const onPointerDown = vi.fn<(target: Element | null) => void>();
  const onClick = vi.fn<(target: Element | null) => void>();
  const onEscape = vi.fn<() => void>();

  beforeEach(() => {
    doc = new EventTarget();
    onPointerDown.mockReset();
    onClick.mockReset();
    onEscape.mockReset();
  });

  it('menu fermé : aucun écouteur', () => {
    createMenuDismiss({ onPointerDown, onClick, onEscape }, doc);
    fire(doc, 'pointerdown');
    fire(doc, 'click');
    fire(doc, 'keydown', { key: 'Escape' });
    expect(onPointerDown).not.toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled();
    expect(onEscape).not.toHaveBeenCalled();
  });

  it('menu ouvert : cible transmise, écouteurs retirés à la fermeture (ouverture répétée sans doublon)', () => {
    const menu = createMenuDismiss({ onPointerDown, onClick }, doc);
    menu.setOpen(true);
    menu.setOpen(true);
    const target = new FakeElement('ailleurs');
    fire(doc, 'pointerdown', { target });
    fire(doc, 'click', { target });
    expect(onPointerDown).toHaveBeenCalledExactlyOnceWith(target);
    expect(onClick).toHaveBeenCalledExactlyOnceWith(target);

    menu.setOpen(false);
    fire(doc, 'pointerdown', { target });
    fire(doc, 'click', { target });
    expect(onPointerDown).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('Échap : menu fermé sans fermer la page (évènement annulé), autres touches ignorées', () => {
    const menu = createMenuDismiss({ onEscape }, doc);
    menu.setOpen(true);
    expect(fire(doc, 'keydown', { key: 'Enter' }).defaultPrevented).toBe(false);
    expect(onEscape).not.toHaveBeenCalled();
    expect(fire(doc, 'keydown', { key: 'Escape' }).defaultPrevented).toBe(true);
    expect(onEscape).toHaveBeenCalledTimes(1);
  });
});
