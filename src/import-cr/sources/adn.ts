import { isAdnHistoryPortMessage, reduceAdnHistory } from '../../platforms/adn/history';
import { ADN_HISTORY_PORT_NAME } from '../../protocol/content-messages';
import { hasHostAccess, requestHostAccess } from '../../browser/host-access';
import { getSettings } from '../../browser/storage/settings-access';
import { readOverPort, type PortProtocol } from './port-reader';
import type { HistorySource } from './source';

// Historique ADN : épisodes lus dans l'onglet (lecteur injecté, jeton de la page), reçus par le port, réduits ici par
// saison au seuil de fin des réglages (platforms/adn/history.ts, jamais dans le script de contenu).

const ORIGINS = ['https://animationdigitalnetwork.com/*', 'https://*.animationdigitalnetwork.com/*'];

const PROTOCOL: PortProtocol = {
  portName: ADN_HISTORY_PORT_NAME,
  request: { type: 'READ_ADN_HISTORY' },
  parse: (raw) => {
    if (!isAdnHistoryPortMessage(raw)) return null;
    if (raw.type === 'progress') return { ...raw, lookups: 0, lookupsTotal: 0 };
    if (raw.type === 'error') return raw;
    const read = raw.result;
    return { type: 'done', history: async () => reduceAdnHistory(read, (await getSettings()).completionPercentage) };
  },
};

export const adnSource: HistorySource = {
  id: 'adn',
  tabPatterns: ['https://animationdigitalnetwork.com/*', 'https://www.animationdigitalnetwork.com/*'],
  home: 'https://animationdigitalnetwork.com/',
  site: 'animationdigitalnetwork.com',
  initialProgress: { kind: 'reading', pages: 0, items: 0, lookups: 0, lookupsTotal: 0 },
  hasAccess: () => hasHostAccess(ORIGINS),
  requestAccess: () => requestHostAccess(ORIGINS),
  read: (tabId, ctx) => readOverPort(tabId, PROTOCOL, adnSource, ctx),
};
