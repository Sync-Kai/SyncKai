import type { ImportPlatform } from '../../shared/cr-import';
import { adnSource } from './adn';
import { crunchyrollSource } from './crunchyroll';
import { netflixSource } from './netflix';
import type { HistorySource } from './source';

/** Sources des historiques, une par plateforme (sources/<plateforme>.ts) */
export const SOURCES: Readonly<Record<ImportPlatform, HistorySource>> = { crunchyroll: crunchyrollSource, adn: adnSource, netflix: netflixSource };
