// Onglet « Agenda » : décision de chargement d'une semaine (pure, testable), appliquée par components/agenda.ts.

/** Après une requête, pas de nouvelle requête automatique pour la même semaine avant ce délai (évite toute boucle) */
export const REFETCH_GUARD_MS = 60_000;

export interface AgendaLoadInput {
  /** Cache `airingWeek:<date>` présent pour la semaine */
  hasCache: boolean;
  /** Cache encore valable (isWeekCacheFresh) */
  fresh: boolean;
  /** Chargement demandé par l'utilisateur (« Réessayer ») */
  force: boolean;
  /** Dernière requête GET_AGENDA de ce panneau pour la semaine (ms), null si aucune */
  lastFetchAt: number | null;
  now: number;
  /** Échec de cette dernière requête, null si elle a réussi */
  lastError: string | null;
  /** Résultat de la dernière requête de la semaine affiché (programme reçu ou erreur) */
  showingResult: boolean;
}

export type AgendaLoadDecision =
  /** Cache affiché sans requête ; `error` : échec de la dernière requête, toujours signalé (« données périmées ») */
  | { kind: 'show'; error: string | null }
  /** Requête récente : son résultat affiché est conservé (redessiné seulement) */
  | { kind: 'keep' }
  | { kind: 'fetch' };

export function decideAgendaLoad(input: AgendaLoadInput): AgendaLoadDecision {
  const recent = input.lastFetchAt !== null && input.now - input.lastFetchAt < REFETCH_GUARD_MS;
  if (input.hasCache && input.fresh) return { kind: 'show', error: null };
  if (recent && !input.force) {
    if (input.hasCache) return { kind: 'show', error: input.lastError };
    if (input.showingResult) return { kind: 'keep' };
  }
  return { kind: 'fetch' };
}
