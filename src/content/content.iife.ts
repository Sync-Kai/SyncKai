// Script de contenu déclaré dans le manifeste : Crunchyroll et ADN (Netflix : netflix/content-netflix.iife.ts,
// enregistré à la demande par le service worker). Aussi réinjecté par le service worker dans les onglets déjà
// ouverts à l'installation et à la mise à jour sur Chrome (background/content-reinjection.ts) ; Firefox le fait seul.
import type { StreamingAdapter } from './lib/adapter';
import { adnAdapter } from './adn/adapter';
import { crunchyrollAdapter, crunchyrollBridge } from './crunchyroll/adapter';
import { claimContentInstance } from './lib/instance-guard';
import { startContent } from './start';

const ADAPTERS: readonly StreamingAdapter[] = [crunchyrollAdapter, adnAdapter];

/** Garde contre une double exécution (script du manifeste puis réinjection, ou l'inverse), voir instance-guard.ts */
const STARTED_FLAG = Symbol.for('synckai.content');

if (claimContentInstance(STARTED_FLAG)) {
  startContent(ADAPTERS, {
    // Pont MAIN de Crunchyroll (signaux de correspondance). Lecteurs de l'historique : injectés à la demande par la page
    // d'import (content/history/history.iife.ts)
    onAdapter: (adapter) => {
      if (adapter.platform === 'crunchyroll') crunchyrollBridge();
    },
  });
}
