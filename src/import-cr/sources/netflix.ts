import { t, tp } from '../../i18n';
import { MAX_HISTORY_SEASONS } from '../../platforms/crunchyroll/history';
import { NETFLIX_HISTORY_HOOK } from '../../protocol/netflix-history';
import {
  groupNetflixRows,
  keepsShow,
  needsMetadata,
  NETFLIX_TITLES_PER_REQUEST,
  readNetflixHistory,
  reduceNetflixShow,
  type NetflixTab,
  type NetflixTitleGroup,
  type NetflixTitleVerdict,
} from '../../platforms/netflix/history';
import { netflixTabOp, type NetflixTabOp } from '../../platforms/netflix/tab-op';
import { isNetflixShowMetadata, type NetflixShowMetadata } from '../../platforms/netflix/metadata';
import { hasPlatformAccess, requestPlatformAccess } from '../../browser/platform-access';
import { getSettings } from '../../browser/storage/settings-access';
import { createLogger } from '../../browser/logger';
import { sendMessage } from '../../protocol/messages';
import { SOURCE_SITES } from './sites';
import { readErrorText, sleep, sourceParams, type HistorySource, type ReadContext, type ReadOutcome, type ReadProgress } from './source';

// Historique Netflix : onglet « Activité de visionnage » piloté d'ici (voir platforms/netflix/history.ts) : a) lignes
// (bouton « Voir plus » du site), b) filtre « anime » des titres distincts (AniList, paquets de NETFLIX_TITLES_PER_REQUEST),
// c) points de lecture des seules séries gardées (une requête Netflix chacune, espacées), d) une ligne par saison vue →
// même analyse que Crunchyroll et ADN. Les titres écartés sont seulement comptés.

const log = createLogger('import-cr');

/** Métadonnées d'une série demandées une à une, espacées (requête du site, avec sa session) */
const NETFLIX_SHOW_GAP_MS = 700;
/** Réponse nulle après ce délai : pont du monde MAIN muet (onglet ouvert avant une mise à jour) → recharger l'onglet */
const NETFLIX_SILENT_MS = 20_000;
/** Nouvelles tentatives du filtre AniList (quota, réseau) avant d'abandonner */
const NETFLIX_TITLES_RETRY_MS = [5_000, 15_000] as const;

/**
 * Onglet Netflix piloté par scripting.executeScript (fonction autonome netflixTabOp, monde isolé de l'extension) : aucun
 * code de lecture de l'historique dans le script de contenu Netflix, qui n'expose que la demande des points de lecture.
 */
function netflixTab(tabId: number): NetflixTab & { show: (movieId: string) => Promise<unknown> } {
  const run = async (op: NetflixTabOp, movieId = ''): Promise<unknown> => {
    const [first] = await chrome.scripting.executeScript({ target: { tabId, frameIds: [0] }, func: netflixTabOp, args: [op, NETFLIX_HISTORY_HOOK, movieId] });
    return first?.result;
  };
  return { state: () => run('state'), clickMore: () => run('click'), rows: () => run('rows'), show: (movieId) => run('show', movieId) };
}

/** Filtre « anime » d'un paquet de titres (service worker), retenté après une erreur passagère (quota, réseau, réveil) */
async function checkTitles(titles: string[], stopped: () => boolean, signal: AbortSignal): Promise<{ ok: true; data: NetflixTitleVerdict[] } | { ok: false; message: string } | null> {
  for (let attempt = 0; ; attempt++) {
    let failure = t('crImport.error.unexpected');
    try {
      const result = await sendMessage('NETFLIX_IMPORT_TITLES', { titles });
      if (stopped()) return null;
      if (result.ok && result.data.length === titles.length) return { ok: true, data: result.data };
      if (!result.ok && result.code === 'NOT_CONNECTED') return { ok: false, message: result.message };
      if (!result.ok) failure = result.message;
    } catch (error: unknown) {
      log.warn('Filtre Netflix non transmis :', error instanceof Error ? error.message : String(error));
    }
    const wait = NETFLIX_TITLES_RETRY_MS[attempt];
    if (wait === undefined) return { ok: false, message: failure };
    await sleep(wait, signal);
    if (stopped()) return null;
  }
}

/** Métadonnées (avec points de lecture) d'une série : ses vidéos essayées tour à tour ; 'absent' / 'silent' : recharger l'onglet */
async function loadNetflixShow(tab: ReturnType<typeof netflixTab>, group: NetflixTitleGroup): Promise<NetflixShowMetadata | null | 'absent' | 'silent'> {
  for (const movieId of group.movieIds) {
    const started = Date.now();
    const raw = await tab.show(movieId);
    if (raw === 'absent') return 'absent';
    if (isNetflixShowMetadata(raw)) return raw;
    if (Date.now() - started >= NETFLIX_SILENT_MS) return 'silent';
  }
  return null;
}

async function readNetflix(tabId: number, ctx: ReadContext): Promise<ReadOutcome> {
  const stopped = (): boolean => ctx.signal.aborted;
  const STOPPED: ReadOutcome = { kind: 'stopped' };
  let progress: Extract<ReadProgress, { kind: 'netflix' }> = { kind: 'netflix', phase: 'rows', done: 0, total: 0 };
  const update = (patch: Partial<typeof progress>): void => {
    if (stopped()) return;
    progress = { ...progress, ...patch };
    ctx.progress(progress);
  };
  const tab = netflixTab(tabId);
  try {
    const read = await readNetflixHistory(tab, { sleep: (ms) => sleep(ms, ctx.signal), stopped }, (rows) => update({ done: rows }));
    if (read === null || stopped()) return STOPPED;
    if (!read.ok) return { kind: 'failed', error: readErrorText(netflixSource, read.code), reloadTabId: read.code === 'unavailable' ? tabId : null };
    const { rows, clicks, partial, moreUnrecognized } = read.read;
    const groups = groupNetflixRows(rows);
    if (groups.length === 0) return { kind: 'failed', error: null, reloadTabId: null, notice: t('crImport.netflix.empty') };

    update({ phase: 'titles', done: 0, total: groups.length });
    const verdicts = new Map<NetflixTitleGroup, NetflixTitleVerdict>();
    for (let start = 0; start < groups.length; start += NETFLIX_TITLES_PER_REQUEST) {
      const chunk = groups.slice(start, start + NETFLIX_TITLES_PER_REQUEST);
      const result = await checkTitles(
        chunk.map((group) => group.title),
        stopped,
        ctx.signal,
      );
      if (result === null || stopped()) return STOPPED;
      if (!result.ok) return { kind: 'failed', error: result.message, reloadTabId: null };
      chunk.forEach((group, index) => {
        const verdict = result.data[index];
        if (verdict) verdicts.set(group, verdict);
      });
      update({ done: start + chunk.length });
    }

    const kept = groups.filter((group) => {
      const verdict = verdicts.get(group);
      return verdict !== undefined && needsMetadata(verdict);
    });
    update({ phase: 'shows', done: 0, total: kept.length });
    const shows = new Map<string, NetflixShowMetadata>();
    let ignored = groups.length - kept.length;
    for (const [index, group] of kept.entries()) {
      if (index > 0) await sleep(NETFLIX_SHOW_GAP_MS, ctx.signal);
      if (stopped()) return STOPPED;
      const show = await loadNetflixShow(tab, group);
      if (stopped()) return STOPPED;
      if (show === 'absent' || show === 'silent') return { kind: 'failed', error: t('crImport.read.error.noScript', sourceParams(netflixSource)), reloadTabId: tabId };
      const verdict = verdicts.get(group);
      // Série lue liée sur AniList (ou au même titre) ; deux titres de l'historique peuvent mener à la même série
      if (show && verdict && keepsShow(verdict, show)) shows.set(show.showId, show);
      else ignored++;
      update({ done: index + 1 });
    }

    const { completionPercentage, completionTrigger } = await getSettings();
    if (stopped()) return STOPPED;
    const seasons = [...shows.values()].flatMap((show) => reduceNetflixShow(show, completionPercentage, completionTrigger));
    // Chiffres seulement : jamais de titre de l'historique dans le journal
    log.info(`Historique Netflix : ${rows.length} lignes, ${groups.length} titres, ${shows.size} séries gardées, ${seasons.length} saisons vues`);
    if (seasons.length === 0) return { kind: 'failed', error: null, reloadTabId: null, notice: tp('crImport.netflix.noAnime', groups.length) };
    const stats = { items: rows.length, pages: clicks + 1, partial: partial || seasons.length > MAX_HISTORY_SEASONS, ignored, ...(moreUnrecognized ? { moreUnrecognized } : {}) };
    return { kind: 'done', history: { seasons: seasons.slice(0, MAX_HISTORY_SEASONS), stats } };
  } catch (error: unknown) {
    if (stopped()) return STOPPED;
    // Onglet fermé, rechargé ou parti de netflix.com : executeScript échoue
    log.warn('Lecture de l’historique Netflix interrompue :', error instanceof Error ? error.message : String(error));
    return { kind: 'failed', error: t('crImport.read.error.interrupted'), reloadTabId: null };
  }
}

export const netflixSource: HistorySource = {
  id: 'netflix',
  // Page Activité de visionnage du profil (l'historique n'est lisible que là)
  tabPatterns: ['https://www.netflix.com/viewingactivity*', 'https://www.netflix.com/*/viewingactivity*'],
  home: 'https://www.netflix.com/viewingactivity',
  site: SOURCE_SITES.netflix,
  initialProgress: { kind: 'netflix', phase: 'rows', done: 0, total: 0 },
  // Accès optionnel, le même que dans Réglages (permission de la plateforme, voir browser/platform-access.ts)
  hasAccess: () => hasPlatformAccess('netflix'),
  requestAccess: () => requestPlatformAccess('netflix'),
  read: readNetflix,
};
