import { SHOWN_SEQUELS_CHECK_KEY } from '../../protocol/storage-keys';
import { connectedServices } from '../../browser/airing-alarm';
import { createLogger } from '../../browser/logger';
import { getOpenSessions } from '../../browser/storage/sessions';
import { isRecord } from '../../shared/guards';
import { isSessionEpochs, sameSessions, type SessionEpochs } from '../../shared/session-epochs';
import { visibleSequels } from '../../shared/sequels';
import { anilistQuery } from '../anilist/client';
import { malList } from '../franchise/states';
import { updateSequels } from './actions';
import { readSequelStore } from './check';

// Suites affichées (« Annoncées » du panneau, Activité du popup) revérifiées contre les listes de l'utilisateur : une suite
// ajoutée sur AniList ou MAL après la passe quotidienne ne garde pas « + À regarder » jusqu'à la suivante. Une suite
// trouvée dans une liste est retirée comme après « Déjà dans ta liste » (alerte terminée, jamais renotifiée).
// Frein : une vérification par 10 min et par compte, notée dans storage.session (survit à l'arrêt du service worker,
// qui s'arrête après 30 s d'inactivité : un frein en mémoire ne tiendrait pas entre deux ouvertures du panneau ; rien
// ne survit à la fermeture du navigateur). Toute erreur : rien ne change.

export const SHOWN_SEQUELS_CHECK_INTERVAL_MS = 10 * 60_000;

const log = createLogger('sequels');
const CHUNK = 50;

const QUERY = /* GraphQL */ `
  query ShownSequels($ids: [Int]) {
    Page(perPage: ${CHUNK}) {
      media(id_in: $ids, type: ANIME) { id mediaListEntry { status } }
    }
  }
`;

const isPageData = (data: unknown): data is { Page: { media: unknown[] } } => isRecord(data) && isRecord(data.Page) && Array.isArray(data.Page.media);

/** Ids AniList dans la liste AniList (statut quelconque), une requête par lot de 50 */
async function listedOnAniList(ids: readonly number[]): Promise<number[]> {
  const listed: number[] = [];
  for (let from = 0; from < ids.length; from += CHUNK) {
    const { Page } = await anilistQuery(QUERY, isPageData, { ids: ids.slice(from, from + CHUNK) }, 'background');
    for (const media of Page.media) if (isRecord(media) && typeof media.id === 'number' && isRecord(media.mediaListEntry)) listed.push(media.id);
  }
  return listed;
}

/** Dernière vérification encore valable pour ces sessions (même compte, moins de 10 min) */
async function throttled(epochs: SessionEpochs, now: number): Promise<boolean> {
  try {
    const value: unknown = (await chrome.storage.session.get(SHOWN_SEQUELS_CHECK_KEY))[SHOWN_SEQUELS_CHECK_KEY];
    if (!isRecord(value) || typeof value.at !== 'number' || !isSessionEpochs(value.epochs)) return false;
    return sameSessions(value.epochs, epochs) && now - value.at >= 0 && now - value.at < SHOWN_SEQUELS_CHECK_INTERVAL_MS;
  } catch {
    return false;
  }
}

async function run(now: number): Promise<void> {
  const epochs = await getOpenSessions();
  if (Object.keys(epochs).length === 0 || (await throttled(epochs, now))) return;
  // Noté avant la lecture : une vérification en échec n'est pas relancée à chaque changement de vue
  await chrome.storage.session.set({ [SHOWN_SEQUELS_CHECK_KEY]: { at: now, epochs } }).catch(() => undefined);
  const shown = visibleSequels(await readSequelStore());
  if (shown.length === 0) return;
  const services = await connectedServices();
  let listed: number[] = [];
  if (services.includes('anilist')) listed = await listedOnAniList(shown.map((record) => record.snapshot.id));
  else if (services.includes('mal') && epochs.mal !== undefined) {
    const malIds = new Set((await malList(epochs.mal, false)).map((entry) => entry.malId));
    listed = shown.filter((record) => record.snapshot.idMal !== null && malIds.has(record.snapshot.idMal)).map((record) => record.snapshot.id);
  }
  // Écriture refusée si une session relevée avant la lecture a changé (autre compte, déconnexion)
  if (listed.length > 0) await updateSequels(listed, 'removed', epochs);
}

let inFlight: Promise<null> | null = null;

/** Revérifie les suites affichées (au plus une fois par 10 min et par compte). Ne lève jamais ; un appel pendant une vérification rend la même promesse. */
export function checkShownSequels(now: number = Date.now()): Promise<null> {
  inFlight ??= run(now)
    .catch((error: unknown) => log.warn('Revérification des suites affichées impossible :', error))
    .then(() => null)
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}
