/**
 * Libellé de version des builds de développement (`version_name` du manifeste) : « 2.3.1-dev · 3c8ec4f », suivi de « + »
 * si des fichiers suivis par git étaient modifiés au build. Affiché par chrome://extensions et le pied de la popup, pour
 * savoir quel build tourne ; `version` (releases, stores, sauvegardes) reste inchangé. Jamais en production : le paquet
 * publié reste identique. Sans import : chargé tel quel par vite.config.ts.
 */

/** État git du dépôt au moment du build ; null hors dépôt (archive des sources) */
export interface DevBuildRef {
  /** Commit abrégé (`git rev-parse --short HEAD`) */
  sha: string;
  /** Fichiers suivis modifiés par rapport à HEAD */
  dirty: boolean;
}

export const GIT_SHORT_SHA_ARGS: readonly string[] = ['rev-parse', '--short', 'HEAD'];
/** Code de sortie 1 si des fichiers suivis diffèrent de HEAD (fichiers non suivis ignorés) */
export const GIT_DIRTY_ARGS: readonly string[] = ['diff', '--quiet', 'HEAD'];

export function devVersionName(version: string, ref: DevBuildRef | null): string {
  if (!ref) return `${version}-dev`;
  return `${version}-dev · ${ref.sha}${ref.dirty ? '+' : ''}`;
}
