// Page de test : monte le VRAI popup (src/popup/popup.ts) sur l'API chrome simulée des captures du Store,
// avec un service worker simulé à état (les séries retirées ne reviennent pas à la revalidation) et des traces
// (messages envoyés, demandes d'accès, presse-papiers) lues par les tests via `window.__e2e`.
import '../../src/popup/popup.css';
import manifest from '../../manifest.json';
import { t } from '../../src/i18n';
import type { CompareJob } from '../../src/shared/compare-job';
import { DIAGNOSTICS_LOG_KEY, type JournalEntry } from '../../src/browser/error-journal';
import { diagnosticsReport } from '../../src/background/diagnostics-report';
import { isRecord } from '../../src/shared/guards';
import { dateKey } from '../../src/shared/agenda';
import type { ActivityDay, ActivityHistory } from '../../src/shared/activity-history';
import type { ProfileStats } from '../../src/shared/profile-stats';
import type { PageMediaResult, PageMediaView } from '../../src/shared/page-media.types';
import type { ListNotesResult } from '../../src/shared/list-notes';
import { STORAGE_KEYS, SYNC_QUEUE_KEY } from '../../src/protocol/storage-keys';
import { SECTION_PREFS_KEY } from '../../src/popup/controllers/section-prefs';
import { isRecoBatch, type RecoItem } from '../../src/shared/recommendations';
import type { ServiceOutcome, SyncOutcome } from '../../src/shared/sync.types';
import { isTrackerId, TRACKER_IDS, type TrackerId } from '../../src/shared/tracker.types';
import type { WatchingEntry, WatchingList } from '../../src/shared/watching.types';
import { agendaWeek } from '../screenshots/demo-panel';
import { accountDemo, demoChrome, demoFriendsHandler, isAccountDemo, PAGE_INFO, pageView, recoHandlers, watchingList, type Scenario } from '../screenshots/demo-data';
import { installChromeMock } from '../screenshots/mock-chrome';
import { loadedUiLocaleParam, param } from '../screenshots/params';
import { popupTimeouts } from '../../src/popup/timeouts';
import { E2E_ADJUST_SLOW_MS, E2E_DORMANT_PACE_MS, E2E_RECO_MOVIE_TITLE, E2E_WATCHING_SLOW_MS, E2E_WATCHING_TIMEOUT_MS, PLANTED_SECRETS, type E2EState } from './protocol';

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
// « Tout mettre en pause » sans l'attente de 6 s entre deux séries (rythme vérifié par les tests unitaires) ; `pace=slow` :
// une attente courte, pour agir ailleurs pendant le lot
popupTimeouts.dormantPaceMs = param('pace') === 'slow' ? E2E_DORMANT_PACE_MS : 0;

const trace: E2EState = { messages: [], permissionRequests: [], permissionRemovals: [], clipboard: [], openedTabs: [] };
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

// ─── Service worker simulé (à état) ─────────────────────────────────────────

/** `watching=empty` : listes vides, cache compris (état vide « Rien en cours ») */
const emptyWatching = watchingMode === 'empty';
/** `remaining=backlog` : progression en retard (identifiant AniList → épisodes vus) ; Spy x Family reste à jour */
const BACKLOG: ReadonlyMap<number, number> = new Map([[185660, 3], [176496, 0], [154587, 1], [178754, 0], [21, 1100]]);
const remainingMode = param('remaining');
function withRemaining(entry: WatchingEntry): WatchingEntry {
  if (remainingMode === 'unknown') return { ...entry, episodeMinutes: null };
  const progress = remainingMode === 'backlog' && entry.mediaId !== null ? BACKLOG.get(entry.mediaId) : undefined;
  return progress === undefined ? entry : { ...entry, progress };
}
/**
 * `airing=mixed` : un statut de sortie par série (spec 2.5.0 §5.5) : Solo Leveling en pause sans date, Frieren terminée avec
 * deux épisodes à voir (sans pastille), Kaiju No. 8 annulée et à jour, Spy x Family pas encore sortie ; Dandadan et One Piece en diffusion
 */
const AIRING_MIXED: ReadonlyMap<number, Partial<WatchingEntry>> = new Map([
  [176496, { airingStatus: 'HIATUS', nextEpisode: null }],
  [178754, { airingStatus: 'CANCELLED', nextEpisode: null, progress: 11 }],
  [177937, { airingStatus: 'NOT_YET_RELEASED', nextEpisode: null }],
]);
const airingMixed = param('airing') === 'mixed';
const withAiring = (entry: WatchingEntry): WatchingEntry => ({ ...entry, ...(airingMixed && entry.mediaId !== null ? AIRING_MIXED.get(entry.mediaId) : undefined) });
/**
 * `dormant=on` : statut de liste connu (CURRENT) partout ; Frieren (75 j), Solo Leveling (50 j) et Kaiju No. 8 (40 j, deux
 * épisodes de retard) sans activité depuis plus de 30 jours : groupe « En sommeil ». `dormant=fail` : idem, mais la mise en pause
 * de Kaiju No. 8 est refusée en entier (« Tout mettre en pause » : bandeau « … · 1 en échec »)
 */
const dormantMode = param('dormant') === 'on' || param('dormant') === 'fail';
const KAIJU_ID = 178754;
const DAY_MS = 24 * 3_600_000;
const ASLEEP: ReadonlyMap<number, { days: number; progress?: number }> = new Map([[154587, { days: 75 }], [176496, { days: 50 }], [178754, { days: 40, progress: 2 }]]);
function withDormancy(entry: WatchingEntry): WatchingEntry {
  if (!dormantMode) return entry;
  const asleep = entry.mediaId !== null ? ASLEEP.get(entry.mediaId) : undefined;
  if (!asleep) return { ...entry, listStatus: 'CURRENT' };
  const at = now - asleep.days * DAY_MS;
  return { ...entry, listStatus: 'CURRENT', updatedAt: at, lastSync: entry.lastSync && { ...entry.lastSync, at }, progress: asleep.progress ?? entry.progress };
}
const demoList = (service: TrackerId): WatchingList => {
  const list = watchingList(service, now);
  return emptyWatching ? { ...list, entries: [] } : { ...list, entries: list.entries.map(withRemaining).map(withAiring).map(withDormancy) };
};
const lists: Record<TrackerId, WatchingList> = { anilist: demoList('anilist'), mal: demoList('mal') };

/** `viewer=missing` : profil MAL jamais chargé, premier GET_MAL_VIEWER en échec réseau, les suivants répondent */
const missingViewer = param('viewer') === 'missing';
let malViewerCalls = 0;

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

/** Séries sorties de « En cours » par un statut, pour « Annuler » (identifiant AniList → série) */
const parked = new Map<number, WatchingEntry>();

/**
 * Statut : la série quitte les deux listes ; CURRENT (« Annuler » des séries en sommeil) la remet en cours, fiche modifiée
 * maintenant. `services` limite l'écriture (résultats des seuls services visés)
 */
function setListStatus(payload: unknown): SyncOutcome {
  const mediaId = numberField(payload, 'mediaId');
  const services = isRecord(payload) && Array.isArray(payload.services) ? payload.services.filter(isTrackerId) : TRACKER_IDS;
  const written = (title: string, progress: number): SyncOutcome => ({ status: 'synced', mediaTitle: title, results: services.map((service) => ({ service, outcome: { status: 'updated', progress, completed: false } })) });
  if (isRecord(payload) && payload.status === 'CURRENT') {
    const back = mediaId !== null ? parked.get(mediaId) : undefined;
    if (!back || back.mediaId === null) return { status: 'error', message: 'Série inconnue (e2e)' };
    parked.delete(back.mediaId);
    for (const service of TRACKER_IDS) lists[service] = { ...lists[service], entries: [...lists[service].entries, { ...back, updatedAt: Date.now() }] };
    return written(back.title, back.progress);
  }
  const entry = findEntry(mediaId);
  if (!entry || entry.mediaId === null) return { status: 'error', message: 'Série inconnue (e2e)' };
  if (param('dormant') === 'fail' && entry.mediaId === KAIJU_ID) return { status: 'error', message: 'Service indisponible (e2e)' };
  parked.set(entry.mediaId, entry);
  patchEntry(entry.mediaId, () => null);
  return written(entry.title, entry.progress);
}

/** Série d'un payload { media: { mediaId } } (retrait, commentaire) */
const mediaOf = (payload: unknown): WatchingEntry | undefined => findEntry(isRecord(payload) ? numberField(payload.media, 'mediaId') : null);

/** « Retirer de la liste » : la série quitte les deux listes (la revalidation ne la ramène pas) */
function removeFromList(payload: unknown): SyncOutcome {
  const entry = mediaOf(payload);
  if (!entry || entry.mediaId === null) return { status: 'error', message: 'Série inconnue (e2e)' };
  patchEntry(entry.mediaId, () => null);
  return synced(entry.title, { status: 'updated', progress: 0, completed: false });
}

/** Commentaires enregistrés (identifiant AniList → texte) : Solo Leveling en a un au départ */
const notes = new Map<number, string>([[176496, 'Combat final à revoir']]);

function getListNotes(payload: unknown): ListNotesResult {
  const entry = mediaOf(payload);
  return { ok: true, data: { inList: entry !== undefined, notes: entry?.mediaId ? (notes.get(entry.mediaId) ?? null) : null } };
}

function setListNotes(payload: unknown): SyncOutcome {
  const entry = mediaOf(payload);
  const text = isRecord(payload) && typeof payload.notes === 'string' ? payload.notes.trim() : '';
  if (!entry || entry.mediaId === null) return { status: 'error', message: 'Série inconnue (e2e)' };
  if (text) notes.set(entry.mediaId, text);
  else notes.delete(entry.mediaId);
  return synced(entry.title, { status: 'updated', progress: entry.progress, completed: false });
}

/**
 * Fiche de la page ; `pageList=missing` : absente des deux listes (boutons « Ajouter ») ; `partial` : dans la liste AniList
 * seulement ; `pageView` : `uncertain` (saison devinée), `manual` (saison choisie hors de l'épisode), `airing` (en
 * diffusion, prochain épisode dans 18 h)
 */
function resolvePage(): PageMediaView {
  const base = pageView();
  const variant = param('pageView');
  const view: PageMediaView =
    variant === 'uncertain' || variant === 'manual'
      ? { ...base, confidence: 'uncertain', source: variant === 'manual' ? 'manual' : 'page' }
      : variant === 'airing'
        ? { ...base, media: { ...base.media, airingStatus: 'RELEASING', nextEpisode: { episode: 8, airingAt: Date.now() + 18 * 3_600_000 } } }
        : base;
  const anilist = view.lists[0];
  switch (param('pageList') ?? '') {
    case 'missing':
      return {
        ...view,
        lists: [
          { service: 'anilist', state: 'not-in-list', siteUrl: 'https://anilist.co/anime/146065' },
          { service: 'mal', state: 'not-in-list', siteUrl: 'https://myanimelist.net/anime/51179' },
        ],
      };
    case 'partial':
      return { ...view, lists: [...(anilist ? [anilist] : []), { service: 'mal', state: 'not-in-list', siteUrl: 'https://myanimelist.net/anime/51179' }] };
    default:
      return view;
  }
}

/**
 * Réponse de RESOLVE_PAGE_MEDIA ; `pageMedia` : `untracked` (pas un anime), `off` (plateforme désactivée), `notFound`,
 * `error` (limite AniList), `hang` (jamais de réponse : squelette)
 */
function resolvePageResult(): PageMediaResult | Promise<never> {
  switch (param('pageMedia') ?? '') {
    case 'untracked':
      return { ok: false, code: 'NOT_TRACKED', message: t('page.notTracked', { platform: 'Netflix' }) };
    case 'off':
      return { ok: false, code: 'NOT_TRACKED', message: t('page.platformOff', { platform: 'Netflix' }) };
    case 'notFound':
      return { ok: false, code: 'NOT_FOUND', message: t('page.notFound', { title: PAGE_INFO.seriesTitle }) };
    case 'error':
      return { ok: false, code: 'RATE_LIMITED', message: t('api.rateLimited', { service: 'AniList' }) };
    case 'hang':
      return new Promise<never>(() => {});
    default:
      return { ok: true, data: resolvePage() };
  }
}

/** Alignement accepté : tâche en cours (la progression arriverait ensuite par le stockage) */
function applyDiffs(payload: unknown): { ok: true; data: CompareJob } | { ok: false; code: 'INVALID'; message: string } {
  if (!isRecord(payload) || !isTrackerId(payload.source) || !Array.isArray(payload.items)) return { ok: false, code: 'INVALID', message: 'Payload invalide (e2e)' };
  const items = payload.items.flatMap((item: unknown) =>
    isRecord(item) ? [{ mediaId: numberField(item, 'mediaId'), malId: numberField(item, 'malId') }] : [],
  );
  const job: CompareJob = {
    kind: 'apply',
    source: payload.source,
    status: 'running',
    total: items.length,
    done: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    cursor: 0,
    itemCount: items.length,
    current: items[0] ?? null,
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

// ─── Activité : vérifications, file de relance (le service worker retire ce qu'il a traité) ───

/** Retire un élément d'une liste du stockage, comme le service worker après l'avoir traité */
async function dropStored(key: string, matches: (item: unknown) => boolean): Promise<void> {
  const stored: unknown = (await chrome.storage.local.get(key))[key];
  if (Array.isArray(stored)) await chrome.storage.local.set({ [key]: stored.filter((item) => !matches(item)) });
}

const hasField = (field: string, value: unknown) => (item: unknown): boolean => isRecord(item) && item[field] === value;

/** « Confirmer » d'une carte « À vérifier » : écrit sur les deux services, la vérification quitte le stockage */
async function resolveReview(payload: unknown): Promise<SyncOutcome> {
  const key = isRecord(payload) ? payload.key : null;
  const progress = numberField(payload, 'progress') ?? 0;
  await dropStored(STORAGE_KEYS.pendingReviews, hasField('key', key));
  return synced('Kaiju No. 8 Season 2', { status: 'updated', progress, completed: false });
}

/** « Réessayer » d'une synchro en attente : écrite, elle quitte la file */
async function retryQueued(payload: unknown): Promise<SyncOutcome> {
  const id = isRecord(payload) ? payload.id : null;
  await dropStored(SYNC_QUEUE_KEY, hasField('id', id));
  return synced('Kaiju No. 8', { status: 'updated', progress: 5, completed: false });
}

// ─── Installation ───────────────────────────────────────────────────────────

const demo = demoChrome(await loadedUiLocaleParam(), scenario, now);
const journal: JournalEntry[] = [
  // Fuite simulée : le rapport doit masquer le token même s'il apparaît dans un message d'erreur
  { at: now - 5 * 60_000, level: 'error', scope: 'sync', message: `AniList 401 (Bearer ${PLANTED_SECRETS.anilistAccess})` },
];

/** `account=expired|loading|no-stats` : compte AniList du menu du compte (voir accountDemo) */
const accountMode = param('account');
const account = accountDemo(isAccountDemo(accountMode) ? accountMode : null, demo);
const demoStorage = Object.fromEntries(Object.entries(demo.storage).filter(([key]) => !(missingViewer && key === STORAGE_KEYS.malViewer) && !account.drop.includes(key)));

/** `panel=chrome` : panneau latéral Chrome disponible, onglet actif sur un site quelconque (pas de script de contenu) */
const chromePanel =
  param('panel') === 'chrome'
    ? {
        sidePanel: true,
        tab: { url: 'https://example.com/', title: 'Example' },
        onOpenSidePanel: (options: chrome.sidePanel.OpenOptions) => (trace.sidePanelOpens ??= []).push(options.windowId ?? null),
      }
    : {};

/**
 * `accounts=none` : aucun compte (accueil) ; `accounts=expired` : session AniList expirée, MyAnimeList jamais connecté
 * (accueil avec « Reconnecter AniList »)
 */
const onboardingParam = param('accounts');
const onboarding = onboardingParam === 'none' || onboardingParam === 'expired' ? onboardingParam : null;
/** `login=pending` : fenêtre de connexion restée ouverte ; `login=error` : connexion AniList annulée */
const loginMode = param('login');

// ─── Stats ─────────────────────────────────────────────────────────────────

const statsMode = param('stats');
const statsOn = statsMode === 'both' || statsMode === 'anilist' || statsMode === 'mal' || statsMode === 'empty' || statsMode === 'foreign';
/** Profil AniList de démo (maquette Stats) : format POINT_10, six genres, six formats, cinq studios, quatre décennies */
const ANILIST_PROFILE: ProfileStats = {
  scoreFormat: 'POINT_10',
  meanScore100: 76,
  statuses: [
    { status: 'CURRENT', count: 12 },
    { status: 'COMPLETED', count: 168 },
    { status: 'PAUSED', count: 9 },
    { status: 'DROPPED', count: 7 },
    { status: 'PLANNING', count: 46 },
  ],
  formats: [
    { format: 'TV', count: 152 },
    { format: 'MOVIE', count: 21 },
    { format: 'ONA', count: 11 },
    { format: 'OVA', count: 7 },
    { format: 'TV_SHORT', count: 5 },
    { format: 'SPECIAL', count: 3 },
  ],
  genres: [
    { genre: 'Action', count: 112, meanScore100: 77 },
    { genre: 'Fantasy', count: 84, meanScore100: 79 },
    { genre: 'Comedy', count: 79, meanScore100: 74 },
    { genre: 'Drama', count: 61, meanScore100: 81 },
    { genre: 'Adventure', count: 55, meanScore100: 76 },
    { genre: 'Slice of Life', count: 38, meanScore100: 78 },
  ],
  scores: [1, 2, 3, 8, 19, 41, 58, 33, 12].map((count, i) => ({ score: i + 2, count })),
  studios: [
    { name: 'MAPPA', count: 14 },
    { name: 'Madhouse', count: 12 },
    { name: 'Bones', count: 11 },
    { name: 'Kyoto Animation', count: 9 },
    { name: 'Wit Studio', count: 8 },
  ],
  decades: [
    { decade: 1990, count: 6 },
    { decade: 2000, count: 18 },
    { decade: 2010, count: 92 },
    { decade: 2020, count: 80 },
  ],
  rewatched: null,
};
/** MyAnimeList : statuts, moyenne et revisionnages seulement */
const MAL_PROFILE: ProfileStats = {
  ...ANILIST_PROFILE,
  meanScore100: 78,
  statuses: [
    { status: 'CURRENT', count: 11 },
    { status: 'COMPLETED', count: 192 },
    { status: 'PAUSED', count: 14 },
    { status: 'DROPPED', count: 14 },
    { status: 'PLANNING', count: 58 },
  ],
  formats: [],
  genres: [],
  scores: [],
  studios: [],
  decades: [],
  rewatched: 14,
};
/** Épisodes des 30 derniers jours (le plus ancien d'abord, pic de 5 au milieu), 24 min chacun, plus quelques mois plus anciens */
const EPS30 = [1, 0, 2, 3, 0, 1, 4, 2, 0, 0, 3, 1, 2, 5, 0, 1, 2, 0, 3, 1, 0, 2, 4, 1, 0, 3, 2, 1, 0, 2];
function demoDays(): Record<string, ActivityDay> {
  const today = new Date(now);
  const days: Record<string, ActivityDay> = {};
  EPS30.forEach((episodes, i) => {
    if (episodes > 0) days[dateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29 + i))] = [episodes, episodes * 24];
  });
  [12, 20, 9, 15].forEach((episodes, i) => {
    days[dateKey(new Date(today.getFullYear(), today.getMonth() - 2 - i * 2, 12))] = [episodes, episodes * 24];
  });
  return days;
}
function statsHistory(anilistId: number, malId: number): ActivityHistory {
  const days = demoDays();
  return { anilist: { accountId: statsMode === 'foreign' ? anilistId + 1 : anilistId, days }, mal: { accountId: malId, days } };
}
/** Profils avec statistiques détaillées, lus il y a 10 min (aucune relecture à l'ouverture), historique selon `stats` */
function statsStorage(base: Record<string, unknown>): Record<string, unknown> {
  if (!statsOn) return {};
  const anilist = base[STORAGE_KEYS.anilistViewer];
  const mal = base[STORAGE_KEYS.malViewer];
  if (!isRecord(anilist) || !isRecord(mal) || typeof anilist.id !== 'number' || typeof mal.id !== 'number') return {};
  return {
    [STORAGE_KEYS.anilistViewer]: { ...anilist, profile: ANILIST_PROFILE },
    [STORAGE_KEYS.malViewer]: { ...mal, profile: MAL_PROFILE },
    [STORAGE_KEYS.anilistViewerAt]: now - 10 * 60_000,
    [STORAGE_KEYS.malViewerAt]: now - 10 * 60_000,
    ...(statsMode === 'empty' ? {} : { [STORAGE_KEYS.activityHistory]: statsHistory(anilist.id, mal.id) }),
  };
}

/** Tokens retirés du stockage semé pour l'accueil, ou pour un seul compte connecté (`stats=anilist|mal`) */
function withoutTokens(storage: Record<string, unknown>): Record<string, unknown> {
  const statsDrop = statsMode === 'anilist' ? [STORAGE_KEYS.malToken, STORAGE_KEYS.malViewer] : statsMode === 'mal' ? [STORAGE_KEYS.anilistToken, STORAGE_KEYS.anilistViewer] : [];
  const dropped: string[] = onboarding === 'none' ? [STORAGE_KEYS.anilistToken, STORAGE_KEYS.malToken] : onboarding === 'expired' ? [STORAGE_KEYS.malToken] : statsDrop;
  return Object.fromEntries(Object.entries(storage).filter(([key]) => !dropped.includes(key)));
}

/** Lot « Pour toi » de la démo, plus un film (la démo n'en a pas) pour le filtre « Films » */
function recoWithMovie(cold: boolean): (payload: unknown) => unknown {
  const base = recoHandlers(cold, now).GET_RECOMMENDATIONS;
  return (payload) => {
    const result = base?.(payload);
    const model = isRecord(result) && result.ok === true && isRecoBatch(result.batch) ? result.batch.items.at(0) : undefined;
    if (!isRecord(result) || !isRecoBatch(result.batch) || !model) return result;
    const movie: RecoItem = { ...model, card: { ...model.card, id: 990001, idMal: 990001, title: E2E_RECO_MOVIE_TITLE, format: 'MOVIE', episodes: 1, genres: ['Drama'], siteUrl: 'https://anilist.co/anime/990001' } };
    return { ...result, batch: { ...result.batch, items: [...result.batch.items, movie] } };
  };
}

installChromeMock({
  ...demo,
  ...chromePanel,
  ...(param('shortcuts') === 'panel-unset' ? { shortcuts: { episode: 'Alt+Shift+K', panel: '' } } : {}),
  storage: withoutTokens({
    ...demoStorage,
    ...(emptyWatching ? { [STORAGE_KEYS.watchingCache]: lists } : {}),
    [STORAGE_KEYS.anilistToken]: { accessToken: PLANTED_SECRETS.anilistAccess, expiresAt: far },
    [STORAGE_KEYS.malToken]: { accessToken: PLANTED_SECRETS.malAccess, refreshToken: PLANTED_SECRETS.malRefresh, expiresAt: far },
    [DIAGNOSTICS_LOG_KEY]: journal,
    ...(hangWatching || slowWatching ? { [STORAGE_KEYS.watchingCache]: {} } : {}),
    ...account.storage,
    // `recoFilter=movies` : filtre « Films » de « Pour toi » déjà retenu
    ...(param('recoFilter') === 'movies' ? { [SECTION_PREFS_KEY]: { recoFilter: { genre: null, format: 'movies' } } } : {}),
    // `statsService=mal` : service MAL déjà retenu pour Stats
    ...(param('statsService') === 'mal' ? { [SECTION_PREFS_KEY]: { statsService: 'mal' } } : {}),
    ...statsStorage(demoStorage),
    // Accueil, session AniList expirée : token échu (MyAnimeList retiré par withoutTokens)
    ...(onboarding === 'expired' ? { [STORAGE_KEYS.anilistToken]: { accessToken: PLANTED_SECRETS.anilistAccess, expiresAt: 1 } } : {}),
  }),
  handlers: {
    ...demo.handlers,
    ...account.handlers,
    // `reco=cold` : suggestions de l'état vide en démarrage à froid
    ...(param('reco') === 'cold' ? recoHandlers(true, now) : {}),
    GET_RECOMMENDATIONS: recoWithMovie(param('reco') === 'cold'),
    // `login=pending` : fenêtre de connexion restée ouverte ; `login=error` : connexion annulée
    ...(loginMode === 'pending' ? { LOGIN_ANILIST: () => new Promise<never>(() => {}), LOGIN_MAL: () => new Promise<never>(() => {}) } : {}),
    ...(loginMode === 'error' ? { LOGIN_ANILIST: () => ({ ok: false, code: 'CANCELLED', message: t('auth.cancelled') }) } : {}),
    // `stats` : profils relus avec leurs statistiques détaillées
    ...(statsOn ? { GET_VIEWER: () => ({ ok: true, data: statsStorage(demoStorage)[STORAGE_KEYS.anilistViewer] }) } : {}),
    GET_MAL_VIEWER: (payload) =>
      missingViewer && ++malViewerCalls === 1
        ? { ok: false, code: 'NETWORK', message: 'MyAnimeList injoignable (e2e)' }
        : statsOn
          ? { ok: true, data: statsStorage(demoStorage)[STORAGE_KEYS.malViewer] }
          : demo.handlers.GET_MAL_VIEWER?.(payload),
    // Semaine demandée de l'Agenda ; `agenda=empty` : aucune sortie
    GET_AGENDA: (payload) => {
      const weekStart = isRecord(payload) && typeof payload.weekStart === 'string' ? payload.weekStart : null;
      const week = weekStart === null ? null : agendaWeek(weekStart, now);
      if (!week || weekStart === null) return { ok: false, code: 'API_ERROR', message: 'semaine invalide (e2e)' };
      return { ok: true, data: param('agenda') === 'empty' ? { ...week, mediaIds: [], schedules: [] } : week };
    },
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
    // Vrai code du service worker (SEC-06) : rapport construit et expurgé sur le stockage semé, jetons compris
    GET_DIAGNOSTICS_REPORT: () => diagnosticsReport(),
    REMOVE_FROM_LIST: removeFromList,
    // `notes=hang` : commentaire jamais lu (éditeur en lecture) ; `notes=missing` : série absente des listes ;
    // `notes=slow` : enregistrement en cours un moment (captures des états de l'éditeur)
    GET_LIST_NOTES: (payload): ListNotesResult | Promise<never> =>
      param('notes') === 'hang' ? new Promise<never>(() => {}) : param('notes') === 'missing' ? { ok: true, data: { inList: false, notes: null } } : getListNotes(payload),
    SET_LIST_NOTES: (payload) => (param('notes') === 'slow' ? new Promise<SyncOutcome>((resolve) => setTimeout(() => resolve(setListNotes(payload)), 60_000)) : setListNotes(payload)),
    ADD_TO_LIST: () => synced(pageView().media.title, { status: 'updated', progress: 0, completed: false }),
    RESOLVE_PAGE_MEDIA: resolvePageResult,
    // `friends=on|error|hang` : amis AniList de la fiche (aucun sinon)
    GET_ANILIST_FRIENDS: demoFriendsHandler(param('friends'), pageView().media.episodes ?? 12),
    RATE_MEDIA: () => synced(pageView().media.title, { status: 'updated', progress: 7, completed: false }),
    APPLY_DIFFS: applyDiffs,
    RESOLVE_REVIEW: resolveReview,
    DISMISS_REVIEW: async (payload) => {
      await dropStored(STORAGE_KEYS.pendingReviews, hasField('key', isRecord(payload) ? payload.key : null));
      return { ok: true, data: null };
    },
    REOPEN_REVIEW: () => ({ ok: true, data: null }),
    RETRY_QUEUED: retryQueued,
  },
  onSendMessage: (message) => trace.messages.push(message),
  onCreateTab: (url) => trace.openedTabs.push(url),
  permissions: {
    granted: param('hostAccess') !== 'missing',
    onRequest: (origins) => {
      trace.permissionRequests.push(origins);
      return true;
    },
    // Netflix, Disney+ : accès optionnels, non accordés au départ
    optional: manifest.optional_host_permissions,
    onRemove: (origins) => trace.permissionRemovals.push(origins),
  },
  manifest: { host_permissions: manifest.host_permissions, content_scripts: manifest.content_scripts },
});

await import('../../src/popup/popup.ts');
