import { isRecord } from './guards';
import { SIDE_PANEL_PATH } from '../platforms/target-pages';

/**
 * Panneau latéral, deux API selon le navigateur, même comportement :
 * - Chrome : `chrome.sidePanel`, un seul panneau global (aucune option par onglet) : il reste ouvert d'un onglet à
 *   l'autre de sa fenêtre ;
 * - Firefox : `sidebarAction` (barre latérale par fenêtre).
 * Disponible sur toutes les pages, il ne s'ouvre jamais seul (menu du navigateur, raccourci, bouton du popup). La page
 * suit l'onglet actif de sa fenêtre : « En lecture » sur les pages de streaming, Agenda par défaut ailleurs.
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

/** Fenêtre (de préférence) ou onglet où ouvrir le panneau : `sidePanel.open` exige l'un des deux */
export interface PanelTarget {
  windowId?: number;
  tabId?: number;
}

/** Options d'ouverture de `chrome.sidePanel.open` : la fenêtre si connue, sinon l'onglet (panneau global ouvert dans sa fenêtre) */
export function panelOpenOptions(target: PanelTarget): chrome.sidePanel.OpenOptions | null {
  if (target.windowId !== undefined && target.windowId >= 0) return { windowId: target.windowId };
  if (target.tabId !== undefined && target.tabId >= 0) return { tabId: target.tabId };
  return null;
}

/**
 * Ouvre le panneau. À appeler directement dans le gestionnaire du clic ou de la commande : `open()` exige un geste
 * utilisateur, perdu après un `await`. Sur Chrome, `setOptions` global (non attendu) part avant `open` dans la même file
 * IPC : le panneau est disponible même si l'activation de l'installation n'a pas encore eu lieu.
 */
export function openSidePanel(target: PanelTarget): Promise<void> {
  const sidePanel = getChromeSidePanel();
  if (sidePanel) {
    const options = panelOpenOptions(target);
    if (!options) return Promise.reject(new Error('Aucune fenêtre où ouvrir le panneau'));
    void sidePanel.setOptions({ path: SIDE_PANEL_PATH, enabled: true }).catch(() => undefined);
    return sidePanel.open(options);
  }
  const sidebar = getSidebarAction();
  if (sidebar) return sidebar.open();
  return Promise.reject(new Error('Panneau latéral indisponible dans ce navigateur'));
}

/** Chrome : panneau du manifeste disponible sur tous les onglets (option globale, sans tabId) */
export async function enableSidePanelGlobally(): Promise<void> {
  await getChromeSidePanel()?.setOptions({ path: SIDE_PANEL_PATH, enabled: true });
}
