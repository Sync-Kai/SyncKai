// Marques « Garder » des séries dormantes (règles : shared/dormant.ts) : par service, liées à la session qui les a écrites
// (génération), retirées à la déconnexion du service (purgeClosedSessions). Non incluses dans les sauvegardes.
import { isRecord } from '../../shared/guards';
import type { KeepMark } from '../../shared/dormant';
import type { SessionEpochs } from '../../shared/session-epochs';
import { TRACKER_IDS, type TrackerId } from '../../shared/tracker.types';
import { STORAGE_KEYS } from '../../protocol/storage-keys';
import { withStorageLock } from './lock';
import { getOpenSessions } from './sessions';

/** Nombre maximal de marques par service : au-delà, la plus ancienne est retirée */
export const MAX_KEEP_MARKS = 200;

interface KeepPart {
  epoch: number;
  marks: Record<string, KeepMark>;
}

type KeepStore = Partial<Record<TrackerId, KeepPart>>;

const isKeepMark = (value: unknown): value is KeepMark => isRecord(value) && typeof value.keptAt === 'number' && Number.isFinite(value.keptAt);

/** Parts lisibles de la valeur enregistrée (une marque ou une part illisible est ignorée, le reste est gardé) */
function readStore(raw: unknown): KeepStore {
  const store: KeepStore = {};
  if (!isRecord(raw)) return store;
  for (const service of TRACKER_IDS) {
    const part = raw[service];
    if (!isRecord(part) || typeof part.epoch !== 'number' || !isRecord(part.marks)) continue;
    const marks: Record<string, KeepMark> = {};
    for (const [key, mark] of Object.entries(part.marks)) if (isKeepMark(mark)) marks[key] = { keptAt: mark.keptAt };
    store[service] = { epoch: part.epoch, marks };
  }
  return store;
}

/** Parts des sessions encore ouvertes (purge à la déconnexion d'un service) */
export function openKeepMarks(raw: unknown, open: SessionEpochs): KeepStore {
  const store = readStore(raw);
  return Object.fromEntries(TRACKER_IDS.flatMap((service) => (store[service] !== undefined && store[service].epoch === open[service] ? [[service, store[service]]] : [])));
}

/** Marques de la session ouverte de `service` (rien sans session ou si la part vient d'une autre session) */
export async function readKeepMarks(service: TrackerId): Promise<Record<string, KeepMark>> {
  const [stored, open] = await Promise.all([chrome.storage.local.get(STORAGE_KEYS.watchingKeptDormant), getOpenSessions()]);
  const part = readStore(stored[STORAGE_KEYS.watchingKeptDormant])[service];
  return part !== undefined && part.epoch === open[service] ? part.marks : {};
}

/** Garde la série `entryKey` hors du groupe dormant (sous le verrou, 200 marques au plus : la plus ancienne est retirée) */
export function keepDormant(service: TrackerId, entryKey: string, now: number): Promise<void> {
  return withStorageLock(async () => {
    const open = await getOpenSessions();
    const epoch = open[service];
    if (epoch === undefined) return;
    const raw: unknown = (await chrome.storage.local.get(STORAGE_KEYS.watchingKeptDormant))[STORAGE_KEYS.watchingKeptDormant];
    const store = readStore(raw);
    const previous = store[service];
    const marks: Record<string, KeepMark> = previous !== undefined && previous.epoch === epoch ? { ...previous.marks } : {};
    delete marks[entryKey];
    marks[entryKey] = { keptAt: now };
    // Les plus récentes d'abord : on garde les MAX_KEEP_MARKS premières
    const newest = Object.entries(marks).sort((a, b) => b[1].keptAt - a[1].keptAt).slice(0, MAX_KEEP_MARKS);
    store[service] = { epoch, marks: Object.fromEntries(newest) };
    await chrome.storage.local.set({ [STORAGE_KEYS.watchingKeptDormant]: store });
  });
}
