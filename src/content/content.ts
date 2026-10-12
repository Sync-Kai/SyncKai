// Script de contenu déclaré dans le manifeste : Crunchyroll et ADN (Netflix : netflix/content-netflix.iife.ts,
// enregistré à la demande par le service worker). Aussi réinjecté par le service worker dans les onglets déjà
// ouverts à l'installation et à la mise à jour sur Chrome (background/content-reinjection.ts) ; Firefox le fait seul.
import type { StreamingAdapter } from './adapters/adapter';
import { adnAdapter } from './adapters/adn';
import { crunchyrollAdapter } from './adapters/crunchyroll';
import { listenAdnHistoryPorts } from './lib/adn-history';
import { listenCrHistoryPorts } from './lib/cr-history-port';
import { claimContentInstance } from './lib/instance-guard';
import { startContent } from './start';

const ADAPTERS: readonly StreamingAdapter[] = [crunchyrollAdapter, adnAdapter];

/** Garde contre une double exécution (script du manifeste puis réinjection, ou l'inverse), voir instance-guard.ts */
const STARTED_FLAG = Symbol.for('synckai.content');

if (claimContentInstance(STARTED_FLAG)) {
  startContent(ADAPTERS, {
    // Import de l'historique (onglet d'import ↔ page Crunchyroll ou ADN)
    onAdapter: (adapter) => {
      if (adapter.platform === 'crunchyroll') listenCrHistoryPorts();
      else if (adapter.platform === 'adn') listenAdnHistoryPorts();
    },
  });
}
