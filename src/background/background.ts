import { initI18n, t } from '../i18n';
import { getMalViewer } from './api/mal';
import { getPanelMedia } from './api/panel-media';
import { getViewer } from './api/viewer';
import { getWatchingList } from './api/watching';
import { loginWithAniList } from './auth/anilist';
import { loginWithMal } from './auth/mal';
import { getAgendaWeek } from './agenda';
import { AIRING_ALARM, checkNewEpisodes, ensureAiringAlarm, handleNotificationButton, handleNotificationClick } from './airing';
import { addToList, adjustProgress, handleCommand, setListStatus } from './controls';
import { handleEpisodeCompleted } from './episode-completed';
import { forgetPageResolutions, resolvePageMedia } from './page-media';
import { applyDiffs, cancelCompareJob, compareServiceLists } from './compare';
import { cancelCrImport, createCrReviews, startCrAnalyze, startCrApply } from './cr-import';
import { listenJobResume } from './job-resume';
import { declineRewatch, deferRating, rateMedia, startRewatch } from './engagement';
import { ensureQueueAlarm, processSyncQueue, QUEUE_ALARM, recordSyncOutcome, retryQueued } from './sync/queue';
import { reopenReview, resolveReview, searchCandidates } from './sync/sync-service';
import { refreshReviewBadge } from '../shared/badge';
import { SETTINGS_STORAGE_KEY } from '../shared/settings';
import { STORAGE_KEYS } from '../shared/storage-keys';
import {
  isAllowedOrigin,
  isExtensionPageSender,
  isRuntimeMessage,
  type MessageOrigin,
  type MessagePayload,
  type MessageResponse,
  type MessageType,
  type RuntimeMessage,
} from '../shared/messages';
import { createLogger } from '../shared/logger';
import { describeFailedResponse } from './response-errors';
import { enablePanelForSender, resetSidePanel } from './side-panel';
import { listenNetflixAccess } from './netflix-access';
import { runUpdateMigrations } from './update-migrations';

const log = createLogger('background');

chrome.runtime.onInstalled.addListener((details): void => {
  log.info('SyncKai installé et prêt');
  log.info('Redirect URL OAuth :', chrome.identity.getRedirectURL());
  void refreshReviewBadge();
  if (details.reason === 'update') {
    runUpdateMigrations(details.previousVersion).catch((error: unknown) => log.warn('Migration après mise à jour impossible :', error));
  }
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
    COMPARE_LISTS: { ok: false, code: 'API_ERROR', message: t('compare.error.unexpected') },
    APPLY_DIFFS: { ok: false, code: 'API_ERROR', message: t('compare.error.unexpected') },
    CANCEL_COMPARE_JOB: { ok: false, code: 'NOT_FOUND', message },
    PANEL_AVAILABLE: null,
    GET_PANEL_MEDIA: { ok: false, code: 'API_ERROR', message },
    GET_AGENDA: { ok: false, code: 'API_ERROR', message },
    CR_IMPORT_ANALYZE: { ok: false, code: 'API_ERROR', message: t('crImport.error.unexpected') },
    CR_IMPORT_APPLY: { ok: false, code: 'API_ERROR', message: t('crImport.error.unexpected') },
    CR_IMPORT_CANCEL: { ok: false, code: 'NOT_FOUND', message },
    CR_IMPORT_REVIEWS: { ok: false, code: 'API_ERROR', message: t('crImport.error.unexpected') },
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
  // Accès Netflix retiré → ignoré ; échec passager → mise en file de relance automatique (`queued: true`)
  EPISODE_COMPLETED: (payload, sender) => handleEpisodeCompleted(payload, sender.tab?.id),
  ADJUST_PROGRESS: (payload) => adjustProgress(payload),
  SET_LIST_STATUS: (payload) => setListStatus(payload),
  RETRY_QUEUED: ({ id }) => retryQueued(id),
  SEARCH_ANIME: ({ query }) => searchCandidates(query),
  // Échec passager d'un service après une vérification confirmée : mis en file comme une synchro en direct
  RESOLVE_REVIEW: async (payload) => {
    const { outcome, episode, epochs } = await resolveReview(payload);
    forgetPageResolutions();
    return episode !== null ? recordSyncOutcome(episode, null, outcome, epochs) : outcome;
  },
  REOPEN_REVIEW: ({ key }) => reopenReview(key),
  GET_WATCHING: ({ service, force }) => getWatchingList(service, force === true),
  RATE_MEDIA: ({ media, score, fromCard }) => rateMedia(media, score, fromCard === true),
  DEFER_RATING: ({ media, coverUrl }) => deferRating(media, coverUrl),
  START_REWATCH: ({ media, progress }) => startRewatch(media, progress),
  DECLINE_REWATCH: ({ media }) => declineRewatch(media),
  RESOLVE_PAGE_MEDIA: (payload) => resolvePageMedia(payload),
  ADD_TO_LIST: (payload) => addToList(payload),
  COMPARE_LISTS: () => compareServiceLists(),
  APPLY_DIFFS: (payload) => applyDiffs(payload),
  CANCEL_COMPARE_JOB: () => cancelCompareJob(),
  PANEL_AVAILABLE: (_payload, sender) => enablePanelForSender(sender),
  GET_PANEL_MEDIA: ({ mediaId }) => getPanelMedia(mediaId),
  GET_AGENDA: ({ weekStart }) => getAgendaWeek(weekStart),
  CR_IMPORT_ANALYZE: (payload) => startCrAnalyze(payload),
  CR_IMPORT_APPLY: (payload) => startCrApply(payload),
  CR_IMPORT_CANCEL: () => cancelCrImport(),
  CR_IMPORT_REVIEWS: (payload) => createCrReviews(payload),
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
    // Liste d'autorisation par type (MESSAGE_ORIGINS, ARCH-07) : un content script n'envoie que les messages de
    // lecture et d'engagement, même s'il tourne dans un onglet comme une page de l'extension
    const origin: MessageOrigin = isExtensionPageSender(sender, chrome.runtime.getURL('')) ? 'extension' : 'content';
    if (!isAllowedOrigin(message.type, origin)) {
      log.warn(`Message refusé (expéditeur ${origin === 'content' ? 'script de contenu' : 'page de l’extension'}) :`, message.type);
      return false;
    }

    i18nReady
      .then(() => dispatch(message, sender))
      .then((response) => {
        // Erreurs prévues (réseau, API…) renvoyées sans log : consignées ici pour le rapport de diagnostic
        const failure = describeFailedResponse(response);
        if (failure !== null) log.warn(`${message.type} :`, failure);
        sendResponse(response);
      })
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
// Réglage modifié ou compte (dé)connecté : l'alarme suit. Zone locale seule (ARCH-18) : les caches de
// `storage.session` écrits par le popup et le panneau ne réveillent pas le service worker.
chrome.storage.local.onChanged.addListener((changes): void => {
  if (SETTINGS_STORAGE_KEY in changes || STORAGE_KEYS.anilistToken in changes || STORAGE_KEYS.malToken in changes) {
    void ensureAiringAlarm();
  }
});

// ─── Tâches de fond (alignement AniList ↔ MAL, import Crunchyroll) : reprise après une interruption ───
// Par leur alarme, au démarrage du navigateur et après une mise à jour de l'extension (voir job-resume.ts)

listenJobResume(afterI18n);

// ─── Panneau latéral (Chrome) : indisponible hors Crunchyroll / ADN ───────
// Activé onglet par onglet via PANEL_AVAILABLE (script de contenu) ou le bouton du popup.
// Pas de tabs.onUpdated ici : sans filtre sur Chrome, il réveillerait le service worker à chaque navigation.

if (__SYNCKAI_TARGET__ === 'chrome') {
  chrome.runtime.onInstalled.addListener(resetSidePanel);
  chrome.runtime.onStartup.addListener(resetSidePanel);
}

// ─── Netflix (accès optionnel) : scripts enregistrés quand l'accès est accordé, retirés sinon ───

listenNetflixAccess();
