import { SHOWN_SEQUELS_CHECK_KEY } from '../../protocol/storage-keys';
import { connectedServices } from '../../browser/airing-alarm';
import { createLogger } from '../../browser/logger';
import { getOpenSessions } from '../../browser/storage/sessions';
import { isRecord } from '../../shared/guards';
import { isSessionEpochs, sameSessions, type SessionEpochs } from '../../shared/session-epochs';
import { dropListed, listedEntries, listedQualifies, listSequels, setSequelStates, visibleSequels, type ListedStatus } from '../../shared/sequels';
import { anilistQuery } from '../anilist/client';
import { malList } from '../franchise/states';
import { writeSequels } from './actions';
import { readSequelStore } from './check';

// Suites affichées (« Annoncées » du panneau, Activité du popup) revérifiées contre les listes de l'utilisateur : une suite
// ajoutée sur AniList ou MAL après la passe quotidienne ne garde pas « + À regarder » jusqu'à la suivante. Une suite
// trouvée À regarder (ou En cours pas encore sortie) passe dans les séries de la liste ; avec un autre statut, elle est
// retirée comme après « Déjà dans ta liste » (alerte terminée, jamais renotifiée). Une série de la liste qui n'y est plus
// (ou avec un autre statut) est retirée de `listed` : redevenue candidate, la passe quotidienne suivante la remontre comme suite.
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

/** Statut dans la liste AniList des ids qui y sont (statut illisible : ''), une requête par lot de 50 */
async function aniListStatuses(ids: readonly number[]): Promise<Map<number, string>> {
  const statuses = new Map<number, string>();
  for (let from = 0; from < ids.length; from += CHUNK) {
    const { Page } = await anilistQuery(QUERY, isPageData, { ids: ids.slice(from, from + CHUNK) }, 'background');
    for (const media of Page.media) {
      if (isRecord(media) && typeof media.id === 'number' && isRecord(media.mediaListEntry)) statuses.set(media.id, typeof media.mediaListEntry.status === 'string' ? media.mediaListEntry.status : '');
    }
  }
  return statuses;
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
  const store = await readSequelStore();
  const shown = visibleSequels(store);
  const listed = listedEntries(store);
  if (shown.length === 0 && listed.length === 0) return;
  const services = await connectedServices();
  /** Statut de liste d'une fiche, undefined si elle n'est dans aucune liste */
  let statusOf: (entry: { id: number; idMal: number | null }) => string | undefined;
  if (services.includes('anilist')) {
    const statuses = await aniListStatuses([...new Set([...shown.map((record) => record.snapshot.id), ...listed.map((entry) => entry.id)])]);
    statusOf = (entry) => statuses.get(entry.id);
  } else if (services.includes('mal') && epochs.mal !== undefined) {
    const byMal = new Map((await malList(epochs.mal, false)).map((entry) => [entry.malId, entry.status]));
    statusOf = (entry) => (entry.idMal === null ? undefined : byMal.get(entry.idMal));
  } else return;
  const moved: { id: number; listStatus: ListedStatus }[] = [];
  const removed: number[] = [];
  for (const { snapshot } of shown) {
    const status = statusOf(snapshot);
    if (status === undefined) continue;
    if (listedQualifies(status, snapshot.status)) moved.push({ id: snapshot.id, listStatus: status });
    else removed.push(snapshot.id);
  }
  const dropped = listed.filter((entry) => statusOf(entry) !== entry.listStatus).map((entry) => entry.id);
  if (moved.length === 0 && removed.length === 0 && dropped.length === 0) return;
  // Écriture refusée si une session relevée avant la lecture a changé (autre compte, déconnexion)
  await writeSequels((current) => listSequels(dropListed(setSequelStates(current, removed, 'removed'), dropped), moved), epochs);
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
