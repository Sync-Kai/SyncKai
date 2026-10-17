// @vitest-environment happy-dom
import { render } from 'preact';
import { useRef } from 'preact/hooks';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDismiss, useFocusFallback, type DismissOptions, type FocusFallback } from './hooks';

// Hooks de focus et de fermeture des pages Preact, dans un vrai DOM (happy-dom) : même contrat que preserveFocus
// (ui/dom.ts › pickFocusKey) quand un rendu retire l'élément focalisé, et que createMenuDismiss (ui/menu.ts).

let container: HTMLElement;

const $ = (selector: string): HTMLElement | null => container.querySelector<HTMLElement>(selector);

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
});

afterEach(async () => {
  await act(() => render(null, container));
  container.remove();
  vi.restoreAllMocks();
});

describe('useFocusFallback', () => {
  /** Liste de boutons `data-focus` ; `fallback` : 'ref' = bouton « Fermer » hors liste, sinon une clé */
  /** `generation` : clés Preact changées, boutons recréés avec les mêmes clés data-focus */
  function List(props: { items: readonly string[]; fallback?: 'ref' | string; disabled?: string; declared?: Record<string, string>; generation?: number }) {
    const root = useRef<HTMLDivElement>(null);
    const close = useRef<HTMLButtonElement>(null);
    const fallback: FocusFallback | undefined = props.fallback === 'ref' ? close : props.fallback;
    useFocusFallback(root, fallback);
    return (
      <div ref={root}>
        <button type="button" ref={close} data-close="">
          Fermer
        </button>
        {props.items.map((item) => (
          <button key={`${item}:${props.generation ?? 0}`} type="button" data-focus={item} data-focus-fallback={props.declared?.[item]} disabled={props.disabled === item}>
            {item}
          </button>
        ))}
      </div>
    );
  }

  const show = (props: Parameters<typeof List>[0]): Promise<void> => act(() => render(<List {...props} />, container));
  const focusKey = (): string | null => (document.activeElement instanceof HTMLElement ? (document.activeElement.dataset.focus ?? null) : null);

  it('élément focalisé retiré par un rendu : focus sur le repli donné par ref', async () => {
    await show({ items: ['a', 'b', 'c'], fallback: 'ref' });
    $('[data-focus="b"]')?.focus();
    await show({ items: ['a', 'c'], fallback: 'ref' });
    expect(document.activeElement).toBe($('[data-close]'));
  });

  it('repli donné par clé data-focus', async () => {
    await show({ items: ['a', 'b', 'c'], fallback: 'a' });
    $('[data-focus="b"]')?.focus();
    await show({ items: ['a', 'c'], fallback: 'a' });
    expect(focusKey()).toBe('a');
  });

  it('sans repli : voisin suivant dans l’ordre d’avant le rendu, sinon précédent (pickFocusKey)', async () => {
    await show({ items: ['a', 'b', 'c'] });
    $('[data-focus="b"]')?.focus();
    await show({ items: ['a', 'c'] });
    expect(focusKey()).toBe('c');
    await show({ items: ['a'] });
    expect(focusKey()).toBe('a');
  });

  it('repli déclaré par l’élément (data-focus-fallback) avant celui du hook et les voisins', async () => {
    await show({ items: ['a', 'b', 'c'], fallback: 'c', declared: { b: 'a' } });
    $('[data-focus="b"]')?.focus();
    await show({ items: ['a', 'c'], fallback: 'c' });
    expect(focusKey()).toBe('a');
  });

  it('élément recréé avec la même clé : il reprend le focus', async () => {
    await show({ items: ['a', 'b'], fallback: 'ref' });
    $('[data-focus="b"]')?.focus();
    const before = $('[data-focus="b"]');
    await show({ items: ['a', 'b'], fallback: 'ref', generation: 1 });
    expect($('[data-focus="b"]')).not.toBe(before);
    expect(focusKey()).toBe('b');
  });

  it('élément focalisé désactivé : focus sur le repli', async () => {
    await show({ items: ['a', 'b'], fallback: 'a' });
    $('[data-focus="b"]')?.focus();
    await show({ items: ['a', 'b'], fallback: 'a', disabled: 'b' });
    expect(focusKey()).toBe('a');
  });

  it('focus parti ailleurs (hors du conteneur) avant le rendu : rien n’est volé', async () => {
    const outside = document.createElement('button');
    document.body.append(outside);
    await show({ items: ['a', 'b'], fallback: 'a' });
    $('[data-focus="b"]')?.focus();
    outside.focus();
    await show({ items: ['a'], fallback: 'a' });
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });

  it('rendu qui ne retire rien : le focus ne bouge pas', async () => {
    await show({ items: ['a', 'b'], fallback: 'a' });
    const b = $('[data-focus="b"]');
    b?.focus();
    await show({ items: ['a', 'b', 'c'], fallback: 'a' });
    expect(document.activeElement).toBe(b);
  });
});

describe('useDismiss', () => {
  const onDismiss = vi.fn<() => void>();

  function Menu(props: { options?: DismissOptions; onDismiss?: () => void }) {
    const ref = useRef<HTMLDivElement>(null);
    useDismiss(ref, props.onDismiss ?? onDismiss, props.options);
    return (
      <div ref={ref} data-menu="">
        <button type="button" data-item="">
          Item
        </button>
      </div>
    );
  }

  beforeEach(() => {
    onDismiss.mockReset();
  });

  const show = (props: Parameters<typeof Menu>[0] = {}): Promise<void> => act(() => render(<Menu {...props} />, container));
  const escape = (target: EventTarget): KeyboardEvent => {
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return event;
  };
  const pointerDown = (target: EventTarget): void => {
    target.dispatchEvent(new Event('pointerdown', { bubbles: true }));
  };

  it('Échap : fermeture, sans atteindre les écouteurs de l’hôte (Échap des Réglages, fermeture du popup)', async () => {
    const host = vi.fn<() => void>();
    container.addEventListener('keydown', host);
    await show();
    const event = escape($('[data-item]') ?? document.body);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
    expect(host).not.toHaveBeenCalled();
    container.removeEventListener('keydown', host);
  });

  it('autre touche : rien', async () => {
    await show();
    $('[data-item]')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('pointeur enfoncé hors de l’élément : fermeture ; dedans : rien', async () => {
    await show();
    pointerDown($('[data-item]') ?? document.body);
    expect(onDismiss).not.toHaveBeenCalled();
    pointerDown(document.body);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('options : Échap ou clic extérieur désactivés', async () => {
    await show({ options: { escape: false } });
    escape(document.body);
    expect(onDismiss).not.toHaveBeenCalled();
    pointerDown(document.body);
    expect(onDismiss).toHaveBeenCalledTimes(1);

    onDismiss.mockReset();
    await show({ options: { outside: false } });
    pointerDown(document.body);
    expect(onDismiss).not.toHaveBeenCalled();
    escape(document.body);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('dernier rappel appelé après un nouveau rendu, sans reposer les écouteurs', async () => {
    const add = vi.spyOn(document, 'addEventListener');
    await show();
    const added = add.mock.calls.length;
    const next = vi.fn<() => void>();
    await show({ onDismiss: next });
    expect(add.mock.calls.length).toBe(added);
    escape(document.body);
    expect(next).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('démontage : écouteurs retirés', async () => {
    await show();
    await act(() => render(null, container));
    escape(document.body);
    pointerDown(document.body);
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
