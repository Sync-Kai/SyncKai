import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POPUP_SCREEN_KEY } from '../protocol/storage-keys';
import { installFakeChrome } from '../test/fake-chrome';

// Panneau latéral → popup ouvert sur un écran (Activité) : chrome.action.openPopup et une demande d'écran à usage
// unique dans storage.session, lue et retirée par le popup à son ouverture

const openPopup = vi.fn<() => Promise<void>>();
const fake = installFakeChrome({ extra: { action: { openPopup } } });
const { canOpenPopup, openPopupOn, POPUP_SCREEN_TTL_MS, takePopupScreen } = await import('./popup-screen');

beforeEach(() => {
  fake.reset();
  openPopup.mockReset();
  openPopup.mockResolvedValue(undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe('openPopupOn', () => {
  it('demande d’écran écrite dans storage.session, popup ouvert dans le même tour (geste de l’utilisateur conservé)', async () => {
    expect(canOpenPopup()).toBe(true);
    const opened = openPopupOn('activity', 1_000);
    // Appelé avant tout await : Firefox exige le geste de l'utilisateur
    expect(openPopup).toHaveBeenCalledTimes(1);
    expect(await opened).toBe(true);
    expect(fake.session.peek(POPUP_SCREEN_KEY)).toEqual({ screen: 'activity', at: 1_000 });
    expect(fake.local.peek(POPUP_SCREEN_KEY)).toBeUndefined();
  });

  it('ouverture refusée : false, demande retirée', async () => {
    openPopup.mockRejectedValue(new Error('no window'));
    expect(await openPopupOn('activity', 1_000)).toBe(false);
    expect(fake.session.peek(POPUP_SCREEN_KEY)).toBeUndefined();
  });
});

describe('takePopupScreen', () => {
  it('demande récente : écran rendu une seule fois ; trop ancienne ou illisible : rien', async () => {
    await fake.session.set({ [POPUP_SCREEN_KEY]: { screen: 'activity', at: 1_000 } });
    expect(await takePopupScreen(1_000 + POPUP_SCREEN_TTL_MS - 1)).toBe('activity');
    expect(await takePopupScreen(1_000)).toBeNull();
    await fake.session.set({ [POPUP_SCREEN_KEY]: { screen: 'activity', at: 1_000 } });
    expect(await takePopupScreen(1_000 + POPUP_SCREEN_TTL_MS)).toBeNull();
    expect(fake.session.peek(POPUP_SCREEN_KEY)).toBeUndefined();
    await fake.session.set({ [POPUP_SCREEN_KEY]: { screen: 'settings', at: 1_000 } });
    expect(await takePopupScreen(1_000)).toBeNull();
  });
});
