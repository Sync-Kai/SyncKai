import { isSealedToken, openToken } from '../shared/token-crypto';
import type { TrackerId } from '../shared/tracker.types';

// Lecture des tokens enregistrés dans les tests (chiffrés depuis la 2.2.0, SEC-01) : clé en mémoire (src/test/setup.ts).

/** Contenu d'un token enregistré : déchiffré s'il est chiffré, tel quel sinon (ancien format, absent). Lève si indéchiffrable. */
export async function revealToken(service: TrackerId, stored: unknown): Promise<unknown> {
  if (!isSealedToken(stored)) return stored;
  const opened = await openToken(service, stored);
  if (!opened.ok) throw new Error(`Token ${service} indéchiffrable`);
  return opened.value;
}
