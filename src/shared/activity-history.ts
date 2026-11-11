// Historique local de l'activité (écran Stats, module pur, testé) : épisodes que SyncKai a synchronisés et leurs
// minutes, par jour local (AAAA-MM-JJ, comme l'Agenda), par service, avec l'identifiant du compte qui les a écrits.
// 400 jours au plus. Une part d'un autre compte n'est jamais montrée (sauvegarde d'un autre compte, reconnexion à un
// autre compte avant la relecture du profil) et elle est remplacée à la première écriture.
import { dateKey, parseDateKey } from './agenda';
import { isRecord } from './guards';
import { isTrackerId, TRACKER_IDS, type TrackerId } from './tracker.types';

export const ACTIVITY_DAYS = 400;
/** Plafond d'un jour (valeur bornée, jamais atteint en pratique) */
export const MAX_DAY_EPISODES = 10_000;

/** [épisodes, minutes] du jour */
export type ActivityDay = readonly [episodes: number, minutes: number];
export interface ActivityPart {
  accountId: number;
  days: Readonly<Record<string, ActivityDay>>;
}
export type ActivityHistory = Partial<Record<TrackerId, ActivityPart>>;
export type StatsPeriod = '7d' | '30d' | '12m' | 'all';
export interface ActivityBar {
  key: string;
  episodes: number;
  minutes: number;
}
export interface ActivitySummary {
  episodes: number;
  minutes: number;
  firstDay: string | null;
  unit: 'day' | 'month';
  bars: ActivityBar[];
}

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0;
const isAccountId = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value > 0;

function isActivityDay(value: unknown): value is ActivityDay {
  return Array.isArray(value) && value.length === 2 && isCount(value[0]) && value[0] <= MAX_DAY_EPISODES && isCount(value[1]);
}

/** Sauvegarde : comme readActivityHistory, avec le nombre de parts et de jours ignorés */
export function parseActivityHistory(raw: unknown): { value: ActivityHistory; invalid: number } {
  const value: ActivityHistory = {};
  if (raw === undefined) return { value, invalid: 0 };
  if (!isRecord(raw) || Array.isArray(raw)) return { value, invalid: 1 };
  let invalid = 0;
  for (const [service, part] of Object.entries(raw)) {
    if (!isTrackerId(service) || !isRecord(part) || !isAccountId(part.accountId) || !isRecord(part.days) || Array.isArray(part.days)) {
      invalid++;
      continue;
    }
    // Clés validées (date réelle) : une clé "__proto__" n'est jamais retenue
    const days: Record<string, ActivityDay> = {};
    for (const [key, day] of Object.entries(part.days)) {
      if (parseDateKey(key) !== null && isActivityDay(day)) days[key] = [day[0], day[1]];
      else invalid++;
    }
    value[service] = { accountId: part.accountId, days };
  }
  return { value, invalid };
}

/** Valeur du stockage : parts et jours illisibles ignorés */
export function readActivityHistory(raw: unknown): ActivityHistory {
  return parseActivityHistory(raw).value;
}

/** Jour local de `now` décalé de `offset` jours de calendrier (un jour fait 23 h ou 25 h au changement d'heure) */
function dayKeyFrom(now: number, offset: number): string {
  const date = new Date(now);
  return dateKey(new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset));
}

/** Mois local AAAA-MM de `now` décalé de `offset` mois */
function monthKeyFrom(now: number, offset: number): string {
  const date = new Date(now);
  return dateKey(new Date(date.getFullYear(), date.getMonth() + offset, 1)).slice(0, 7);
}

/** Jours des 400 derniers jours (aujourd'hui compris) et futurs ; les plus anciens retirés */
function pruned(days: Readonly<Record<string, ActivityDay>>, now: number): Record<string, ActivityDay> {
  const oldest = dayKeyFrom(now, 1 - ACTIVITY_DAYS);
  return Object.fromEntries(Object.entries(days).filter(([key]) => key >= oldest));
}

/** +1 épisode et +minutes au jour de `now` pour chaque écriture ; part d'un autre compte remplacée ; jours de plus de 400 jours retirés */
export function addActivity(raw: unknown, writes: readonly { service: TrackerId; accountId: number }[], minutes: number, now: number): ActivityHistory {
  const next = readActivityHistory(raw);
  const today = dayKeyFrom(now, 0);
  const added = Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : 0;
  for (const { service, accountId } of writes) {
    const part = next[service];
    const days = part !== undefined && part.accountId === accountId ? { ...part.days } : {};
    const [episodes, total] = days[today] ?? [0, 0];
    if (episodes < MAX_DAY_EPISODES) days[today] = [episodes + 1, total + added];
    next[service] = { accountId, days };
  }
  for (const service of TRACKER_IDS) {
    const part = next[service];
    if (part !== undefined) next[service] = { accountId: part.accountId, days: pruned(part.days, now) };
  }
  return next;
}

/** Part de `service` retirée si elle appartient à un autre compte ; null si rien ne change */
export function withoutOtherAccount(raw: unknown, service: TrackerId, accountId: number): ActivityHistory | null {
  const history = readActivityHistory(raw);
  const part = history[service];
  if (part === undefined || part.accountId === accountId) return null;
  delete history[service];
  return history;
}

/** replace : l'entrant ; merge : même compte → maximum par jour et par champ, autre compte → l'existant l'emporte, part absente → l'entrant */
export function mergeActivityHistory(current: ActivityHistory, incoming: ActivityHistory, mode: 'merge' | 'replace'): ActivityHistory {
  if (mode === 'replace') return incoming;
  const merged: ActivityHistory = {};
  for (const service of TRACKER_IDS) {
    const mine = current[service];
    const theirs = incoming[service];
    if (mine === undefined || theirs === undefined || mine.accountId !== theirs.accountId) {
      const kept = mine ?? theirs;
      if (kept !== undefined) merged[service] = kept;
      continue;
    }
    const days: Record<string, ActivityDay> = { ...theirs.days };
    for (const [key, [episodes, minutes]] of Object.entries(mine.days)) {
      const other = days[key];
      days[key] = other === undefined ? [episodes, minutes] : [Math.max(episodes, other[0]), Math.max(minutes, other[1])];
    }
    merged[service] = { accountId: mine.accountId, days };
  }
  return merged;
}

/**
 * Part d'un autre compte (ou accountId null) : résumé vide. 7d / 30d : une barre par jour ; 12m : par mois ; all : par
 * mois depuis le premier jour enregistré. Jours futurs ignorés
 */
export function activitySummary(history: ActivityHistory, service: TrackerId, accountId: number | null, period: StatsPeriod, now: number): ActivitySummary {
  const part = history[service];
  const days = part !== undefined && accountId !== null && part.accountId === accountId ? part.days : {};
  const today = dayKeyFrom(now, 0);
  const past = Object.keys(days).filter((key) => key <= today).sort();
  const firstDay = past[0] ?? null;
  const unit = period === '7d' || period === '30d' ? 'day' : 'month';

  // Barres construites pas à pas sur le calendrier local, jamais en retranchant des multiples de 24 h
  let keys: string[];
  if (period === '7d' || period === '30d') {
    const count = period === '7d' ? 7 : 30;
    keys = Array.from({ length: count }, (_, i) => dayKeyFrom(now, i + 1 - count));
  } else if (period === '12m') {
    keys = Array.from({ length: 12 }, (_, i) => monthKeyFrom(now, i - 11));
  } else {
    const first = firstDay !== null ? parseDateKey(firstDay) : null;
    const current = new Date(now);
    const span = first !== null ? (current.getFullYear() - first.getFullYear()) * 12 + current.getMonth() - first.getMonth() : -1;
    keys = Array.from({ length: span + 1 }, (_, i) => monthKeyFrom(now, i - span));
  }

  const bars = new Map<string, ActivityBar>(keys.map((key) => [key, { key, episodes: 0, minutes: 0 }]));
  for (const key of past) {
    const bar = bars.get(unit === 'day' ? key : key.slice(0, 7));
    const day = days[key];
    if (bar === undefined || day === undefined) continue;
    bar.episodes += day[0];
    bar.minutes += day[1];
  }
  const list = [...bars.values()];
  return { episodes: list.reduce((sum, bar) => sum + bar.episodes, 0), minutes: list.reduce((sum, bar) => sum + bar.minutes, 0), firstDay, unit, bars: list };
}
