/** Attente maximale acceptée avant une nouvelle tentative (au-delà : échec immédiat, affiché à l'utilisateur) */
export const MAX_RETRY_WAIT_MS = 20_000;
/** Attente minimale après un 429 (AniList répond parfois `Retry-After: 0`, ce qui relancerait aussitôt la requête) */
export const MIN_RETRY_WAIT_MS = 5_000;

/**
 * Délai à respecter après une réponse 429, d'après l'en-tête `Retry-After` (secondes ou date HTTP) et
 * `X-RateLimit-Reset` (horodatage Unix en secondes) s'ils sont présents ; jamais moins de MIN_RETRY_WAIT_MS.
 * Retourne null si l'attente dépasse `MAX_RETRY_WAIT_MS`.
 */
export function retryDelayMs(retryAfter: string | null, now: number = Date.now(), rateLimitReset: string | null = null): number | null {
  let delay = MIN_RETRY_WAIT_MS;
  if (retryAfter !== null && retryAfter.trim() !== '') {
    const seconds = Number(retryAfter);
    const date = Date.parse(retryAfter);
    if (Number.isFinite(seconds)) delay = seconds * 1000;
    else if (Number.isFinite(date)) delay = date - now;
  }
  const reset = rateLimitReset !== null && rateLimitReset.trim() !== '' ? Number(rateLimitReset) : Number.NaN;
  if (Number.isFinite(reset) && reset > 0) delay = Math.max(delay, reset * 1000 - now);
  delay = Math.max(MIN_RETRY_WAIT_MS, delay);
  return delay <= MAX_RETRY_WAIT_MS ? delay : null;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Budget de requêtes partagé (AniList) ─────────────────────────────────

/**
 * Origine d'une requête :
 * - interactive : popup, panneau latéral, synchro en direct (prioritaire, jamais retenue hors pénalité 429) ;
 * - background  : tâches de fond (analyse de l'import Crunchyroll, application, comparaison des listes),
 *                 limitées pour laisser de la marge aux requêtes interactives.
 */
export type RequestLane = 'interactive' | 'background';

/** Requêtes de fond au plus par minute glissante (AniList : ~90/min, parfois réduit à 30/min) */
export const BACKGROUND_PER_MINUTE = 20;
/** Requêtes restantes annoncées par AniList (`X-RateLimit-Remaining`) réservées aux requêtes interactives */
export const INTERACTIVE_RESERVE = 10;
/** Pause des tâches de fond après une requête interactive (le popup en enchaîne plusieurs) */
export const INTERACTIVE_GRACE_MS = 1_500;
const WINDOW_MS = 60_000;
/** Plus longue attente d'une tâche de fond avant de réévaluer le budget */
const MAX_POLL_MS = 5_000;

export interface RateLimitHeaders {
  limit: number | null;
  remaining: number | null;
}

/** En-têtes X-RateLimit-* d'une réponse (null si absents ou illisibles) */
export function readRateLimitHeaders(headers: Pick<Headers, 'get'>): RateLimitHeaders {
  const int = (name: string): number | null => {
    const raw = headers.get(name);
    const value = raw !== null && raw.trim() !== '' ? Number(raw) : Number.NaN;
    return Number.isInteger(value) && value >= 0 ? value : null;
  };
  return { limit: int('X-RateLimit-Limit'), remaining: int('X-RateLimit-Remaining') };
}

/** Attente au-delà de laquelle une tâche de fond l'affiche (« En attente du quota AniList ») */
export const WAIT_NOTICE_MS = 2_000;
const WAIT_REFRESH_MS = 10_000;

/**
 * Attente d'une requête de fond, pour l'affichage :
 * - reason : 'rate-limit' (pénalité 429 en cours) ou 'budget' (quota de fond, réserve, priorité interactive) ;
 * - until  : reprise estimée (ms), null si inconnue (requête interactive en cours : sa durée n'est pas connue).
 */
export interface BudgetWait {
  reason: 'rate-limit' | 'budget';
  until: number | null;
}

/** Écouteur des attentes de fond : une attente qui commence (ou dont l'estimation change), puis null quand la requête part */
export type BudgetWaitListener = (wait: BudgetWait | null) => void;

export interface BudgetClock {
  now: () => number;
  sleep: (ms: number) => Promise<void>;
}

/**
 * Budget de requêtes d'une API, partagé par tout le service worker. Les requêtes interactives passent
 * toujours (sauf pénalité 429 en cours) ; les requêtes de fond attendent : pénalité, requête interactive en
 * cours ou toute récente, quota de fond de la minute épuisé, ou réserve interactive annoncée par l'API atteinte.
 */
export class RequestBudget {
  private backgroundStarts: number[] = [];
  private interactiveInFlight = 0;
  private lastInteractiveAt = Number.NEGATIVE_INFINITY;
  private cooldownUntil = 0;
  /** Dernier `X-RateLimit-Remaining` connu, décompté à chaque requête, valable jusqu'à `until` */
  private remaining: { value: number; until: number } | null = null;
  private readonly waitListeners = new Set<BudgetWaitListener>();

  private readonly clock: BudgetClock;

  constructor(clock: BudgetClock = { now: () => Date.now(), sleep }) {
    this.clock = clock;
  }

  /** Attente avant qu'une requête de fond puisse partir (0 : tout de suite) */
  backgroundWait(now: number = this.clock.now()): number {
    this.backgroundStarts = this.backgroundStarts.filter((at) => at > now - WINDOW_MS);
    const waits = [this.cooldownUntil - now];
    if (this.interactiveInFlight > 0) waits.push(INTERACTIVE_GRACE_MS);
    else waits.push(this.lastInteractiveAt + INTERACTIVE_GRACE_MS - now);
    if (this.backgroundStarts.length >= BACKGROUND_PER_MINUTE) waits.push(this.backgroundStarts[0] + WINDOW_MS - now);
    if (this.remaining && now < this.remaining.until && this.remaining.value <= INTERACTIVE_RESERVE) waits.push(this.remaining.until - now);
    return Math.max(0, ...waits);
  }

  /** Attente estimée d'une requête de fond (null : elle peut partir tout de suite) */
  backgroundWaitEstimate(now: number = this.clock.now()): BudgetWait | null {
    const wait = this.backgroundWait(now);
    if (wait <= 0) return null;
    const cooldown = this.cooldownUntil - now;
    if (cooldown >= wait) return { reason: 'rate-limit', until: this.cooldownUntil };
    return { reason: 'budget', until: this.interactiveInFlight > 0 ? null : now + wait };
  }

  /** Abonne un écouteur des attentes de fond (boucle d'une tâche) ; renvoie le désabonnement */
  onBackgroundWait(listener: BudgetWaitListener): () => void {
    this.waitListeners.add(listener);
    return () => this.waitListeners.delete(listener);
  }

  /** Pénalité en cours (ms restantes), 0 sinon */
  cooldownLeft(now: number = this.clock.now()): number {
    return Math.max(0, this.cooldownUntil - now);
  }

  /**
   * Réserve une place. Interactive : immédiat (la pénalité est gérée par l'appelant, voir cooldownLeft) ;
   * renvoie la fonction à appeler une fois la réponse reçue. Fond : attend que le budget le permette.
   */
  async acquire(lane: RequestLane): Promise<() => void> {
    if (lane === 'interactive') {
      this.interactiveInFlight++;
      this.consume();
      let released = false;
      return () => {
        if (released) return;
        released = true;
        this.interactiveInFlight--;
        this.lastInteractiveAt = this.clock.now();
      };
    }
    // Attente longue signalée aux tâches (pause visible), estimation mise à jour si elle change, fin signalée au départ
    let notified: BudgetWait | null = null;
    const waitingSince = this.clock.now();
    let notifiedAt = 0;
    for (;;) {
      const now = this.clock.now();
      const estimate = this.backgroundWaitEstimate(now);
      if (estimate === null) break;
      const wait = this.backgroundWait(now);
      const changed = notified === null || notified.reason !== estimate.reason || (notified.until === null) !== (estimate.until === null) || Math.abs((notified.until ?? 0) - (estimate.until ?? 0)) > 1_000;
      // Renvoyée toutes les 10 s même inchangée : signe de vie de la tâche qui attend
      if ((notified !== null || wait > WAIT_NOTICE_MS || now - waitingSince >= WAIT_NOTICE_MS) && (changed || now - notifiedAt >= WAIT_REFRESH_MS)) {
        notified = estimate;
        notifiedAt = now;
        this.emit(estimate);
      }
      await this.clock.sleep(Math.min(wait, MAX_POLL_MS));
    }
    if (notified !== null) this.emit(null);
    this.backgroundStarts.push(this.clock.now());
    this.consume();
    return () => undefined;
  }

  /** En-têtes X-RateLimit-* reçus : la réserve interactive se recale sur le décompte de l'API */
  observe({ remaining }: RateLimitHeaders): void {
    if (remaining === null) return;
    this.remaining = { value: remaining, until: this.clock.now() + WINDOW_MS };
  }

  /** Réponse 429 : plus aucune requête (de fond ou interactive) avant `delayMs` */
  penalize(delayMs: number): void {
    this.cooldownUntil = Math.max(this.cooldownUntil, this.clock.now() + delayMs);
    this.remaining = { value: 0, until: this.cooldownUntil };
  }

  private emit(wait: BudgetWait | null): void {
    for (const listener of this.waitListeners) listener(wait);
  }

  private consume(): void {
    if (this.remaining && this.remaining.value > 0) this.remaining.value--;
  }
}

/** Budget AniList commun (popup, panneau, synchro, tâches de fond) */
export const aniListBudget = new RequestBudget();
