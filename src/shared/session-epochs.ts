import { isRecord } from './guards';
import { TRACKER_IDS, type TrackerId } from './tracker.types';

// Liaison des données au compte (module pur, testable). La file de relance, les cartes « À noter », les dernières
// synchros et les corrections portent les sessions ouvertes au moment de leur création : elles ne sont jamais
// rejouées sur une autre session (autre compte, ou même compte reconnecté après une déconnexion).

/**
 * Sessions ouvertes (jeton enregistré, même expiré) au moment de la création : génération de chaque service
 * (`sessionEpoch`, incrémentée à chaque déconnexion). Un service absent n'était pas connecté.
 */
export type SessionEpochs = Partial<Record<TrackerId, number>>;

export function isSessionEpochs(value: unknown): value is SessionEpochs {
  return (
    isRecord(value) &&
    Object.entries(value).every(([key, epoch]) => (TRACKER_IDS as readonly string[]).includes(key) && typeof epoch === 'number' && Number.isInteger(epoch) && epoch >= 0)
  );
}

/** Services dont la session de création est toujours ouverte (même génération) */
export function liveServices(epochs: SessionEpochs, current: SessionEpochs): TrackerId[] {
  return TRACKER_IDS.filter((service) => epochs[service] !== undefined && epochs[service] === current[service]);
}

/**
 * Toutes les sessions relevées dans `epochs` sont encore ouvertes, avec la même génération (une connexion à un autre
 * service entre-temps n'y change rien). Aucune session relevée : false (rien à écrire pour un compte).
 */
export function stillOpen(epochs: SessionEpochs, current: SessionEpochs): boolean {
  const services = TRACKER_IDS.filter((service) => epochs[service] !== undefined);
  return services.length > 0 && liveServices(epochs, current).length === services.length;
}

/** Mêmes sessions ouvertes (aucune connexion ni déconnexion entre les deux relevés) */
export function sameSessions(a: SessionEpochs, b: SessionEpochs): boolean {
  return TRACKER_IDS.every((service) => a[service] === b[service]);
}

/** Sessions réduites à `services` (celles qui restent valables pour une donnée) */
export function pickSessions(epochs: SessionEpochs, services: readonly TrackerId[]): SessionEpochs {
  return Object.fromEntries(services.flatMap((service) => (epochs[service] !== undefined ? [[service, epochs[service]]] : [])));
}

/**
 * Sessions d'une donnée. Sans `epochs` : créée avant la 2.2.0 et pas encore migrée (voir update-migrations.ts).
 * Toute déconnexion purge ces données (purgeClosedSessions) : une donnée encore présente date donc de la session
 * courante.
 */
export function sessionsOf(epochs: SessionEpochs | undefined, current: SessionEpochs): SessionEpochs {
  return epochs ?? current;
}
