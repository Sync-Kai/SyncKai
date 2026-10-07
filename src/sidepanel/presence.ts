import { isPageMediaResponse, type ContentMessage } from '../shared/content-messages';
import { createLogger } from '../shared/logger';
import { disableSidePanelForTab, type SidePanelKind } from '../shared/side-panel';
import { isTargetPage } from '../shared/target-pages';

const log = createLogger('sidepanel');

/**
 * Onglet suivi par le panneau : Crunchyroll / ADN (contenu affiché) ou autre site (ligne neutre).
 * Tout est fait ici, dans la page du panneau ouverte : le service worker n'écoute aucun événement d'onglet.
 */
export type PanelContext = { status: 'checking' } | { status: 'target'; tabId: number } | { status: 'off' };

/** Ce que l'URL dit de l'onglet ; `unknown` : URL masquée (site sans permission d'hôte, ou ADN selon le navigateur) */
export type UrlVerdict = 'target' | 'other' | 'unknown';

export function classifyTabUrl(url: string | undefined, patterns?: readonly string[]): UrlVerdict {
  if (!url) return 'unknown';
  return isTargetPage(url, patterns) ? 'target' : 'other';
}

/** Délai de réponse du script de contenu, puis délais des nouvelles tentatives (page encore en chargement) */
const PING_TIMEOUT_MS = 800;
export const PING_RETRY_DELAYS_MS: readonly number[] = [0, 600, 1_500];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** true si le script de contenu SyncKai répond dans l'onglet (il ne tourne que sur Crunchyroll / ADN) */
async function pingContentScript(tabId: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const message: ContentMessage = { type: 'GET_PAGE_MEDIA' };
    const timeout = new Promise<'timeout'>((resolve) => {
      timer = setTimeout(() => resolve('timeout'), PING_TIMEOUT_MS);
    });
    const response: unknown = await Promise.race([chrome.tabs.sendMessage(tabId, message), timeout]);
    return response !== 'timeout' && isPageMediaResponse(response);
  } catch {
    // « Receiving end does not exist » : pas de script de contenu dans cet onglet
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** URL visible : réponse immédiate ; URL masquée : le script de contenu fait foi (quelques essais pendant le chargement) */
async function isTargetTab(tab: chrome.tabs.Tab): Promise<boolean> {
  const verdict = classifyTabUrl(tab.url ?? tab.pendingUrl);
  if (verdict !== 'unknown' || tab.id === undefined) return verdict === 'target';
  for (const wait of PING_RETRY_DELAYS_MS) {
    if (wait > 0) await delay(wait);
    if (await pingContentScript(tab.id)) return true;
  }
  return false;
}

/**
 * Suit l'onglet du panneau et signale son contexte.
 * - Chrome : panneau propre à un onglet. Hors Crunchyroll / ADN, il est retiré de l'onglet (ce qui le ferme).
 * - Firefox : barre latérale par fenêtre, impossible à masquer sans geste utilisateur : on suit l'onglet
 *   actif et la page n'affiche qu'une ligne neutre ailleurs.
 */
export async function watchPanelContext(kind: SidePanelKind, onChange: (context: PanelContext) => void): Promise<void> {
  let trackedTabId: number | null = null;
  let run = 0;
  let debounce: ReturnType<typeof setTimeout> | undefined;

  const evaluate = async (tabId: number): Promise<void> => {
    const current = ++run;
    trackedTabId = tabId;
    let target = false;
    try {
      target = await isTargetTab(await chrome.tabs.get(tabId));
    } catch (error: unknown) {
      log.debug('Onglet illisible :', error);
    }
    if (current !== run) return; // Une évaluation plus récente a pris le relais
    onChange(target ? { status: 'target', tabId } : { status: 'off' });
    if (!target && kind === 'chrome') {
      disableSidePanelForTab(tabId).catch((error: unknown) => log.debug('Panneau non retiré :', error));
    }
  };

  const schedule = (tabId: number): void => {
    clearTimeout(debounce);
    debounce = setTimeout(() => void evaluate(tabId), 250);
  };

  // Navigation dans l'onglet suivi : changement d'URL (SPA comprise) ou fin de chargement
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    // Sans permission d'hôte, `changeInfo.url` est masqué : la fin de chargement déclenche aussi la vérification
    if (tabId !== trackedTabId || (changeInfo.url === undefined && changeInfo.status !== 'complete')) return;
    schedule(tabId);
  });

  if (kind === 'firefox') {
    const { id: windowId } = await chrome.windows.getCurrent();
    // Changement d'onglet dans la fenêtre de la barre latérale
    chrome.tabs.onActivated.addListener((info) => {
      if (info.windowId !== windowId) return;
      trackedTabId = info.tabId;
      schedule(info.tabId);
    });
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined) {
    onChange({ status: 'off' });
    return;
  }
  await evaluate(tab.id);
}
