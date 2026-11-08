// Amis AniList de la fiche affichée (carte « Sur cette page » du popup, « En lecture » du panneau) : une demande par
// fiche, envoyée seulement quand elle est restée la même FRIENDS_SETTLE_MS (budget de requêtes décidé par le
// propriétaire : une suite rapide de choix de saisons ou de navigations n'envoie rien, les saisons du sélecteur ne sont
// jamais lues d'avance). Le service worker garde la réponse 10 min ; « Réessayer » renvoie aussitôt.
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import type { FriendsSummary } from '../../shared/friends';
import { callWorker } from '../worker-call';

/** Fiche restée la même ce temps-là : demande envoyée */
export const FRIENDS_SETTLE_MS = 1500;

/** `idle` : pas de session AniList ou pas de fiche ; `none` : aucun ami n'a la série (bloc masqué dans les deux cas) */
export type FriendsState = 'idle' | 'loading' | 'ok' | 'none' | 'error';

export interface FriendsView {
  state: FriendsState;
  summary: FriendsSummary | null;
  retry: () => void;
}

/** Résultat lu, rattaché à sa fiche : jamais montré pour une autre */
interface FriendsResult {
  mediaId: number;
  state: 'ok' | 'none' | 'error';
  summary: FriendsSummary | null;
}

export function useFriends(mediaId: number | null, enabled: boolean): FriendsView {
  const [result, setResult] = useState<FriendsResult | null>(null);
  /** Nombre de « Réessayer » : relance l'effet */
  const [attempt, setAttempt] = useState(0);
  /** Prochaine demande sans attente (« Réessayer ») */
  const immediate = useRef(false);
  const active = enabled && mediaId !== null;

  useEffect(() => {
    if (!active) {
      // Session fermée (ou fiche absente) : résultat oublié, jamais remontré pour un autre compte à la réouverture
      setResult(null);
      return undefined;
    }
    let current = true;
    const delay = immediate.current ? 0 : FRIENDS_SETTLE_MS;
    immediate.current = false;
    const timer = setTimeout(() => {
      void callWorker('GET_ANILIST_FRIENDS', { mediaId }, (message) => ({ status: 'error', message })).then((response) => {
        // Fiche changée, démontée ou relancée entre-temps : réponse ignorée
        if (!current) return;
        setResult(response.status === 'ok' ? { mediaId, state: 'ok', summary: response.summary } : { mediaId, state: response.status, summary: null });
      });
    }, delay);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [active, mediaId, attempt]);

  const retry = useCallback((): void => {
    immediate.current = true;
    setResult(null);
    setAttempt((n) => n + 1);
  }, []);

  if (!active) return { state: 'idle', summary: null, retry };
  if (result === null || result.mediaId !== mediaId) return { state: 'loading', summary: null, retry };
  return { state: result.state, summary: result.summary, retry };
}
