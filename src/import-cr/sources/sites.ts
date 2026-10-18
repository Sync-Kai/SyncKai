import { PLATFORMS } from '../../platforms/registry';
import type { ImportPlatform } from '../../shared/cr-import';

// Site de chaque source, cité par les messages (« Ouvre www.crunchyroll.com dans cet onglet. ») : module léger, lu par les
// sources et par les composants de la page (sans charger les lecteurs injectés des sources).

export const SOURCE_SITES: Readonly<Record<ImportPlatform, string>> = {
  crunchyroll: 'www.crunchyroll.com',
  adn: 'animationdigitalnetwork.com',
  netflix: 'netflix.com/viewingactivity',
};

/** Paramètres des messages qui citent la plateforme et son site */
export const platformParams = (platform: ImportPlatform): { platform: string; site: string } => ({ platform: PLATFORMS[platform].label, site: SOURCE_SITES[platform] });
