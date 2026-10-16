// Lecteurs de l'historique Crunchyroll et ADN (page d'import ↔ onglet de la plateforme), hors du script de contenu du
// manifeste : ils ne servent qu'à l'import, mais chaque page Crunchyroll / ADN les aurait analysés. Injecté par la page
// d'import juste avant d'ouvrir le port (import-cr/history-reader.ts, scripting.executeScript, monde isolé des scripts de
// contenu), jamais exposé aux sites (retiré de web_accessible_resources, src/build/output-names.ts). Protocole des ports
// inchangé (lib/history-port.ts).
import { listenAdnHistoryPorts } from '../adn/history';
import { listenCrHistoryPorts } from '../crunchyroll/history-port';
import { domainOrSubdomain } from '../../shared/hosts';
import { claimContentInstance } from '../lib/instance-guard';

/** Garde contre une double exécution (injecté à chaque tentative de lecture ; orphelin possible après une mise à jour), voir instance-guard.ts */
const STARTED_FLAG = Symbol.for('synckai.history');

if (claimContentInstance(STARTED_FLAG)) {
  // Les lecteurs vérifient eux-mêmes l'hôte exact de l'API (sinon « wrong-page » sur le port)
  // Mêmes hôtes que les adapters Crunchyroll et ADN
  if (domainOrSubdomain('crunchyroll.com')(location.hostname)) listenCrHistoryPorts();
  else if (domainOrSubdomain('animationdigitalnetwork.com')(location.hostname)) listenAdnHistoryPorts();
}
