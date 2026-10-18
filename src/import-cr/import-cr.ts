import { getLocale, initI18n, onLocaleChange, t, tp } from '../i18n';
import type { CrHistoryResult } from '../platforms/crunchyroll/history';
import { CR_IMPORT_KEYS, IMPORT_PLATFORMS, isCrImportJob, isCrImportPlan, isImportPlatform, type ImportPlatform } from '../shared/cr-import';
import { dismissCrImportJob, resetCrImport } from '../browser/storage/cr-import-store';
import { isJobActive } from '../shared/job';
import { createLogger } from '../browser/logger';
import { sendMessage } from '../protocol/messages';
import { hasMalToken, hasValidAniListToken } from '../browser/storage/tokens';
import { STORAGE_KEYS } from '../protocol/storage-keys';
import type { ImportActions } from './actions';
import { mountImportApp } from './components/import-app';
import { isSelectable, partialNotice } from './preview';
import { findSourceTab } from './sources/source';
import { SOURCES } from './sources/registry';
import { platformParams } from './sources/sites';
import { connectStep, isRunning, publish, setPlan, state, type StepAlert } from './state';
import { readStep } from './view';

const log = createLogger('import-cr');

// Page « Importer un historique » (onglet ouvert depuis Réglages › Mes données, ou depuis la barre d'état avec
// ?platform=<plateforme>) : a) plateforme choisie, onglet trouvé (ou ouvert), b) lecture de l'historique par sa source
// (sources/ : port vers les lecteurs injectés ; ADN : réduit ici par saison ; Netflix : onglet piloté d'ici, filtre
// « anime » puis points de lecture), c) analyse en tâche de fond, d) aperçu, e) application en tâche de fond. Les tâches et
// l'aperçu vivent dans chrome.storage.local : la page peut être fermée puis rouverte, elle reprend où en est l'import.
// Une seule analyse ou un seul aperçu à la fois, toutes plateformes confondues (« Recommencer » pour changer).
// Logique ici, rendu Preact dans components/ (état publié par state.ts › publish).

const TAB_POLL_MS = 2_000;

/** Lecture en cours : l'arrêter (« Arrêter », autre lecture, page fermée) ferme son port ou stoppe le pilotage de l'onglet */
let reading: AbortController | null = null;
let pollTimer: ReturnType<typeof setTimeout> | undefined;

/** Publie l'état (nouveau rendu) et relance l'attente d'un onglet si besoin */
function draw(): void {
  publish();
  scheduleTimers();
}

// ─── Lecture du stockage ──────────────────────────────────────────────────

async function loadStored(): Promise<void> {
  const stored = await chrome.storage.local.get([CR_IMPORT_KEYS.job, CR_IMPORT_KEYS.plan]);
  const job: unknown = stored[CR_IMPORT_KEYS.job];
  const plan: unknown = stored[CR_IMPORT_KEYS.plan];
  state.job = isCrImportJob(job) ? job : null;
  setPlan(isCrImportPlan(plan) ? plan : null);
  // Comme les autres écrans : AniList seulement avec un token non expiré (le service worker refuse l'import sinon), MAL avec le sien
  state.connected = (await hasValidAniListToken()) || (await hasMalToken());
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

// ─── a) Plateforme, accès et onglets ──────────────────────────────────────

/** Onglet de chaque plateforme (tuiles du choix), relu tant que l'écran de connexion est affiché */
async function refreshTabs(): Promise<void> {
  if (state.step.kind !== 'connect') return;
  const tabs = await Promise.all(IMPORT_PLATFORMS.map((platform) => findSourceTab(SOURCES[platform])));
  if (state.step.kind !== 'connect') return;
  IMPORT_PLATFORMS.forEach((platform, index) => {
    const tab = tabs[index] ?? null;
    state.platforms[platform] = { ...state.platforms[platform], tabId: tab?.id ?? null, tabTitle: tab?.title ?? null };
  });
  // Onglet ouvert par « Ouvrir … » trouvé : fin de l'attente
  if (state.step.opening && state.platforms[state.platform].tabId !== null) state.step = { ...state.step, opening: false };
  draw();
}

/** Accès de chaque plateforme (Netflix : accès optionnel ; Crunchyroll / ADN : accès retiré sur Firefox) */
async function refreshAccess(): Promise<void> {
  const access = await Promise.all(IMPORT_PLATFORMS.map((platform) => SOURCES[platform].hasAccess().catch(() => false)));
  IMPORT_PLATFORMS.forEach((platform, index) => {
    state.platforms[platform] = { ...state.platforms[platform], access: access[index] ?? false };
  });
}

async function openPlatform(): Promise<void> {
  if (state.step.kind !== 'connect') return;
  const platform = state.platform;
  state.step = { ...state.step, opening: true, alert: null };
  draw();
  try {
    // Ouvert en arrière-plan : la page d'import suit l'onglet (connexion éventuelle à faire dans celui-ci)
    await chrome.tabs.create({ url: SOURCES[platform].home, active: false });
  } catch (error: unknown) {
    log.warn('Ouverture de la plateforme impossible :', error);
    if (state.step.kind === 'connect') state.step = { kind: 'connect', opening: false, alert: { text: t('crImport.connect.openFailed', platformParams(platform)), tone: 'error', reloadTabId: null } };
  }
  await refreshTabs();
}

/** Autre plateforme choisie (étape de connexion seulement) : choix gardé dans l'URL */
function choosePlatform(platform: ImportPlatform): void {
  if (state.step.kind !== 'connect' || state.platform === platform) return;
  state.platform = platform;
  state.step = connectStep();
  state.error = null;
  state.notice = null;
  const url = new URL(location.href);
  url.searchParams.set('platform', platform);
  window.history.replaceState(null, '', url);
  draw();
  void refreshTabs();
}

/** « Autoriser l'accès » : demande directe dans le clic (Firefox exige un geste utilisateur sans await préalable) */
function requestAccess(platform: ImportPlatform): void {
  SOURCES[platform].requestAccess().then(
    (granted) => {
      state.platforms[platform] = { ...state.platforms[platform], access: granted };
      draw();
      void refreshTabs();
    },
    (error: unknown) => log.warn('Demande d’accès impossible :', error),
  );
}

function showTab(tabId: number): void {
  void chrome.tabs.update(tabId, { active: true }).catch(() => undefined);
}

function reloadTab(tabId: number): void {
  void chrome.tabs.reload(tabId).then(
    () => backToConnect(null),
    () => backToConnect(null),
  );
}

// ─── b) Lecture de l'historique (source de la plateforme, voir sources/) ──

function backToConnect(alert: StepAlert | null): void {
  reading?.abort();
  reading = null;
  state.step = connectStep(alert);
  draw();
  void refreshTabs();
}

function startReading(tabId: number): void {
  // « Arrêter » puis « Lire » pendant l'attente d'une nouvelle tentative : une seule lecture de l'historique à la fois
  reading?.abort();
  const controller = new AbortController();
  reading = controller;
  const source = SOURCES[state.platform];
  state.error = null;
  state.notice = null;
  state.step = readStep(state.step, source.initialProgress, tabId);
  draw();
  const current = (): boolean => reading === controller && !controller.signal.aborted;
  void source
    .read(tabId, {
      signal: controller.signal,
      progress: (progress) => {
        if (!current()) return;
        state.step = readStep(state.step, progress, tabId);
        draw();
      },
    })
    .then((outcome) => {
      // Arrêtée ou remplacée entre-temps : l'écran a déjà changé
      if (!current() || outcome.kind === 'stopped') return;
      reading = null;
      if (outcome.kind === 'done') {
        void startAnalysis(outcome.history, source.id);
        return;
      }
      // Échec (erreur), ou historique Netflix vide / sans anime (information)
      const text = outcome.error ?? outcome.notice ?? null;
      backToConnect(text === null ? null : { text, tone: outcome.error === null ? 'info' : 'error', reloadTabId: outcome.reloadTabId });
    });
}

function stopReading(): void {
  backToConnect(null);
}

// ─── c) Analyse ───────────────────────────────────────────────────────────

async function startAnalysis(history: CrHistoryResult, platform: ImportPlatform): Promise<void> {
  state.step = { kind: 'starting' };
  draw();
  try {
    const result = await sendMessage('CR_IMPORT_ANALYZE', { history, platform });
    if (!result.ok) {
      // Historique sans épisode terminé : information, rien n'est analysé
      backToConnect({ text: result.message, tone: result.code === 'EMPTY' ? 'info' : 'error', reloadTabId: null });
      return;
    }
    state.job = result.data;
    state.plan = null;
    state.step = connectStep();
    if (history.stats.partial) state.notice = partialNotice(history.stats);
  } catch (error: unknown) {
    log.error('Analyse non démarrée :', error);
    backToConnect({ text: t('crImport.error.unexpected'), tone: 'error', reloadTabId: null });
    return;
  }
  draw();
}

// ─── d) Aperçu : sélection ────────────────────────────────────────────────

function toggleItem(id: string, checked: boolean): void {
  if (checked) state.selected.add(id);
  else state.selected.delete(id);
  draw();
}

/** « Tout cocher » / « Tout décocher » : lignes pas encore écrites */
function toggleAll(): void {
  const selectable = (state.plan?.items ?? []).filter(isSelectable).map((item) => item.id);
  state.selected = selectable.every((id) => state.selected.has(id)) ? new Set() : new Set(selectable);
  draw();
}

function toggleReview(key: string, checked: boolean): void {
  if (checked) state.reviewSelected.add(key);
  else state.reviewSelected.delete(key);
  draw();
}

function setUpToDateOpen(open: boolean): void {
  state.upToDateOpen = open;
  draw();
}

// ─── e) Import, vérifications ─────────────────────────────────────────────

async function applySelected(): Promise<void> {
  if (!state.plan || state.selected.size === 0 || state.busy) return;
  state.busy = 'apply';
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
  state.busy = null;
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
  if (state.reviewSelected.size === 0 || state.busy) return;
  state.busy = 'reviews';
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
  state.busy = null;
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
  backToConnect(null);
}

async function dismissJob(): Promise<void> {
  if (state.job?.status === 'running') return;
  await dismissCrImportJob();
}

// ─── Attente d'un onglet ──────────────────────────────────────────────────

function scheduleTimers(): void {
  clearTimeout(pollTimer);
  pollTimer = undefined;
  // Écran de connexion : onglets relus (ouverts ou fermés ailleurs), les tuiles suivent
  const choosing = state.loaded && state.step.kind === 'connect' && !state.plan && !isRunning();
  if (choosing && !document.hidden) pollTimer = setTimeout(() => void refreshTabs(), TAB_POLL_MS);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden || !state.loaded) return;
  // Accès changé dans les Réglages, onglet ouvert entre-temps
  void refreshAccess().then(refreshTabs);
});
window.addEventListener('pagehide', () => reading?.abort());

// ─── Démarrage ────────────────────────────────────────────────────────────

const actions: ImportActions = {
  choosePlatform,
  openPlatform: () => void openPlatform(),
  requestAccess,
  read: startReading,
  stopReading,
  showTab,
  reloadTab,
  cancelJob: () => void cancelJob(),
  restart: () => void restart(),
  toggleItem,
  toggleAll,
  applySelected: () => void applySelected(),
  toggleReview,
  createReviews: () => void createReviews(),
  setUpToDateOpen,
  dismissJob: () => void dismissJob(),
};

const requested = new URLSearchParams(location.search).get('platform');
if (isImportPlatform(requested)) state.platform = requested;

await initI18n();
document.title = t('crImport.pageTitle');
onLocaleChange(() => {
  document.title = t('crImport.pageTitle');
});
const app = document.getElementById('app');
publish();
if (app) mountImportApp(app, actions);
try {
  await Promise.all([loadStored(), refreshAccess()]);
} catch (error: unknown) {
  log.error('Lecture de l’état de l’import impossible :', error);
  state.error = t('crImport.error.unexpected');
}
state.loaded = true;
draw();
void refreshTabs();
log.debug(`Page d’import prête (${state.platform}, ${getLocale()})`);
