import { t } from '../../i18n';
import type { CrHistoryErrorCode, CrHistoryResult } from '../../platforms/crunchyroll/history';
import { createLogger } from '../../browser/logger';
import { injectHistoryReader } from '../history-reader';
import { readErrorText, sleep, sourceParams, type HistorySource, type ReadContext, type ReadOutcome } from './source';

// Lecture par port (Crunchyroll, ADN) : lecteurs injectés dans l'onglet (hors du script de contenu du manifeste, voir
// history-reader.ts), puis port vers eux : progression, puis historique ou erreur.

const log = createLogger('import-cr');

/** Lecteur pas encore prêt (onglet en chargement) : nouvelles tentatives avant de proposer de recharger */
export const CONNECT_RETRY_MS = [1_000, 2_000, 3_000] as const;

/** Message du port normalisé (les deux protocoles) ; `history` réduit l'historique reçu si la source le fait ici (ADN) */
export type PortEvent =
  | { type: 'progress'; pages: number; items: number; lookups: number; lookupsTotal: number }
  | { type: 'error'; code: CrHistoryErrorCode }
  | { type: 'done'; history: () => Promise<CrHistoryResult> };

export interface PortProtocol {
  portName: string;
  /** Seul message accepté par le lecteur */
  request: { type: string };
  parse(raw: unknown): PortEvent | null;
}

/** Une tentative : 'silent' si aucun lecteur n'a répondu (onglet en chargement, autre page) */
function connectOnce(tabId: number, protocol: PortProtocol, source: HistorySource, ctx: ReadContext): Promise<ReadOutcome | 'silent'> {
  let port: chrome.runtime.Port;
  try {
    port = chrome.tabs.connect(tabId, { name: protocol.portName, frameId: 0 });
  } catch (error: unknown) {
    log.warn('Port vers l’onglet de la plateforme non ouvert :', error);
    return Promise.resolve({ kind: 'failed', error: t('crImport.read.error.noScript', sourceParams(source)), reloadTabId: tabId });
  }
  return new Promise((resolve) => {
    let answered = false;
    let settled = false;
    const settle = (outcome: ReadOutcome | 'silent'): void => {
      if (settled) return;
      settled = true;
      ctx.signal.removeEventListener('abort', stop);
      resolve(outcome);
    };
    // « Arrêter » ou page fermée : port fermé, la lecture dans l'onglet s'arrête
    function stop(): void {
      port.disconnect();
      settle({ kind: 'stopped' });
    }
    ctx.signal.addEventListener('abort', stop, { once: true });
    port.onMessage.addListener((raw: unknown) => {
      const message = settled ? null : protocol.parse(raw);
      if (!message) return;
      answered = true;
      if (message.type === 'progress') {
        ctx.progress({ kind: 'reading', pages: message.pages, items: message.items, lookups: message.lookups, lookupsTotal: message.lookupsTotal });
      } else if (message.type === 'error') {
        port.disconnect();
        settle({ kind: 'failed', error: readErrorText(source, message.code), reloadTabId: null });
      } else {
        port.disconnect();
        settled = true;
        ctx.signal.removeEventListener('abort', stop);
        message.history().then(
          (history) => resolve({ kind: 'done', history }),
          (error: unknown) => {
            log.error('Historique non réduit :', error);
            resolve({ kind: 'failed', error: t('crImport.error.unexpected'), reloadTabId: null });
          },
        );
      }
    });
    port.onDisconnect.addListener(() => {
      // Lecture obligatoire : sinon Chrome journalise « Receiving end does not exist » (script absent / orphelin)
      void chrome.runtime.lastError;
      // Lecteur parti après avoir répondu : lecture interrompue ; aucun lecteur à l'écoute : nouvelle tentative
      settle(answered ? { kind: 'failed', error: t('crImport.read.error.interrupted'), reloadTabId: null } : 'silent');
    });
    port.postMessage(protocol.request);
  });
}

/**
 * Lit l'historique par le port : lecteurs injectés à chaque tentative, puis le port ; sans réponse, nouvelles tentatives
 * après CONNECT_RETRY_MS, puis message « recharge l'onglet ». Onglet fermé, page d'erreur, accès au site retiré
 * (injection refusée) : même parcours qu'un port sans réponse.
 */
export async function readOverPort(tabId: number, protocol: PortProtocol, source: HistorySource, ctx: ReadContext): Promise<ReadOutcome> {
  for (let attempt = 0; ; attempt++) {
    let injected = true;
    try {
      await injectHistoryReader(tabId);
    } catch (error: unknown) {
      log.warn('Lecteur de l’historique non injecté :', error instanceof Error ? error.message : String(error));
      injected = false;
    }
    if (ctx.signal.aborted) return { kind: 'stopped' };
    if (injected) {
      const outcome = await connectOnce(tabId, protocol, source, ctx);
      if (outcome !== 'silent') return outcome;
    }
    const wait = CONNECT_RETRY_MS[attempt];
    if (wait === undefined) return { kind: 'failed', error: t('crImport.read.error.noScript', sourceParams(source)), reloadTabId: tabId };
    await sleep(wait, ctx.signal);
    if (ctx.signal.aborted) return { kind: 'stopped' };
  }
}
