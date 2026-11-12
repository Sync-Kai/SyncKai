import { withStorageLock } from '../../browser/storage/lock';
import { STORAGE_KEYS } from '../../protocol/storage-keys';
import { getOpenSessions } from '../../browser/storage/sessions';
import { isRecoBatch, MAX_DISMISSED } from '../../shared/recommendations';
import type { TrackerId } from '../../shared/tracker.types';
import { forgetTouched, noteTouched } from './touched';

// UPDATE_RECOMMENDATION et RESTORE_RECOMMENDATIONS : écritures sous le verrou du stockage, sans requête réseau.

const isIdList = (value: unknown): value is number[] => Array.isArray(value) && value.every((v) => typeof v === 'number');

/** Écartées : liste de l'utilisateur (les deux comptes), 500 au plus, les plus anciennes sortent en premier */
const withDismissed = (list: readonly number[], id: number): number[] => [...list.filter((v) => v !== id), id].slice(-MAX_DISMISSED);

/**
 * `added` / `dismissed` : la suggestion quitte le lot enregistré (un GET en cache ne la renvoie plus) ; `dismissed` l'ajoute
 * aux écartées ; `undo` la retire des écartées (la page garde la fiche en mémoire). Le lot n'est réécrit que s'il existe :
 * un compte déconnecté entre-temps (lot effacé sous le même verrou) n'est jamais recréé.
 */
export function updateRecommendation(id: number, action: 'added' | 'dismissed' | 'undo'): Promise<boolean> {
  return withStorageLock(async () => {
    // Plus aucune session : les écartées ont été purgées à la dernière déconnexion, jamais recréées ici
    if (Object.keys(await getOpenSessions()).length === 0) return false;
    if (action === 'undo') forgetTouched(id);
    else noteTouched('anilist', id);
    const stored = await chrome.storage.local.get([STORAGE_KEYS.recoBatch, STORAGE_KEYS.recoDismissed]);
    const changes: Record<string, unknown> = {};
    const batch: unknown = stored[STORAGE_KEYS.recoBatch];
    if (action !== 'undo' && isRecoBatch(batch)) {
      changes[STORAGE_KEYS.recoBatch] = { ...batch, items: batch.items.filter((i) => i.card.id !== id) };
    }
    const raw: unknown = stored[STORAGE_KEYS.recoDismissed];
    const list = isIdList(raw) ? raw : [];
    if (action === 'dismissed') changes[STORAGE_KEYS.recoDismissed] = withDismissed(list, id);
    if (action === 'undo') changes[STORAGE_KEYS.recoDismissed] = list.filter((v) => v !== id);
    await chrome.storage.local.set(changes);
    return true;
  });
}

/** Réglages › Mes données : les écartées reviennent ; le lot en cache les excluait, il est recalculé à la prochaine demande */
export function restoreRecommendations(): Promise<boolean> {
  return withStorageLock(async () => {
    if (Object.keys(await getOpenSessions()).length === 0) return false;
    await chrome.storage.local.remove([STORAGE_KEYS.recoDismissed, STORAGE_KEYS.recoBatch]);
    return true;
  });
}

/** Retire du lot enregistré les suggestions touchées pendant son calcul (écriture du calcul passée entre-temps) */
export function purgeStoredBatch(ids: ReadonlySet<number>): Promise<void> {
  return withStorageLock(async () => {
    const batch: unknown = (await chrome.storage.local.get(STORAGE_KEYS.recoBatch))[STORAGE_KEYS.recoBatch];
    if (isRecoBatch(batch)) await chrome.storage.local.set({ [STORAGE_KEYS.recoBatch]: { ...batch, items: batch.items.filter((i) => !ids.has(i.card.id)) } });
  });
}

/**
 * Série écrite dans une liste par SyncKai (ajout, synchro, import) : elle quitte le lot enregistré, comme `added`.
 * `id` : identifiant de la fiche sur le service (AniList : id de la fiche ; MyAnimeList : idMal). Sans lot enregistré,
 * ou fiche absente du lot : une lecture, aucune écriture. Aussi notée pour un lot en cours de calcul (par idMal pour MyAnimeList).
 */
export function dropSuggestion(service: TrackerId, id: number): Promise<void> {
  noteTouched(service, id);
  return withStorageLock(async () => {
    const batch: unknown = (await chrome.storage.local.get(STORAGE_KEYS.recoBatch))[STORAGE_KEYS.recoBatch];
    if (!isRecoBatch(batch)) return;
    const items = batch.items.filter((i) => (service === 'anilist' ? i.card.id : i.card.idMal) !== id);
    if (items.length < batch.items.length) await chrome.storage.local.set({ [STORAGE_KEYS.recoBatch]: { ...batch, items } });
  });
}
