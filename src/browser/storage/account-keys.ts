// Registre des données liées au compte dans chrome.storage.local : à quel moment chaque clé est effacée. Ajouter une clé =
// une déclaration ici ; `account-keys.test.ts` exige que chaque clé de STORAGE_KEYS soit classée (liée au compte ou globale).
import { PENDING_RATINGS_KEY, REWATCH_DECLINED_KEY, STORAGE_KEYS, SYNC_QUEUE_KEY } from '../../protocol/storage-keys';
import { PLATFORM_LINKS_KEY } from '../../platforms/links';
import { AIRING_WEEK_PREFIX } from '../../shared/agenda';
import { AIRING_USER_KEYS } from '../../shared/airing-keys';
import type { TrackerId } from '../../shared/tracker.types';

/**
 * Quand la clé est effacée :
 * - `service` : à la fin de la session de ce service (jeton, profil) ;
 * - `account` : à toute fin de session (aperçu et comparaisons reflètent l'état des listes du compte) ET quand plus aucune
 *   session n'est ouverte ;
 * - `user` : quand plus aucune session n'est ouverte (déconnexion du dernier compte).
 */
export type AccountScope = { kind: 'service'; service: TrackerId } | { kind: 'account' } | { kind: 'user' };

export interface AccountBoundStore {
  name: string;
  scope: AccountScope;
  keys: readonly string[];
  /** Clés dont seul le préfixe est connu (une par semaine : `airingWeek:<date>`) */
  prefixes?: readonly string[];
}

export const ACCOUNT_STORES: readonly AccountBoundStore[] = [
  { name: 'anilist-session', scope: { kind: 'service', service: 'anilist' }, keys: [STORAGE_KEYS.anilistToken, STORAGE_KEYS.anilistViewer, STORAGE_KEYS.anilistViewerAt] },
  { name: 'mal-session', scope: { kind: 'service', service: 'mal' }, keys: [STORAGE_KEYS.malToken, STORAGE_KEYS.malViewer, STORAGE_KEYS.malViewerAt] },
  // Comparaison AniList ↔ MAL et import d'historique : l'aperçu est l'état des listes du compte
  { name: 'compare', scope: { kind: 'account' }, keys: [STORAGE_KEYS.compareLast, STORAGE_KEYS.compareJob, STORAGE_KEYS.compareJobItems] },
  { name: 'history-import', scope: { kind: 'account' }, keys: [STORAGE_KEYS.crImportJob, STORAGE_KEYS.crImportJobItems, STORAGE_KEYS.crImportInput, STORAGE_KEYS.crImportResolutions, STORAGE_KEYS.crImportPlan] },
  // Cartes « À vérifier » et synchros récentes (la part de chaque service est retirée à sa déconnexion par purgeClosedSessions)
  { name: 'reviews', scope: { kind: 'user' }, keys: [STORAGE_KEYS.pendingReviews, STORAGE_KEYS.recentSyncs] },
  // Marques « vu » de la barre d'état (synchros et import terminés de l'utilisateur)
  { name: 'status-bar', scope: { kind: 'user' }, keys: [STORAGE_KEYS.syncsSeenAt, STORAGE_KEYS.importSeenAt] },
  // Liste « En cours » de chaque service : l'entrée du service déconnecté est retirée à sa déconnexion (removeCachedWatching)
  { name: 'watching-cache', scope: { kind: 'user' }, keys: [STORAGE_KEYS.watchingCache] },
  { name: 'sync-queue', scope: { kind: 'user' }, keys: [SYNC_QUEUE_KEY, PENDING_RATINGS_KEY, REWATCH_DECLINED_KEY] },
  { name: 'platform-links', scope: { kind: 'user' }, keys: [PLATFORM_LINKS_KEY] },
  // Alertes de sortie : épisodes notifiés, cibles des notifications (séries de l'ancien compte), dernière vérification (ALRT-05),
  // semaines de l'agenda en cache (`airingWeek:<date>`, voir agenda.ts)
  { name: 'airing', scope: { kind: 'user' }, keys: AIRING_USER_KEYS, prefixes: [AIRING_WEEK_PREFIX] },
];

/**
 * Clés de STORAGE_KEYS qui ne sont PAS effacées avec un compte, avec la raison. Les correspondances appartiennent à
 * l'utilisateur (un changement de compte ne les invalide pas) ; la génération de session est incrémentée, jamais retirée ;
 * l'indicateur de migration ne concerne pas le compte.
 */
export const GLOBAL_STORAGE_KEYS: Readonly<Record<string, string>> = {
  [STORAGE_KEYS.mediaMappings]: 'correspondances de l’utilisateur, conservées entre comptes',
  [STORAGE_KEYS.sessionEpoch]: 'génération de session par service : incrémentée à la déconnexion, jamais retirée',
  [STORAGE_KEYS.otherSeriesPurge]: 'indicateur de migration (SYNC-01)',
};

/** Clés effacées à la fin de la session de `service` : son jeton et son profil, plus les clés du compte (toute session) */
export function keysClearedOnSessionEnd(service: TrackerId): string[] {
  return ACCOUNT_STORES.filter(({ scope }) => (scope.kind === 'service' && scope.service === service) || scope.kind === 'account').flatMap(({ keys }) => keys);
}

/** Clés effacées quand plus aucune session n'est ouverte : données du compte et de l'utilisateur, jamais les jetons */
export function keysClearedOnLastSession(): string[] {
  return ACCOUNT_STORES.filter(({ scope }) => scope.kind !== 'service').flatMap(({ keys }) => keys);
}

/** Préfixes des clés effacées quand plus aucune session n'est ouverte */
export function prefixesClearedOnLastSession(): string[] {
  return ACCOUNT_STORES.filter(({ scope }) => scope.kind !== 'service').flatMap(({ prefixes }) => prefixes ?? []);
}
