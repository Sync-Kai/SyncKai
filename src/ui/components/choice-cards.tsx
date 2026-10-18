// Choix exclusif en cartes (maquettes Sync, Notifications) : un vrai bouton radio par option (masqué, cercle dessiné à
// côté), titre en gras, description `muted` dessous, pastille facultative (« Recommandé ») et visuel facultatif. Option
// choisie : fond `raised`, bordure lavender ; les autres : bordure `line`. Variante `flush` (maquette Notifications :
// cartes dans une carte) : aucune bordure, l'option choisie seulement sur fond `raised`. Groupe nommé par une légende (fieldset) ;
// boutons radio natifs d'un même nom : un seul arrêt de tabulation, les flèches choisissent.
import type { ComponentChildren } from 'preact';
import { useId } from 'preact/hooks';

export interface ChoiceCardOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  /** Pastille après le titre (« Recommandé ») */
  badge?: string;
  /** Visuel entre le cercle et le texte (illustration du style de notification) */
  media?: ComponentChildren;
}

export interface ChoiceCardsProps<T extends string> {
  /** Légende du groupe, visible au-dessus des cartes */
  legend: string;
  options: readonly ChoiceCardOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  /** Repère `data-focus` de chaque bouton radio : `${focusKey}-${value}` */
  focusKey?: string;
  /** Légende lue par le lecteur d'écran seulement (le titre de section au-dessus suffit à l'œil) */
  legendHidden?: boolean;
  /** Options sans bordure, serrées, dans une carte englobante : l'option choisie sur fond `raised` */
  flush?: boolean;
  /**
   * Deux cartes côte à côte dès 26 rem de conteneur (`@container` d'un parent ; page Sauvegarde : Fusionner / Remplacer),
   * l'une sous l'autre en dessous. Légende masquée de préférence (`legendHidden`) : visible, elle occuperait une case
   */
  columns?: boolean;
}

export function ChoiceCards<T extends string>({ legend, options, value, onChange, disabled = false, focusKey, legendHidden = false, flush = false, columns = false }: ChoiceCardsProps<T>) {
  const name = useId();
  const layout = columns ? 'grid grid-cols-1 @min-[26rem]:grid-cols-2' : 'flex flex-col';
  return (
    <fieldset class={`m-0 ${layout} min-w-0 border-0 p-0 ${flush ? 'gap-0' : 'gap-2'}`} disabled={disabled} data-choice-cards="">
      <legend class={legendHidden ? 'sr-only' : 'float-left mb-1 w-full p-0 text-body font-bold'}>{legend}</legend>
      {options.map((option) => {
        const on = option.value === value;
        const descriptionId = option.description ? `${name}-${option.value}` : undefined;
        return (
          <label
            key={option.value}
            class={`clear-both flex min-w-0 cursor-pointer items-center gap-2.5 rounded-panel p-2.5 transition-colors has-disabled:cursor-default has-disabled:opacity-50 ${
              flush ? (on ? 'bg-raised' : 'bg-transparent hover:bg-raised/60') : on ? 'border border-lavender bg-raised' : 'border border-line bg-transparent hover:bg-raised'
            }`}
            data-choice={option.value}
          >
            <input
              class="peer sr-only"
              type="radio"
              name={name}
              value={option.value}
              checked={on}
              disabled={disabled}
              aria-describedby={descriptionId}
              data-focus={focusKey ? `${focusKey}-${option.value}` : undefined}
              onChange={(event) => {
                if (event.currentTarget.checked) onChange(option.value);
              }}
            />
            <span
              class={`flex size-4.5 shrink-0 items-center justify-center rounded-pill border-2 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-lavender ${
                on ? 'border-lavender' : 'border-field'
              }`}
              aria-hidden="true"
            >
              {on && <span class="size-2 rounded-pill bg-lavender" />}
            </span>
            {option.media}
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="flex flex-wrap items-center gap-x-1.5 font-bold">
                {option.label}
                {option.badge && <span class="rounded-pill bg-lavender/16 px-2 text-section tracking-normal text-lavender">{option.badge}</span>}
              </span>
              {option.description && (
                <span class="text-secondary text-muted" id={descriptionId}>
                  {option.description}
                </span>
              )}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
