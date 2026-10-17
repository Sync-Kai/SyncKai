// Progression d'une série : « Ép. x / y » en chiffres tabulaires puis − / + fantômes de 24 px (jeton stepper).
// Une borne atteinte désactive son côté ; total inconnu (max null) : + toujours actif.
import { Icon } from './icon';

export interface StepperProps {
  /** Texte visible déjà traduit (« Ép. 4 / 12 ») */
  text: string;
  value: number;
  /** Borne basse (défaut 0) */
  min?: number;
  /** Borne haute (nombre d'épisodes) ; null : inconnue */
  max: number | null;
  decrementLabel: string;
  incrementLabel: string;
  /** Nom du groupe des deux boutons (« Épisodes vus de Dandadan ») */
  groupLabel?: string;
  onDecrement: () => void;
  onIncrement: () => void;
  /** Action en cours ou ligne inactive : les deux côtés */
  disabled?: boolean;
  /** Préfixe data-focus des deux boutons (`<clé>-minus`, `<clé>-plus`) */
  focusKey?: string;
}

const STEP =
  'inline-flex size-stepper shrink-0 cursor-pointer items-center justify-center rounded-pill border-0 bg-transparent p-0 text-muted transition-colors hover:bg-raised hover:text-ink disabled:pointer-events-none disabled:opacity-40';

export function Stepper({ text, value, min = 0, max, decrementLabel, incrementLabel, groupLabel, onDecrement, onIncrement, disabled = false, focusKey }: StepperProps) {
  const atMin = value <= min;
  const atMax = max !== null && value >= max;
  return (
    <div class="flex h-stepper items-center gap-0.5">
      <span class="mr-1 text-secondary whitespace-nowrap text-muted tabular-nums" data-stepper-text="">
        {text}
      </span>
      <span class="flex items-center gap-0.5" role="group" aria-label={groupLabel}>
        <button type="button" class={STEP} aria-label={decrementLabel} title={decrementLabel} disabled={disabled || atMin} data-step="-1" data-focus={focusKey && `${focusKey}-minus`} onClick={onDecrement}>
          <Icon name="minus" class="size-3.5" strokeWidth="2.6" />
        </button>
        <button type="button" class={STEP} aria-label={incrementLabel} title={incrementLabel} disabled={disabled || atMax} data-step="1" data-focus={focusKey && `${focusKey}-plus`} onClick={onIncrement}>
          <Icon name="plus" class="size-3.5" strokeWidth="2.6" />
        </button>
      </span>
    </div>
  );
}
