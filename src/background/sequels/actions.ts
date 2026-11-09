import { t } from '../../i18n';
import { STORAGE_KEYS } from '../../protocol/storage-keys';
import { openPopupOn } from '../../browser/popup-screen';
import { createLogger } from '../../browser/logger';
import { getOpenSessions, sessionsStillOpen } from '../../browser/storage/sessions';
import { withStorageLock } from '../../browser/storage/lock';
import { setSequelStates, visibleSequels, type SequelSnapshot, type SequelStore } from '../../shared/sequels';
import type { SyncOutcome } from '../../shared/sync.types';
import { addToList } from '../controls';
import { SEQUEL_NOTIFICATION_PREFIX, readSequelStore } from './check';

// Actions des notifications de suites (clic, boutons) et mise à jour du store depuis les pages. Le routage par
// préfixe d'id se fait dans airing.ts (aucun écouteur de plus).

const log = createLogger('sequels');
const GROUP_PREFIX = `${SEQUEL_NOTIFICATION_PREFIX}group:`;

export type SequelUpdate = 'seen' | 'dismissed' | 'removed' | 'restore';

/** `restore` : masquée → vue ; sans id, toutes les suites masquées */
function applyUpdate(store: SequelStore, ids: readonly number[], update: SequelUpdate): SequelStore {
  if (update !== 'restore') return setSequelStates(store, ids, update);
  const dismissed = store.records.filter((record) => record.state === 'dismissed' && (ids.length === 0 || ids.includes(record.snapshot.id)));
  return setSequelStates(store, dismissed.map((record) => record.snapshot.id), 'seen');
}

/**
 * Change l'état de suites du store, sous le verrou et avec les sessions ouvertes à l'instant (donnée du compte :
 * jamais recréée après une déconnexion). False sans session ouverte.
 */
export async function updateSequels(ids: readonly number[], update: SequelUpdate): Promise<boolean> {
  const epochs = await getOpenSessions();
  if (Object.keys(epochs).length === 0) return false;
  return withStorageLock(async () => {
    if (!(await sessionsStillOpen(epochs))) return false;
    await chrome.storage.local.set({ [STORAGE_KEYS.sequelsState]: applyUpdate(await readSequelStore(), ids, update) });
    return true;
  });
}

/** Fiche AniList de la suite : celle du store, sinon l'URL canonique (enregistrement retiré entre-temps) */
async function snapshotOf(id: number): Promise<Pick<SequelSnapshot, 'idMal' | 'siteUrl'>> {
  const found = (await readSequelStore()).records.find((record) => record.snapshot.id === id);
  return found?.snapshot ?? { idMal: null, siteUrl: `https://anilist.co/anime/${id}` };
}

async function openGroup(): Promise<void> {
  if (await openPopupOn('activity')) return;
  const [first] = visibleSequels(await readSequelStore());
  if (first !== undefined) await chrome.tabs.create({ url: first.snapshot.siteUrl });
}

/** Message de la notification après « + Plan to watch » ; `added` : au moins un service a écrit */
function addOutcome(outcome: SyncOutcome): { added: boolean; message: string } {
  if (outcome.status !== 'synced') return { added: false, message: outcome.status === 'error' ? outcome.message : t('error.unexpectedAdd') };
  const outcomes = outcome.results.map((result) => result.outcome);
  if (outcomes.some((o) => o.status === 'updated' || o.status === 'up-to-date')) return { added: true, message: t('sequel.added') };
  if (outcomes.some((o) => o.status === 'skipped' && o.reason === t('page.alreadyInList'))) return { added: false, message: t('sequel.inList') };
  const failed = outcomes.find((o) => o.status === 'error');
  return { added: false, message: failed?.status === 'error' ? failed.message : t('error.unexpectedAdd') };
}

async function addToPlanning(notificationId: string, id: number): Promise<void> {
  const { added, message } = addOutcome(await addToList({ mediaId: id, malId: (await snapshotOf(id)).idMal, status: 'PLANNING' }));
  if (added) await updateSequels([id], 'removed');
  await chrome.notifications.update(notificationId, { message });
}

/** Clic sur le corps de la notification : la fiche de la suite, ou Activité pour la notification groupée */
export async function handleSequelClick(notificationId: string): Promise<void> {
  try {
    await chrome.notifications.clear(notificationId);
    if (notificationId.startsWith(GROUP_PREFIX)) return await openGroup();
    await chrome.tabs.create({ url: (await snapshotOf(Number(notificationId.slice(SEQUEL_NOTIFICATION_PREFIX.length)))).siteUrl });
  } catch (error) {
    log.error('Ouverture impossible :', error);
  }
}

/** Boutons : suite seule 0 = ajouter, 1 = ouvrir ; groupée 0 = ouvrir Activité */
export async function handleSequelButton(notificationId: string, buttonIndex: number): Promise<void> {
  if (notificationId.startsWith(GROUP_PREFIX)) return buttonIndex === 0 ? handleSequelClick(notificationId) : undefined;
  if (buttonIndex === 1) return handleSequelClick(notificationId);
  if (buttonIndex !== 0) return;
  try {
    await addToPlanning(notificationId, Number(notificationId.slice(SEQUEL_NOTIFICATION_PREFIX.length)));
  } catch (error) {
    log.error('Ajout depuis la notification impossible :', error);
  }
}
