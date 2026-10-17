import { isRecord } from '../shared/guards';
import { POPUP_SCREEN_KEY } from '../protocol/storage-keys';
import { createLogger } from './logger';

// Popup ouvert depuis le panneau latéral sur un écran précis (barre d'état du panneau : « 2 éléments à vérifier › »
// mène à Activité, que le panneau n'a pas). chrome.action.openPopup (Chrome 127+, Firefox) ouvre le popup de la fenêtre
// courante ; l'écran voulu passe par une demande à usage unique dans chrome.storage.session, lue et retirée par le popup
// à son ouverture (takePopupScreen), ignorée au-delà de POPUP_SCREEN_TTL_MS.

const log = createLogger('popup-screen');

export type PopupScreen = 'activity';

/** Demande plus ancienne : popup ouvert autrement (icône de la barre d'outils), écran par défaut */
export const POPUP_SCREEN_TTL_MS = 10_000;

interface PopupScreenRequest {
  screen: PopupScreen;
  at: number;
}

const isRequest = (value: unknown): value is PopupScreenRequest => isRecord(value) && value.screen === 'activity' && typeof value.at === 'number';

/** API d'ouverture du popup présente (absente : Chrome < 127, le message du panneau reste un texte) */
export function canOpenPopup(): boolean {
  return typeof chrome.action?.openPopup === 'function';
}

/**
 * Ouvre le popup sur `screen`. Demande écrite puis popup ouvert dans le même tour, sans await entre les deux : Firefox
 * exige le geste de l'utilisateur, et les écritures du stockage passent avant la lecture faite par le popup qui s'ouvre.
 * false si l'ouverture est refusée (demande retirée).
 */
export async function openPopupOn(screen: PopupScreen, now: number = Date.now()): Promise<boolean> {
  const written = chrome.storage.session.set({ [POPUP_SCREEN_KEY]: { screen, at: now } satisfies PopupScreenRequest });
  try {
    await Promise.all([written, chrome.action.openPopup()]);
    return true;
  } catch (error: unknown) {
    log.warn('Popup non ouvert :', error);
    await chrome.storage.session.remove(POPUP_SCREEN_KEY).catch(() => undefined);
    return false;
  }
}

/** Écran demandé au popup qui s'ouvre (une seule fois), null sans demande récente */
export async function takePopupScreen(now: number = Date.now()): Promise<PopupScreen | null> {
  const value: unknown = (await chrome.storage.session.get(POPUP_SCREEN_KEY))[POPUP_SCREEN_KEY];
  if (value === undefined) return null;
  await chrome.storage.session.remove(POPUP_SCREEN_KEY);
  return isRequest(value) && value.at <= now && now - value.at < POPUP_SCREEN_TTL_MS ? value.screen : null;
}
