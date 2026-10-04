import { initI18n, t } from '../i18n';
import { getMalViewer } from './api/mal';
import { getViewer } from './api/viewer';
import { getWatchingList } from './api/watching';
import { loginWithAniList } from './auth/anilist';
import { loginWithMal } from './auth/mal';
import { AIRING_ALARM, checkNewEpisodes, ensureAiringAlarm, handleNotificationButton, handleNotificationClick } from './airing';
import { addToList, adjustProgress, handleCommand, setListStatus } from './controls';
import { resolvePageMedia } from './page-media';
import { declineRewatch, deferRating, rateMedia, startRewatch } from './engagement';
import { ensureQueueAlarm, processSyncQueue, QUEUE_ALARM, recordSyncOutcome, retryQueued } from './sync/queue';
import { reopenReview, resolveReview, searchCandidates, syncEpisode } from './sync/sync-service';
import { refreshReviewBadge } from '../shared/badge';
import { SETTINGS_STORAGE_KEY } from '../shared/settings';
import { STORAGE_KEYS } from '../shared/storage';
import {
  EXTENSION_PAGE_ONLY,
  isRuntimeMessage,
  type MessagePayload,
  type MessageResponse,
  type MessageType,
  type RuntimeMessage,
} from '../shared/messages';
import { createLogger } from '../shared/logger';

const log = createLogger('background');

chrome.runtime.onInstalled.addListener((): void => {
  log.info('SyncKai installé et prêt');
  log.info('Redirect URL OAuth :', chrome.identity.getRedirectURL());
  void refreshReviewBadge();
});

// Le texte du badge n'est pas conservé au redémarrage du navigateur
chrome.runtime.onStartup.addListener((): void => {
  void refreshReviewBadge();
});

// Langue de l'interface (messages d'erreur, notifications) : lue au réveil, attendue avant chaque traitement
const i18nReady = initI18n().catch((error: unknown) => log.warn('Langue des réglages illisible :', error));

/** Exécute `run` une fois la langue chargée */
function afterI18n(run: () => unknown): void {
  void i18nReady.then(run);
}

/** Réponse de secours par type de message si un handler lève une exception inattendue (traduite à la demande) */
function unexpectedErrors(): { [K in MessageType]: MessageResponse<K> } {
  const message = t('error.unexpected');
  return {
    LOGIN_ANILIST: { ok: false, code: 'UNKNOWN', message },
    GET_VIEWER: { ok: false, code: 'API_ERROR', message },
    LOGIN_MAL: { ok: false, code: 'UNKNOWN', message },
    GET_MAL_VIEWER: { ok: false, code: 'API_ERROR', message },
    EPISODE_COMPLETED: { status: 'error', message: t('error.unexpectedSync') },
    ADJUST_PROGRESS: { status: 'error', message },
    SET_LIST_STATUS: { status: 'error', message: t('error.unexpectedStatus') },
    RETRY_QUEUED: { status: 'error', message },
    SEARCH_ANIME: { ok: false, code: 'API_ERROR', message },
    RESOLVE_REVIEW: { status: 'error', message: t('error.unexpectedSync') },
    REOPEN_REVIEW: { ok: false, code: 'API_ERROR', message },
    GET_WATCHING: { ok: false, code: 'API_ERROR', message },
    RATE_MEDIA: { status: 'error', message: t('error.unexpectedRating') },
    DEFER_RATING: { ok: false, code: 'API_ERROR', message },
    START_REWATCH: { status: 'error', message: t('error.unexpectedRewatch') },
    DECLINE_REWATCH: { ok: false, code: 'API_ERROR', message },
    CHECK_AIRING: { checkedAt: 0, notified: 0, skipped: null, error: message },
    RESOLVE_PAGE_MEDIA: { ok: false, code: 'API_ERROR', message },
    ADD_TO_LIST: { status: 'error', message: t('error.unexpectedAdd') },
  };
}

type MessageHandlers = {
  [K in MessageType]: (payload: MessagePayload<K>, sender: chrome.runtime.MessageSender) => Promise<MessageResponse<K>>;
};

const handlers: MessageHandlers = {
  LOGIN_ANILIST: async () => {
    const result = await loginWithAniList();
    // Précharge le profil : la popup, souvent fermée pendant l'OAuth, l'affichera instantanément
    if (result.ok) await getViewer();
    return result;
  },
  GET_VIEWER: () => getViewer(),
  LOGIN_MAL: async () => {
    const result = await loginWithMal();
    if (result.ok) await getMalViewer();
    return result;
  },
  GET_MAL_VIEWER: () => getMalViewer(),
  // Échec passager → mise en file de relance automatique (le résultat porte alors `queued: true`)
  EPISODE_COMPLETED: async ({ episode, services }) => recordSyncOutcome(episode, services, await syncEpisode(episode, services)),
  ADJUST_PROGRESS: (payload) => adjustProgress(payload),
  SET_LIST_STATUS: (payload) => setListStatus(payload),
  RETRY_QUEUED: ({ id }) => retryQueued(id),
  SEARCH_ANIME: ({ query }) => searchCandidates(query),
  RESOLVE_REVIEW: (payload) => resolveReview(payload),
  REOPEN_REVIEW: ({ key }) => reopenReview(key),
  GET_WATCHING: ({ service }) => getWatchingList(service),
  RATE_MEDIA: ({ media, score }) => rateMedia(media, score),
  DEFER_RATING: ({ media, coverUrl }) => deferRating(media, coverUrl),
  START_REWATCH: ({ media, progress }) => startRewatch(media, progress),
  DECLINE_REWATCH: ({ media }) => declineRewatch(media),
  RESOLVE_PAGE_MEDIA: (payload) => resolvePageMedia(payload),
  ADD_TO_LIST: (payload) => addToList(payload),
  // Vérification manuelle : (re)crée aussi l'alarme horaire si elle a disparu
  CHECK_AIRING: async () => {
    await ensureAiringAlarm();
    return checkNewEpisodes();
  },
};

// Générique pour conserver la corrélation type ↔ payload ↔ handler
function dispatch<K extends MessageType>(
  message: RuntimeMessage<K>,
  sender: chrome.runtime.MessageSender,
): Promise<MessageResponse<K>> {
  const handler: MessageHandlers[K] = handlers[message.type];
  return handler(message.payload, sender);
}

chrome.runtime.onMessage.addListener(
  (
    message: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse<MessageType>) => void,
  ): boolean => {
    // N'accepte que les messages provenant de l'extension elle-même (popup ou content scripts)
    if (sender.id !== chrome.runtime.id || !isRuntimeMessage(message)) return false;
    // Les actions sur le compte ne viennent que du popup : un content script (sender.tab) est refusé
    if (EXTENSION_PAGE_ONLY.has(message.type) && sender.tab !== undefined) {
      log.warn('Message refusé depuis un onglet :', message.type);
      return false;
    }

    i18nReady
      .then(() => dispatch(message, sender))
      .then(sendResponse)
      .catch((error: unknown) => {
        log.error('Erreur non gérée pour', message.type, error);
        sendResponse(unexpectedErrors()[message.type]);
      });
    return true; // Garde le canal ouvert pour la réponse asynchrone
  },
);

// ─── File de relance et raccourci clavier ─────────────────────────────────

chrome.alarms.onAlarm.addListener((alarm): void => {
  if (alarm.name === QUEUE_ALARM) afterI18n(processSyncQueue);
});

chrome.commands.onCommand.addListener((command): void => {
  void handleCommand(command);
});

chrome.runtime.onStartup.addListener((): void => {
  void ensureQueueAlarm();
});
chrome.runtime.onInstalled.addListener((): void => {
  void ensureQueueAlarm();
});

// ─── Alertes de nouveaux épisodes ──────────────────────────────────────────

chrome.alarms.onAlarm.addListener((alarm): void => {
  if (alarm.name === AIRING_ALARM) afterI18n(checkNewEpisodes);
});
chrome.notifications.onClicked.addListener((id): void => {
  void handleNotificationClick(id);
});
chrome.notifications.onButtonClicked.addListener((id, index): void => {
  void handleNotificationButton(id, index);
});
chrome.runtime.onStartup.addListener((): void => {
  void ensureAiringAlarm();
});
chrome.runtime.onInstalled.addListener((): void => {
  void ensureAiringAlarm();
});
// Réglage modifié ou compte (dé)connecté : l'alarme suit
chrome.storage.onChanged.addListener((changes, area): void => {
  if (area === 'local' && (SETTINGS_STORAGE_KEY in changes || STORAGE_KEYS.anilistToken in changes || STORAGE_KEYS.malToken in changes)) {
    void ensureAiringAlarm();
  }
});
