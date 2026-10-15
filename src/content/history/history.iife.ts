// Lecteurs de l'historique Crunchyroll et ADN (page d'import ↔ onglet de la plateforme), hors du script de contenu du
// manifeste : ils ne servent qu'à l'import, mais chaque page Crunchyroll / ADN les aurait analysés. Injecté par la page
// d'import juste avant d'ouvrir le port (import-cr/history-reader.ts, scripting.executeScript, monde isolé des scripts de
// contenu), jamais exposé aux sites (retiré de web_accessible_resources, src/build/output-names.ts). Protocole des ports
// inchangé (lib/history-port.ts).
import { listenAdnHistoryPorts } from '../adn/history';
import { listenCrHistoryPorts } from '../crunchyroll/history-port';
import { claimContentInstance } from '../lib/instance-guard';

/** Garde contre une double exécution (injecté à chaque tentative de lecture ; orphelin possible après une mise à jour), voir instance-guard.ts */
const STARTED_FLAG = Symbol.for('synckai.history');

/** Domaine ou l'un de ses sous-domaines (mêmes hôtes que les adapters Crunchyroll et ADN) */
const onDomain = (hostname: string, domain: string): boolean => hostname === domain || hostname.endsWith(`.${domain}`);

if (claimContentInstance(STARTED_FLAG)) {
  // Les lecteurs vérifient eux-mêmes l'hôte exact de l'API (sinon « wrong-page » sur le port)
  if (onDomain(location.hostname, 'crunchyroll.com')) listenCrHistoryPorts();
  else if (onDomain(location.hostname, 'animationdigitalnetwork.com')) listenAdnHistoryPorts();
}
