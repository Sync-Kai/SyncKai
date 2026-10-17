// Section : titre en capitales de 11 px (jeton text-section, `muted`, ou `danger` pour la zone de danger) qui nomme son
// contenu, compte facultatif aligné à droite (« CRUNCHYROLL ··· 61 »). Popup › Activité (maquettes PopupActivite,
// PopupActiviteEtats) : titre teinté du ton de la section (échec, en attente, à noter, à vérifier) et compte à la suite
// (« ÉCHEC · 1 »).
import type { ComponentChildren } from 'preact';
import { useId } from 'preact/hooks';

/** `danger` : zone de danger, échecs ; `info` : en attente ; `warn` : à vérifier ; `accent` : à noter */
export type SectionTone = 'danger' | 'info' | 'warn' | 'accent';

export interface SectionProps {
  title: string;
  /** Nombre aligné à droite du titre, hors du nom de la section */
  count?: number | string;
  /** Compte à la suite du titre (« ÉCHEC · 1 »), dans son nom accessible */
  countInline?: boolean;
  tone?: SectionTone;
  children: ComponentChildren;
}

const TONES: Readonly<Record<SectionTone | 'muted', string>> = {
  muted: 'text-muted',
  danger: 'text-danger',
  info: 'text-lavender',
  warn: 'text-butter',
  accent: 'text-sakura',
};

export function Section({ title, count, countInline = false, tone, children }: SectionProps) {
  const id = useId();
  const color = TONES[tone ?? 'muted'];
  return (
    <section class="flex flex-col gap-2" aria-labelledby={id}>
      {count === undefined || countInline ? (
        <h2 class={`m-0 mx-1 text-section uppercase ${color}`} id={id}>
          {title}
          {count !== undefined && <span class="tabular-nums" data-section-count="">{` · ${count}`}</span>}
        </h2>
      ) : (
        <div class="mx-1 flex items-baseline justify-between gap-2">
          <h2 class={`m-0 min-w-0 text-section uppercase ${color}`} id={id}>
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
