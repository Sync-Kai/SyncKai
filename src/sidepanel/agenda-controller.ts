// Onglet « Agenda » : données de la semaine affichée, sans rendu (audit 4-§3), extraites de components/agenda.ts.
// Le cache `airingWeek:<date>` (alarme horaire ou requête précédente) est lu d'abord ; le service worker n'est sollicité
// (GET_AGENDA) que s'il manque ou a expiré (decideAgendaLoad). Budget de requêtes (maquette PanelAgendaSemaine) : ‹ ›
// regroupés (une requête pour la semaine finale, 300 ms après le dernier clic), semaine choisie dans le calendrier
// chargée aussitôt (une requête), semaines déjà reçues gardées en mémoire pour la vie de la page (revues sans requête,
// même hors du cache du stockage, limité à ±35 jours). La vue (components/agenda.tsx) garde le menu « ⋯ », l'éditeur
// de délai et le rendu.
import { airingWeekKey, isWeekCacheFresh, mergeWatchingSeries, rolloverWeek, shiftWeek, weekRange, type AgendaSeries, type AiringWeekCache, type IsoWeekday, type WeekRange } from '../shared/agenda';
import { agendaFirstDay, readWeekCache, saveSeriesOffset } from '../browser/storage/agenda-store';
import { EXCLUDED_SERIES_KEY, getExcludedSeries } from '../shared/exclusions';
import type { StreamingPlatform } from '../shared/episode.types';
import { createLogger } from '../browser/logger';
import { sendMessage, type MessageResponse } from '../protocol/messages';
import { DEFAULT_SETTINGS, effectivePlayer, SETTINGS_STORAGE_KEY, type SyncSettings } from '../shared/settings';
import { getSettings } from '../browser/storage/settings-access';
import { getCachedWatching } from '../browser/storage/watching-cache';
import { hasMalToken, hasValidAniListToken } from '../browser/storage/tokens';
import { STORAGE_KEYS } from '../protocol/storage-keys';
import { t } from '../i18n';
import { TRACKER_IDS, type TrackerId } from '../shared/tracker.types';
import { callWorker, networkFailure } from '../ui/worker-call';
import type { PlatformAccessStore } from '../ui/platform-access-store';
import { decideAgendaLoad } from './agenda-load';

const log = createLogger('agenda');

/** Navigation ‹ › : un seul chargement après une rafale de clics */
export const NAV_DEBOUNCE_MS = 300;
/** Changements du stockage regroupés */
export const STORAGE_DEBOUNCE_MS = 250;

export type AgendaStatus =
  | { kind: 'loading' }
  | { kind: 'not-connected' }
  /** `optional` : plateformes à accès optionnel accordées (Netflix, Disney+), citées parmi les plateformes */
  | { kind: 'no-series'; optional: readonly StreamingPlatform[] }
  | { kind: 'ready'; cache: AiringWeekCache; refreshing: boolean; error: string | null }
  | { kind: 'error'; message: string };

export interface AgendaControllerOptions {
  /** Accès optionnels de la page du panneau (lecteur préféré, plateformes de « aucune série ») */
  platformAccess: PlatformAccessStore;
  /** Données changées : la vue redessine */
  onChange(): void;
  /** Autre semaine affichée (navigation, passage au lundi à minuit) : état propre à la vue oublié (menu, éditeur) */
  onWeekChange?(): void;
}

export interface AgendaController {
  readonly range: WeekRange;
  readonly firstDay: IsoWeekday;
  readonly status: AgendaStatus;
  /** Réglages lus au dernier chargement (délais des plateformes, fiche ouverte par défaut) */
  readonly settings: SyncSettings | null;
  /** Lecteur préféré effectif (Netflix ou Prime Video seulement avec l'accès) : lien « Ouvrir » et ordre des recherches */
  readonly player: StreamingPlatform;
  readonly series: ReadonlyMap<number, AgendaSeries>;
  /** Comptes connectés (lus à chaque chargement) : fiche ouverte par le titre et la jaquette */
  readonly connected: readonly TrackerId[];
  /** ‹ › : semaine décalée de `delta`, chargée après la rafale de clics (NAV_DEBOUNCE_MS) */
  step(delta: number): void;
  /** Semaine choisie (calendrier, « Aujourd'hui ») : chargée aussitôt, rafale de ‹ › en attente annulée */
  choose(next: WeekRange): void;
  /** Charge la semaine affichée ; `force` (« Réessayer ») remplace une requête en cours */
  load(force: boolean): Promise<void>;
  /** Onglet affiché : écouteurs posés au premier appel, premier jour de la semaine relu, puis chargement */
  activate(): void;
  /** Réglages relus après un enregistrement de la vue (délai d'une série) */
  reloadSettings(): Promise<void>;
  /** « Ajuster l'heure » : délai propre à la série (null = délai de la plateforme), réglages relus, vue redessinée */
  saveOffset(mediaId: number, offset: number | null): Promise<void>;
  /** Écouteur du stockage et minuteries retirés (4-R6) */
  dispose(): void;
}

export function createAgendaController(options: AgendaControllerOptions): AgendaController {
  const { platformAccess, onChange, onWeekChange } = options;
  let firstDay: IsoWeekday = agendaFirstDay();
  let range: WeekRange = weekRange(Date.now(), firstDay);
  let status: AgendaStatus = { kind: 'loading' };
  let settings: SyncSettings | null = null;
  let player: StreamingPlatform = DEFAULT_SETTINGS.preferredPlayer;
  let series = new Map<number, AgendaSeries>();
  let connected: TrackerId[] = [];
  let started = false;
  let run = 0;
  let loadTimer: ReturnType<typeof setTimeout> | undefined;
  let midnightTimer: ReturnType<typeof setTimeout> | undefined;
  /** Semaine → horodatage de la dernière requête GET_AGENDA de ce panneau */
  const lastFetch = new Map<string, number>();
  /** Semaine → échec de la dernière requête GET_AGENDA (absente si elle a réussi) */
  const lastError = new Map<string, string>();
  /** Requête GET_AGENDA en cours (semaine, chargement qui l'a lancée) */
  let inFlight: { key: string; run: number } | null = null;
  /** Chargement demandé pendant cette requête : rejoué une fois sa réponse affichée */
  let reloadQueued = false;
  /** Services dont la liste « En cours » a déjà été demandée (cache vide à l'ouverture du panneau) */
  const watchingRequested = new Set<TrackerId>();
  /**
   * Semaines reçues par cette page (réponses GET_AGENDA, même arrivées après le départ de la semaine, et caches frais du
   * stockage) : revues sans requête tant qu'elles couvrent les séries en cours
   */
  const remembered = new Map<string, AiringWeekCache>();

  /** Programme gardé en mémoire utilisable pour les séries en cours (complet, toutes les séries couvertes) */
  function rememberedFor(key: string): AiringWeekCache | null {
    const week = remembered.get(key);
    if (!week) return null;
    const known = new Set(week.mediaIds);
    for (const id of series.keys()) if (!known.has(id)) return null;
    return week;
  }

  function remember(week: AiringWeekCache): void {
    if (week.truncated !== true) remembered.set(week.weekStart, week);
  }

  function scheduleLoad(delay: number): void {
    clearTimeout(loadTimer);
    loadTimer = setTimeout(() => void load(false), delay);
  }

  /** Semaine affichée changée : programme en mémoire affiché aussitôt, sinon squelette ; chargement après `delay` */
  function goTo(next: WeekRange, delay: number): void {
    range = next;
    onWeekChange?.();
    const week = series.size > 0 ? rememberedFor(next.key) : null;
    status = week ? { kind: 'ready', cache: week, refreshing: false, error: lastError.get(next.key) ?? null } : { kind: 'loading' };
    onChange();
    if (delay > 0) scheduleLoad(delay);
    else {
      clearTimeout(loadTimer);
      void load(false);
    }
  }

  /** Liste « En cours » jamais chargée (popup jamais ouvert) : demandée une fois au service worker */
  function requestMissingWatching(services: readonly TrackerId[], cached: Record<TrackerId, boolean>): void {
    for (const service of services) {
      if (cached[service] || watchingRequested.has(service)) continue;
      watchingRequested.add(service);
      // La réponse est enregistrée en cache par le service worker : storage.onChanged relance le chargement
      sendMessage('GET_WATCHING', { service }).catch((error: unknown) => log.warn('Liste en cours indisponible :', error));
    }
  }

  /**
   * Charge la semaine affichée. Une requête déjà en cours pour cette semaine n'est jamais jetée par un
   * chargement automatique (stockage, langue) : sa réponse, erreur comprise, reste affichée, et le chargement
   * demandé entre-temps est rejoué ensuite. Seul « Réessayer » (`force`) la remplace.
   */
  async function load(force: boolean): Promise<void> {
    if (!force && inFlight?.key === range.key) {
      reloadQueued = true;
      return;
    }
    reloadQueued = false;
    const current = ++run;
    await loadWeek(current, force);
    if (current === run && reloadQueued) {
      reloadQueued = false;
      scheduleLoad(STORAGE_DEBOUNCE_MS);
    }
  }

  async function loadWeek(current: number, force: boolean): Promise<void> {
    const target = range;
    /** GET_AGENDA envoyé : son échec est retenu pour la semaine */
    let requested = false;
    try {
      const [nextSettings, optionalGranted, anilistConnected, malConnected, anilist, mal, excluded, cache] = await Promise.all([
        getSettings(),
        platformAccess.read(),
        hasValidAniListToken(),
        hasMalToken(),
        getCachedWatching('anilist'),
        getCachedWatching('mal'),
        getExcludedSeries(),
        readWeekCache(target.key),
      ]);
      if (current !== run) return;
      settings = nextSettings;
      player = effectivePlayer(nextSettings.preferredPlayer, optionalGranted);
      connected = TRACKER_IDS.filter((id) => (id === 'anilist' ? anilistConnected : malConnected));
      if (connected.length === 0) {
        status = { kind: 'not-connected' };
        onChange();
        return;
      }
      requestMissingWatching(connected, { anilist: anilist !== null, mal: mal !== null });
      const entries = [...(anilistConnected ? (anilist?.entries ?? []) : []), ...(malConnected ? (mal?.entries ?? []) : [])];
      series = mergeWatchingSeries(entries, excluded, player);
      if (series.size === 0) {
        status = { kind: 'no-series', optional: optionalGranted };
        onChange();
        return;
      }

      const now = Date.now();
      const fresh = cache !== null && isWeekCacheFresh(cache, target, now, series.keys());
      if (cache && fresh) remember(cache);
      // Semaine déjà reçue par la page, au moins aussi récente que le cache du stockage : aucune requête (sauf « Réessayer »)
      const week = force || fresh ? null : rememberedFor(target.key);
      if (week && (!cache || week.fetchedAt >= cache.fetchedAt)) {
        status = { kind: 'ready', cache: week, refreshing: false, error: lastError.get(target.key) ?? null };
        onChange();
        return;
      }
      const decision = decideAgendaLoad({
        hasCache: cache !== null,
        fresh,
        force,
        lastFetchAt: lastFetch.get(target.key) ?? null,
        now,
        lastError: lastError.get(target.key) ?? null,
        showingResult: status.kind === 'error' || (status.kind === 'ready' && status.cache.weekStart === target.key),
      });
      if (decision.kind === 'show' && cache) {
        status = { kind: 'ready', cache, refreshing: false, error: decision.error };
        onChange();
        return;
      }
      if (decision.kind === 'keep') {
        onChange();
        return;
      }

      // Cache expiré : affiché tout de suite, rafraîchi en arrière-plan
      status = cache ? { kind: 'ready', cache, refreshing: true, error: null } : { kind: 'loading' };
      onChange();
      lastFetch.set(target.key, now);
      inFlight = { key: target.key, run: current };
      requested = true;
      let result: MessageResponse<'GET_AGENDA'>;
      try {
        result = await callWorker('GET_AGENDA', { weekStart: target.key }, networkFailure);
      } finally {
        if (inFlight?.run === current) inFlight = null;
      }
      // Échec retenu pour la semaine, même si un chargement plus récent a pris le relais (sauf déconnexion)
      if (!result.ok && result.code !== 'NOT_AUTHENTICATED') lastError.set(target.key, result.message);
      else lastError.delete(target.key);
      // Gardée même si une autre semaine est affichée entre-temps (retour sans nouvelle requête)
      if (result.ok) remember(result.data);
      if (current !== run) return;
      if (result.ok) status = { kind: 'ready', cache: result.data, refreshing: false, error: null };
      else if (result.code === 'NOT_AUTHENTICATED') status = { kind: 'not-connected' };
      else status = cache ? { kind: 'ready', cache, refreshing: false, error: result.message } : { kind: 'error', message: result.message };
    } catch (error: unknown) {
      const message = error instanceof Error && error.message ? error.message : t('error.unexpected');
      if (requested) lastError.set(target.key, message);
      if (current !== run) return;
      log.warn('Agenda illisible :', error);
      status = status.kind === 'ready' ? { ...status, refreshing: false, error: message } : { kind: 'error', message };
    }
    onChange();
  }

  /** Redessine à minuit (« Aujourd'hui » change de jour) */
  function armMidnight(): void {
    clearTimeout(midnightTimer);
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
    midnightTimer = setTimeout(() => {
      // Semaine en cours affichée la veille : suit le changement de semaine (lundi), sinon seul « Aujourd'hui » bouge
      const rolled = rolloverWeek(range, Date.now(), firstDay);
      if (rolled) goTo(rolled, NAV_DEBOUNCE_MS);
      else onChange();
      armMidnight();
    }, next - now.getTime() + 1_000);
  }

  const onStorageChange = (changes: Record<string, chrome.storage.StorageChange>, area: string): void => {
    if (area !== 'local') return;
    const relevant = [SETTINGS_STORAGE_KEY, STORAGE_KEYS.watchingCache, STORAGE_KEYS.anilistToken, STORAGE_KEYS.malToken, EXCLUDED_SERIES_KEY, airingWeekKey(range.key)];
    if (relevant.some((key) => key in changes)) scheduleLoad(STORAGE_DEBOUNCE_MS);
  };

  function start(): void {
    chrome.storage.onChanged.addListener(onStorageChange);
    armMidnight();
  }

  return {
    get range() {
      return range;
    },
    get firstDay() {
      return firstDay;
    },
    get status() {
      return status;
    },
    get settings() {
      return settings;
    },
    get player() {
      return player;
    },
    get series() {
      return series;
    },
    get connected() {
      return connected;
    },
    step: (delta) => goTo(shiftWeek(range, delta), NAV_DEBOUNCE_MS),
    choose: (next) => goTo(next, 0),
    load,
    activate() {
      if (!started) {
        started = true;
        start();
      }
      // Langue changée depuis le dernier affichage : le premier jour de la semaine peut changer
      const nextFirstDay = agendaFirstDay();
      if (nextFirstDay !== firstDay) {
        firstDay = nextFirstDay;
        range = weekRange(range.start, firstDay);
      }
      onChange();
      void load(false);
    },
    async reloadSettings() {
      settings = await getSettings();
    },
    async saveOffset(mediaId, offset) {
      await saveSeriesOffset(mediaId, offset);
      // Le changement des réglages revient aussi par storage.onChanged (rechargement regroupé)
      settings = await getSettings();
      onChange();
    },
    dispose() {
      if (started) chrome.storage.onChanged.removeListener(onStorageChange);
      started = false;
      run++;
      clearTimeout(loadTimer);
      clearTimeout(midnightTimer);
    },
  };
}
