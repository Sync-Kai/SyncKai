// Section : titre en capitales de 11 px (jeton text-section, `muted`) qui nomme son contenu.
import type { ComponentChildren } from 'preact';
import { useId } from 'preact/hooks';

export interface SectionProps {
  title: string;
  children: ComponentChildren;
}

export function Section({ title, children }: SectionProps) {
  const id = useId();
  return (
    <section class="flex flex-col gap-2" aria-labelledby={id}>
      <h2 class="m-0 mx-1 text-section text-muted uppercase" id={id}>
        {title}
      </h2>
      {children}
    </section>
  );
}
