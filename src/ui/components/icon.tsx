// Icônes et logos des composants Preact : les nœuds viennent des fabriques vanilla (ui/icons.ts, ui/brand-icons.ts),
// montés dans un <span class="contents"> sans effet sur la mise en page. Une seule source pour les tracés et les
// chemins des logos ; Preact ne touche pas aux enfants qu'il n'a pas créés.
import type { Inputs } from 'preact/hooks';
import { useLayoutEffect, useRef } from 'preact/hooks';
import { icon, type IconName } from '../icons';

/**
 * Nœud construit par `build`, remplacé quand `inputs` changent (avant que le navigateur ne peigne). Le conteneur reste
 * vide pour Preact : aucun enfant JSX, donc aucun diff sur le nœud monté.
 */
export function MountedNode({ build, inputs }: { build: () => Node; inputs: Inputs }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    ref.current?.replaceChildren(build());
    // `build` est recréé à chaque rendu : seules les entrées déclarées comptent
  }, inputs);
  return <span ref={ref} class="contents" />;
}

export interface IconProps {
  name: IconName;
  /** Taille et couleur (classes Tailwind) ; défaut 16 px */
  class?: string;
  strokeWidth?: string;
}

/** Icône décorative (aria-hidden), couleur par currentColor */
export function Icon({ name, class: className = 'size-4', strokeWidth = '2' }: IconProps) {
  return <MountedNode build={() => icon(name, className, strokeWidth)} inputs={[name, className, strokeWidth]} />;
}
