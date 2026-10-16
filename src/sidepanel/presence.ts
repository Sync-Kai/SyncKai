import { createLogger } from '../browser/logger';
import type { PageMediaInfo } from '../shared/page-media.types';
import { isOptionalPlatform, type StreamingPlatform } from '../platforms/registry';
import { isTargetPage } from '../platforms/target-pages';
import { PAGE_MEDIA_RETRY_DELAYS_MS, requestPageMedia } from '../ui/page-media-request';
import type { PlatformAccessStore } from '../ui/platform-access-store';

const log = createLogger('sidepanel');

/**
 * Onglet suivi par le panneau : page de streaming reconnue (« En lecture ») ou autre site (Agenda par défaut).
 * Tout est fait ici, dans la page du panneau ouverte : le service worker n'écoute aucun événement d'onglet.
 */
export type PanelContext = { status: 'checking' } | { status: 'target'; tabId: number } | { status: 'off' };

/** Ce que l'URL dit de l'onglet ; `unknown` : URL masquée (site sans permission d'hôte, ou ADN selon le navigateur) */
export type UrlVerdict = 'target' | 'other' | 'unknown';

export function classifyTabUrl(url: string | undefined, patterns?: readonly string[]): UrlVerdict {
  if (!url) return 'unknown';
  return isTargetPage(url, patterns) ? 'target' : 'other';
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Réponse du script de contenu d'un onglet à l'URL masquée : page suivie, sauf celle d'une plateforme dont l'accès a été
 * retiré (le script tourne encore jusqu'au rechargement, l'URL est masquée faute de permission) : hors page cible, comme
 * si elle n'avait jamais été activée (« Activer Prime Video »)
 */
export async function answersAsTarget(page: PageMediaInfo | null, hasAccess: (platform: StreamingPlatform) => Promise<boolean>): Promise<boolean> {
  return page === null || !isOptionalPlatform(page.platform) || (await hasAccess(page.platform));
}

/** 'unreachable' si le script de contenu SyncKai ne répond pas dans l'onglet, sinon s'il signale une page suivie */
async function pingContentScript(tabId: number, access: PlatformAccessStore): Promise<boolean | 'unreachable'> {
  const response = await requestPageMedia(tabId);
  return response === 'unreachable' ? response : answersAsTarget(response, (platform) => access.has(platform));
}

/**
 * URL visible : réponse immédiate ; URL masquée : le script de contenu fait foi (mêmes essais que la fiche de la page).
 * `onFirstMiss` : script muet au premier essai. URL masquée = presque toujours un site sans permission d'hôte (le panneau
 * est disponible partout) : le panneau n'attend pas les essais suivants pour s'afficher.
 */
async function isTargetTab(tab: chrome.tabs.Tab, access: PlatformAccessStore, onFirstMiss: () => void): Promise<boolean> {
  const verdict = classifyTabUrl(tab.url ?? tab.pendingUrl);
  if (verdict !== 'unknown' || tab.id === undefined) return verdict === 'target';
  for (const [index, wait] of PAGE_MEDIA_RETRY_DELAYS_MS.entries()) {
    if (wait > 0) await delay(wait);
    const answer = await pingContentScript(tab.id, access);
    if (answer !== 'unreachable') return answer;
    if (index === 0) onFirstMiss();
  }
  return false;
}

/**
 * Suit l'onglet actif de la fenêtre du panneau et signale son contexte. Même règle sur Chrome (panneau global, partagé
 * par les onglets de la fenêtre) et Firefox (barre latérale par fenêtre) : le panneau n'est jamais retiré ni fermé ici.
 * `access` : accès optionnels de la page du panneau (store unique, ui/platform-access-store.ts).
 */
export async function watchPanelContext(onChange: (context: PanelContext) => void, access: PlatformAccessStore): Promise<void> {
  let trackedTabId: number | null = null;
  /** Dernier onglet signalé comme page de streaming (sa navigation ne repasse pas par « hors page » le temps des essais) */
  let targetTabId: number | null = null;
  let run = 0;
  let debounce: ReturnType<typeof setTimeout> | undefined;

  const evaluate = async (tabId: number): Promise<void> => {
    const current = ++run;
    trackedTabId = tabId;
    let target = false;
    try {
      target = await isTargetTab(await chrome.tabs.get(tabId), access, () => {
        if (current === run && targetTabId !== tabId) onChange({ status: 'off' });
      });
    } catch (error: unknown) {
      log.debug('Onglet illisible :', error);
    }
    if (current !== run) return; // Une évaluation plus récente a pris le relais
    targetTabId = target ? tabId : null;
    onChange(target ? { status: 'target', tabId } : { status: 'off' });
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

  // Accès à une plateforme optionnelle (ou aux sites) accordé ou retiré : l'URL de ses onglets devient visible ou masquée
  access.onPermissionsChange(() => {
    if (trackedTabId !== null) schedule(trackedTabId);
  });

  const { id: windowId } = await chrome.windows.getCurrent();
  // Changement d'onglet dans la fenêtre du panneau
  chrome.tabs.onActivated.addListener((info) => {
    if (info.windowId !== windowId) return;
    trackedTabId = info.tabId;
    schedule(info.tabId);
  });

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined) {
    onChange({ status: 'off' });
    return;
  }
  await evaluate(tab.id);
}
