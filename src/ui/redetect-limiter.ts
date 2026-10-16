// Plafond des relectures AUTOMATIQUES de la page (fiche réécrite ailleurs, événement du port de lecture : synchro,
// saison choisie dans la page), extrait du contrôleur de la fiche (ui/page-media-controller.ts, audit 4-§3) : au plus
// une toutes les `minIntervalMs` (les suivantes sont regroupées et reportées) et `maxPerMinute` par minute. Au-delà,
// plus aucune jusqu'à `reset` (changement d'URL de l'onglet, actualisation demandée) : quelle qu'en soit la cause, une
// boucle ne peut jamais épuiser le quota de requêtes AniList (chaque résolution relit les listes).

const MINUTE_MS = 60_000;

export interface RedetectLimiterOptions {
  minIntervalMs: number;
  maxPerMinute: number;
  /** Relecture accordée ; `reresolve` : cumul (ou logique) des demandes regroupées */
  run(reresolve: boolean): void;
  /** Faux : demande ignorée sans être comptée (aucun onglet suivi) */
  active(): boolean;
  /** Plafond atteint : relectures suspendues jusqu'à `reset` ou `navigated` */
  onSuspend?(): void;
}

export interface RedetectLimiter {
  /** Relecture automatique demandée : accordée, reportée (regroupée) ou ignorée (suspendue) */
  request(reresolve: boolean): void;
  /** Changement d'URL, autre onglet, actualisation demandée : plafond remis à zéro, relecture reportée oubliée */
  reset(): void;
  /**
   * Page changée sans changement d'URL (saison choisie dans le menu de la page) : comme une navigation, compte de la
   * minute remis à zéro (seule la dernière relecture reste, pour l'intervalle) et suspension levée, puis relecture
   * demandée avec le `reresolve` de la demande reportée
   */
  navigated(): void;
  /** Minuterie de la relecture reportée annulée (hôte détruit) */
  dispose(): void;
}

export function createRedetectLimiter(options: RedetectLimiterOptions): RedetectLimiter {
  const { minIntervalMs, maxPerMinute, run, active, onSuspend } = options;
  /** Relectures accordées de la dernière minute */
  let times: number[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  /** `reresolve` cumulé de la relecture reportée, null : aucune */
  let deferred: boolean | null = null;
  let suspended = false;

  function request(reresolve: boolean): void {
    if (!active() || suspended) return;
    const now = Date.now();
    times = times.filter((at) => now - at < MINUTE_MS);
    const last = times.at(-1);
    if (last !== undefined && now - last < minIntervalMs) {
      deferred = (deferred ?? false) || reresolve;
      timer ??= setTimeout(() => {
        timer = undefined;
        const pending = deferred ?? false;
        deferred = null;
        request(pending);
      }, last + minIntervalMs - now);
      return;
    }
    if (times.length >= maxPerMinute) {
      suspended = true;
      onSuspend?.();
      return;
    }
    times.push(now);
    run(reresolve);
  }

  function reset(): void {
    clearTimeout(timer);
    timer = undefined;
    deferred = null;
    times = [];
    suspended = false;
  }

  return {
    request,
    reset,
    navigated(): void {
      times = times.slice(-1);
      suspended = false;
      request(deferred ?? false);
    },
    dispose: reset,
  };
}
