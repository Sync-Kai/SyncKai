import { getLocale, t, tl, type Locale } from '../i18n';
import type { StreamingPlatform } from './episode.types';
import { STREAMING_PLATFORMS } from './platform-links';
import type { NextEpisodeBadge, PlatformLink, WatchingEntry, WatchingSort } from './watching.types';

// Fonctions pures partagées par le service worker (tri, liens) et le popup (affichage).

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const isFinished = (entry: WatchingEntry): boolean =>
  entry.airingStatus === 'FINISHED' || entry.airingStatus === 'CANCELLED';

/** Nombre d'épisodes déjà sortis, si on peut le déduire (prochain épisode annoncé ou série terminée). */
export function airedEpisodes(entry: WatchingEntry): number | null {
  if (entry.nextEpisode) return entry.nextEpisode.episode - 1;
  if (isFinished(entry) && entry.totalEpisodes) return entry.totalEpisodes;
  return null;
}

/** Délai compact avant une sortie : "12 min", "18 h", "2 j" (arrondi à l'inférieur, minimum 1). */
function formatCountdown(ms: number): string {
  if (ms < HOUR) return t('time.countdown.minutes', { count: Math.max(1, Math.floor(ms / MINUTE)) });
  if (ms < DAY) return t('time.countdown.hours', { count: Math.max(1, Math.floor(ms / HOUR)) });
  return t('time.countdown.days', { count: Math.floor(ms / DAY) });
}

/**
 * Pastille d'état d'une ligne, dans la langue active, à l'instant `now` (ms) — exemples en français :
 * - available : "Ép. 3 disponible" (des épisodes sortis n'ont pas encore été vus)
 * - upcoming  : "Ép. 5 dans 18 h" / "Ép. 3 dans 2 j" / "Ép. 4 dans 12 min",
 *               ou "Prochain épisode bientôt" (série en cours de diffusion sans date à venir connue)
 * - finished  : "Série terminée"
 * - unknown   : "Date inconnue"
 */
export function nextEpisodeBadge(entry: WatchingEntry, now: number): NextEpisodeBadge {
  const next = entry.nextEpisode;
  // Données en cache : un épisode annoncé dont l'heure est passée est considéré comme sorti
  const aired = next && next.airingAt <= now ? next.episode : airedEpisodes(entry);

  if (aired !== null && aired > entry.progress) {
    return { kind: 'available', label: t('watching.badge.available', { episode: entry.progress + 1 }) };
  }
  if (next && next.airingAt > now) {
    return { kind: 'upcoming', label: t('watching.badge.upcoming', { episode: next.episode, delay: formatCountdown(next.airingAt - now) }) };
  }
  if (isFinished(entry)) return { kind: 'finished', label: t('watching.badge.finished') };
  // Diffusion en cours, ou épisode annoncé déjà passé (cache) hors pause : la suite arrive
  if (entry.airingStatus === 'RELEASING' || (next && entry.airingStatus !== 'HIATUS')) {
    return { kind: 'upcoming', label: t('watching.badge.soon') };
  }
  return { kind: 'unknown', label: t('watching.badge.unknown') };
}

const GROUP_ORDER: Record<NextEpisodeBadge['kind'], number> = { available: 0, upcoming: 1, unknown: 2, finished: 3 };

/** Plus récemment mis à jour en tête, dates inconnues en dernier (`|| 0` absorbe le NaN de -∞ - -∞) */
const byUpdatedDesc = (a: WatchingEntry, b: WatchingEntry): number =>
  (b.updatedAt ?? Number.NEGATIVE_INFINITY) - (a.updatedAt ?? Number.NEGATIVE_INFINITY) || 0;

/** Date de sortie à venir, null si inconnue ou déjà passée */
const upcomingAt = (entry: WatchingEntry, now: number): number | null =>
  entry.nextEpisode && entry.nextEpisode.airingAt > now ? entry.nextEpisode.airingAt : null;

/**
 * Tri de l'onglet "En cours" : épisodes disponibles d'abord (le plus récemment mis à jour en tête),
 * puis prochaines sorties (la plus proche en tête), puis sans date, puis séries terminées.
 */
export function sortWatching(entries: readonly WatchingEntry[], now: number): WatchingEntry[] {
  // Pastille calculée une seule fois par entrée ; Array.prototype.sort est stable
  const ranked = entries.map((entry) => ({ entry, group: GROUP_ORDER[nextEpisodeBadge(entry, now).kind] }));
  ranked.sort((a, b) => {
    if (a.group !== b.group) return a.group - b.group;
    if (a.group === GROUP_ORDER.upcoming) {
      // Sortie datée la plus proche en tête ; « bientôt » (sans date à venir) ensuite, par mise à jour
      const da = upcomingAt(a.entry, now);
      const db = upcomingAt(b.entry, now);
      if (da !== null && db !== null) return da - db;
      if (da !== null || db !== null) return da !== null ? -1 : 1;
    }
    return byUpdatedDesc(a.entry, b.entry);
  });
  return ranked.map(({ entry }) => entry);
}

/** Comparateur de titres de la langue active (recréé seulement quand la langue change) */
let collator: { locale: Locale; compare: (a: string, b: string) => number } | null = null;
function compareTitles(a: string, b: string): number {
  const locale = getLocale();
  if (collator?.locale !== locale) collator = { locale, compare: new Intl.Collator(locale, { sensitivity: 'base' }).compare };
  return collator.compare(a, b);
}
const byTitle = (a: WatchingEntry, b: WatchingEntry): number => compareTitles(a.title, b.title);

/** Épisodes restants à voir, null si le total est inconnu */
const remainingEpisodes = (entry: WatchingEntry): number | null =>
  entry.totalEpisodes !== null && entry.totalEpisodes > 0 ? Math.max(0, entry.totalEpisodes - entry.progress) : null;

/** Moins d'épisodes restants en tête ; total inconnu en dernier ; à égalité, par titre */
function byRemaining(a: WatchingEntry, b: WatchingEntry): number {
  const ra = remainingEpisodes(a);
  const rb = remainingEpisodes(b);
  if (ra !== null && rb !== null && ra !== rb) return ra - rb;
  if ((ra === null) !== (rb === null)) return ra === null ? 1 : -1;
  return byTitle(a, b);
}

/** Tri de « Mes séries » selon le mode choisi (nouveau tableau, tri stable). */
export function sortWatchingBy(entries: readonly WatchingEntry[], sort: WatchingSort, now: number): WatchingEntry[] {
  switch (sort) {
    case 'next-episode':
      return sortWatching(entries, now);
    case 'recent':
      return [...entries].sort(byUpdatedDesc);
    case 'title':
      return [...entries].sort(byTitle);
    case 'remaining':
      return [...entries].sort(byRemaining);
  }
}

/**
 * Lien utilisé par « Ouvrir » : la plateforme préférée si l'anime y est, sinon la première disponible.
 * Choix assumé : sans lien connu sur la plateforme préférée, « Ouvrir » ouvre le lien direct de l'autre
 * plateforme plutôt qu'une page de recherche ; la recherche sur la préférée est proposée dans le menu « ⋯ ».
 * null si aucune plateforme connue (le bouton est alors masqué).
 * La pastille de plateforme des jaquettes suit ce lien (même plateforme que « Ouvrir »).
 */
export function choosePlatformLink(entry: Pick<WatchingEntry, 'platforms'>, preferred: StreamingPlatform): PlatformLink | null {
  const byPlatform = (platform: StreamingPlatform): PlatformLink | undefined => entry.platforms.find((link) => link.platform === platform);
  // Repli dans l'ordre fixe des plateformes (Crunchyroll, ADN, puis Netflix), pas dans l'ordre des liens
  for (const platform of [preferred, ...STREAMING_PLATFORMS]) {
    const link = byPlatform(platform);
    if (link) return link;
  }
  return null;
}

/** Série mise en avant dans la carte « Reprendre » : la dernière synchronisée par SyncKai, sinon null. */
export function pickHeroEntry(entries: readonly WatchingEntry[]): WatchingEntry | null {
  let hero: WatchingEntry | null = null;
  for (const entry of entries) {
    if (entry.lastSync && (!hero?.lastSync || entry.lastSync.at > hero.lastSync.at)) hero = entry;
  }
  return hero;
}

/**
 * "il y a 20 min", "il y a 2 h", "hier", "il y a 3 jours" (fr) — pour la barre d'état et les métadonnées.
 * Langue active par défaut ; `locale` permet de forcer une langue (tests).
 */
export function formatRelativeTime(timestamp: number, now: number, locale: Locale = getLocale()): string {
  const diff = now - timestamp;
  if (diff < MINUTE) return tl(locale, 'time.justNow');
  if (diff < HOUR) return tl(locale, 'time.minutesAgo', { count: Math.floor(diff / MINUTE) });
  if (diff < DAY) return tl(locale, 'time.hoursAgo', { count: Math.floor(diff / HOUR) });
  if (diff < 2 * DAY) return tl(locale, 'time.yesterday');
  return tl(locale, 'time.daysAgo', { count: Math.floor(diff / DAY) });
}
