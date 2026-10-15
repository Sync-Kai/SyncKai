// Script de contenu Netflix (monde isolé), enregistré à la demande par le service worker
// (src/background/platform-access.ts) quand l'utilisateur accorde l'accès à netflix.com, et exécuté aussitôt
// dans les onglets Netflix déjà ouverts, ainsi qu'après une mise à jour de l'extension (accès accordé).
// Les métadonnées viennent du script du monde MAIN (page-bridge.iife.ts) via le pont d'événements.
// Format IIFE (suffixe .iife.ts) : script enregistré dynamiquement, sans chargeur ESM.
import { bridge, netflixAdapter } from './adapter';
import { claimContentInstance } from '../lib/instance-guard';
import { NETFLIX_HISTORY_HOOK } from '../../shared/netflix-history';
import { startContent } from '../start';

/**
 * Garde contre une double exécution dans le même monde isolé (accès retiré puis accordé de nouveau sans recharger
 * l'onglet, réinjection après une mise à jour), voir instance-guard.ts. Clé distincte de celle des versions
 * jusqu'à la 2.2.0 (`synckai.netflix.content`, posée à `true` non configurable) : une instance orpheline de ces
 * versions ne bloque pas la nouvelle, et la garde reste réinscriptible.
 */
const STARTED_FLAG = Symbol.for('synckai.netflix.content.runtime');

if (claimContentInstance(STARTED_FLAG)) {
  startContent([netflixAdapter]);
  // Import de l'historique : la page d'import (scripting.executeScript, même monde isolé, jamais la page Netflix) demande
  // les points de lecture d'une série au pont MAIN. Rien ne tourne tant qu'elle ne l'appelle pas.
  Reflect.set(globalThis, Symbol.for(NETFLIX_HISTORY_HOOK), (movieId: string) => bridge().loadHistory(movieId, new AbortController().signal));
}
