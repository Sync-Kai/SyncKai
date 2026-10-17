// Page Preact des Réglages : contrat SettingsMountedPage construit depuis un composant. La vue la monte dans son
// conteneur à l'ouverture et la démonte quand on la quitte ou que la vue est fermée (render(null)).
import { render, type ComponentChild } from 'preact';
import type { SettingsMountedPage } from './context';

export interface PreactPageOptions {
  /** Repère `data-focus` à focaliser à l'ouverture à la place du titre (null : le titre) */
  initialFocus?: () => string | null;
}

/**
 * `view` rend l'arbre de la page (appelé à chaque montage) : l'état à garder entre deux visites vit hors de l'arbre
 * (store créé avec la page), les données viennent de `ctx.state` (useStore) et des stores de l'hôte.
 */
export function preactPage(view: () => ComponentChild, options: PreactPageOptions = {}): SettingsMountedPage {
  return {
    mount(container) {
      render(view(), container);
      return () => render(null, container);
    },
    ...(options.initialFocus ? { initialFocus: options.initialFocus } : {}),
  };
}
