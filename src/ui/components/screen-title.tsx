// Ligne de titre d'un écran (popup) : le nom de la section à gauche (police d'affichage, jeton text-stat, comme le
// titre de la barre des Réglages), des actions facultatives à droite. Le rail n'a que des icônes : ce titre nomme
// l'écran affiché (au toucher, sans bulle, c'est le seul libellé visible).
import type { ComponentChildren } from 'preact';

export interface ScreenTitleProps {
  title: string;
  /** Actions à droite (tri, menu) */
  children?: ComponentChildren;
}

export function ScreenTitle({ title, children }: ScreenTitleProps) {
  return (
    <div class="flex min-h-11 shrink-0 items-center gap-2 px-4" data-screen-title="">
      <h1 class="m-0 min-w-0 flex-1 truncate font-display text-stat font-extrabold" title={title}>
        {title}
      </h1>
      {children}
    </div>
  );
}
