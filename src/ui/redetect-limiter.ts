// Plafond des relectures AUTOMATIQUES de la page (fiche réécrite ailleurs, événement du port de lecture : synchro,
// saison choisie dans la page), extrait du contrôleur de la fiche (ui/page-media-controller.ts, audit 4-§3) : au plus
// une toutes les `minIntervalMs` (les suivantes sont regroupées et reportées) et `maxPerMinute` par minute. Au-delà,
// plus aucune jusqu'à `reset` (changement d'URL de l'onglet, actualisation demandée) : quelle qu'en soit la cause, une
// boucle ne peut jamais épuiser le quota de requêtes AniList (chaque résolution relit les listes). Les échos d'une action
// de l'utilisateur (`expectEchoes` : +1 / −1, statut… dans l'écran, synchro terminée dans la page) restent regroupés
// mais ne sont pas comptés : quelques actions de suite ne suspendent plus le suivi de la page (2026-10-15).

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
  /**
   * Action de l'utilisateur : les relectures demandées pendant `ms` sont ses échos (fiche de l'onglet réécrite par le
   * service worker ou l'autre écran, synchro annoncée) : regroupées comme les autres, jamais comptées dans le plafond par
   * minute. Une relecture regroupée avec une demande hors écho est comptée.
   */
  expectEchoes(ms: number): void;
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
  /** Relectures accordées et comptées de la dernière minute (sans les échos) */
  let times: number[] = [];
  /** Dernière relecture accordée, écho compris (intervalle minimal), null : aucune */
  let lastAt: number | null = null;
  /** Fin de la fenêtre des échos d'une action de l'utilisateur */
  let echoUntil = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  /** Relecture reportée : `reresolve` cumulé, `echo` si toutes les demandes regroupées sont des échos ; null : aucune */
  let deferred: { reresolve: boolean; echo: boolean } | null = null;
  let suspended = false;

  /** `echo` : demande faite dans la fenêtre des échos (relecture reportée : établi à la demande, pas à son exécution) */
  function grant(reresolve: boolean, echo: boolean): void {
    if (!active() || suspended) return;
    const now = Date.now();
    times = times.filter((at) => now - at < MINUTE_MS);
    if (lastAt !== null && now - lastAt < minIntervalMs) {
      deferred = deferred === null ? { reresolve, echo } : { reresolve: deferred.reresolve || reresolve, echo: deferred.echo && echo };
      timer ??= setTimeout(() => {
        timer = undefined;
        const pending = deferred;
        deferred = null;
        if (pending) grant(pending.reresolve, pending.echo);
      }, lastAt + minIntervalMs - now);
      return;
    }
    if (!echo && times.length >= maxPerMinute) {
      suspended = true;
      onSuspend?.();
      return;
    }
    if (!echo) times.push(now);
    lastAt = now;
    run(reresolve);
  }

  function reset(): void {
    clearTimeout(timer);
    timer = undefined;
    deferred = null;
    times = [];
    lastAt = null;
    echoUntil = 0;
    suspended = false;
  }

  return {
    request: (reresolve) => grant(reresolve, Date.now() < echoUntil),
    expectEchoes(ms: number): void {
      echoUntil = Math.max(echoUntil, Date.now() + ms);
    },
    reset,
    navigated(): void {
      times = times.slice(-1);
      suspended = false;
      grant(deferred?.reresolve ?? false, Date.now() < echoUntil);
    },
    dispose: reset,
  };
}
