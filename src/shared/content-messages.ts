import { isRecord } from './guards';
import { isPageMediaInfo, type PageMediaInfo } from './page-media.types';

export { CR_HISTORY_PORT_NAME, isCrHistoryPortMessage, isCrHistoryRequest, type CrHistoryPortMessage, type CrHistoryRequest } from './cr-history';

/**
 * Messages envoyés AU content script d'un onglet (chrome.tabs.sendMessage) :
 * - FORCE_COMPLETE (service worker) : raccourci « valider l'épisode en cours » → synchronise tout de suite ;
 * - GET_PAGE_MEDIA (popup) : série ou épisode affiché sur la page, pour la carte « Sur cette page ».
 *
 * READ_CR_HISTORY (page d'import Crunchyroll) passe par un port dédié (CR_HISTORY_PORT_NAME, chrome.tabs.connect) :
 * la lecture dure, la progression remonte sur le port et sa fermeture l'abandonne. Protocole dans cr-history.ts.
 */
export type ContentMessage = { type: 'FORCE_COMPLETE' } | { type: 'GET_PAGE_MEDIA' };

/** Réponse du content script à GET_PAGE_MEDIA : null hors page de série / d'épisode reconnue */
export type PageMediaResponse = PageMediaInfo | null;

export function isContentMessage(value: unknown): value is ContentMessage {
  return isRecord(value) && (value.type === 'FORCE_COMPLETE' || value.type === 'GET_PAGE_MEDIA');
}

export function isPageMediaResponse(value: unknown): value is PageMediaResponse {
  return value === null || isPageMediaInfo(value);
}
