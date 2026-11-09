import { withStorageLock } from '../../browser/storage/lock';
import { STORAGE_KEYS } from '../../protocol/storage-keys';
import { MAX_DISMISSED, type RecoBatch } from '../../shared/recommendations';

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
    const stored = await chrome.storage.local.get([STORAGE_KEYS.recoBatch, STORAGE_KEYS.recoDismissed]);
    const changes: Record<string, unknown> = {};
    const batch = stored[STORAGE_KEYS.recoBatch] as RecoBatch | undefined;
    if (action !== 'undo' && batch && Array.isArray(batch.items)) {
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
    await chrome.storage.local.remove([STORAGE_KEYS.recoDismissed, STORAGE_KEYS.recoBatch]);
    return true;
  });
}
