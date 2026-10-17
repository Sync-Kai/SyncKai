// Section : titre en capitales de 11 px (jeton text-section, `muted`, ou `danger` pour la zone de danger) qui nomme son
// contenu, compte facultatif aligné à droite (« CRUNCHYROLL ··· 61 »).
import type { ComponentChildren } from 'preact';
import { useId } from 'preact/hooks';

export interface SectionProps {
  title: string;
  /** Nombre aligné à droite du titre, hors du nom de la section */
  count?: number | string;
  tone?: 'danger';
  children: ComponentChildren;
}

export function Section({ title, count, tone, children }: SectionProps) {
  const id = useId();
  return (
    <section class="flex flex-col gap-2" aria-labelledby={id}>
      {count === undefined ? (
        <h2 class={`m-0 mx-1 text-section uppercase ${tone === 'danger' ? 'text-danger' : 'text-muted'}`} id={id}>
          {title}
        </h2>
      ) : (
        <div class="mx-1 flex items-baseline justify-between gap-2">
          <h2 class={`m-0 min-w-0 text-section uppercase ${tone === 'danger' ? 'text-danger' : 'text-muted'}`} id={id}>
            {title}
          </h2>
          <span class="shrink-0 text-secondary font-extrabold text-muted tabular-nums" data-section-count="">
            {count}
          </span>
        </div>
      )}
      {children}
    </section>
  );
}
