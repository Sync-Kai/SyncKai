import { t } from '../i18n';
import { AGENDA_SCHEDULE_PAGES, itemsInWindow } from './airing-policy';
import { fetchAiring, getCachedEntries, hasConnectedService } from './airing';
import { ApiError } from './api/errors';
import { mergeWatchingSeries, weekRangeFromKey, type AgendaResult, type AiringWeekCache } from '../shared/agenda';
import { writeWeekCache } from '../shared/agenda-store';
import { getExcludedSeries } from '../shared/exclusions';
import { getOpenSessions } from '../shared/storage';
import { createLogger } from '../shared/logger';

// GET_AGENDA : sorties d'une semaine pour le panneau latéral, quand son cache manque ou a expiré.

const log = createLogger('agenda');

/** Requêtes en cours par semaine : deux demandes rapprochées partagent la même lecture du calendrier */
const inFlight = new Map<string, Promise<AgendaResult>>();

async function loadWeek(weekStart: string): Promise<AgendaResult> {
  const range = weekRangeFromKey(weekStart);
  if (!range) return { ok: false, code: 'API_ERROR', message: t('error.unexpected') };
  const notConnected: AgendaResult = { ok: false, code: 'NOT_AUTHENTICATED', message: t('agenda.notConnected') };
  if (!(await hasConnectedService())) return notConnected;

  // Sessions relevées avant la lecture des séries suivies : la semaine n'est pas enregistrée si l'une d'elles est fermée entre-temps
  const epochs = await getOpenSessions();
  const [entries, excluded] = await Promise.all([getCachedEntries(), getExcludedSeries()]);
  const mediaIds = [...mergeWatchingSeries(entries, excluded, 'crunchyroll').keys()];
  // Bornes exclues côté AniList : la seconde précédant minuit est la borne basse
  const window = { from: Math.floor(range.start / 1000) - 1, to: Math.floor(range.end / 1000) };
  try {
    // Demande du panneau ouvert : budget de pages plus large que la vérification horaire (ALRT-06)
    const fetched = mediaIds.length > 0 ? await fetchAiring(mediaIds, window.from, window.to, AGENDA_SCHEDULE_PAGES) : { items: [], truncatedAt: null };
    const schedules = itemsInWindow(fetched.items, window);
    const cache: AiringWeekCache = { weekStart, fetchedAt: Date.now(), mediaIds, schedules, ...(fetched.truncatedAt !== null ? { truncated: true } : {}) };
    if (!(await writeWeekCache(cache, epochs))) return notConnected;
    log.info(`Semaine ${weekStart} : ${schedules.length} sortie(s) pour ${mediaIds.length} série(s)`);
    return { ok: true, data: cache };
  } catch (error: unknown) {
    if (error instanceof ApiError) return { ok: false, code: error.code, message: error.message };
    throw error;
  }
}

export function getAgendaWeek(weekStart: string): Promise<AgendaResult> {
  const pending = inFlight.get(weekStart);
  if (pending) return pending;
  const request = loadWeek(weekStart).finally(() => inFlight.delete(weekStart));
  inFlight.set(weekStart, request);
  return request;
}
