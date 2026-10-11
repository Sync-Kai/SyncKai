// Script de contenu déclaré dans le manifeste : Crunchyroll et ADN (Netflix : netflix/content-netflix.iife.ts,
// enregistré à la demande par le service worker). Aussi réinjecté par le service worker dans les onglets déjà
// ouverts à l'installation et à la mise à jour (background/content-reinjection.ts).
import { isRecord } from '../shared/guards';
import type { StreamingAdapter } from './adapters/adapter';
import { adnAdapter } from './adapters/adn';
import { crunchyrollAdapter } from './adapters/crunchyroll';
import { listenCrHistoryPorts } from './lib/cr-history-port';
import { startContent } from './start';

const ADAPTERS: readonly StreamingAdapter[] = [crunchyrollAdapter, adnAdapter];

/**
 * Garde contre une double exécution dans le même monde isolé (script du manifeste puis réinjection, ou l'inverse).
 * La valeur est le `chrome.runtime` de l'instance qui tourne : s'il n'a plus d'`id`, cette instance est orpheline
 * (extension rechargée) et ne bloque pas la nouvelle.
 */
const STARTED_FLAG = Symbol.for('synckai.content');

const running: unknown = Reflect.get(globalThis, STARTED_FLAG);
if (!(isRecord(running) && typeof running.id === 'string')) {
  Reflect.defineProperty(globalThis, STARTED_FLAG, { value: chrome.runtime, configurable: true });
  startContent(ADAPTERS, {
    // Import de l'historique Crunchyroll (onglet d'import ↔ page Crunchyroll)
    onAdapter: (adapter) => {
      if (adapter.platform === 'crunchyroll') listenCrHistoryPorts();
    },
  });
}
