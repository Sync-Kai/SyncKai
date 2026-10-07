import { isRecord } from './guards';
import { SIDE_PANEL_PATH } from './target-pages';

/**
 * Panneau latéral, deux API selon le navigateur :
 * - Chrome : `chrome.sidePanel`, désactivé globalement et activé onglet par onglet sur Crunchyroll / ADN ;
 * - Firefox : `sidebarAction` (barre latérale par fenêtre, impossible à masquer par onglet) : la page
 *   s'adapte à l'onglet actif et n'affiche qu'une ligne neutre hors Crunchyroll / ADN.
 */

/** Sous-ensemble de `browser.sidebarAction` (Firefox), absent de @types/chrome */
export interface SidebarActionApi {
  open(): Promise<void>;
  close(): Promise<void>;
  isOpen(details: { windowId?: number }): Promise<boolean>;
  setPanel(details: { panel: string | null; tabId?: number; windowId?: number }): Promise<void>;
}

function isSidebarActionApi(value: unknown): value is SidebarActionApi {
  return isRecord(value) && typeof value.open === 'function' && typeof value.close === 'function' && typeof value.setPanel === 'function';
}

/** `sidebarAction` de Firefox (espace `browser`, sinon `chrome`), null ailleurs */
export function getSidebarAction(): SidebarActionApi | null {
  for (const name of ['browser', 'chrome']) {
    const namespace: unknown = Reflect.get(globalThis, name);
    if (isRecord(namespace) && isSidebarActionApi(namespace.sidebarAction)) return namespace.sidebarAction;
  }
  return null;
}

/** `chrome.sidePanel` si disponible (Chrome 116+ ; absent sur Firefox malgré les types) */
export function getChromeSidePanel(): typeof chrome.sidePanel | null {
  if (typeof chrome === 'undefined') return null;
  const api: unknown = Reflect.get(chrome, 'sidePanel');
  return isRecord(api) && typeof api.open === 'function' && typeof api.setOptions === 'function' ? chrome.sidePanel : null;
}

export type SidePanelKind = 'chrome' | 'firefox';

/** API de panneau disponible dans ce navigateur, null si aucune */
export function sidePanelKind(): SidePanelKind | null {
  if (getChromeSidePanel()) return 'chrome';
  if (getSidebarAction()) return 'firefox';
  return null;
}

/**
 * Ouvre le panneau pour l'onglet. À appeler directement dans le gestionnaire du clic : `open()` exige
 * un geste utilisateur, perdu après un `await`. Sur Chrome, `setOptions` (non attendu) part avant `open`
 * dans la même file IPC : un onglet ouvert avant l'installation (script de contenu absent) est couvert.
 */
export function openSidePanel(tabId: number): Promise<void> {
  const sidePanel = getChromeSidePanel();
  if (sidePanel) {
    void sidePanel.setOptions({ tabId, path: SIDE_PANEL_PATH, enabled: true });
    return sidePanel.open({ tabId });
  }
  const sidebar = getSidebarAction();
  if (sidebar) return sidebar.open();
  return Promise.reject(new Error('Panneau latéral indisponible dans ce navigateur'));
}

/** Chrome : panneau disponible pour cet onglet uniquement (reste actif pendant la navigation SPA de l'onglet) */
export async function enableSidePanelForTab(tabId: number): Promise<void> {
  await getChromeSidePanel()?.setOptions({ tabId, path: SIDE_PANEL_PATH, enabled: true });
}

/** Chrome : retire le panneau de cet onglet (le ferme s'il est ouvert) */
export async function disableSidePanelForTab(tabId: number): Promise<void> {
  await getChromeSidePanel()?.setOptions({ tabId, enabled: false });
}

/** Chrome : le panneau du manifeste (`side_panel.default_path`) n'est disponible sur aucun onglet par défaut */
export async function disableSidePanelGlobally(): Promise<void> {
  await getChromeSidePanel()?.setOptions({ enabled: false });
}
