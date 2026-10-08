// Script de contenu déclaré dans le manifeste : Crunchyroll et ADN (Netflix : netflix/content-netflix.iife.ts,
// enregistré à la demande par le service worker).
import type { StreamingAdapter } from './adapters/adapter';
import { adnAdapter } from './adapters/adn';
import { crunchyrollAdapter } from './adapters/crunchyroll';
import { listenCrHistoryPorts } from './lib/cr-history-port';
import { startContent } from './start';

const ADAPTERS: readonly StreamingAdapter[] = [crunchyrollAdapter, adnAdapter];

startContent(ADAPTERS, {
  // Import de l'historique Crunchyroll (onglet d'import ↔ page Crunchyroll)
  onAdapter: (adapter) => {
    if (adapter.platform === 'crunchyroll') listenCrHistoryPorts();
  },
});
