import { initI18n, languageSettled, t } from '../i18n';
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
import { checkNetflixTitles } from './netflix-import';
import { getContentCatalog } from './content-catalog';
import { listenJobResume } from './job-resume';
import { declineRewatch, deferRating, getListNotes, rateMedia, removeFromList, setListNotes, startRewatch } from './engagement';
import { ensureQueueAlarm, processSyncQueue, QUEUE_ALARM, retryQueued } from './sync/queue';
import { reopenReview, searchCandidates } from './sync/sync-service';
import { confirmReview, ignoreReview } from './sync/review-decision';
import { refreshReviewBadge } from '../shared/badge';
import { SETTINGS_STORAGE_KEY } from '../shared/settings';
import { STORAGE_KEYS } from '../protocol/storage-keys';
import type { MessagePayload, MessageResponse, MessageType, RuntimeMessage } from '../protocol/messages';
import { isAllowedOrigin, isExtensionPageSender, isRuntimeMessage, type MessageOrigin } from './message-guards';
import { createLogger } from '../shared/logger';
import { describeFailedResponse } from './response-errors';
import { resetSidePanel, togglePanelFromCommand } from './side-panel';
import { OPEN_SIDE_PANEL_COMMAND } from '../protocol/commands';
import { listenContentReinjection } from './content-reinjection';
import { listenPlatformAccess } from './platform-access';
import { runUpdateMigrations } from './update-migrations';
import { runPendingOtherSeriesPurge } from './sync/mapping-purge';

const log = createLogger('background');

chrome.runtime.onInstalled.addListener((details): void => {
  log.info('SyncKai installé et prêt');
  log.info('Redirect URL OAuth :', chrome.identity.getRedirectURL());
  void refreshReviewBadge();
  if (details.reason === 'update') {
    runUpdateMigrations(details.previousVersion).catch((error: unknown) => log.warn('Migration après mise à jour impossible :', error));
  }
});

// Le texte du badge n'est pas conservé au redémarrage du navigateur. Purge des correspondances restée en échec à la
// mise à jour (AniList injoignable) : retentée à chaque démarrage, une lecture du stockage sinon.
chrome.runtime.onStartup.addListener((): void => {
  void refreshReviewBadge();
  void runPendingOtherSeriesPurge();
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
    DISMISS_REVIEW: { ok: false, code: 'API_ERROR', message },
    GET_WATCHING: { ok: false, code: 'API_ERROR', message },
    RATE_MEDIA: { status: 'error', message: t('error.unexpectedRating') },
    REMOVE_FROM_LIST: { status: 'error', message: t('error.unexpectedRemove') },
    GET_LIST_NOTES: { ok: false, code: 'API_ERROR', message },
    SET_LIST_NOTES: { status: 'error', message: t('error.unexpectedNotes') },
    DEFER_RATING: { ok: false, code: 'API_ERROR', message },
    START_REWATCH: { status: 'error', message: t('error.unexpectedRewatch') },
    DECLINE_REWATCH: { ok: false, code: 'API_ERROR', message },
    CHECK_AIRING: { checkedAt: 0, notified: 0, skipped: null, error: message },
    RESOLVE_PAGE_MEDIA: { ok: false, code: 'API_ERROR', message },
    ADD_TO_LIST: { status: 'error', message: t('error.unexpectedAdd') },
    COMPARE_LISTS: { ok: false, code: 'API_ERROR', message: t('compare.error.unexpected') },
    APPLY_DIFFS: { ok: false, code: 'API_ERROR', message: t('compare.error.unexpected') },
    CANCEL_COMPARE_JOB: { ok: false, code: 'NOT_FOUND', message },
    GET_PANEL_MEDIA: { ok: false, code: 'API_ERROR', message },
    GET_AGENDA: { ok: false, code: 'API_ERROR', message },
    CR_IMPORT_ANALYZE: { ok: false, code: 'API_ERROR', message: t('crImport.error.unexpected') },
    CR_IMPORT_APPLY: { ok: false, code: 'API_ERROR', message: t('crImport.error.unexpected') },
    CR_IMPORT_CANCEL: { ok: false, code: 'NOT_FOUND', message },
    CR_IMPORT_REVIEWS: { ok: false, code: 'API_ERROR', message: t('crImport.error.unexpected') },
    NETFLIX_IMPORT_TITLES: { ok: false, code: 'API_ERROR', message: t('crImport.error.unexpected') },
    GET_CONTENT_CATALOG: null,
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
  // Accès Netflix / Disney+ retiré → ignoré ; échec passager → mise en file de relance automatique (`queued: true`)
  EPISODE_COMPLETED: (payload, sender) => handleEpisodeCompleted(payload, sender.tab?.id),
  ADJUST_PROGRESS: (payload) => adjustProgress(payload),
  SET_LIST_STATUS: (payload) => setListStatus(payload),
  RETRY_QUEUED: ({ id }) => retryQueued(id),
  SEARCH_ANIME: ({ query }) => searchCandidates(query),
  // Échec passager d'un service après une vérification confirmée : mis en file comme une synchro en direct ; épisode
  // mis de côté pendant une correction rejoué ensuite (review-decision.ts)
  RESOLVE_REVIEW: async (payload) => {
    const outcome = await confirmReview(payload);
    forgetPageResolutions();
    return outcome;
  },
  REOPEN_REVIEW: ({ key }) => reopenReview(key),
  DISMISS_REVIEW: async ({ key }) => {
    const result = await ignoreReview(key);
    forgetPageResolutions();
    return result;
  },
  GET_WATCHING: ({ service, force }) => getWatchingList(service, force === true),
  RATE_MEDIA: ({ media, score, fromCard }) => rateMedia(media, score, fromCard === true),
  // Retrait : la saison choisie sur une page de série (« première non terminée ») dépend des listes, résolution oubliée
  REMOVE_FROM_LIST: async ({ media }) => {
    const outcome = await removeFromList(media);
    forgetPageResolutions();
    return outcome;
  },
  GET_LIST_NOTES: ({ media }) => getListNotes(media),
  SET_LIST_NOTES: ({ media, notes }) => setListNotes(media, notes),
  DEFER_RATING: ({ media, coverUrl }) => deferRating(media, coverUrl),
  START_REWATCH: ({ media, progress }) => startRewatch(media, progress),
  DECLINE_REWATCH: ({ media }) => declineRewatch(media),
  RESOLVE_PAGE_MEDIA: (payload) => resolvePageMedia(payload),
  ADD_TO_LIST: (payload) => addToList(payload),
  COMPARE_LISTS: () => compareServiceLists(),
  APPLY_DIFFS: (payload) => applyDiffs(payload),
  CANCEL_COMPARE_JOB: () => cancelCompareJob(),
  GET_PANEL_MEDIA: ({ mediaId }) => getPanelMedia(mediaId),
  GET_AGENDA: ({ weekStart }) => getAgendaWeek(weekStart),
  CR_IMPORT_ANALYZE: (payload) => startCrAnalyze(payload),
  CR_IMPORT_APPLY: (payload) => startCrApply(payload),
  CR_IMPORT_CANCEL: () => cancelCrImport(),
  CR_IMPORT_REVIEWS: (payload) => createCrReviews(payload),
  NETFLIX_IMPORT_TITLES: (payload) => checkNetflixTitles(payload),
  // Script de contenu dans une autre langue que l'anglais : ses textes, tirés du catalogue chargé à la demande
  GET_CONTENT_CATALOG: ({ locale }) => getContentCatalog(locale),
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

    // Langue en cours de changement (réglage modifié juste avant) : réponse traduite dans la nouvelle
    i18nReady
      .then(languageSettled)
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

chrome.commands.onCommand.addListener((command, tab): void => {
  // Panneau latéral (Chrome) : ouverture synchrone, sans attendre la langue (geste utilisateur perdu au premier await) ;
  // un panneau déjà ouvert se ferme lui-même ensuite (bascule). Firefox : `_execute_sidebar_action` (manifest-target.ts),
  // bascule native du navigateur, n'arrive jamais ici.
  if (__SYNCKAI_TARGET__ === 'chrome' && command === OPEN_SIDE_PANEL_COMMAND) {
    togglePanelFromCommand(tab);
    return;
  }
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

// ─── Panneau latéral (Chrome) : disponible sur tous les onglets, ouvert seulement par l'utilisateur ───
// Option globale (un seul panneau, partagé par les onglets de la fenêtre) ; la page du panneau suit elle-même l'onglet
// actif. Pas de tabs.onUpdated ici : sans filtre sur Chrome, il réveillerait le service worker à chaque navigation.

if (__SYNCKAI_TARGET__ === 'chrome') {
  chrome.runtime.onInstalled.addListener(resetSidePanel);
  chrome.runtime.onStartup.addListener(resetSidePanel);
}

// ─── Onglets Crunchyroll / ADN déjà ouverts : script de contenu réinjecté à l'installation et à la mise à jour ───
// Chrome seulement : Firefox exécute lui-même les scripts du manifeste dans les onglets ouverts (content-reinjection.ts).
// Netflix, Disney+ (accès accordé) : repris sur les deux navigateurs par platform-access.ts

listenContentReinjection();

// ─── Netflix, Disney+ (accès optionnel) : scripts enregistrés quand l'accès est accordé, retirés sinon ───

listenPlatformAccess();
