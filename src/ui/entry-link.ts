import { t } from '../i18n';
import type { EntryLink } from '../shared/entry-link';
import { TRACKER_LABELS } from '../shared/tracker.types';
import { h, type Child } from './dom';

// Titre et jaquette cliquables (popup, panneau latéral) : fiche AniList ou MyAnimeList dans un nouvel onglet.
// Le lien choisi vient de shared/entry-link.ts ; sans lien (aucun identifiant), titre et jaquette restent inertes.

/** Le clic ouvre la fiche et rien d'autre (aucun gestionnaire de la ligne) */
const stopPropagation = (event: Event): void => event.stopPropagation();

function linkAttrs(link: EntryLink): Record<string, string> {
  return { href: link.url, target: '_blank', rel: 'noopener noreferrer' };
}

/**
 * Titre : lien atteignable au clavier, souligné au survol. `focusKey` : clé `data-focus` stable (focus retrouvé
 * après un nouveau rendu). Sans lien : le texte seul.
 */
export function entryTitle(link: EntryLink | null, title: string, focusKey: string, className = ''): Child {
  if (!link) return title;
  return h(
    'a',
    {
      class: `cursor-pointer underline-offset-2 hover:underline ${className}`,
      attrs: { ...linkAttrs(link), 'aria-label': t('entry.openAria', { title, service: TRACKER_LABELS[link.service] }), 'data-focus': focusKey },
      on: { click: stopPropagation },
    },
    title,
  );
}

/**
 * Jaquette : même lien que le titre, hors de l'ordre de tabulation et masqué aux lecteurs d'écran (doublon du titre).
 * Rendu de la jaquette inchangé (`renderCover`, images filtrées par `toImageSrc`).
 */
export function entryCover(link: EntryLink | null, cover: HTMLElement, className = ''): HTMLElement {
  if (!link) return cover;
  return h(
    'a',
    {
      class: `block shrink-0 cursor-pointer rounded-lg transition hover:brightness-110 ${className}`,
      attrs: { ...linkAttrs(link), tabindex: '-1', 'aria-hidden': 'true' },
      on: { click: stopPropagation },
    },
    cover,
  );
}
