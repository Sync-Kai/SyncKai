// Clés de stockage des alertes de sortie (module sans dépendance : importé par storage.ts pour l'effacement).

/** Horodatage (UNIX secondes) de la dernière vérification des sorties : ancien format, lu seulement si AIRING_COVERED_KEY manque */
export const AIRING_LAST_CHECK_KEY = 'airingLastCheck';
/** Fin de la fenêtre réellement couverte (UNIX secondes, délai déjà retiré) : les sorties antérieures ont été traitées (ALRT-02) */
export const AIRING_COVERED_KEY = 'airingCoveredUntil';
/** scheduleId des épisodes déjà notifiés */
export const AIRING_NOTIFIED_KEY = 'airingNotified';
/** notificationId → mediaIds à ouvrir au clic (le service worker peut s'endormir entre-temps) */
export const AIRING_TARGETS_KEY = 'airingTargets';
/** Dernier résumé de vérification des sorties */
export const AIRING_RESULT_KEY = 'airingLastResult';

/** Propres au compte (séries suivies) : effacées quand plus aucun service n'est connecté */
export const AIRING_USER_KEYS = [AIRING_LAST_CHECK_KEY, AIRING_COVERED_KEY, AIRING_NOTIFIED_KEY, AIRING_TARGETS_KEY, AIRING_RESULT_KEY] as const;
