import { getLocale, initI18n, onLocaleChange, t, tp, type MessageKey } from '../i18n';
import { CR_HISTORY_PORT_NAME, isCrHistoryPortMessage } from '../shared/content-messages';
import type { CrHistoryErrorCode, CrHistoryResult } from '../shared/cr-history';
import {
  CR_IMPORT_KEYS,
  defaultSelection,
  hasUpdate,
  isCrImportJob,
  isCrImportPlan,
  planCounts,
  type CrImportJob,
  type CrImportPlan,
  type CrPlanItem,
  type CrReviewItem,
  type CrServicePlan,
} from '../shared/cr-import';
import { dismissCrImportJob, resetCrImport } from '../shared/cr-import-store';
import { hasHostAccess, requestHostAccess } from '../shared/host-access';
import { isJobActive } from '../shared/job';
import { createLogger } from '../shared/logger';
import { sendMessage } from '../shared/messages';
import { STORAGE_KEYS } from '../shared/storage';
import { TRACKER_LABELS } from '../shared/tracker.types';
import { h, nodes, preserveFocus, type Child } from '../ui/dom';
import { icon, kai } from '../ui/icons';
import { renderAlert } from '../popup/components/alert';
import { jobPauseText } from '../popup/components/job-pause';
import { TONE_CHIP } from '../popup/feedback';
import { BTN_GHOST, BTN_PRIMARY, CARD, renderCover, SERVICE_CHIPS } from '../popup/components/ui';

const log = createLogger('import-cr');

// Page « Importer depuis Crunchyroll » (onglet ouvert depuis Réglages › Sauvegarde) :
// a) onglet Crunchyroll trouvé (ou ouvert), b) lecture de l'historique par son script de contenu (port),
// c) analyse en tâche de fond, d) aperçu, e) application en tâche de fond. Les tâches et l'aperçu vivent dans
// chrome.storage.local : la page peut être fermée puis rouverte, elle reprend où en est l'import.

/** Onglets où le script de contenu peut lire l'historique (même origine que l'API) */
const CR_TAB_PATTERN = 'https://www.crunchyroll.com/*';
const CR_HOME = 'https://www.crunchyroll.com/';
/** Accès demandé sur Firefox s'il a été retiré (script de contenu et API Crunchyroll) */
const CR_ORIGINS = ['*://*.crunchyroll.com/*'];
const TAB_POLL_MS = 2_000;
/** Script de contenu pas encore prêt (onglet en chargement) : nouvelles tentatives avant de proposer de recharger */
const CONNECT_RETRY_MS = [1_000, 2_000, 3_000] as const;

type Step =
  | { kind: 'connect'; tabId: number | null; tabTitle: string | null; opening: boolean; error: string | null; reloadTabId: number | null }
  | { kind: 'reading'; tabId: number; pages: number; items: number; lookups: number; lookupsTotal: number }
  | { kind: 'starting' };

interface PageState {
  loaded: boolean;
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
const state: PageState = {
  loaded: false,
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

// ─── a) Onglet Crunchyroll ────────────────────────────────────────────────

async function findCrTab(): Promise<chrome.tabs.Tab | null> {
  try {
    const tabs = await chrome.tabs.query({ url: CR_TAB_PATTERN });
    return tabs.find((tab) => tab.id !== undefined && tab.status === 'complete') ?? tabs.find((tab) => tab.id !== undefined) ?? null;
  } catch (error: unknown) {
    log.warn('Recherche de l’onglet Crunchyroll impossible :', error);
    return null;
  }
}

async function refreshTab(): Promise<void> {
  if (state.step.kind !== 'connect') return;
  const tab = await findCrTab();
  if (state.step.kind !== 'connect') return;
  state.step = { ...state.step, tabId: tab?.id ?? null, tabTitle: tab?.title ?? null, opening: state.step.opening && !tab };
  draw();
}

async function openCrunchyroll(): Promise<void> {
  if (state.step.kind !== 'connect') return;
  state.step = { ...state.step, opening: true, error: null };
  draw();
  try {
    // Ouvert en arrière-plan : la page d'import suit l'onglet (connexion éventuelle à faire dans celui-ci)
    await chrome.tabs.create({ url: CR_HOME, active: false });
  } catch (error: unknown) {
    log.warn('Ouverture de Crunchyroll impossible :', error);
    if (state.step.kind === 'connect') state.step = { ...state.step, opening: false, error: t('crImport.connect.openFailed') };
  }
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

function backToConnect(tabId: number | null, error: string | null, reloadTabId: number | null = null): void {
  port = null;
  state.step = { kind: 'connect', tabId, tabTitle: null, opening: false, error, reloadTabId };
  draw();
  void refreshTab();
}

function startReading(tabId: number, attempt = 0): void {
  state.error = null;
  state.notice = null;
  state.step = { kind: 'reading', tabId, pages: 0, items: 0, lookups: 0, lookupsTotal: 0 };
  draw();
  let next: chrome.runtime.Port;
  try {
    next = chrome.tabs.connect(tabId, { name: CR_HISTORY_PORT_NAME, frameId: 0 });
  } catch (error: unknown) {
    log.warn('Port vers l’onglet Crunchyroll non ouvert :', error);
    backToConnect(tabId, t('crImport.read.error.noScript'), tabId);
    return;
  }
  port = next;
  let answered = false;
  next.onMessage.addListener((raw: unknown) => {
    if (port !== next || !isCrHistoryPortMessage(raw)) return;
    answered = true;
    if (raw.type === 'progress') {
      if (state.step.kind === 'reading') state.step = { ...state.step, pages: raw.pages, items: raw.items, lookups: raw.lookups, lookupsTotal: raw.lookupsTotal };
      draw();
    } else if (raw.type === 'error') {
      next.disconnect();
      backToConnect(tabId, t(READ_ERRORS[raw.code]));
    } else {
      next.disconnect();
      port = null;
      void startAnalysis(raw.result);
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
      backToConnect(tabId, t('crImport.read.error.noScript'), tabId);
      return;
    }
    setTimeout(() => {
      if (state.step.kind === 'reading' && state.step.tabId === tabId) startReading(tabId, attempt + 1);
    }, wait);
  });
  next.postMessage({ type: 'READ_CR_HISTORY' });
}

function stopReading(): void {
  const current = port;
  const tabId = state.step.kind === 'reading' ? state.step.tabId : null;
  port = null;
  current?.disconnect();
  backToConnect(tabId, null);
}

// ─── c) Analyse, e) application ───────────────────────────────────────────

async function startAnalysis(history: CrHistoryResult): Promise<void> {
  state.step = { kind: 'starting' };
  draw();
  try {
    const result = await sendMessage('CR_IMPORT_ANALYZE', { history });
    if (!result.ok) {
      backToConnect(null, result.message);
      return;
    }
    state.job = result.data;
    state.plan = null;
    state.step = { kind: 'connect', tabId: null, tabTitle: null, opening: false, error: null, reloadTabId: null };
    if (history.stats.partial) state.notice = t('crImport.read.partial');
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
  if (paused && tickTimer === undefined) tickTimer = setInterval(draw, 1_000);
  if (!paused && tickTimer !== undefined) {
    clearInterval(tickTimer);
    tickTimer = undefined;
  }
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
      h('p', { class: 'm-0 text-[12px] text-muted' }, t('crImport.subtitle')),
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

function renderConnect(step: Extract<Step, { kind: 'connect' }>): Child[] {
  const intro = h('p', { class: 'm-0 text-[12px] text-muted' }, t('crImport.intro'));
  if (!state.connected) return [intro, renderAlert({ message: t('crImport.error.notConnected') })];
  if (!state.hostAccess) {
    return [
      intro,
      h('p', { class: 'm-0 text-[12px] font-bold text-butter' }, t('crImport.connect.access')),
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
                void requestHostAccess(CR_ORIGINS).then((granted) => {
                  state.hostAccess = granted;
                  draw();
                  void refreshTab();
                }),
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
          h('span', { class: 'truncate' }, step.tabTitle ? t('crImport.connect.foundTitled', { title: step.tabTitle }) : t('crImport.connect.found')),
        )
      : step.opening
        ? statusLine(t('crImport.connect.waiting'))
        : h('p', { class: 'm-0 text-[12px] text-muted' }, t('crImport.connect.none'));
  const tabId = step.tabId;
  return [
    intro,
    h('ul', { class: 'm-0 flex list-disc flex-col gap-1 pl-5 text-[12px] text-muted' }, h('li', {}, t('crImport.rule.never')), h('li', {}, t('crImport.rule.preview')), h('li', {}, t('crImport.rule.privacy'))),
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
        : h('button', { class: BTN_PRIMARY, attrs: { type: 'button', 'data-focus': 'cr-open', ...(step.opening ? { disabled: '' } : {}) }, on: { click: () => void openCrunchyroll() } }, t('crImport.connect.open')),
    ),
  ];
}

function renderReading(step: Extract<Step, { kind: 'reading' }>): Child[] {
  const text =
    step.lookupsTotal > 0
      ? t('crImport.read.lookups', { done: step.lookups, total: step.lookupsTotal })
      : step.pages > 0
        ? t('crImport.read.progress', { pages: step.pages, items: step.items })
        : t('crImport.read.starting');
  return [
    statusLine(text),
    step.lookupsTotal > 0 && progressBar(step.lookups, step.lookupsTotal, t('crImport.read.progressAria')),
    h('p', { class: 'm-0 text-[11px] text-muted' }, t('crImport.read.keepTab')),
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
          { class: `${BTN_GHOST} h-7 px-2.5 text-[11px] text-danger`, attrs: { type: 'button', 'data-focus': 'cr-job-stop', ...(job.cancelled ? { disabled: '' } : {}) }, on: { click: () => void cancelJob() } },
          job.cancelled ? t('compare.job.stopping') : t('compare.job.stop'),
        ),
      ),
      progressBar(done, total, analyzing ? t('crImport.analyze.progressAria') : t('crImport.apply.progressAria')),
      pause && h('p', { class: 'm-0 flex items-center gap-1.5 text-[11px] font-bold text-butter', attrs: { role: 'status' } }, icon('clock', 'h-3 w-3 shrink-0'), pause),
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
      attrs: { title: `${label} : ${text}` },
    },
    h('span', { class: `rounded-full px-1 text-on-fill ${chip.class}` }, chip.short),
    h('span', { class: 'sr-only' }, `${label} : `),
    text,
  );
}

function renderItem(item: CrPlanItem, selectable: boolean, disabled: boolean): HTMLElement {
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
      h('span', { class: 'truncate text-[11px] text-muted', attrs: { title: item.seasons.join('\n') } }, `Crunchyroll : ${item.seasons.join(' · ')}`),
      h('div', { class: 'flex flex-wrap gap-1' }, ...item.services.map(serviceChip)),
      item.result &&
        h(
          'span',
          {
            class: `text-[11px] font-bold ${item.result.outcome === 'updated' ? 'text-mint' : item.result.outcome === 'failed' ? 'text-danger' : 'text-muted'}`,
            attrs: item.result.outcome === 'failed' ? { role: 'alert' } : {},
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
    plan.failed > 0 && tp('crImport.preview.failed', plan.failed),
  ].filter((p): p is string => typeof p === 'string');

  const allChecked = selectable.length > 0 && selectable.every((i) => state.selected.has(i.id));
  return [
    h('p', { class: 'm-0 text-[12px] text-muted' }, summary.join(' · ')),
    plan.stats.partial && h('p', { class: 'm-0 text-[12px] font-bold text-butter' }, t('crImport.read.partial')),
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
        ? h('ul', { class: 'm-0 flex list-none flex-col gap-1.5 p-0' }, ...toUpdate.map((item) => renderItem(item, true, disabled)))
        : h('p', { class: 'm-0 text-[12px] text-muted' }, t('crImport.preview.nothing')),
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
        h('ul', { class: 'm-0 mt-2 flex list-none flex-col gap-1.5 p-0' }, ...upToDate.map((item) => renderItem(item, false, true))),
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
  state.hostAccess = await hasHostAccess(CR_ORIGINS);
} catch (error: unknown) {
  log.error('Lecture de l’état de l’import impossible :', error);
  state.error = t('crImport.error.unexpected');
}
state.loaded = true;
draw();
void refreshTab();
log.debug(`Page d’import Crunchyroll prête (${getLocale()})`);
