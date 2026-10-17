// Parties encore vanilla montées dans un arbre Preact pendant la migration (popup : carte « Sur cette page »,
// Activité, carte « Reprendre », menus « ⋯ » des lignes, éditeur de commentaire). Le conteneur n'a aucun enfant JSX :
// Preact ne touche pas aux nœuds montés.
import type { Inputs } from 'preact/hooks';
import { useLayoutEffect, useRef } from 'preact/hooks';
import { preserveFocus } from '../dom';

export interface VanillaSlotProps {
  /** Nœud reconstruit quand `inputs` changent ; null : vide */
  build: () => Node | null;
  inputs: Inputs;
  /** Classes du conteneur ; défaut `contents` (sans effet sur la mise en page) */
  class?: string;
  /** Attributs data-* ou ARIA du conteneur */
  attrs?: Record<string, string>;
}

/**
 * Rendu vanilla reconstruit quand ses entrées changent, avant que le navigateur ne peigne. Le focus clavier est
 * retrouvé par sa clé `data-focus` (preserveFocus), comme lorsque l'écran entier était vanilla.
 */
export function VanillaSlot({ build, inputs, class: className = 'contents', attrs }: VanillaSlotProps) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const container = ref.current;
    if (!container) return;
    preserveFocus(container, () => {
      const node = build();
      container.replaceChildren(...(node ? [node] : []));
    });
    // `build` est recréé à chaque rendu : seules les entrées déclarées comptent
  }, inputs);
  return <div ref={ref} class={className} {...attrs} />;
}

export interface ElementSlotProps {
  /** Élément persistant (créé et mis à jour par l'hôte), lu après chaque rendu ; null : rien */
  element: () => HTMLElement | null;
  class?: string;
  attrs?: Record<string, string>;
}

/**
 * Élément persistant (barre et vue des Réglages, éditeur de commentaire) inséré dans le conteneur après chaque rendu,
 * jamais recréé : le focus et la saisie en cours y restent.
 */
export function ElementSlot({ element, class: className = 'contents', attrs }: ElementSlotProps) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const container = ref.current;
    if (!container) return;
    const el = element();
    if (!el) {
      container.replaceChildren();
      return;
    }
    if (container.firstChild !== el || container.childNodes.length !== 1) container.replaceChildren(el);
  });
  return <div ref={ref} class={className} {...attrs} />;
}
