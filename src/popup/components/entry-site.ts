import { entryLink, type EntryLink, type EntryLinkContext } from '../../shared/entry-link';
import type { WatchingEntry } from '../../shared/watching.types';

/**
 * Fiche ouverte par le titre et la jaquette d'une série de « Mes séries » ; sans identifiant exploitable (cas théorique),
 * la page de la fiche sur le service affiché
 */
export function entrySite(entry: WatchingEntry, links: EntryLinkContext): EntryLink {
  return entryLink(entry, links) ?? { service: entry.siteUrl.startsWith('https://myanimelist.net/') ? 'mal' : 'anilist', url: entry.siteUrl };
}
