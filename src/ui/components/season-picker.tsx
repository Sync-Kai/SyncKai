// Sélecteur de la saison AniList d'une série (maquettes PopupPageEtats « Saison devinée », PopupSeriesDeplie) : titre en
// petites capitales, liste déroulante native (titre complet en infobulle), aide facultative dessous. Saison devinée :
// avertissement beurre au-dessus, le tout dans un encadré beurre. Carte « Sur cette page » du popup, prévu pour le panneau.
import { useId } from 'preact/hooks';
import { Icon } from './icon';

export interface SeasonOption {
  id: number;
  label: string;
}

export interface SeasonPickerProps {
  /** Titre (« Saison », « Saison sur AniList ») */
  label: string;
  /** Nom de la liste déroulante (« Choisir la saison affichée ») */
  ariaLabel: string;
  options: readonly SeasonOption[];
  /** Saison affichée */
  value: number;
  /** Action en cours, fiche relue : choix impossible */
  disabled?: boolean;
  /** Autre saison choisie */
  onPick: (id: number) => void;
  /** Saison devinée (ou choisie hors de l'épisode) : avertissement et encadré beurre */
  warning?: string | null;
  /** Aide sous la liste */
  help?: string | null;
  focusKey?: string;
}

export function SeasonPicker({ label, ariaLabel, options, value, disabled = false, onPick, warning = null, help = null, focusKey }: SeasonPickerProps) {
  const id = useId();
  const selected = options.find((option) => option.id === value)?.label;
  return (
    <div class={`flex min-w-0 flex-col gap-1.5 ${warning !== null ? 'rounded-panel border border-butter/40 bg-butter/10 p-2.5' : ''}`} data-season-picker="">
      {warning !== null && (
        <p class="m-0 flex items-start gap-1.5 text-secondary font-extrabold text-butter" role="note">
          <span class="flex shrink-0 pt-0.5">
            <Icon name="alert" class="size-3.5" strokeWidth="2.4" />
          </span>
          <span class="min-w-0">{warning}</span>
        </p>
      )}
      <label class="text-section text-muted uppercase" for={id}>
        {label}
      </label>
      <span class="relative flex min-w-0">
        <select
          id={id}
          class="h-9 w-full min-w-0 cursor-pointer appearance-none truncate rounded-panel border border-field bg-ground pr-8 pl-3 text-body font-bold text-ink disabled:cursor-default disabled:opacity-50"
          aria-label={ariaLabel}
          title={selected}
          disabled={disabled}
          data-focus={focusKey}
          onChange={(event) => {
            const next = Number(event.currentTarget.value);
            if (Number.isInteger(next) && next > 0 && next !== value) onPick(next);
          }}
        >
          {options.map((option) => (
            <option key={option.id} value={String(option.id)} selected={option.id === value}>
              {option.label}
            </option>
          ))}
        </select>
        <span class="pointer-events-none absolute top-1/2 right-3 flex -translate-y-1/2 text-muted">
          <Icon name="chevronDown" class="size-3.5" strokeWidth="2.4" />
        </span>
      </span>
      {help !== null && <p class="m-0 text-secondary text-muted">{help}</p>}
    </div>
  );
}
