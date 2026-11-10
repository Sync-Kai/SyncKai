import { isRecord } from '../shared/guards';
import { PANEL_TAB_KEY } from '../protocol/storage-keys';
import { createLogger } from './logger';
import { openSidePanel, type PanelTarget } from './side-panel';

// Panneau latéral ouvert depuis le popup sur « Découvrir » (« Plus d'idées dans le panneau »). L'onglet voulu passe par
// une demande à usage unique dans chrome.storage.session, lue et retirée par le panneau à son ouverture (takePanelTab),
// ignorée au-delà de PANEL_TAB_TTL_MS (même schéma que popup-screen.ts, dans l'autre sens).

const log = createLogger('panel-tab');

export type RequestedPanelTab = 'discover';

/** Demande plus ancienne : panneau ouvert autrement (menu du navigateur, raccourci), onglet habituel */
export const PANEL_TAB_TTL_MS = 10_000;

interface PanelTabRequest {
  tab: RequestedPanelTab;
  at: number;
}

const isRequest = (value: unknown): value is PanelTabRequest => isRecord(value) && value.tab === 'discover' && typeof value.at === 'number';

/**
 * Ouvre le panneau sur `tab`. Demande écrite puis panneau ouvert dans le même tour, sans await entre les deux (le geste
 * de l'utilisateur est exigé). false si l'ouverture est refusée (demande retirée).
 */
export async function openPanelOn(tab: RequestedPanelTab, target: PanelTarget, now: number = Date.now()): Promise<boolean> {
  const written = chrome.storage.session.set({ [PANEL_TAB_KEY]: { tab, at: now } satisfies PanelTabRequest });
  try {
    await Promise.all([written, openSidePanel(target)]);
    return true;
  } catch (error: unknown) {
    log.warn('Panneau non ouvert :', error);
    await chrome.storage.session.remove(PANEL_TAB_KEY).catch(() => undefined);
    return false;
  }
}

/** Onglet demandé au panneau qui s'ouvre (une seule fois), null sans demande récente */
export async function takePanelTab(now: number = Date.now()): Promise<RequestedPanelTab | null> {
  const value: unknown = (await chrome.storage.session.get(PANEL_TAB_KEY))[PANEL_TAB_KEY];
  if (value === undefined) return null;
  await chrome.storage.session.remove(PANEL_TAB_KEY);
  return isRequest(value) && value.at <= now && now - value.at < PANEL_TAB_TTL_MS ? value.tab : null;
}
