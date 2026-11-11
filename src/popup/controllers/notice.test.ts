import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createNoticeBanner, NOTICE_MS, type NoticeBanner } from './notice';

// Bandeau de « Mes séries » : délai d'affichage suspendu tant que le pointeur ou le focus est dedans (M1)

const SUCCESS = { tone: 'success', text: 'Frieren mise en pause', detail: 'Frieren mise en pause' } as const;
const undo = (): void => undefined;

let banner: NoticeBanner;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  banner = createNoticeBanner(() => undefined);
});

afterEach(() => {
  banner.dispose();
  vi.useRealTimers();
});

describe('createNoticeBanner', () => {
  it('masqué au bout du délai (le double avec « Annuler »)', () => {
    banner.show(SUCCESS);
    vi.advanceTimersByTime(NOTICE_MS);
    expect(banner.store.get()).toBeNull();
    banner.show(SUCCESS, { undo });
    vi.advanceTimersByTime(NOTICE_MS * 2 - 1);
    expect(banner.store.get()).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(banner.store.get()).toBeNull();
  });

  it('pointeur ou focus dans le bandeau : jamais masqué ; le temps restant reprend à la sortie', () => {
    banner.show(SUCCESS, { undo });
    vi.advanceTimersByTime(NOTICE_MS);
    banner.hold('pointer', true);
    vi.advanceTimersByTime(60_000);
    expect(banner.store.get()?.undo).toBe(undo);
    // Focus sur « Annuler » pendant que le pointeur sort : toujours affiché
    banner.hold('focus', true);
    banner.hold('pointer', false);
    vi.advanceTimersByTime(60_000);
    expect(banner.store.get()).not.toBeNull();
    banner.hold('focus', false);
    vi.advanceTimersByTime(NOTICE_MS - 1);
    expect(banner.store.get()).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(banner.store.get()).toBeNull();
  });

  it('nouveau bandeau pendant une pause : son délai attend la sortie du pointeur', () => {
    banner.show(SUCCESS);
    banner.hold('pointer', true);
    banner.show(SUCCESS, { undo });
    vi.advanceTimersByTime(60_000);
    expect(banner.store.get()?.undo).toBe(undo);
    banner.hold('pointer', false);
    vi.advanceTimersByTime(NOTICE_MS * 2);
    expect(banner.store.get()).toBeNull();
  });

  it('écriture lancée depuis le bandeau : il reste (délai suspendu), sa progression suit ; le bandeau suivant n’est jamais touché', () => {
    banner.show(SUCCESS, { undo });
    const progress = banner.track('undo', 3);
    progress(1);
    vi.advanceTimersByTime(60_000);
    expect(banner.store.get()).toMatchObject({ feedback: SUCCESS, undo, progress: { button: 'undo', done: 1, total: 3 } });
    progress(2);
    expect(banner.store.get()?.progress).toEqual({ button: 'undo', done: 2, total: 3 });
    // Résultat affiché : fin de l'écriture, le délai reprend ; une mise à jour tardive ne s'y pose pas
    banner.show(SUCCESS);
    progress(3);
    expect(banner.store.get()?.progress).toBeUndefined();
    vi.advanceTimersByTime(NOTICE_MS);
    expect(banner.store.get()).toBeNull();
  });

  it('bandeau masqué : les pauses sont oubliées (le suivant n’attend pas un pointeur parti avec l’ancien)', () => {
    banner.show(SUCCESS);
    banner.hold('focus', true);
    banner.hide();
    banner.show(SUCCESS);
    vi.advanceTimersByTime(NOTICE_MS);
    expect(banner.store.get()).toBeNull();
  });
});
