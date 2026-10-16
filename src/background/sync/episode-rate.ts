import { EPISODE_RATE_KEY } from '../../protocol/storage-keys';
import { isRecord } from '../../shared/guards';
import { createLogger } from '../../browser/logger';

// Limite de débit de EPISODE_COMPLETED (SEC-01, décision 1) : un script de la page (publicité, XSS) peut faire « terminer »
// de courtes vidéos à la chaîne. Au-delà de MAX_COMPLETIONS épisodes en COMPLETION_WINDOW_MS pour un même onglet ou une
// même série, l'épisode passe par « À vérifier » au lieu d'être écrit (jamais perdu). Un enchaînement autoplay normal
// (un épisode toutes les quelques minutes, même des courts de 2 min) reste en dessous.
// Horodatages dans chrome.storage.session : gardés quand le service worker s'arrête entre deux épisodes, effacés à la
// fermeture du navigateur, jamais dans `local` (aucun réveil du service worker par onChanged).

const log = createLogger('sync');

export const COMPLETION_WINDOW_MS = 10 * 60_000;
export const MAX_COMPLETIONS = 5;
const LOCK = 'synckai:episode-rate';

export type CompletionHistory = Record<string, number[]>;

/**
 * Enregistre un épisode terminé sous chacune de ses clés (onglet, série) et dit s'il dépasse la limite (pur, testable) :
 * une clé compte déjà MAX_COMPLETIONS épisodes dans la fenêtre. Les horodatages sortis de la fenêtre sont oubliés.
 */
export function recordCompletionAt(history: Readonly<CompletionHistory>, keys: readonly string[], now: number): { burst: boolean; history: CompletionHistory } {
  const recent = (key: string): number[] => (history[key] ?? []).filter((at) => now - at < COMPLETION_WINDOW_MS && at <= now);
  const burst = keys.some((key) => recent(key).length >= MAX_COMPLETIONS);
  const next: CompletionHistory = {};
  for (const [key, times] of Object.entries(history)) {
    const kept = times.filter((at) => now - at < COMPLETION_WINDOW_MS && at <= now);
    if (kept.length > 0) next[key] = kept;
  }
  for (const key of keys) next[key] = [...(next[key] ?? []), now].slice(-MAX_COMPLETIONS * 2);
  return { burst, history: next };
}

function readHistory(value: unknown): CompletionHistory {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, times]) => (Array.isArray(times) ? [[key, times.filter((t): t is number => typeof t === 'number' && Number.isFinite(t))]] : [])),
  );
}

/**
 * Épisode terminé reçu : true s'il dépasse la limite (« À vérifier »). Stockage illisible : jamais limité (la synchro
 * garde ses autres gardes ; une erreur ne bloque pas les épisodes de l'utilisateur).
 */
export async function recordCompletion(keys: readonly string[], now = Date.now()): Promise<boolean> {
  try {
    return await navigator.locks.request(LOCK, async () => {
      const stored = await chrome.storage.session.get(EPISODE_RATE_KEY);
      const { burst, history } = recordCompletionAt(readHistory(stored[EPISODE_RATE_KEY]), keys, now);
      await chrome.storage.session.set({ [EPISODE_RATE_KEY]: history });
      return burst;
    });
  } catch (error: unknown) {
    log.warn('Limite de débit des épisodes indisponible :', error);
    return false;
  }
}
