import type { TrackerId } from '../../shared/tracker.types';

/**
 * Verrou par fiche d'une liste (AniList ou MAL) : sérialise la séquence lecture → décision → écriture de tous
 * les chemins (synchro en direct, relance de la file, +1/−1, statut, ajout, note, revisionnage, import Crunchyroll,
 * alignement). Sans lui, deux chemins lisent la même progression et le dernier écrit l'emporte : E5 relancé par
 * la file après E7 en direct ferait reculer la fiche à 5, deux +1 simultanés n'en compteraient qu'un.
 *
 * Web Locks : verrou commun à toute l'origine chrome-extension:// (service worker et pages). Toutes les
 * écritures passent aujourd'hui par le service worker ; une page qui écrirait un jour serait aussi coordonnée.
 *
 * Ordre des verrous (jamais l'inverse, sinon interblocage) :
 *   file (`synckai:sync-queue-item:*`) → fiche (ce verrou) → renouvellement MAL → stockage (`synckai:storage`).
 * - Le verrou du stockage peut être pris SOUS ce verrou (ex : `markSeriesStale` après une écriture) ; ce verrou ne
 *   doit jamais être demandé depuis une tâche `withStorageLock`.
 * - Non réentrant : une seule prise par chemin (au niveau de l'écriture sur UN service), jamais dans un appelant
 *   qui détient déjà la même fiche. Une tâche ne verrouille qu'une fiche à la fois.
 * - Tâches de fond : créneaux d'écriture et budget AniList (`waitWriteSlot`, `waitReadSlot`) pris AVANT le verrou,
 *   pour ne jamais retenir la fiche pendant une attente de quota (un +1 du popup sur la même série n'attend pas).
 *   Sous le verrou, seules restent les requêtes elles-mêmes (bornées par le délai d'expiration des requêtes).
 */
export function entryLockName(service: TrackerId, id: number): string {
  return `synckai:entry:${service}:${id}`;
}

export function withEntryLock<T>(service: TrackerId, id: number, task: () => Promise<T>): Promise<T> {
  return navigator.locks.request(entryLockName(service, id), task);
}
