// Correspondances épisode → fiche (`mediaMappings`) : lectures et écritures conditionnelles.
import { isRecord } from '../../shared/guards';
import { isMediaMapping, type MediaMapping } from '../../shared/sync.types';
import { STORAGE_KEYS } from '../../protocol/storage-keys';
import { withStorageLock } from './lock';

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

/** Ajoute ou remplace la correspondance de la clé (les autres entrées, même illisibles, restent intactes). */
export function saveMediaMapping(key: string, mapping: MediaMapping): Promise<void> {
  return withStorageLock(async () => {
    const raw = await readRawMappings();
    await chrome.storage.local.set({ [STORAGE_KEYS.mediaMappings]: { ...raw, [key]: mapping } });
  });
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
 * jamais par-dessus un choix de l'utilisateur (`chosen`) quand `next` n'en est pas un. Retourne true si écrite.
 */
export function saveMediaMappingIf(key: string, expected: MediaMapping | null, next: MediaMapping): Promise<boolean> {
  return withStorageLock(async () => {
    const raw = await readRawMappings();
    const current = readableMappings(raw)[key] ?? null;
    if (!sameMapping(current, expected) || (current?.chosen === true && next.chosen !== true)) return false;
    await chrome.storage.local.set({ [STORAGE_KEYS.mediaMappings]: { ...raw, [key]: next } });
    return true;
  });
}

/** Suppression automatique décidée hors verrou : seulement si la correspondance est toujours celle lue. Retourne true si supprimée. */
export function deleteMediaMappingIf(key: string, expected: MediaMapping): Promise<boolean> {
  return withStorageLock(async () => {
    const raw = await readRawMappings();
    if (!sameMapping(readableMappings(raw)[key] ?? null, expected)) return false;
    const { [key]: _removed, ...rest } = raw;
    await chrome.storage.local.set({ [STORAGE_KEYS.mediaMappings]: rest });
    return true;
  });
}

/**
 * Enregistre en une seule écriture les correspondances dont la clé n'en a pas encore de lisible (import : jamais
 * d'écrasement d'une correspondance existante, apprise ou corrigée par l'utilisateur). Retourne le nombre ajouté.
 */
export function saveMediaMappingsIfAbsent(entries: readonly { key: string; mapping: MediaMapping }[]): Promise<number> {
  if (entries.length === 0) return Promise.resolve(0);
  return withStorageLock(async () => {
    const raw = await readRawMappings();
    const known = readableMappings(raw);
    const added = entries.filter(({ key }, i) => !Object.hasOwn(known, key) && entries.findIndex((e) => e.key === key) === i);
    if (added.length > 0) await chrome.storage.local.set({ [STORAGE_KEYS.mediaMappings]: { ...raw, ...Object.fromEntries(added.map(({ key, mapping }) => [key, mapping])) } });
    return added.length;
  });
}

export function deleteMediaMapping(key: string): Promise<void> {
  return withStorageLock(async () => {
    const raw = await readRawMappings();
    if (!Object.hasOwn(raw, key)) return;
    const { [key]: _removed, ...rest } = raw;
    await chrome.storage.local.set({ [STORAGE_KEYS.mediaMappings]: rest });
  });
}

/** Supprime les correspondances dont la clé commence par `prefix` (ex : `netflix:`), même illisibles ; retourne leur nombre. */
export function deleteMediaMappingsByPrefix(prefix: string): Promise<number> {
  return withStorageLock(async () => {
    const raw = await readRawMappings();
    const kept = Object.fromEntries(Object.entries(raw).filter(([key]) => !key.startsWith(prefix)));
    const removed = Object.keys(raw).length - Object.keys(kept).length;
    if (removed > 0) await chrome.storage.local.set({ [STORAGE_KEYS.mediaMappings]: kept });
    return removed;
  });
}

/**
 * Supprime les correspondances jugées fausses après une vérification réseau faite hors verrou : seulement celles dont
 * la fiche et le libellé n'ont pas changé depuis leur lecture (une correspondance réécrite entre-temps est gardée).
 * Entrées illisibles conservées (ARCH-15). Retourne le nombre supprimé.
 */
export function deleteMediaMappingsIfUnchanged(expected: Readonly<Record<string, Pick<MediaMapping, 'mediaId' | 'seriesLabel'>>>): Promise<number> {
  return withStorageLock(async () => {
    const raw = await readRawMappings();
    const removed = Object.entries(expected).filter(([key, read]) => {
      const current = raw[key];
      return isMediaMapping(current) && current.mediaId === read.mediaId && current.seriesLabel === read.seriesLabel;
    });
    if (removed.length === 0) return 0;
    for (const [key] of removed) delete raw[key];
    await chrome.storage.local.set({ [STORAGE_KEYS.mediaMappings]: raw });
    return removed.length;
  });
}

export function clearMediaMappings(): Promise<void> {
  return withStorageLock(() => chrome.storage.local.remove(STORAGE_KEYS.mediaMappings));
}
