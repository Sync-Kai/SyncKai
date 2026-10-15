import { getLocale, initI18n, onLocaleChange, t, tp, type MessageKey } from '../i18n';
import { isAdnHistoryPortMessage, reduceAdnHistory } from '../platforms/adn/history';
import { ADN_HISTORY_PORT_NAME, CR_HISTORY_PORT_NAME, isCrHistoryPortMessage } from '../protocol/content-messages';
import { MAX_HISTORY_SEASONS, type CrHistoryErrorCode, type CrHistoryResult, type HistoryStats } from '../platforms/crunchyroll/history';
import {
  CR_IMPORT_KEYS,
  defaultSelection,
  hasUpdate,
  IMPORT_PLATFORMS,
  importPlatformOf,
  isCrImportJob,
  isCrImportPlan,
  isImportPlatform,
  planCounts,
  type CrImportJob,
  type CrImportPlan,
  type CrPlanItem,
  type CrReviewItem,
  type CrServicePlan,
  type ImportPlatform,
} from '../shared/cr-import';
import { dismissCrImportJob, resetCrImport } from '../browser/storage/cr-import-store';
import { hasHostAccess, requestHostAccess } from '../browser/host-access';
import { NETFLIX_HISTORY_HOOK } from '../protocol/netflix-history';
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
} from '../platforms/netflix/history';
import { netflixTabOp, type NetflixTabOp } from '../platforms/netflix/tab-op';
import { isNetflixShowMetadata, type NetflixShowMetadata } from '../platforms/netflix/metadata';
import { hasPlatformAccess, requestPlatformAccess } from '../browser/platform-access';
import { isJobActive } from '../shared/job';
import { createLogger } from '../browser/logger';
import { sendMessage } from '../protocol/messages';
import { PLATFORMS } from '../platforms/registry';
import { getSettings } from '../shared/settings';
import { STORAGE_KEYS } from '../protocol/storage-keys';
import { TRACKER_LABELS } from '../shared/tracker.types';
import { busyAttrs, h, nodes, preserveFocus, type Child } from '../ui/dom';
import { icon, kai } from '../ui/icons';
import { renderAlert } from '../ui/alert';
import { jobPauseText, renderJobPause, tickJobPause } from '../ui/job-pause';
import { TONE_CHIP } from '../ui/feedback';
import { BTN_GHOST, BTN_PRIMARY, CARD, renderCover, segmented, SERVICE_CHIPS } from '../ui/kit';

const log = createLogger('import-cr');

// Page « Importer un historique » (onglet ouvert depuis Réglages › Mes données), Crunchyroll, ADN (?platform=adn) ou
// Netflix (?platform=netflix) : a) plateforme choisie, onglet trouvé (ou ouvert), b) lecture de l'historique par son script
// de contenu (port ; ADN : réduit ici par saison ; Netflix : onglet piloté d'ici, filtre « anime » puis points de lecture,
// voir platforms/netflix/history.ts), c) analyse en tâche de fond, d) aperçu, e) application en tâche de fond. Les tâches et
// l'aperçu vivent dans chrome.storage.local : la page peut être fermée puis rouverte, elle reprend où en est l'import.
// Une seule analyse ou un seul aperçu à la fois, toutes plateformes confondues (« Recommencer » pour changer).

interface PlatformSource {
  /** Onglets où le script de contenu peut lire l'historique (jeton ou session du site) */
  tabPatterns: string[];
  home: string;
  /** Site à ouvrir, cité dans les messages */
  site: string;
  /** Accès demandé sur Firefox s'il a été retiré (script de contenu ; Crunchyroll : API en même origine) */
  origins: string[];
}

const SOURCES: Record<ImportPlatform, PlatformSource> = {
  crunchyroll: { tabPatterns: ['https://www.crunchyroll.com/*'], home: 'https://www.crunchyroll.com/', site: 'www.crunchyroll.com', origins: ['*://*.crunchyroll.com/*'] },
  adn: {
    tabPatterns: ['https://animationdigitalnetwork.com/*', 'https://www.animationdigitalnetwork.com/*'],
    home: 'https://animationdigitalnetwork.com/',
    site: 'animationdigitalnetwork.com',
    origins: ['*://animationdigitalnetwork.com/*', '*://*.animationdigitalnetwork.com/*'],
  },
  // Page Activité de visionnage du profil (l'historique n'est lisible que là) ; accès optionnel, comme dans Réglages
  netflix: {
    tabPatterns: ['https://www.netflix.com/viewingactivity*', 'https://www.netflix.com/*/viewingactivity*'],
    home: 'https://www.netflix.com/viewingactivity',
    site: 'netflix.com/viewingactivity',
    origins: [...PLATFORMS.netflix.optionalMatches],
  },
};
/** Netflix : accès optionnel (permission de la plateforme, voir browser/platform-access.ts) ; autres : accès du manifeste */
const hasSourceAccess = (platform: ImportPlatform): Promise<boolean> => (platform === 'netflix' ? hasPlatformAccess('netflix') : hasHostAccess(SOURCES[platform].origins));
/** À appeler directement dans le clic (Firefox : geste utilisateur sans await préalable) */
const requestSourceAccess = (platform: ImportPlatform): Promise<boolean> => (platform === 'netflix' ? requestPlatformAccess('netflix') : requestHostAccess(SOURCES[platform].origins));
/** Netflix : métadonnées d'une série demandées une à une, espacées (requête du site, avec sa session) */
const NETFLIX_SHOW_GAP_MS = 700;
/** Réponse nulle après ce délai : pont du monde MAIN muet (onglet ouvert avant une mise à jour) → recharger l'onglet */
const NETFLIX_SILENT_MS = 20_000;
/** Nouvelles tentatives du filtre AniList (quota, réseau) avant d'abandonner */
const NETFLIX_TITLES_RETRY_MS = [5_000, 15_000] as const;
const TAB_POLL_MS = 2_000;
/** Script de contenu pas encore prêt (onglet en chargement) : nouvelles tentatives avant de proposer de recharger */
const CONNECT_RETRY_MS = [1_000, 2_000, 3_000] as const;

type Step =
  | { kind: 'connect'; tabId: number | null; tabTitle: string | null; opening: boolean; error: string | null; reloadTabId: number | null }
  | { kind: 'reading'; tabId: number; pages: number; items: number; lookups: number; lookupsTotal: number }
  /** Netflix : lignes chargées (« Voir plus »), puis titres filtrés sur AniList, puis séries lues sur Netflix */
  | { kind: 'netflix'; tabId: number; phase: 'rows' | 'titles' | 'shows'; done: number; total: number }
  | { kind: 'starting' };

interface PageState {
  loaded: boolean;
  /** Plateforme choisie pour une nouvelle lecture (l'aperçu garde la sienne) */
  platform: ImportPlatform;
  connected: boolean;
  hostAccess: boolean;
  job: CrImportJob | null;
  plan: CrImportPlan | null;
  step: Step;
  /** Éléments cochés de l'aperçu (initialisés à chaque nouvel aperçu) */
  selected: Set<string>;
  selectionFor: number | null;
  reviewSelected: Set<string>;
  /** Blocs repliables de l'aperçu ouverts : choix de l'utilisateur gardé d'un rendu à l'autre (UI-06) */
  reviewOpen: boolean;
  upToDateOpen: boolean;
  busy: boolean;
  error: string | null;
  notice: string | null;
}

const app = document.getElementById('app');
const requested = new URLSearchParams(location.search).get('platform');
const state: PageState = {
  loaded: false,
  platform: isImportPlatform(requested) ? requested : 'crunchyroll',
  connected: true,
  hostAccess: true,
  job: null,
  plan: null,
  step: { kind: 'connect', tabId: null, tabTitle: null, opening: false, error: null, reloadTabId: null },
  selected: new Set(),
  selectionFor: null,
  reviewSelected: new Set(),
  reviewOpen: true,
  upToDateOpen: false,
  busy: false,
  error: null,
  notice: null,
};

let port: chrome.runtime.Port | null = null;
/** Lecture Netflix en cours (pilotée d'ici) : `stopped` l'arrête à la prochaine étape */
let netflixRun: { stopped: boolean } | null = null;
let pollTimer: ReturnType<typeof setTimeout> | undefined;
let tickTimer: ReturnType<typeof setInterval> | undefined;

function draw(): void {
  if (!app) return;
  preserveFocus(app, () => app.replaceChildren(render()));
  scheduleTimers();
}

// ─── Lecture du stockage ──────────────────────────────────────────────────

async function loadStored(): Promise<void> {
  const stored = await chrome.storage.local.get([CR_IMPORT_KEYS.job, CR_IMPORT_KEYS.plan, STORAGE_KEYS.anilistToken, STORAGE_KEYS.malToken]);
  const job: unknown = stored[CR_IMPORT_KEYS.job];
  const plan: unknown = stored[CR_IMPORT_KEYS.plan];
  state.job = isCrImportJob(job) ? job : null;
  setPlan(isCrImportPlan(plan) ? plan : null);
  state.connected = stored[STORAGE_KEYS.anilistToken] !== undefined || stored[STORAGE_KEYS.malToken] !== undefined;
}

/** Plateforme affichée : celle de l'aperçu s'il existe, sinon celle choisie */
const currentPlatform = (): ImportPlatform => (state.plan ? importPlatformOf(state.plan) : state.platform);
const platformParams = (platform: ImportPlatform = currentPlatform()): { platform: string; site: string } => ({ platform: PLATFORMS[platform].label, site: SOURCES[platform].site });

function setPlan(plan: CrImportPlan | null): void {
  state.plan = plan;
  // Nouvel aperçu : sélection par défaut ; mise à jour du même aperçu (résultats) : sélection conservée, éléments faits retirés
  if (plan && plan.builtAt !== state.selectionFor) {
    state.selectionFor = plan.builtAt;
    state.selected = new Set(defaultSelection(plan));
    state.reviewSelected = new Set(plan.review.filter((r) => !r.created).map((r) => r.key));
    state.reviewOpen = true;
    state.upToDateOpen = false;
  } else if (plan) {
    for (const item of plan.items) if (item.result?.outcome === 'updated') state.selected.delete(item.id);
    for (const review of plan.review) if (review.created) state.reviewSelected.delete(review.key);
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  const jobChange = changes[CR_IMPORT_KEYS.job];
  const planChange = changes[CR_IMPORT_KEYS.plan];
  if (!jobChange && !planChange && !changes[STORAGE_KEYS.anilistToken] && !changes[STORAGE_KEYS.malToken]) return;
  if (jobChange) {
    const value: unknown = jobChange.newValue;
    state.job = isCrImportJob(value) ? value : null;
  }
  if (planChange) {
    const value: unknown = planChange.newValue;
    setPlan(isCrImportPlan(value) ? value : null);
  }
  if (changes[STORAGE_KEYS.anilistToken] || changes[STORAGE_KEYS.malToken]) {
    void loadStored().then(draw);
    return;
  }
  draw();
});

// ─── a) Plateforme et onglet ──────────────────────────────────────────────

async function findTab(platform: ImportPlatform): Promise<chrome.tabs.Tab | null> {
  try {
    const tabs = await chrome.tabs.query({ url: SOURCES[platform].tabPatterns });
    return tabs.find((tab) => tab.id !== undefined && tab.status === 'complete') ?? tabs.find((tab) => tab.id !== undefined) ?? null;
  } catch (error: unknown) {
    log.warn('Recherche de l’onglet de la plateforme impossible :', error);
    return null;
  }
}

async function refreshTab(): Promise<void> {
  if (state.step.kind !== 'connect') return;
  const platform = state.platform;
  const tab = await findTab(platform);
  if (state.step.kind !== 'connect' || state.platform !== platform) return;
  state.step = { ...state.step, tabId: tab?.id ?? null, tabTitle: tab?.title ?? null, opening: state.step.opening && !tab };
  draw();
}

async function openPlatform(): Promise<void> {
  if (state.step.kind !== 'connect') return;
  const platform = state.platform;
  state.step = { ...state.step, opening: true, error: null };
  draw();
  try {
    // Ouvert en arrière-plan : la page d'import suit l'onglet (connexion éventuelle à faire dans celui-ci)
    await chrome.tabs.create({ url: SOURCES[platform].home, active: false });
  } catch (error: unknown) {
    log.warn('Ouverture de la plateforme impossible :', error);
    if (state.step.kind === 'connect') state.step = { ...state.step, opening: false, error: t('crImport.connect.openFailed', platformParams(platform)) };
  }
  await refreshTab();
}

/** Autre plateforme choisie (étape de connexion seulement) : onglet et accès revus, choix gardé dans l'URL */
async function choosePlatform(platform: ImportPlatform): Promise<void> {
  if (state.step.kind !== 'connect' || state.platform === platform) return;
  state.platform = platform;
  state.step = { kind: 'connect', tabId: null, tabTitle: null, opening: false, error: null, reloadTabId: null };
  state.error = null;
  state.notice = null;
  const url = new URL(location.href);
  url.searchParams.set('platform', platform);
  window.history.replaceState(null, '', url);
  draw();
  state.hostAccess = await hasSourceAccess(platform);
  draw();
  await refreshTab();
}

function showTab(tabId: number): void {
  void chrome.tabs.update(tabId, { active: true }).catch(() => undefined);
}

// ─── b) Lecture de l'historique (port vers le script de contenu) ──────────

const READ_ERRORS: Record<CrHistoryErrorCode, MessageKey> = {
  'logged-out': 'crImport.read.error.logged-out',
  unavailable: 'crImport.read.error.unavailable',
  blocked: 'crImport.read.error.blocked',
  network: 'crImport.read.error.network',
  'wrong-page': 'crImport.read.error.wrong-page',
};

/** Message d'échec de lecture ; ADN : jeton absent ou expiré → se connecter puis recharger la page du site */
function readErrorText(platform: ImportPlatform, code: CrHistoryErrorCode): string {
  if (platform === 'adn' && code === 'logged-out') return t('crImport.read.error.adnLoggedOut');
  if (platform === 'netflix' && code === 'logged-out') return t('crImport.read.error.netflixLoggedOut');
  return t(READ_ERRORS[code], platformParams(platform));
}

/** Message du port normalisé (les deux protocoles) ; historique ADN réduit par saison au seuil de fin des réglages */
type ReadEvent =
  | { type: 'progress'; pages: number; items: number; lookups: number; lookupsTotal: number }
  | { type: 'error'; code: CrHistoryErrorCode }
  | { type: 'done'; history: () => Promise<CrHistoryResult> };

function readEvent(platform: ImportPlatform, raw: unknown): ReadEvent | null {
  if (platform === 'adn') {
    if (!isAdnHistoryPortMessage(raw)) return null;
    if (raw.type === 'progress') return { ...raw, lookups: 0, lookupsTotal: 0 };
    if (raw.type === 'error') return raw;
    const read = raw.result;
    return { type: 'done', history: async () => reduceAdnHistory(read, (await getSettings()).completionPercentage) };
  }
  if (!isCrHistoryPortMessage(raw)) return null;
  if (raw.type !== 'done') return raw;
  const result = raw.result;
  return { type: 'done', history: () => Promise.resolve(result) };
}

function backToConnect(tabId: number | null, error: string | null, reloadTabId: number | null = null): void {
  port = null;
  netflixRun = null;
  state.step = { kind: 'connect', tabId, tabTitle: null, opening: false, error, reloadTabId };
  draw();
  void refreshTab();
}

function startReading(tabId: number, attempt = 0): void {
  const platform = state.platform;
  if (platform === 'netflix') {
    void readNetflix(tabId);
    return;
  }
  state.error = null;
  state.notice = null;
  state.step = { kind: 'reading', tabId, pages: 0, items: 0, lookups: 0, lookupsTotal: 0 };
  draw();
  let next: chrome.runtime.Port;
  try {
    next = chrome.tabs.connect(tabId, { name: platform === 'adn' ? ADN_HISTORY_PORT_NAME : CR_HISTORY_PORT_NAME, frameId: 0 });
  } catch (error: unknown) {
    log.warn('Port vers l’onglet de la plateforme non ouvert :', error);
    backToConnect(tabId, t('crImport.read.error.noScript', platformParams(platform)), tabId);
    return;
  }
  port = next;
  let answered = false;
  next.onMessage.addListener((raw: unknown) => {
    const message = port === next ? readEvent(platform, raw) : null;
    if (!message) return;
    answered = true;
    if (message.type === 'progress') {
      if (state.step.kind === 'reading') state.step = { ...state.step, pages: message.pages, items: message.items, lookups: message.lookups, lookupsTotal: message.lookupsTotal };
      draw();
    } else if (message.type === 'error') {
      next.disconnect();
      backToConnect(tabId, readErrorText(platform, message.code));
    } else {
      next.disconnect();
      port = null;
      void message.history().then(
        (reduced) => startAnalysis(reduced, platform),
        (error: unknown) => {
          log.error('Historique non réduit :', error);
          backToConnect(tabId, t('crImport.error.unexpected'));
        },
      );
    }
  });
  next.onDisconnect.addListener(() => {
    // Lecture obligatoire : sinon Chrome journalise « Receiving end does not exist » (script absent / orphelin)
    void chrome.runtime.lastError;
    if (port !== next) return;
    port = null;
    if (answered) {
      backToConnect(tabId, t('crImport.read.error.interrupted'));
      return;
    }
    // Aucun script de contenu à l'écoute : onglet en chargement (nouvelle tentative) ou ouvert avant l'extension (recharger)
    const wait = CONNECT_RETRY_MS[attempt];
    if (wait === undefined) {
      backToConnect(tabId, t('crImport.read.error.noScript', platformParams(platform)), tabId);
      return;
    }
    setTimeout(() => {
      if (state.step.kind === 'reading' && state.step.tabId === tabId) startReading(tabId, attempt + 1);
    }, wait);
  });
  next.postMessage({ type: platform === 'adn' ? 'READ_ADN_HISTORY' : 'READ_CR_HISTORY' });
}

function stopReading(): void {
  const current = port;
  const tabId = state.step.kind === 'reading' || state.step.kind === 'netflix' ? state.step.tabId : null;
  port = null;
  if (netflixRun) netflixRun.stopped = true;
  current?.disconnect();
  backToConnect(tabId, null);
}

// ─── b') Netflix : onglet piloté d'ici (voir platforms/netflix/history.ts) ────

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

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Filtre « anime » d'un paquet de titres (service worker), retenté après une erreur passagère (quota, réseau, réveil) */
async function checkTitles(titles: string[], stopped: () => boolean): Promise<{ ok: true; data: NetflixTitleVerdict[] } | { ok: false; message: string } | null> {
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
    await sleep(wait);
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

/**
 * Lecture Netflix : a) lignes (bouton « Voir plus » du site), b) filtre « anime » des titres distincts (AniList, paquets de
 * NETFLIX_TITLES_PER_REQUEST), c) points de lecture des seules séries gardées (une requête Netflix chacune, espacées),
 * d) une ligne par saison vue → même analyse que Crunchyroll et ADN. Les titres écartés sont seulement comptés.
 */
async function readNetflix(tabId: number): Promise<void> {
  const run = { stopped: false };
  netflixRun = run;
  const stopped = (): boolean => run.stopped || netflixRun !== run;
  const update = (patch: Partial<Extract<Step, { kind: 'netflix' }>>): void => {
    if (stopped() || state.step.kind !== 'netflix') return;
    state.step = { ...state.step, ...patch };
    draw();
  };
  state.error = null;
  state.notice = null;
  state.step = { kind: 'netflix', tabId, phase: 'rows', done: 0, total: 0 };
  draw();
  const tab = netflixTab(tabId);
  try {
    const read = await readNetflixHistory(tab, { sleep, stopped }, (rows) => update({ done: rows }));
    if (read === null || stopped()) return;
    if (!read.ok) {
      backToConnect(tabId, readErrorText('netflix', read.code), read.code === 'unavailable' ? tabId : null);
      return;
    }
    const { rows, clicks, partial, moreUnrecognized } = read.read;
    const groups = groupNetflixRows(rows);
    if (groups.length === 0) {
      backToConnect(tabId, null);
      state.notice = t('crImport.netflix.empty');
      draw();
      return;
    }

    update({ phase: 'titles', done: 0, total: groups.length });
    const verdicts = new Map<NetflixTitleGroup, NetflixTitleVerdict>();
    for (let start = 0; start < groups.length; start += NETFLIX_TITLES_PER_REQUEST) {
      const chunk = groups.slice(start, start + NETFLIX_TITLES_PER_REQUEST);
      const result = await checkTitles(
        chunk.map((group) => group.title),
        stopped,
      );
      if (result === null || stopped()) return;
      if (!result.ok) {
        backToConnect(tabId, result.message);
        return;
      }
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
      if (index > 0) await sleep(NETFLIX_SHOW_GAP_MS);
      if (stopped()) return;
      const show = await loadNetflixShow(tab, group);
      if (stopped()) return;
      if (show === 'absent' || show === 'silent') {
        backToConnect(tabId, t('crImport.read.error.noScript', platformParams('netflix')), tabId);
        return;
      }
      const verdict = verdicts.get(group);
      // Série lue liée sur AniList (ou au même titre) ; deux titres de l'historique peuvent mener à la même série
      if (show && verdict && keepsShow(verdict, show)) shows.set(show.showId, show);
      else ignored++;
      update({ done: index + 1 });
    }

    const { completionPercentage, completionTrigger } = await getSettings();
    if (stopped()) return;
    const seasons = [...shows.values()].flatMap((show) => reduceNetflixShow(show, completionPercentage, completionTrigger));
    // Chiffres seulement : jamais de titre de l'historique dans le journal
    log.info(`Historique Netflix : ${rows.length} lignes, ${groups.length} titres, ${shows.size} séries gardées, ${seasons.length} saisons vues`);
    if (seasons.length === 0) {
      backToConnect(tabId, null);
      state.notice = tp('crImport.netflix.noAnime', groups.length);
      draw();
      return;
    }
    netflixRun = null;
    await startAnalysis(
      { seasons: seasons.slice(0, MAX_HISTORY_SEASONS), stats: { items: rows.length, pages: clicks + 1, partial: partial || seasons.length > MAX_HISTORY_SEASONS, ignored, ...(moreUnrecognized ? { moreUnrecognized } : {}) } },
      'netflix',
    );
  } catch (error: unknown) {
    if (stopped()) return;
    // Onglet fermé, rechargé ou parti de netflix.com : executeScript échoue
    log.warn('Lecture de l’historique Netflix interrompue :', error instanceof Error ? error.message : String(error));
    backToConnect(tabId, t('crImport.read.error.interrupted'));
  }
}

// ─── c) Analyse, e) application ───────────────────────────────────────────

/** Historique incomplet : trop long, ou « Voir plus » de Netflix non reconnu dans la langue du profil */
function partialNotice(stats: HistoryStats): string {
  return t(stats.moreUnrecognized ? 'crImport.netflix.moreUnrecognized' : 'crImport.read.partial');
}

async function startAnalysis(history: CrHistoryResult, platform: ImportPlatform): Promise<void> {
  state.step = { kind: 'starting' };
  draw();
  try {
    const result = await sendMessage('CR_IMPORT_ANALYZE', { history, platform });
    if (!result.ok) {
      backToConnect(null, result.message);
      return;
    }
    state.job = result.data;
    state.plan = null;
    state.step = { kind: 'connect', tabId: null, tabTitle: null, opening: false, error: null, reloadTabId: null };
    if (history.stats.partial) state.notice = partialNotice(history.stats);
  } catch (error: unknown) {
    log.error('Analyse non démarrée :', error);
    backToConnect(null, t('crImport.error.unexpected'));
    return;
  }
  draw();
}

async function applySelected(): Promise<void> {
  if (!state.plan || state.selected.size === 0) return;
  state.busy = true;
  state.error = null;
  draw();
  try {
    const result = await sendMessage('CR_IMPORT_APPLY', { ids: [...state.selected] });
    if (result.ok) state.job = result.data;
    else state.error = result.message;
  } catch (error: unknown) {
    log.error('Import non démarré :', error);
    state.error = t('crImport.error.unexpected');
  }
  state.busy = false;
  draw();
}

async function cancelJob(): Promise<void> {
  try {
    await sendMessage('CR_IMPORT_CANCEL', null);
  } catch (error: unknown) {
    log.warn('Arrêt non transmis :', error);
  }
}

async function createReviews(): Promise<void> {
  if (state.reviewSelected.size === 0) return;
  state.busy = true;
  state.error = null;
  state.notice = null;
  draw();
  try {
    const result = await sendMessage('CR_IMPORT_REVIEWS', { keys: [...state.reviewSelected] });
    if (!result.ok) state.error = result.message;
    else state.notice = result.data.limited ? tp('crImport.review.createdLimited', result.data.created) : tp('crImport.review.created', result.data.created);
  } catch (error: unknown) {
    log.error('Vérifications non créées :', error);
    state.error = t('crImport.error.unexpected');
  }
  state.busy = false;
  draw();
}

/** « Recommencer » : efface l'aperçu et la dernière tâche (jamais une tâche en cours) */
async function restart(): Promise<void> {
  if (isJobActive(state.job, Date.now())) return;
  // Tâche relue sous verrou : une analyse lancée entre-temps (autre onglet, reprise) n'est jamais effacée
  if (!(await resetCrImport())) return;
  state.job = null;
  state.plan = null;
  state.selectionFor = null;
  state.error = null;
  state.notice = null;
  backToConnect(null, null);
}

async function dismissJob(): Promise<void> {
  if (state.job?.status === 'running') return;
  await dismissCrImportJob();
}

// ─── Minuteries (attente d'un onglet, compte à rebours des pauses) ────────

function scheduleTimers(): void {
  clearTimeout(pollTimer);
  pollTimer = undefined;
  const waitingTab = state.loaded && state.step.kind === 'connect' && state.step.tabId === null && !state.plan && !isRunning();
  if (waitingTab && !document.hidden) pollTimer = setTimeout(() => void refreshTab(), TAB_POLL_MS);

  const paused = state.job?.status === 'running' && state.job.pausedUntil !== null;
  // Compte à rebours mis à jour en place (pas de nouveau rendu de la page chaque seconde)
  if (paused && tickTimer === undefined) tickTimer = setInterval(tickPause, 1_000);
  if (!paused && tickTimer !== undefined) {
    clearInterval(tickTimer);
    tickTimer = undefined;
  }
}

function tickPause(): void {
  if (app && state.job) tickJobPause(app, state.job, Date.now(), 'AniList');
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) void refreshTab();
});
window.addEventListener('pagehide', () => port?.disconnect());

const isRunning = (): boolean => state.job?.status === 'running';

// ─── Rendu ────────────────────────────────────────────────────────────────

function renderHeader(): HTMLElement {
  return h(
    'header',
    { class: 'flex items-center gap-3' },
    kai('h-10 w-10', { size: 'large' }),
    h(
      'div',
      { class: 'flex min-w-0 flex-col' },
      h('h1', { class: 'm-0 font-display text-[18px] font-extrabold' }, t('crImport.title')),
      h('p', { class: 'm-0 text-[12px] text-muted' }, t('crImport.subtitle', platformParams())),
    ),
  );
}

function statusLine(text: string): HTMLElement {
  return h('p', { class: 'm-0 flex items-center gap-2 text-[12px] text-muted', attrs: { role: 'status' } }, icon('spinner', 'h-4 w-4 shrink-0 motion-safe:animate-spin'), text);
}

function ghostButton(label: string, focus: string, onClick: () => void, extra = 'text-ink', disabled = false): HTMLElement {
  return h('button', { class: `${BTN_GHOST} border border-line px-3.5 ${extra}`, attrs: { type: 'button', 'data-focus': focus, ...(disabled ? { disabled: '' } : {}) }, on: { click: onClick } }, label);
}

function progressBar(done: number, total: number, label: string): HTMLElement {
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  return h(
    'div',
    { class: 'h-1.5 overflow-hidden rounded-full bg-raised', attrs: { role: 'progressbar', 'aria-label': label, 'aria-valuemin': '0', 'aria-valuemax': String(total), 'aria-valuenow': String(done) } },
    h('div', { class: 'h-full rounded-full bg-lavender transition-[width]', attrs: { style: `width:${percent}%` } }),
  );
}

function pauseText(job: CrImportJob): string | null {
  return jobPauseText(job, Date.now(), 'AniList');
}

/** Choix de la plateforme (Crunchyroll / ADN) avant la lecture */
function renderPlatformChoice(): HTMLElement {
  return h(
    'div',
    { class: 'flex justify-start' },
    segmented({
      options: IMPORT_PLATFORMS.map((platform) => ({ value: platform, label: PLATFORMS[platform].label })),
      current: state.platform,
      onPick: (platform) => void choosePlatform(platform),
      attrs: { 'aria-label': t('crImport.platform') },
      focusKey: 'platform',
      activeClass: 'bg-lavender',
      trackClass: 'bg-raised',
    }),
  );
}

function renderConnect(step: Extract<Step, { kind: 'connect' }>): Child[] {
  const params = platformParams(state.platform);
  const intro = h('p', { class: 'm-0 text-[12px] text-muted' }, t('crImport.intro', params));
  const choice = renderPlatformChoice();
  if (!state.connected) return [choice, intro, renderAlert({ message: t('crImport.error.notConnected') })];
  if (!state.hostAccess) {
    const platform = state.platform;
    return [
      choice,
      intro,
      // Netflix : plateforme optionnelle, l'autorisation active aussi la synchro en direct (même accès que dans Réglages)
      h('p', { class: 'm-0 text-[12px] font-bold text-butter' }, platform === 'netflix' ? t('crImport.connect.netflixAccess') : t('crImport.connect.access', params)),
      h(
        'div',
        { class: 'flex justify-end' },
        h(
          'button',
          {
            class: BTN_PRIMARY,
            attrs: { type: 'button', 'data-focus': 'cr-access' },
            on: {
              // Demande directe dans le clic : Firefox exige un geste utilisateur sans await préalable
              click: () =>
                void requestSourceAccess(platform).then(
                  (granted) => {
                    state.hostAccess = granted;
                    draw();
                    void refreshTab();
                  },
                  (error: unknown) => log.warn('Demande d’accès impossible :', error),
                ),
            },
          },
          t('crImport.connect.allow'),
        ),
      ),
    ];
  }
  const tabRow =
    step.tabId !== null
      ? h(
          'p',
          { class: 'm-0 flex min-w-0 items-center gap-2 text-[12px] font-bold text-mint', attrs: { role: 'status' } },
          icon('check', 'h-3.5 w-3.5 shrink-0', '3'),
          h('span', { class: 'truncate' }, step.tabTitle ? t('crImport.connect.foundTitled', { ...params, title: step.tabTitle }) : t('crImport.connect.found', params)),
        )
      : step.opening
        ? statusLine(t('crImport.connect.waiting', params))
        : h('p', { class: 'm-0 text-[12px] text-muted' }, t('crImport.connect.none', params));
  const tabId = step.tabId;
  return [
    choice,
    intro,
    h(
      'ul',
      { class: 'm-0 flex list-disc flex-col gap-1 pl-5 text-[12px] text-muted' },
      h('li', {}, t('crImport.rule.never')),
      h('li', {}, t('crImport.rule.preview')),
      h('li', {}, t('crImport.rule.privacy')),
      state.platform === 'netflix' && h('li', {}, t('crImport.netflix.rule')),
    ),
    tabRow,
    step.error &&
      renderAlert({
        message: step.error,
        ...(step.reloadTabId !== null
          ? { action: { label: t('crImport.connect.reload'), onClick: () => step.reloadTabId !== null && void chrome.tabs.reload(step.reloadTabId).then(() => backToConnect(step.reloadTabId, null)) } }
          : tabId !== null
            ? { action: { label: t('crImport.connect.showTab'), onClick: () => showTab(tabId) } }
            : {}),
      }),
    h(
      'div',
      { class: 'flex flex-wrap items-center justify-end gap-2' },
      tabId !== null
        ? h('button', { class: BTN_PRIMARY, attrs: { type: 'button', 'data-focus': 'cr-read' }, on: { click: () => startReading(tabId) } }, t('crImport.connect.read'))
        : h('button', { class: BTN_PRIMARY, attrs: { type: 'button', 'data-focus': 'cr-open', ...busyAttrs(step.opening, true) }, on: { click: () => void openPlatform() } }, t('crImport.connect.open', params)),
    ),
  ];
}

function renderReading(step: Extract<Step, { kind: 'reading' }>): Child[] {
  const text =
    step.lookupsTotal > 0
      ? t('crImport.read.lookups', { done: step.lookups, total: step.lookupsTotal })
      : step.pages > 0
        ? t('crImport.read.progress', { pages: step.pages, items: step.items })
        : t('crImport.read.starting', platformParams(state.platform));
  return [
    statusLine(text),
    step.lookupsTotal > 0 && progressBar(step.lookups, step.lookupsTotal, t('crImport.read.progressAria')),
    h('p', { class: 'm-0 text-[11px] text-muted' }, t('crImport.read.keepTab', platformParams(state.platform))),
    h('div', { class: 'flex justify-end' }, ghostButton(t('compare.job.stop'), 'cr-read-stop', stopReading, 'text-danger')),
  ];
}

/** Lecture Netflix : lignes chargées, puis titres filtrés (AniList), puis séries lues (Netflix) */
function renderNetflix(step: Extract<Step, { kind: 'netflix' }>): Child[] {
  const text =
    step.phase === 'rows'
      ? step.done > 0
        ? t('crImport.netflix.rows', { rows: step.done })
        : t('crImport.read.starting', platformParams('netflix'))
      : step.phase === 'titles'
        ? t('crImport.netflix.titles', { done: step.done, total: step.total })
        : t('crImport.netflix.shows', { done: step.done, total: step.total });
  return [
    statusLine(text),
    step.phase !== 'rows' && progressBar(step.done, step.total, t('crImport.read.progressAria')),
    h('p', { class: 'm-0 text-[11px] text-muted' }, t('crImport.netflix.keepTab')),
    h('div', { class: 'flex justify-end' }, ghostButton(t('compare.job.stop'), 'cr-read-stop', stopReading, 'text-danger')),
  ];
}

function renderRunningJob(job: CrImportJob): Child[] {
  const analyzing = job.kind === 'cr-analyze';
  // L'analyse compte aussi l'étape finale (lecture des listes) : elle n'est pas montrée comme une saison
  const total = analyzing ? Math.max(0, job.total - 1) : job.total;
  const done = Math.min(job.done, total);
  const finalizing = analyzing && job.done >= total;
  const text = analyzing
    ? finalizing
      ? t('crImport.analyze.finalizing')
      : t('crImport.analyze.running', { done, total })
    : t('crImport.apply.running', { done, total });
  const pause = pauseText(job);
  return [
    h(
      'div',
      { class: 'flex flex-col gap-2 rounded-lg bg-raised/60 px-3 py-2.5' },
      h(
        'div',
        { class: 'flex items-center justify-between gap-2' },
        statusLine(text),
        h(
          'button',
          { class: `${BTN_GHOST} h-7 px-2.5 text-[11px] text-danger`, attrs: { type: 'button', 'data-focus': 'cr-job-stop', ...busyAttrs(job.cancelled) }, on: { click: () => void cancelJob() } },
          job.cancelled ? t('compare.job.stopping') : t('compare.job.stop'),
        ),
      ),
      progressBar(done, total, analyzing ? t('crImport.analyze.progressAria') : t('crImport.apply.progressAria')),
      pause && renderJobPause(pause, 'm-0 flex items-center gap-1.5 text-[11px] font-bold text-butter'),
      h('p', { class: 'm-0 text-[11px] text-muted' }, analyzing ? t('crImport.analyze.hint') : t('crImport.apply.hint')),
    ),
  ];
}

/** Bilan d'une analyse arrêtée ou interrompue avant l'aperçu */
function renderAnalyzeEnded(job: CrImportJob): Child[] {
  const message = job.status === 'stopped' ? t('crImport.analyze.stopped', { message: job.message ?? '' }) : t('crImport.analyze.cancelled');
  return [renderAlert({ message }), h('div', { class: 'flex justify-end' }, ghostButton(t('crImport.restart'), 'cr-restart', () => void restart()))];
}

/** Bilan de la dernière application, jusqu'à « OK » */
function renderApplySummary(job: CrImportJob): HTMLElement {
  const parts = [
    job.updated > 0 && tp('compare.result.updated', job.updated),
    job.skipped > 0 && tp('compare.result.skipped', job.skipped),
    job.failed > 0 && tp('compare.result.failed', job.failed),
  ].filter((p): p is string => typeof p === 'string');
  const head = job.status === 'stopped' ? t('crImport.apply.stopped', { message: job.message ?? '' }) : t(job.status === 'cancelled' ? 'crImport.apply.cancelled' : 'crImport.apply.done');
  const tone = job.status === 'stopped' || (job.failed > 0 && job.updated === 0) ? 'error' : job.failed > 0 || job.status === 'cancelled' ? 'warning' : 'success';
  return h(
    'div',
    { class: `flex items-start gap-2 rounded-lg border px-2.5 py-2 text-[12px] font-bold ${TONE_CHIP[tone]}`, attrs: { role: 'status', title: job.messages.join('\n') } },
    h('p', { class: 'm-0 min-w-0 flex-1 break-words' }, [head, ...parts].join(' · ')),
    h('button', { class: 'shrink-0 cursor-pointer rounded-full px-1 text-ink underline-offset-2 hover:underline', attrs: { type: 'button', 'data-focus': 'cr-dismiss' }, on: { click: () => void dismissJob() } }, t('compare.job.dismiss')),
  );
}

const SKIP_KEYS: Record<Extract<CrServicePlan, { action: 'skip' }>['reason'], MessageKey> = {
  'up-to-date': 'crImport.skipReason.up-to-date',
  completed: 'crImport.skipReason.completed',
  repeating: 'crImport.skipReason.repeating',
  beyond: 'crImport.skipReason.beyond',
  'no-equivalent': 'crImport.skipReason.no-equivalent',
};

/** « AL 3 → 12 », « MAL ajout → 12 » ou « MAL déjà à jour » */
function serviceChip(plan: CrServicePlan): HTMLElement {
  const chip = SERVICE_CHIPS[plan.service];
  const label = TRACKER_LABELS[plan.service];
  const text =
    plan.action === 'update'
      ? `${plan.current ? plan.current.progress : t('crImport.preview.add')} → ${plan.progress}${plan.status === 'COMPLETED' ? ` ${t('crImport.preview.completed')}` : ''}`
      : t(SKIP_KEYS[plan.reason]);
  return h(
    'span',
    {
      class: `inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${plan.action === 'update' ? 'bg-lavender/15 text-ink' : 'bg-raised text-muted'}`,
      attrs: { title: t('common.labelValue', { label, value: text }) },
    },
    h('span', { class: `rounded-full px-1 text-on-fill ${chip.class}` }, chip.short),
    // Préfixe lu par les lecteurs d'écran (« AniList : » en français, « AniList: » en anglais et en allemand)
    h('span', { class: 'sr-only' }, t('common.labelValue', { label }).split('{value}')[0] ?? ''),
    text,
  );
}

function renderItem(item: CrPlanItem, selectable: boolean, disabled: boolean, platform: string): HTMLElement {
  const id = `cr-item-${item.mediaId}`;
  const checked = state.selected.has(item.id);
  const done = item.result?.outcome === 'updated';
  return h(
    'li',
    { class: 'flex items-start gap-2.5 rounded-lg bg-raised/50 px-2.5 py-2' },
    selectable &&
      h('input', {
        class: 'mt-1 shrink-0',
        attrs: { id, type: 'checkbox', 'data-focus': id, 'aria-label': item.title, ...(checked ? { checked: '' } : {}), ...(disabled || done ? { disabled: '' } : {}) },
        on: {
          change: (event) => {
            if (!(event.target instanceof HTMLInputElement)) return;
            if (event.target.checked) state.selected.add(item.id);
            else state.selected.delete(item.id);
            draw();
          },
        },
      }),
    renderCover(item.title, item.coverUrl, 'h-12 w-9', 'text-[11px]'),
    h(
      'div',
      { class: 'flex min-w-0 flex-1 flex-col gap-1' },
      h('span', { class: 'truncate text-[13px] font-bold', attrs: { title: item.title } }, item.title),
      h('span', { class: 'truncate text-[11px] text-muted', attrs: { title: item.seasons.join('\n') } }, t('common.labelValue', { label: platform, value: item.seasons.join(' · ') })),
      h('div', { class: 'flex flex-wrap gap-1' }, ...item.services.map(serviceChip)),
      item.result &&
        h(
          'span',
          {
            // Résultat d'un élément : texte simple, pas de role="alert" relu à chaque avancée du job (le bilan annonce les échecs)
            class: `text-[11px] font-bold ${item.result.outcome === 'updated' ? 'text-mint' : item.result.outcome === 'failed' ? 'text-danger' : 'text-muted'}`,
          },
          item.result.outcome === 'updated' ? t('crImport.result.updated') : (item.result.message ?? t(`crImport.result.${item.result.outcome}` satisfies MessageKey)),
        ),
    ),
  );
}

function renderReviewItem(item: CrReviewItem, disabled: boolean): HTMLElement {
  const id = `cr-review-${item.key}`;
  return h(
    'li',
    { class: 'flex items-start gap-2 px-1 py-1' },
    h('input', {
      class: 'mt-0.5 shrink-0',
      attrs: { id, type: 'checkbox', 'data-focus': id, ...(state.reviewSelected.has(item.key) ? { checked: '' } : {}), ...(disabled || item.created ? { disabled: '' } : {}) },
      on: {
        change: (event) => {
          if (!(event.target instanceof HTMLInputElement)) return;
          if (event.target.checked) state.reviewSelected.add(item.key);
          else state.reviewSelected.delete(item.key);
          draw();
        },
      },
    }),
    h(
      'label',
      { class: 'flex min-w-0 flex-col', attrs: { for: id } },
      h(
        'span',
        { class: 'text-[12px]' },
        seasonPart(item),
        ' · ',
        t('crImport.review.episode', { episode: item.episode.displayedEpisodeNumber ?? '?' }),
        item.created ? ` · ${t('crImport.review.done')}` : '',
      ),
      // Saisons réunies (numérotation absolue vers la même fiche) : détail au survol
      item.seasons.length > 1 && h('span', { class: 'text-[11px] text-muted', attrs: { title: item.seasons.join('\n') } }, tp('crImport.review.merged', item.seasons.length)),
      h('span', { class: 'text-[11px] text-muted' }, item.reason),
    ),
  );
}

/** Libellé sans le titre de la série (affiché en tête du groupe) : « S3 (Alabasta (62-143)) » */
function seasonPart(item: CrReviewItem): string {
  const prefix = `${item.episode.animeTitle} · `;
  return item.label.startsWith(prefix) ? item.label.slice(prefix.length) : item.label === item.episode.animeTitle ? t('crImport.review.series') : item.label;
}

/** Vérifications regroupées par série (One Piece : un seul bloc), dans l'ordre du plan */
function reviewGroups(review: readonly CrReviewItem[]): { key: string; title: string; items: CrReviewItem[] }[] {
  const groups = new Map<string, { key: string; title: string; items: CrReviewItem[] }>();
  for (const item of review) {
    const key = item.episode.seriesId ?? item.episode.animeTitle;
    const group = groups.get(key) ?? { key, title: item.episode.animeTitle, items: [] };
    group.items.push(item);
    groups.set(key, group);
  }
  return [...groups.values()];
}

function renderReviewGroup(group: { title: string; items: CrReviewItem[] }, disabled: boolean): HTMLElement {
  return h(
    'li',
    { class: 'flex flex-col border-t border-dotted border-line py-1 first:border-t-0' },
    h('span', { class: 'px-1 text-[12px] font-bold' }, group.title),
    h('ul', { class: 'm-0 flex list-none flex-col p-0' }, ...group.items.map((r) => renderReviewItem(r, disabled))),
  );
}

function sectionHeading(text: string): HTMLElement {
  return h('h2', { class: 'm-0 text-[11px] font-bold tracking-[0.06em] text-muted uppercase' }, text);
}

function renderPreview(plan: CrImportPlan, running: boolean): Child[] {
  const counts = planCounts(plan);
  const platform = PLATFORMS[importPlatformOf(plan)].label;
  const toUpdate = plan.items.filter(hasUpdate);
  const upToDate = plan.items.filter((i) => !hasUpdate(i));
  const disabled = running || state.busy;
  const selectable = toUpdate.filter((i) => i.result?.outcome !== 'updated');
  const summary = [
    tp('crImport.preview.seasons', plan.seasonCount),
    tp('crImport.preview.toUpdate', counts.toUpdate),
    counts.review > 0 && tp('crImport.preview.review', counts.review),
    counts.upToDate > 0 && tp('crImport.preview.upToDate', counts.upToDate),
    plan.excluded > 0 && tp('crImport.preview.excluded', plan.excluded),
    (plan.ignored ?? 0) > 0 && tp('crImport.preview.ignored', plan.ignored ?? 0),
    plan.failed > 0 && tp('crImport.preview.failed', plan.failed),
  ].filter((p): p is string => typeof p === 'string');

  const allChecked = selectable.length > 0 && selectable.every((i) => state.selected.has(i.id));
  return [
    h('p', { class: 'm-0 text-[12px] text-muted' }, summary.join(' · ')),
    plan.stats.partial && h('p', { class: 'm-0 text-[12px] font-bold text-butter' }, partialNotice(plan.stats)),
    plan.services.length < 2 && h('p', { class: 'm-0 text-[11px] text-muted' }, t('crImport.preview.oneService', { service: TRACKER_LABELS[plan.services[0] ?? 'anilist'] })),

    // À mettre à jour
    h(
      'section',
      { class: 'flex flex-col gap-2', attrs: { 'aria-label': t('crImport.preview.updateSection') } },
      h(
        'div',
        { class: 'flex items-center justify-between gap-2' },
        sectionHeading(t('crImport.preview.updateSection')),
        selectable.length > 0 &&
          h(
            'button',
            {
              class: `${BTN_GHOST} h-7 px-2.5 text-[11px] text-sakura`,
              attrs: { type: 'button', 'data-focus': 'cr-toggle-all', ...(disabled ? { disabled: '' } : {}) },
              on: {
                click: () => {
                  state.selected = allChecked ? new Set() : new Set(selectable.map((i) => i.id));
                  draw();
                },
              },
            },
            allChecked ? t('crImport.preview.none') : t('crImport.preview.all'),
          ),
      ),
      toUpdate.length > 0
        ? h('ul', { class: 'm-0 flex list-none flex-col gap-1.5 p-0' }, ...toUpdate.map((item) => renderItem(item, true, disabled, platform)))
        : h('p', { class: 'm-0 text-[12px] text-muted' }, t('crImport.preview.nothing', { platform })),
      toUpdate.length > 0 &&
        h(
          'div',
          { class: 'flex justify-end' },
          h(
            'button',
            { class: BTN_PRIMARY, attrs: { type: 'button', 'data-focus': 'cr-apply', ...(disabled || state.selected.size === 0 ? { disabled: '' } : {}) }, on: { click: () => void applySelected() } },
            state.busy ? icon('spinner', 'h-3.5 w-3.5 motion-safe:animate-spin') : null,
            tp('crImport.preview.apply', state.selected.size),
          ),
        ),
    ),

    // À vérifier (ouvert par défaut)
    plan.review.length > 0 &&
      h(
        'details',
        {
          class: 'flex flex-col gap-2 rounded-lg border border-line px-3 py-2',
          attrs: state.reviewOpen ? { open: '' } : {},
          on: {
            toggle: (event) => {
              if (event.target instanceof HTMLDetailsElement) state.reviewOpen = event.target.open;
            },
          },
        },
        h('summary', { class: 'cursor-pointer text-[12px] font-bold', attrs: { 'data-focus': 'cr-review-toggle' } }, tp('crImport.review.title', plan.review.length)),
        h('p', { class: 'm-0 mt-1 text-[11px] text-muted' }, t('crImport.review.help')),
        h('ul', { class: 'm-0 flex list-none flex-col p-0' }, ...reviewGroups(plan.review).map((g) => renderReviewGroup(g, disabled))),
        counts.reviewPending > 0 &&
          h(
            'div',
            { class: 'flex justify-end' },
            ghostButton(tp('crImport.review.create', state.reviewSelected.size), 'cr-create-reviews', () => void createReviews(), 'text-sakura', disabled || state.reviewSelected.size === 0),
          ),
      ),

    // Déjà à jour (replié par défaut)
    upToDate.length > 0 &&
      h(
        'details',
        {
          class: 'rounded-lg border border-line px-3 py-2',
          attrs: state.upToDateOpen ? { open: '' } : {},
          on: {
            toggle: (event) => {
              if (event.target instanceof HTMLDetailsElement) state.upToDateOpen = event.target.open;
            },
          },
        },
        h('summary', { class: 'cursor-pointer text-[12px] font-bold text-muted', attrs: { 'data-focus': 'cr-uptodate-toggle' } }, tp('crImport.preview.upToDateTitle', upToDate.length)),
        h('ul', { class: 'm-0 mt-2 flex list-none flex-col gap-1.5 p-0' }, ...upToDate.map((item) => renderItem(item, false, true, platform))),
      ),

    h('div', { class: 'flex justify-start border-t border-dotted border-line pt-3' }, ghostButton(t('crImport.restart'), 'cr-restart', () => void restart(), 'text-muted', running)),
  ];
}

function render(): HTMLElement {
  let body: Child[];
  const job = state.job;
  if (!state.loaded) {
    body = [statusLine(t('crImport.loading'))];
  } else if (job?.status === 'running' && job.kind === 'cr-analyze') {
    body = renderRunningJob(job);
  } else if (state.plan) {
    body = [
      ...(job?.kind === 'cr-apply' && job.status === 'running' ? renderRunningJob(job) : []),
      job?.kind === 'cr-apply' && job.status !== 'running' ? renderApplySummary(job) : null,
      ...renderPreview(state.plan, job?.status === 'running'),
    ];
  } else if (job?.kind === 'cr-analyze' && job.status !== 'done') {
    body = renderAnalyzeEnded(job);
  } else if (state.step.kind === 'reading') {
    body = renderReading(state.step);
  } else if (state.step.kind === 'netflix') {
    body = renderNetflix(state.step);
  } else if (state.step.kind === 'starting') {
    body = [statusLine(t('crImport.analyze.starting'))];
  } else {
    body = renderConnect(state.step);
  }
  return h(
    'div',
    { class: `${CARD} flex flex-col gap-4 p-5 shadow-pop` },
    renderHeader(),
    state.notice && h('p', { class: 'm-0 text-[12px] font-bold text-mint', attrs: { role: 'status' } }, state.notice),
    state.error && renderAlert({ message: state.error }),
    ...nodes(body),
  );
}

// ─── Démarrage ────────────────────────────────────────────────────────────

await initI18n();
document.title = t('crImport.pageTitle');
onLocaleChange(() => {
  document.title = t('crImport.pageTitle');
  draw();
});
draw();
try {
  await loadStored();
  state.hostAccess = await hasSourceAccess(state.platform);
} catch (error: unknown) {
  log.error('Lecture de l’état de l’import impossible :', error);
  state.error = t('crImport.error.unexpected');
}
state.loaded = true;
draw();
void refreshTab();
log.debug(`Page d’import prête (${state.platform}, ${getLocale()})`);
