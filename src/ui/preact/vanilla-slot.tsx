// Éléments créés hors d'un arbre Preact et montés dedans (popup : barre et vue des Réglages, conteneur de la barre
// d'état). Le conteneur n'a aucun enfant JSX : Preact ne touche pas aux nœuds montés.
import { useLayoutEffect, useRef } from 'preact/hooks';

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
