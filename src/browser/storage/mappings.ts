// Correspondances épisode → fiche (`mediaMappings`) : lectures et écritures conditionnelles. Une seule écriture sans
// condition, celle d'un choix de l'utilisateur (saveChosen) ; l'origine stockée (`learned`, `chosen`) est posée ici.
import { isRecord } from '../../shared/guards';
import { isMediaMapping, mappingOrigin, withOrigin, type MappingOrigin, type MediaMapping } from '../../shared/sync.types';
import { STORAGE_KEYS } from '../../protocol/storage-keys';
import { createLogger } from '../logger';
import { withStorageLock } from './lock';

const log = createLogger('storage');

/**
 * Abonnés prévenus après chaque écriture faite dans ce contexte (pas un événement chrome : le service worker n'écoute pas
 * storage.onChanged, PERF-17). Le service worker y oublie ses résolutions de page en mémoire (page-media.ts, L4) ; une page
 * de l'extension qui modifie les correspondances l'en prévient par le message MAPPINGS_CHANGED.
 */
const writeListeners = new Set<() => void>();

/** Appelé après chaque écriture des correspondances faite dans ce contexte ; retourne la fonction de désabonnement */
export function onMappingsWritten(listener: () => void): () => void {
  writeListeners.add(listener);
  return () => void writeListeners.delete(listener);
}

function notifyWritten(): void {
  for (const listener of [...writeListeners]) {
    try {
      listener();
    } catch (error: unknown) {
      // Un abonné fautif n'annule ni l'écriture ni les autres abonnés
      log.warn('Abonné aux correspondances en échec :', error);
    }
  }
}

/** Exécute `write` sous le verrou, puis prévient les abonnés si `changed` dit qu'elle a modifié le stockage */
async function lockedWrite<T>(write: () => Promise<T>, changed: (result: T) => boolean): Promise<T> {
  const result = await withStorageLock(write);
  if (changed(result)) notifyWritten();
  return result;
}

/** Copie de l'objet brut du stockage, entrées illisibles comprises */
async function readRawMappings(): Promise<Record<string, unknown>> {
  const raw: unknown = (await chrome.storage.local.get(STORAGE_KEYS.mediaMappings))[STORAGE_KEYS.mediaMappings];
  return isRecord(raw) && !Array.isArray(raw) ? { ...raw } : {};
}

function readableMappings(raw: Record<string, unknown>): Record<string, MediaMapping> {
  return Object.fromEntries(Object.entries(raw).filter((entry): entry is [string, MediaMapping] => isMediaMapping(entry[1])));
}

export async function getMediaMappings(): Promise<Record<string, MediaMapping>> {
  return readableMappings(await readRawMappings());
}

export async function getMediaMapping(key: string): Promise<MediaMapping | null> {
  return (await getMediaMappings())[key] ?? null;
}

/**
 * Choix de l'utilisateur (saison choisie dans le sélecteur, carte « À vérifier » validée) : toujours écrit, par-dessus toute
 * correspondance de la clé, avec l'origine choisie (les autres entrées, même illisibles, restent intactes).
 */
export async function saveChosen(key: string, mapping: MediaMapping): Promise<void> {
  await lockedWrite(async () => {
    const raw = await readRawMappings();
    await chrome.storage.local.set({ [STORAGE_KEYS.mediaMappings]: { ...raw, [key]: withOrigin(mapping, 'chosen') } });
  }, () => true);
}

/** Même correspondance, champ par champ (null : absente ou illisible) */
function sameMapping(a: MediaMapping | null, b: MediaMapping | null): boolean {
  if (a === null || b === null) return a === b;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof MediaMapping>;
  return [...keys].every((key) => a[key] === b[key]);
}

/**
 * Écriture automatique préparée hors verrou, après des requêtes réseau (correspondance apprise, total complété, import
 * confirmé) : faite seulement si la correspondance de la clé est toujours celle lue (`expected`, null : absente), et
 * jamais par-dessus un choix de l'utilisateur, sauf pour le garder (`origin` choisie). `origin` : apprise par défaut, ou
 * celle de la correspondance relue que l'appelant complète (total du catalogue, import confirmé). Retourne true si écrite.
 */
export function saveLearned(key: string, expected: MediaMapping | null, mapping: MediaMapping, origin: MappingOrigin = 'learned'): Promise<boolean> {
  return lockedWrite(async () => {
    const raw = await readRawMappings();
    const current = readableMappings(raw)[key] ?? null;
    if (!sameMapping(current, expected) || (current !== null && mappingOrigin(current) === 'chosen' && origin !== 'chosen')) return false;
    await chrome.storage.local.set({ [STORAGE_KEYS.mediaMappings]: { ...raw, [key]: withOrigin(mapping, origin) } });
    return true;
  }, (written) => written);
}

/** Suppression automatique décidée hors verrou : seulement si la correspondance est toujours celle lue. Retourne true si supprimée. */
export function forgetIfUnchanged(key: string, expected: MediaMapping): Promise<boolean> {
  return lockedWrite(async () => {
    const raw = await readRawMappings();
    if (!sameMapping(readableMappings(raw)[key] ?? null, expected)) return false;
    const { [key]: _removed, ...rest } = raw;
    await chrome.storage.local.set({ [STORAGE_KEYS.mediaMappings]: rest });
    return true;
  }, (removed) => removed);
}

/**
 * Enregistre en une seule écriture les correspondances dont la clé n'en a pas encore de lisible (import : jamais
 * d'écrasement d'une correspondance existante, apprise ou corrigée par l'utilisateur). Retourne le nombre ajouté.
 */
export function saveMediaMappingsIfAbsent(entries: readonly { key: string; mapping: MediaMapping }[]): Promise<number> {
  if (entries.length === 0) return Promise.resolve(0);
  return lockedWrite(async () => {
    const raw = await readRawMappings();
    const known = readableMappings(raw);
    const added = entries.filter(({ key }, i) => !Object.hasOwn(known, key) && entries.findIndex((e) => e.key === key) === i);
    if (added.length > 0) await chrome.storage.local.set({ [STORAGE_KEYS.mediaMappings]: { ...raw, ...Object.fromEntries(added.map(({ key, mapping }) => [key, mapping])) } });
    return added.length;
  }, (added) => added > 0);
}

/** « Oublier » (Réglages › Mes données) : retire la correspondance de la clé, illisible comprise */
export async function forgetMapping(key: string): Promise<void> {
  await lockedWrite(async () => {
    const raw = await readRawMappings();
    if (!Object.hasOwn(raw, key)) return false;
    const { [key]: _removed, ...rest } = raw;
    await chrome.storage.local.set({ [STORAGE_KEYS.mediaMappings]: rest });
    return true;
  }, (removed) => removed);
}

/** Supprime les correspondances dont la clé commence par `prefix` (ex : `netflix:`), même illisibles ; retourne leur nombre. */
export function deleteMediaMappingsByPrefix(prefix: string): Promise<number> {
  return lockedWrite(async () => {
    const raw = await readRawMappings();
    const kept = Object.fromEntries(Object.entries(raw).filter(([key]) => !key.startsWith(prefix)));
    const removed = Object.keys(raw).length - Object.keys(kept).length;
    if (removed > 0) await chrome.storage.local.set({ [STORAGE_KEYS.mediaMappings]: kept });
    return removed;
  }, (removed) => removed > 0);
}

/**
 * Supprime les correspondances jugées fausses après une vérification réseau faite hors verrou : seulement celles dont
 * la fiche et le libellé n'ont pas changé depuis leur lecture (une correspondance réécrite entre-temps est gardée).
 * Entrées illisibles conservées (ARCH-15). Retourne le nombre supprimé.
 */
export function deleteMediaMappingsIfUnchanged(expected: Readonly<Record<string, Pick<MediaMapping, 'mediaId' | 'seriesLabel'>>>): Promise<number> {
  return lockedWrite(async () => {
    const raw = await readRawMappings();
    const removed = Object.entries(expected).filter(([key, read]) => {
      const current = raw[key];
      return isMediaMapping(current) && current.mediaId === read.mediaId && current.seriesLabel === read.seriesLabel;
    });
    if (removed.length === 0) return 0;
    for (const [key] of removed) delete raw[key];
    await chrome.storage.local.set({ [STORAGE_KEYS.mediaMappings]: raw });
    return removed.length;
  }, (removed) => removed > 0);
}

export function clearMediaMappings(): Promise<void> {
  return lockedWrite(() => chrome.storage.local.remove(STORAGE_KEYS.mediaMappings), () => true);
}
