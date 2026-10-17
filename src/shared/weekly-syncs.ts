// « Synchro cette semaine » du menu du compte (module pur, testé) : épisodes que SyncKai a synchronisés vers chaque
// service pendant la semaine civile en cours, du lundi au dimanche en heure locale (comme l'Agenda). Un compteur par
// service, lié à la session qui l'a écrit (génération) : une reconnexion, même à un autre compte, repart de zéro.
// Les dernières synchros (5 au plus) ne suffisent pas à compter une semaine.
import { weekRange } from './agenda';
import { isRecord } from './guards';
import type { SessionEpochs } from './session-epochs';
import { TRACKER_IDS, type TrackerId } from './tracker.types';

export interface WeeklySyncCount {
  /** Lundi de la semaine comptée (date locale AAAA-MM-JJ) */
  weekStart: string;
  count: number;
  /** Génération de la session du service qui a écrit le compteur */
  epoch: number;
}

export type WeeklySyncs = Partial<Record<TrackerId, WeeklySyncCount>>;

/** Plafond du compteur (valeur bornée, jamais atteint en pratique) */
export const MAX_WEEKLY_SYNCS = 10_000;

/** Lundi de la semaine de `now`, en date locale */
export function currentWeekStart(now: number): string {
  return weekRange(now, 1).key;
}

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0;

function isWeeklySyncCount(value: unknown): value is WeeklySyncCount {
  return isRecord(value) && typeof value.weekStart === 'string' && isCount(value.count) && isCount(value.epoch);
}

/** Parts lisibles de la valeur enregistrée (une part illisible est ignorée, les autres restent) */
function readWeeklySyncs(raw: unknown): WeeklySyncs {
  const parts: WeeklySyncs = {};
  if (!isRecord(raw)) return parts;
  for (const service of TRACKER_IDS) {
    const part = raw[service];
    if (isWeeklySyncCount(part)) parts[service] = part;
  }
  return parts;
}

/** Épisodes synchronisés cette semaine vers `service` par la session `epoch` (0 : autre semaine, autre session, rien) */
export function weeklySyncCount(raw: unknown, service: TrackerId, epoch: number | undefined, now: number): number {
  const part = readWeeklySyncs(raw)[service];
  return part !== undefined && epoch !== undefined && part.epoch === epoch && part.weekStart === currentWeekStart(now) ? part.count : 0;
}

/**
 * Un épisode de plus pour chaque service de `services` dont la session est relevée dans `epochs` (sessions ouvertes,
 * vérifiées par l'appelant) ; une autre semaine ou une autre session repart de zéro
 */
export function addWeeklySyncs(raw: unknown, services: readonly TrackerId[], epochs: SessionEpochs, now: number): WeeklySyncs {
  const next = readWeeklySyncs(raw);
  const weekStart = currentWeekStart(now);
  for (const service of services) {
    const epoch = epochs[service];
    if (epoch === undefined) continue;
    const count = weeklySyncCount(next, service, epoch, now);
    next[service] = { weekStart, count: Math.min(count + 1, MAX_WEEKLY_SYNCS), epoch };
  }
  return next;
}

/** Parts des sessions encore ouvertes (purge à la déconnexion d'un service) */
export function openWeeklySyncs(raw: unknown, open: SessionEpochs): WeeklySyncs {
  const parts = readWeeklySyncs(raw);
  return Object.fromEntries(TRACKER_IDS.flatMap((service) => (parts[service] !== undefined && parts[service].epoch === open[service] ? [[service, parts[service]]] : [])));
}
