import { t } from '../i18n';
import { sendMessage, type MessagePayload, type MessageResponse, type MessageType } from '../protocol/messages';
import { createLogger } from '../browser/logger';

// Appel du service worker par une page de l'extension (popup, panneau, réglages, pages d'import) : une seule implémentation
// du repli « service worker injoignable » (arrêté, rechargé, message perdu) au lieu d'un try / catch par appelant.

const log = createLogger('worker');

/**
 * Envoie le message au service worker. Si l'envoi échoue (service worker injoignable), l'erreur est journalisée et la réponse
 * est celle que construit `unreachable` à partir du texte `popup.swUnreachable` : l'appelant
 * traite alors un échec comme n'importe quelle autre réponse. Ne lève jamais.
 */
export async function callWorker<K extends MessageType>(type: K, payload: MessagePayload<K>, unreachable: (message: string) => MessageResponse<K>): Promise<MessageResponse<K>> {
  try {
    return await sendMessage(type, payload);
  } catch (error: unknown) {
    log.error('Service worker injoignable :', error);
    return unreachable(t('popup.swUnreachable'));
  }
}

/** Repli des réponses `{ ok: false, code, message }` (listes, profils, recherches, comparaison) : code réseau */
export const networkFailure = (message: string): { ok: false; code: 'NETWORK'; message: string } => ({ ok: false, code: 'NETWORK', message });

/** Repli des actions sur une fiche (`SyncOutcome`) : erreur affichée telle quelle */
export const outcomeFailure = (message: string): { status: 'error'; message: string } => ({ status: 'error', message });

/**
 * Correspondances modifiées par cette page (« Oublier », restauration d'une sauvegarde) : le service worker oublie ses
 * résolutions de page gardées en mémoire (L4 ; il n'écoute pas storage.onChanged). Ne lève jamais : service worker
 * injoignable → rien à oublier (ses caches en mémoire ne survivent pas à son arrêt).
 */
export async function notifyMappingsChanged(): Promise<void> {
  try {
    await sendMessage('MAPPINGS_CHANGED', null);
  } catch (error: unknown) {
    log.info('Service worker non prévenu du changement des correspondances :', error);
  }
}
