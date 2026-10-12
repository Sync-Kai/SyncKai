import type { CrHistoryErrorCode, HistoryStats } from './cr-history';
import { isRecord } from './guards';

// Import de l'historique ADN : protocole du port entre la page d'import et le script de contenu de l'onglet ADN.
// Le script de contenu lit l'API de visionnage d'ADN avec le jeton de la page (localStorage), qui ne quitte jamais
// l'onglet : seuls les épisodes (champs utiles, voir content/lib/adn-history.ts) remontent par le port. La page
// d'import les réduit à une ligne par saison (adn-import.ts) puis lance la même analyse que pour Crunchyroll.
// Ce module n'a que ce qu'il faut au script de contenu (budget) ; la validation des messages reçus par la page
// d'import est dans adn-import.ts.

/** Port ouvert par la page d'import vers l'onglet ADN (chrome.tabs.connect) ; fermé = lecture abandonnée */
export const ADN_HISTORY_PORT_NAME = 'synckai:adn-history';

/** Taille de page de l'API (`limit` : 100 accepté, 500 refusé en HTTP 400, vérifié le 2026-10-12) */
export const ADN_HISTORY_PAGE_SIZE = 100;
/** Garde-fou : 50 pages = 5 000 épisodes ; au-delà l'historique est déclaré partiel */
export const MAX_ADN_HISTORY_PAGES = 50;
export const MAX_ADN_HISTORY_ITEMS = ADN_HISTORY_PAGE_SIZE * MAX_ADN_HISTORY_PAGES;

/** Demande de lecture (seul message accepté sur le port, venant d'une page de l'extension) */
export interface AdnHistoryRequest {
  type: 'READ_ADN_HISTORY';
}

/** Épisodes lus (éléments bruts réduits aux champs utiles, revalidés par adn-import.ts) */
export interface AdnHistoryRead {
  videos: unknown[];
  stats: HistoryStats;
}

export type AdnHistoryPortMessage =
  | { type: 'progress'; pages: number; items: number }
  | { type: 'done'; result: AdnHistoryRead }
  | { type: 'error'; code: CrHistoryErrorCode };

export function isAdnHistoryRequest(value: unknown): value is AdnHistoryRequest {
  return isRecord(value) && value.type === 'READ_ADN_HISTORY';
}
