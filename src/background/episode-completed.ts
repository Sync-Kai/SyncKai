// Épisode terminé envoyé par un script de contenu (EPISODE_COMPLETED) : garde d'accès, synchro, file de relance.
import type { EpisodeCompletedPayload } from '../protocol/messages';
import { hasPlatformAccess } from '../browser/platform-access';
import { isOptionalPlatform, PLATFORMS } from '../platforms/registry';
import { getOpenSessions } from '../browser/storage/sessions';
import { createLogger } from '../browser/logger';
import type { SyncOutcome } from '../shared/sync.types';
import { forgetPageResolutions, refreshTabPageMedia } from './page-media';
import { recordSyncOutcome } from './sync/queue';
import { syncEpisode } from './sync/sync-service';

const log = createLogger('background');

/**
 * Accès Netflix ou Disney+ retiré (Réglages, chrome://extensions, about:addons) : les scripts déjà exécutés dans les
 * onglets ouverts tournent encore jusqu'au rechargement. Leurs épisodes sont refusés ici, sans écriture ni mise en file
 * (la file garde, elle, les épisodes regardés quand l'accès était accordé).
 */
async function accessRevoked(episode: EpisodeCompletedPayload['episode']): Promise<boolean> {
  return isOptionalPlatform(episode.platform) && !(await hasPlatformAccess(episode.platform));
}

/** Échec passager → mise en file de relance automatique (le résultat porte alors `queued: true`) */
export async function handleEpisodeCompleted({ episode, services }: EpisodeCompletedPayload, tabId: number | undefined): Promise<SyncOutcome> {
  if (await accessRevoked(episode)) {
    log.info(`Accès ${PLATFORMS[episode.platform].label} retiré : épisode ignoré, rien n’est écrit`, episode.animeTitle);
    return { status: 'ignored', noAccess: true };
  }
  // Sessions capturées avant la synchro : un échec n'est relancé que sur elles (jamais sur un compte connecté depuis)
  const epochs = await getOpenSessions();
  const outcome = await syncEpisode(episode, services, epochs);
  // Correspondance saison → fiche peut-être apprise : les résolutions en mémoire sont oubliées
  forgetPageResolutions();
  if (outcome.status === 'synced' && tabId !== undefined) {
    // Fiche de l'onglet recalculée sans retarder le toast de la page (panneau et popup la lisent dans le cache)
    refreshTabPageMedia(tabId, episode).catch((error: unknown) => log.warn('Fiche de l’onglet non mise à jour :', error));
  }
  return recordSyncOutcome(episode, services, outcome, epochs);
}
