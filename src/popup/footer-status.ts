// Barre d'état du popup (pied de page) : état affiché et pastilles des comptes, fonctions pures de l'état du popup
// (sorties de popup.ts pour être testées, audit 4-§3).
import { TRACKER_IDS, type TrackerId } from '../shared/tracker.types';
import { formatRelativeTime } from '../shared/watching';
import type { AccountState } from '../ui/state';
import type { FooterStatus } from './components/footer';

export interface FooterInput {
  accounts: Readonly<Record<TrackerId, AccountState<unknown>>>;
  /** Cartes « À vérifier » */
  reviews: number;
  /** File de synchro : abandonnées (à traiter) et en attente de relance automatique */
  queue: { failed: number; pending: number };
  /** Séries terminées dont la note a été reportée (Activité › À noter) */
  toRate: number;
  /** Dernière synchro (ms), null si aucune */
  latestSyncAt: number | null;
  now: number;
}

export type FooterChip = { service: TrackerId; state: 'ok' | 'expired' };

/** Priorité : synchros abandonnées, vérifications, relances en attente, session expirée, aucun compte, notes, puis « à jour » */
export function footerStatus(input: FooterInput): FooterStatus {
  const connected = TRACKER_IDS.some((service) => input.accounts[service].status === 'logged-in');
  const expired = TRACKER_IDS.find((service) => {
    const state = input.accounts[service];
    return state.status === 'logged-out' && state.expired;
  });
  const { failed, pending } = input.queue;

  if (connected && failed > 0) return { kind: 'queue-failed', count: failed };
  if (connected && input.reviews > 0) return { kind: 'pending', count: input.reviews };
  if (connected && pending > 0) return { kind: 'queue-pending', count: pending };
  if (expired) return { kind: 'expired', service: expired };
  if (!connected) return { kind: 'none' };
  // Priorité la plus basse : une note reportée n'empêche rien de fonctionner
  if (input.toRate > 0) return { kind: 'to-rate', count: input.toRate };
  return { kind: 'ok', relative: input.latestSyncAt !== null ? formatRelativeTime(input.latestSyncAt, input.now) : null };
}

/** Pastilles : services connectés, ou dont la session a expiré (« Reconnecter ») */
export function footerChips(accounts: FooterInput['accounts']): FooterChip[] {
  return TRACKER_IDS.flatMap((service): FooterChip[] => {
    const state = accounts[service];
    if (state.status === 'logged-in') return [{ service, state: 'ok' }];
    if (state.status === 'logged-out' && state.expired) return [{ service, state: 'expired' }];
    return [];
  });
}
