// Écran Stats du popup (contrôleur sans rendu) : service affiché (choix retenu dans les préférences du popup, sinon
// « Fiche ouverte par défaut »), période de l'activité (non retenue), historique local d'activité et cache « En cours »
// relus à chaque affichage. Le profil vient du contrôleur des comptes (même requête et même cache que le menu du
// compte) : relu au plus une fois par service et par ouverture du popup, quand il date de plus d'une heure ou qu'il a
// été enregistré avant les statistiques détaillées (sans `profile`).
import { activitySummary, type ActivityHistory, type ActivitySummary, type StatsPeriod } from '../../shared/activity-history';
import type { AniListViewer } from '../../shared/anilist.types';
import type { MalViewer } from '../../shared/mal.types';
import { formatRemainingTotal } from '../../shared/remaining-time';
import { TRACKER_IDS, type TrackerId } from '../../shared/tracker.types';
import type { WatchingEntry } from '../../shared/watching.types';
import { createLogger } from '../../browser/logger';
import { getActivityHistory } from '../../browser/storage/activity-history';
import { getCachedMalViewer, getCachedViewer, getViewerFetchedAt } from '../../browser/storage/viewer-cache';
import { getCachedWatching } from '../../browser/storage/watching-cache';
import type { AccountsController } from '../../ui/accounts';
import { menuNeedsRefresh, typedViewerState } from '../../ui/account-menu-model';
import { createStore, LOGGED_OUT, type AccountState, type ReadonlyStore } from '../../ui/state';
import type { SectionPrefs } from './section-prefs';

const log = createLogger('popup');

export const DEFAULT_STATS_PERIOD: StatsPeriod = '30d';

type Viewer = AniListViewer | MalViewer;

export interface StatsView {
  /** null : aucun compte connecté */
  service: TrackerId | null;
  /** Comptes connectés : le contrôle AniList / MAL s'affiche quand il y en a deux */
  services: readonly TrackerId[];
  period: StatsPeriod;
  account: AccountState<Viewer>;
  refreshing: boolean;
  activity: ActivitySummary;
  /** « ≈ 3 h à rattraper · 4 séries » (cache « En cours » du service), null sans série */
  remaining: string | null;
}

export interface StatsController {
  readonly store: ReadonlyStore<StatsView>;
  /** Écran affiché : historique et cache relus, profil relu s'il date de plus d'une heure (menuNeedsRefresh) */
  show(): void;
  /** Retenu dans les préférences du popup */
  setService(service: TrackerId): void;
  /** Non retenu */
  setPeriod(period: StatsPeriod): void;
  reloadActivity(): void;
  dispose(): void;
}

export interface StatsControllerDeps {
  accounts: Pick<AccountsController, 'store' | 'refresh'>;
  /** Service par défaut : watching.activeService() */
  defaultService: () => TrackerId | null;
  prefs: { load(): Promise<SectionPrefs>; save(patch: Partial<SectionPrefs>): Promise<void> };
  now?: () => number;
}

/** Compte connu : session ouverte, en cours de lecture ou expirée (« Reconnecter ») */
const isKnown = (state: AccountState<unknown>): boolean => state.status !== 'logged-out' || state.expired;

export function createStatsController(deps: StatsControllerDeps): StatsController {
  const now = deps.now ?? Date.now;
  let history: ActivityHistory = {};
  let watching: Partial<Record<TrackerId, readonly WatchingEntry[]>> = {};
  /** Identifiant du profil en cache (session expirée : le contrôleur des comptes n'a plus de profil) */
  let cachedIds: Partial<Record<TrackerId, number>> = {};
  let chosen: TrackerId | null = null;
  let period: StatsPeriod = DEFAULT_STATS_PERIOD;
  let prefsRead: Promise<void> | null = null;
  let shown = false;
  let disposed = false;
  /** Services dont la fraîcheur du profil a été jugée (une relecture au plus par ouverture du popup) */
  const checked = new Set<TrackerId>();
  const refreshing = new Set<TrackerId>();

  const knownServices = (): TrackerId[] => TRACKER_IDS.filter((service) => isKnown(deps.accounts.store(service).get()));

  function pick(services: readonly TrackerId[]): TrackerId | null {
    if (chosen !== null && services.includes(chosen)) return chosen;
    const fallback = deps.defaultService();
    return fallback !== null && services.includes(fallback) ? fallback : (services[0] ?? null);
  }

  /**
   * Compte dont l'activité est montrée : profil de la session ouverte ; session expirée : profil en cache, sinon la
   * part enregistrée (gardée à l'expiration, retirée quand un autre compte se connecte sur ce service)
   */
  function accountId(service: TrackerId, account: AccountState<Viewer>): number | null {
    if (account.status === 'logged-in') return account.viewer?.id ?? null;
    if (account.status === 'logged-out' && account.expired) return cachedIds[service] ?? history[service]?.accountId ?? null;
    return null;
  }

  function view(): StatsView {
    const services = knownServices();
    const service = pick(services);
    const account = service === null ? LOGGED_OUT : typedViewerState(deps.accounts.store(service).get());
    const at = now();
    return {
      service,
      services,
      period,
      account,
      refreshing: service !== null && refreshing.has(service),
      activity: activitySummary(history, service ?? 'anilist', service === null ? null : accountId(service, account), period, at),
      remaining: service === null ? null : formatRemainingTotal(watching[service] ?? [], at),
    };
  }

  const store = createStore<StatsView>(view());

  function update(): void {
    if (disposed) return;
    const next = view();
    store.set(next);
    // Profil arrivé après l'affichage (lecture des sessions en cours à l'ouverture) : fraîcheur jugée à ce moment
    if (shown && next.service !== null) void ensureFresh(next.service);
  }

  async function ensureFresh(service: TrackerId): Promise<void> {
    const state = typedViewerState(deps.accounts.store(service).get());
    if (disposed || state.status !== 'logged-in' || checked.has(service)) return;
    checked.add(service);
    try {
      // Profil d'avant l'écran Stats (sans `profile`) : relu une fois comme un profil de plus d'une heure (les totaux restent affichés)
      const legacy = state.viewer !== null && state.viewer.profile === undefined;
      if (!legacy && !menuNeedsRefresh(state, await getViewerFetchedAt(service), now())) return;
      refreshing.add(service);
      update();
      await deps.accounts.refresh(service);
    } catch (error: unknown) {
      log.warn('Profil des statistiques non relu :', error);
    } finally {
      if (refreshing.delete(service)) update();
    }
  }

  async function load(): Promise<void> {
    prefsRead ??= deps.prefs.load().then(
      (prefs) => {
        chosen = prefs.statsService;
      },
      (error: unknown) => log.warn('Préférences des statistiques illisibles :', error),
    );
    const [nextHistory, lists, anilist, mal] = await Promise.all([
      getActivityHistory(),
      Promise.all(TRACKER_IDS.map((service) => getCachedWatching(service))),
      getCachedViewer(),
      getCachedMalViewer(),
      prefsRead,
    ]);
    history = nextHistory;
    watching = Object.fromEntries(lists.flatMap((list) => (list === null ? [] : [[list.service, list.entries]])));
    cachedIds = { ...(anilist ? { anilist: anilist.id } : {}), ...(mal ? { mal: mal.id } : {}) };
  }

  const unsubscribers = TRACKER_IDS.map((service) => deps.accounts.store(service).subscribe(update));

  return {
    store,
    show() {
      shown = true;
      load().then(update, (error: unknown) => {
        log.warn('Statistiques illisibles :', error);
        update();
      });
    },
    setService(service) {
      chosen = service;
      void deps.prefs.save({ statsService: service });
      update();
    },
    setPeriod(next) {
      period = next;
      update();
    },
    reloadActivity() {
      getActivityHistory().then(
        (next) => {
          history = next;
          update();
        },
        (error: unknown) => log.warn('Historique d’activité illisible :', error),
      );
    },
    dispose() {
      disposed = true;
      for (const unsubscribe of unsubscribers) unsubscribe();
    },
  };
}
