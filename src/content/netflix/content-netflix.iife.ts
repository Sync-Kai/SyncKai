// Script de contenu Netflix (monde isolé), enregistré à la demande par le service worker
// (src/background/netflix-access.ts) quand l'utilisateur accorde l'accès à netflix.com.
// Les métadonnées viennent du script du monde MAIN (page-bridge.iife.ts) via le pont d'événements.
// Format IIFE (suffixe .iife.ts) : script enregistré dynamiquement, sans chargeur ESM.
import { netflixAdapter } from '../adapters/netflix';
import { startContent } from '../start';

startContent([netflixAdapter]);
