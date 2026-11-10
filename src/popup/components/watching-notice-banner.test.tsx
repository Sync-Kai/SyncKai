// @vitest-environment happy-dom
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n';
import type { NoticeHold } from '../controllers/notice';
import { WatchingNoticeBanner } from './watching-screen';

// Bandeau de « Mes séries » : le pointeur et le focus suspendent son délai (M1, controllers/notice.ts › hold)

let container: HTMLElement;

beforeEach(() => {
  setLocale('fr');
  container = document.createElement('div');
  document.body.append(container);
});

afterEach(async () => {
  await act(() => render(null, container));
  container.remove();
});

describe('WatchingNoticeBanner', () => {
  it('pointeur et focus signalés à l’entrée et à la sortie ; focus passé d’un bouton à l’autre : toujours dedans', async () => {
    const onHold = vi.fn<(reason: NoticeHold, held: boolean) => void>();
    const notice = { feedback: { tone: 'warning', text: '2 séries mises en pause · 1 en échec', detail: '' }, undo: () => undefined, retry: () => undefined } as const;
    await act(() => render(<WatchingNoticeBanner notice={notice} onHold={onHold} />, container));
    const banner = container.querySelector<HTMLElement>('[data-watching-notice]');
    const [undo, retry] = [...container.querySelectorAll<HTMLButtonElement>('button')];
    if (!banner || !undo || !retry) throw new Error('bandeau incomplet');

    banner.dispatchEvent(new PointerEvent('pointerenter'));
    expect(onHold).toHaveBeenLastCalledWith('pointer', true);
    banner.dispatchEvent(new PointerEvent('pointerleave'));
    expect(onHold).toHaveBeenLastCalledWith('pointer', false);

    undo.focus();
    expect(onHold).toHaveBeenLastCalledWith('focus', true);
    onHold.mockClear();
    retry.focus();
    expect(onHold).not.toHaveBeenCalledWith('focus', false);
    retry.blur();
    expect(onHold).toHaveBeenLastCalledWith('focus', false);
  });

  it('démontage pendant un survol ou un focus : les deux suspensions sont levées', async () => {
    const onHold = vi.fn<(reason: NoticeHold, held: boolean) => void>();
    const notice = { feedback: { tone: 'warning', text: '2 séries mises en pause · 1 en échec', detail: '' }, undo: () => undefined, retry: () => undefined } as const;
    await act(() => render(<WatchingNoticeBanner notice={notice} onHold={onHold} />, container));
    container.querySelector<HTMLElement>('[data-watching-notice]')?.dispatchEvent(new PointerEvent('pointerenter'));
    container.querySelector<HTMLButtonElement>('button')?.focus();
    onHold.mockClear();
    await act(() => render(null, container));
    expect(onHold).toHaveBeenCalledWith('pointer', false);
    expect(onHold).toHaveBeenCalledWith('focus', false);
  });

  it('bouton focalisé retiré du bandeau (aucun focusout) : la suspension du focus est levée', async () => {
    const onHold = vi.fn<(reason: NoticeHold, held: boolean) => void>();
    const withUndo = { feedback: { tone: 'warning', text: '2 séries mises en pause', detail: '' }, undo: () => undefined, retry: null } as const;
    const without = { feedback: { tone: 'warning', text: '2 séries mises en pause', detail: '' }, undo: null, retry: null } as const;
    await act(() => render(<WatchingNoticeBanner notice={withUndo} onHold={onHold} />, container));
    container.querySelector<HTMLButtonElement>('button')?.focus();
    expect(onHold).toHaveBeenLastCalledWith('focus', true);
    // happy-dom ne déclenche pas de focusout au retrait du nœud, comme Chrome
    await act(() => render(<WatchingNoticeBanner notice={without} onHold={onHold} />, container));
    expect(onHold).toHaveBeenLastCalledWith('focus', false);
  });
});
