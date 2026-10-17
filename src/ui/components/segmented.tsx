// Choix segmenté (maquettes Comptes, Affichage, Notifications) : groupe de boutons radio en pilule, sélection neutre
// (bordure `field`, fond `raised`, jamais sakura). Un seul arrêt de tabulation (l'option choisie), flèches ← → ↑ ↓ en
// boucle, Début / Fin : la flèche choisit (comme des boutons radio natifs). `fill` : options de largeur égale sur toute
// la ligne ; sinon la pilule prend la largeur de son contenu. Un libellé trop long passe sur deux lignes, jamais coupé.
import { useRef } from 'preact/hooks';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** Nom accessible quand le libellé est abrégé (« MAL » → « MyAnimeList ») */
  aria?: string;
}

export interface SegmentedProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Nom du groupe : id d'un libellé visible, sinon texte */
  labelledBy?: string;
  label?: string;
  describedBy?: string;
  disabled?: boolean;
  /** Options de largeur égale sur toute la ligne */
  fill?: boolean;
  /** Repère `data-focus` de chaque option : `${focusKey}-${value}` */
  focusKey?: string;
}

export function Segmented<T extends string>({ options, value, onChange, labelledBy, label, describedBy, disabled = false, fill = false, focusKey }: SegmentedProps<T>) {
  const group = useRef<HTMLDivElement>(null);
  // Option choisie absente (valeur hors liste) : la première reçoit l'arrêt de tabulation
  const focusable = options.some((option) => option.value === value) ? value : options[0]?.value;

  const onKeyDown = (event: KeyboardEvent): void => {
    if (disabled) return;
    const buttons = [...(group.current?.querySelectorAll<HTMLElement>('[role="radio"]') ?? [])];
    const focused = buttons.findIndex((button) => button === event.target);
    const index = focused >= 0 ? focused : options.findIndex((option) => option.value === value);
    const last = options.length - 1;
    const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
    const backward = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? last : forward ? (index >= last ? 0 : index + 1) : backward ? (index <= 0 ? last : index - 1) : null;
    if (next === null) return;
    event.preventDefault();
    const option = options[next];
    if (!option) return;
    if (option.value !== value) onChange(option.value);
    buttons[next]?.focus();
  };

  return (
    <div
      ref={group}
      class={`${fill ? 'grid w-full' : 'inline-flex w-fit max-w-full'} shrink-0 gap-0 rounded-pill border border-line bg-ground p-0.5 ${disabled ? 'opacity-50' : ''}`}
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : label}
      aria-describedby={describedBy}
      aria-disabled={disabled ? 'true' : undefined}
      onKeyDown={onKeyDown}
      // Colonnes égales, une par option (CSSOM : pas de classe générée par nombre d'options)
      style={fill ? { gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` } : undefined}
      data-segmented=""
    >
      {options.map((option) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            class={`flex min-h-7 min-w-0 cursor-pointer items-center justify-center rounded-pill border px-3 py-0.5 text-secondary transition-colors disabled:cursor-default ${
              on ? 'border-field bg-raised font-extrabold text-ink' : 'border-transparent bg-transparent font-bold text-muted hover:text-ink disabled:hover:text-muted'
            }`}
            aria-checked={on ? 'true' : 'false'}
            aria-label={option.aria}
            tabIndex={option.value === focusable ? 0 : -1}
            disabled={disabled}
            data-focus={focusKey ? `${focusKey}-${option.value}` : undefined}
            onClick={() => {
              if (!on) onChange(option.value);
            }}
          >
            {/* Libellé long (allemand, panneau étroit) : sur deux lignes plutôt que coupé */}
            <span class="min-w-0 text-center leading-tight break-words">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
