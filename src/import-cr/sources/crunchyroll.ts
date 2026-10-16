import { CR_HISTORY_PORT_NAME, isCrHistoryPortMessage } from '../../protocol/content-messages';
import { hasHostAccess, requestHostAccess } from '../../browser/host-access';
import { readOverPort, type PortProtocol } from './port-reader';
import type { HistorySource } from './source';

// Historique Crunchyroll : lu et réduit par saison dans l'onglet (lecteur injecté, session du site), reçu par le port.

/** Accès demandé sur Firefox s'il a été retiré (script de contenu ; API en même origine) */
const ORIGINS = ['https://*.crunchyroll.com/*'];

const PROTOCOL: PortProtocol = {
  portName: CR_HISTORY_PORT_NAME,
  request: { type: 'READ_CR_HISTORY' },
  parse: (raw) => {
    if (!isCrHistoryPortMessage(raw)) return null;
    if (raw.type !== 'done') return raw;
    const result = raw.result;
    return { type: 'done', history: () => Promise.resolve(result) };
  },
};

export const crunchyrollSource: HistorySource = {
  id: 'crunchyroll',
  tabPatterns: ['https://www.crunchyroll.com/*'],
  home: 'https://www.crunchyroll.com/',
  site: 'www.crunchyroll.com',
  initialProgress: { kind: 'reading', pages: 0, items: 0, lookups: 0, lookupsTotal: 0 },
  hasAccess: () => hasHostAccess(ORIGINS),
  requestAccess: () => requestHostAccess(ORIGINS),
  read: (tabId, ctx) => readOverPort(tabId, PROTOCOL, crunchyrollSource, ctx),
};
