import type { EpisodeInfo } from '../../shared/episode.types';
import { platformSeriesKey } from '../../shared/exclusions';
import { isRecord } from '../../shared/guards';
import { createLogger } from '../../shared/logger';

// Séries ignorées par le filtre « anime » des plateformes généralistes (Netflix : aucune fiche AniList liée ni au
// même titre), par clé plateforme (`netflix:{showId}`). Évite de relancer la recherche AniList (budget de
// requêtes partagé) à chaque onglet ou épisode d'une série qui n'est pas un anime.
// `storage.session` (Chrome 102+, Firefox 115+ : couverts par les versions minimales) : survit à la mise en veille
// du service worker, vidé à la fermeture du navigateur, jamais écrit sur disque. Absent : rien n'est mémorisé.
// Pas une donnée de l'utilisateur (seulement l'état du catalogue AniList) : rien à effacer à la déconnexion.

export const IGNORED_SERIES_KEY = 'ignoredSeries';
/** Au-delà, nouvelle recherche : un lien vers la plateforme a pu être ajouté sur AniList */
export const IGNORED_SERIES_TTL_MS = 24 * 3_600_000;
/** Taille maximale : les verdicts les plus anciens sont retirés */
export const MAX_IGNORED_SERIES = 200;

/** Clé plateforme → date du verdict (ms) */
export type IgnoredSeriesStore = Record<string, number>;

const log = createLogger('sync');

type SeriesRef = Pick<EpisodeInfo, 'platform' | 'seriesId' | 'animeTitle'>;

function sessionArea(): chrome.storage.StorageArea | null {
  const area: unknown = typeof chrome !== 'undefined' && chrome.storage ? Reflect.get(chrome.storage, 'session') : undefined;
  return isRecord(area) && typeof area.get === 'function' ? chrome.storage.session : null;
}

const isFresh = (at: number, now: number): boolean => now - at < IGNORED_SERIES_TTL_MS && at <= now + 60_000;

/** Verdicts encore valables (forme revalidée), au plus MAX_IGNORED_SERIES, les plus récents */
export function pruneIgnoredSeries(raw: unknown, now: number): IgnoredSeriesStore {
  if (!isRecord(raw)) return {};
  const fresh = Object.entries(raw).flatMap(([key, at]) => (typeof at === 'number' && isFresh(at, now) ? [[key, at] as const] : []));
  return Object.fromEntries(fresh.sort((a, b) => b[1] - a[1]).slice(0, MAX_IGNORED_SERIES));
}

async function readStore(area: chrome.storage.StorageArea, now: number): Promise<IgnoredSeriesStore> {
  const stored = await area.get(IGNORED_SERIES_KEY);
  return pruneIgnoredSeries(stored[IGNORED_SERIES_KEY], now);
}

/** Vrai si la série a été ignorée il y a moins de 24 h ; stockage illisible → false (nouvelle recherche) */
export async function isSeriesIgnored(series: SeriesRef, now: number = Date.now()): Promise<boolean> {
  const area = sessionArea();
  if (!area) return false;
  try {
    return platformSeriesKey(series) in (await readStore(area, now));
  } catch (error: unknown) {
    log.debug('Séries ignorées illisibles :', error);
    return false;
  }
}

/**
 * Mémorise le verdict. Écritures concurrentes (deux onglets) : la dernière peut effacer l'autre verdict,
 * sans conséquence (une recherche de plus) ; pas de verrou pour un simple cache.
 */
export async function rememberIgnoredSeries(series: SeriesRef, now: number = Date.now()): Promise<void> {
  const area = sessionArea();
  if (!area) return;
  try {
    const store = await readStore(area, now);
    await area.set({ [IGNORED_SERIES_KEY]: pruneIgnoredSeries({ ...store, [platformSeriesKey(series)]: now }, now) });
  } catch (error: unknown) {
    log.debug('Série ignorée non mémorisée :', error);
  }
}
