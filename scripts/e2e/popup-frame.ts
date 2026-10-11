// Page de test : monte le VRAI popup (src/popup/popup.ts) sur l'API chrome simulée des captures du Store,
// avec un service worker simulé à état (les séries retirées ne reviennent pas à la revalidation) et des traces
// (messages envoyés, demandes d'accès, presse-papiers) lues par les tests via `window.__e2e`.
import '../../src/popup/popup.css';
import manifest from '../../manifest.json';
import { t } from '../../src/i18n';
import type { CompareJob } from '../../src/shared/compare-job';
import { DIAGNOSTICS_LOG_KEY, type JournalEntry } from '../../src/shared/error-journal';
import { isRecord } from '../../src/shared/guards';
import type { PageMediaResult, PageMediaView } from '../../src/shared/page-media.types';
import { STORAGE_KEYS } from '../../src/shared/storage-keys';
import type { ServiceOutcome, SyncOutcome } from '../../src/shared/sync.types';
import { isTrackerId, TRACKER_IDS, type TrackerId } from '../../src/shared/tracker.types';
import type { WatchingEntry, WatchingList } from '../../src/shared/watching.types';
import { demoChrome, pageView, watchingList, type Scenario } from '../screenshots/demo-data';
import { installChromeMock } from '../screenshots/mock-chrome';
import { localeParam, param } from '../screenshots/params';
import { popupTimeouts } from '../../src/popup/timeouts';
import { E2E_ADJUST_SLOW_MS, E2E_PERSIST_KEY, E2E_WATCHING_SLOW_MS, E2E_WATCHING_TIMEOUT_MS, PLANTED_SECRETS, type E2EState } from './protocol';

const SCENARIOS: readonly Scenario[] = ['watching', 'page', 'activity', 'compare', 'settings'];
const scenario = SCENARIOS.find((s) => s === param('scenario')) ?? 'watching';
const now = Date.now();
const far = now + 30 * 24 * 3_600_000;
/**
 * Pas de cache, délai raccourci ; premier GET_WATCHING : `watching=hang` ne répond jamais (service worker
 * bloqué), `watching=slow` répond après le délai d'attente (service worker lent)
 */
const watchingMode = param('watching');
const hangWatching = watchingMode === 'hang';
const slowWatching = watchingMode === 'slow';
let watchingCalls = 0;
if (hangWatching || slowWatching) popupTimeouts.watchingMs = E2E_WATCHING_TIMEOUT_MS;

const trace: E2EState = { messages: [], permissionRequests: [], permissionRemovals: [], clipboard: [] };
window.__e2e = trace;

// Presse-papiers simulé : déterministe en headless, sans permission à accorder
Object.defineProperty(navigator, 'clipboard', {
  configurable: true,
  value: {
    writeText: (text: string): Promise<void> => {
      trace.clipboard.push(text);
      return Promise.resolve();
    },
  },
});

// Nouvelle navigation : on repart des données de démo ; rechargement (changement de langue) : stockage conservé
const [navigation] = performance.getEntriesByType('navigation');
if (!(navigation instanceof PerformanceNavigationTiming && navigation.type === 'reload')) sessionStorage.removeItem(E2E_PERSIST_KEY);

// ─── Service worker simulé (à état) ─────────────────────────────────────────

const lists: Record<TrackerId, WatchingList> = { anilist: watchingList('anilist', now), mal: watchingList('mal', now) };

const numberField = (payload: unknown, key: string): number | null => (isRecord(payload) && typeof payload[key] === 'number' ? payload[key] : null);

/** Même résultat sur les deux services connectés */
function synced(mediaTitle: string, outcome: ServiceOutcome): SyncOutcome {
  return { status: 'synced', mediaTitle, results: TRACKER_IDS.map((service) => ({ service, outcome })) };
}

function findEntry(mediaId: number | null): WatchingEntry | undefined {
  return lists.anilist.entries.find((e) => e.mediaId === mediaId);
}

/** Applique `update` à la série dans les deux listes (null : la série quitte « En cours ») */
function patchEntry(mediaId: number, update: (entry: WatchingEntry) => WatchingEntry | null): void {
  for (const service of TRACKER_IDS) {
    const entries = lists[service].entries.flatMap((e) => {
      if (e.mediaId !== mediaId) return [e];
      const next = update(e);
      return next ? [next] : [];
    });
    lists[service] = { ...lists[service], entries };
  }
}

/** `adjust=partial` : MyAnimeList échoue au +1 / −1 ; le nouvel essai (`retry`) n'écrit que MAL, à la progression absolue */
const partialAdjust = param('adjust') === 'partial';

function adjustProgress(payload: unknown): SyncOutcome {
  const entry = findEntry(numberField(payload, 'mediaId'));
  const delta = numberField(payload, 'delta');
  if (!entry || entry.mediaId === null || (delta !== 1 && delta !== -1)) return { status: 'error', message: 'Série inconnue (e2e)' };
  const retried = isRecord(payload) ? numberField(payload.retry, 'progress') : null;
  if (retried !== null) return { status: 'synced', mediaTitle: entry.title, results: [{ service: 'mal', outcome: { status: 'updated', progress: retried, completed: false } }] };
  const progress = entry.progress + delta;
  patchEntry(entry.mediaId, (e) => ({ ...e, progress }));
  if (!partialAdjust) return synced(entry.title, { status: 'updated', progress, completed: false });
  return {
    status: 'synced',
    mediaTitle: entry.title,
    results: [
      { service: 'anilist', outcome: { status: 'updated', progress, completed: false } },
      { service: 'mal', outcome: { status: 'error', message: 'Service indisponible (e2e)' } },
    ],
  };
}

function setListStatus(payload: unknown): SyncOutcome {
  const entry = findEntry(numberField(payload, 'mediaId'));
  if (!entry || entry.mediaId === null) return { status: 'error', message: 'Série inconnue (e2e)' };
  patchEntry(entry.mediaId, () => null);
  return synced(entry.title, { status: 'updated', progress: entry.progress, completed: false });
}

/** Fiche de la page ; `pageList=missing` : absente des deux listes (boutons « Ajouter ») */
function resolvePage(): PageMediaView {
  const view = pageView();
  if (param('pageList') !== 'missing') return view;
  return {
    ...view,
    lists: [
      { service: 'anilist', state: 'not-in-list', siteUrl: 'https://anilist.co/anime/146065' },
      { service: 'mal', state: 'not-in-list', siteUrl: 'https://myanimelist.net/anime/51179' },
    ],
  };
}

/** Alignement accepté : tâche en cours (la progression arriverait ensuite par le stockage) */
function applyDiffs(payload: unknown): { ok: true; data: CompareJob } | { ok: false; code: 'INVALID'; message: string } {
  if (!isRecord(payload) || !isTrackerId(payload.source) || !Array.isArray(payload.items)) return { ok: false, code: 'INVALID', message: 'Payload invalide (e2e)' };
  const pending = payload.items.flatMap((item: unknown) =>
    isRecord(item) ? [{ mediaId: numberField(item, 'mediaId'), malId: numberField(item, 'malId') }] : [],
  );
  const job: CompareJob = {
    kind: 'apply',
    source: payload.source,
    status: 'running',
    total: pending.length,
    done: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    pending,
    cancelled: false,
    startedAt: now,
    updatedAt: Date.now(),
    message: null,
    messages: [],
    pausedUntil: null,
    pauseReason: null,
    pauseService: null,
  };
  return { ok: true, data: job };
}

// ─── Installation ───────────────────────────────────────────────────────────

const demo = demoChrome(localeParam(), scenario, now);
const journal: JournalEntry[] = [
  // Fuite simulée : le rapport doit masquer le token même s'il apparaît dans un message d'erreur
  { at: now - 5 * 60_000, level: 'error', scope: 'sync', message: `AniList 401 (Bearer ${PLANTED_SECRETS.anilistAccess})` },
];

installChromeMock({
  ...demo,
  storage: {
    ...demo.storage,
    [STORAGE_KEYS.anilistToken]: { accessToken: PLANTED_SECRETS.anilistAccess, expiresAt: far },
    [STORAGE_KEYS.malToken]: { accessToken: PLANTED_SECRETS.malAccess, refreshToken: PLANTED_SECRETS.malRefresh, expiresAt: far },
    [DIAGNOSTICS_LOG_KEY]: journal,
    ...(hangWatching || slowWatching ? { [STORAGE_KEYS.watchingCache]: {} } : {}),
  },
  handlers: {
    ...demo.handlers,
    GET_WATCHING: (payload) => {
      const first = ++watchingCalls === 1;
      if (hangWatching && first) return new Promise<never>(() => {});
      const service: TrackerId = isRecord(payload) && payload.service === 'mal' ? 'mal' : 'anilist';
      const result = { ok: true, data: lists[service] };
      return slowWatching && first ? new Promise((resolve) => setTimeout(() => resolve(result), E2E_WATCHING_SLOW_MS)) : result;
    },
    // `adjust=slow` : réponse retardée (le +1 reste en cours d'envoi un moment)
    ADJUST_PROGRESS: (payload) =>
      param('adjust') === 'slow' ? new Promise<SyncOutcome>((resolve) => setTimeout(() => resolve(adjustProgress(payload)), E2E_ADJUST_SLOW_MS)) : adjustProgress(payload),
    SET_LIST_STATUS: setListStatus,
    ADD_TO_LIST: () => synced(pageView().media.title, { status: 'updated', progress: 0, completed: false }),
    RESOLVE_PAGE_MEDIA: (): PageMediaResult =>
      // `pageMedia=untracked` : série ignorée par la synchro (Netflix, pas un anime)
      param('pageMedia') === 'untracked' ? { ok: false, code: 'NOT_TRACKED', message: t('page.notTracked') } : { ok: true, data: resolvePage() },
    APPLY_DIFFS: applyDiffs,
  },
  onSendMessage: (message) => trace.messages.push(message),
  permissions: {
    granted: param('hostAccess') !== 'missing',
    onRequest: (origins) => {
      trace.permissionRequests.push(origins);
      return true;
    },
    // Netflix : accès optionnel, non accordé au départ
    optional: manifest.optional_host_permissions,
    onRemove: (origins) => trace.permissionRemovals.push(origins),
  },
  manifest: { host_permissions: manifest.host_permissions, content_scripts: manifest.content_scripts },
  persistKey: E2E_PERSIST_KEY,
});

await import('../../src/popup/popup.ts');
