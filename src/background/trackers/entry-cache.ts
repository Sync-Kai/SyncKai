import type { TrackerId } from '../../shared/tracker.types';
import type { TrackerEntry } from '../ports/tracker';

// Entrées de liste lues pour l'AFFICHAGE (fiche de la page : carte « Sur cette page », panneau), gardées brièvement en
// mémoire du service worker : changer de saison dans le menu d'une page de série relit les mêmes fiches (Attack on Titan,
// 2026-10-15 : 4 choix de saison ont épuisé la limite AniList). Jamais servies à un autre compte (empreinte du compte,
// voir accountFingerprint), oubliées à toute écriture sur le service (trackers/index.ts), et jamais lues avant une
// écriture : la synchro et les actions relisent toujours l'entrée fraîche (tracker.getEntry).

/** Durée de vie d'une entrée (modification faite sur le site du service : vue au plus tard après ce délai) */
export const ENTRY_CACHE_TTL_MS = 2 * 60_000;
const MAX_ENTRIES = 200;

interface CachedEntry {
  at: number;
  account: string;
  value: TrackerEntry;
}

const entries = new Map<string, CachedEntry>();
/** Incrémenté à chaque écriture : une lecture partie avant n'est pas rangée (elle peut précéder l'écriture) */
const generations: Record<TrackerId, number> = { anilist: 0, mal: 0 };

const keyOf = (service: TrackerId, id: number): string => `${service}:${id}`;

/** Génération courante du service, à relever AVANT la requête de lecture */
export function entryGeneration(service: TrackerId): number {
  return generations[service];
}

/** Entrée gardée pour ce compte, encore valable ; undefined sinon */
export function readCachedEntry(service: TrackerId, account: string, id: number, now: number = Date.now()): TrackerEntry | undefined {
  const hit = entries.get(keyOf(service, id));
  if (!hit) return undefined;
  if (hit.account !== account || now - hit.at > ENTRY_CACHE_TTL_MS) {
    entries.delete(keyOf(service, id));
    return undefined;
  }
  return hit.value;
}

/** Range une entrée lue, sauf si une écriture a eu lieu depuis `generation` */
export function storeCachedEntry(service: TrackerId, account: string, id: number, value: TrackerEntry, generation: number): void {
  if (generation !== generations[service]) return;
  const key = keyOf(service, id);
  entries.delete(key);
  entries.set(key, { at: Date.now(), account, value });
  // Plus ancienne entrée retirée au-delà de la limite (ordre d'insertion de la Map)
  if (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value ?? '');
}

/**
 * Écriture sur le service (progression, statut, note, commentaire, retrait, alignement) : toutes ses entrées oubliées.
 * Toutes, pas seulement la fiche écrite : MAL et AniList ne partagent pas leurs identifiants, et une écriture est rare.
 */
export function forgetCachedEntries(service: TrackerId): void {
  generations[service]++;
  for (const key of [...entries.keys()]) if (key.startsWith(`${service}:`)) entries.delete(key);
}

/** Vide tout (tests) */
export function clearEntryCache(): void {
  entries.clear();
  generations.anilist++;
  generations.mal++;
}
