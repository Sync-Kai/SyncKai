// Progression d'une série : « Ép. x / y » en chiffres tabulaires puis − / + fantômes de 24 px (jeton stepper).
// Une borne atteinte désactive son côté ; total inconnu (max null) : + toujours actif. Envoi en cours (`busy`) :
// aria-disabled, le bouton cliqué garde le focus clavier et les clics sont ignorés.
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
  /** Envoi en cours : aria-busy + aria-disabled (focus gardé), clics ignorés */
  busy?: boolean;
  /** + absent (série exclue : un épisode vu n'y serait pas envoyé) */
  incrementHidden?: boolean;
  /** Préfixe data-focus des deux boutons (`<clé>-minus`, `<clé>-plus`) */
  focusKey?: string;
}

const STEP =
  'inline-flex size-stepper shrink-0 cursor-pointer items-center justify-center rounded-pill border-0 bg-transparent p-0 text-muted transition-colors hover:bg-raised hover:text-ink disabled:pointer-events-none disabled:opacity-40 aria-disabled:cursor-default aria-disabled:opacity-40 aria-disabled:hover:bg-transparent';

export function Stepper({ text, value, min = 0, max, decrementLabel, incrementLabel, groupLabel, onDecrement, onIncrement, disabled = false, busy = false, incrementHidden = false, focusKey }: StepperProps) {
  const atMin = value <= min;
  const atMax = max !== null && value >= max;
  // Envoi en cours : le clic (souris ou Entrée) n'a aucun effet
  const guard = (run: () => void) => () => {
    if (!busy) run();
  };
  const busyAttrs = busy ? { 'aria-disabled': 'true' as const, 'aria-busy': 'true' as const } : {};
  return (
    <div class="flex h-stepper items-center gap-0.5">
      <span class="mr-1 text-secondary whitespace-nowrap text-muted tabular-nums" data-stepper-text="">
        {text}
      </span>
      <span class="flex items-center gap-0.5" role="group" aria-label={groupLabel}>
        <button type="button" class={STEP} aria-label={decrementLabel} title={decrementLabel} disabled={disabled || atMin} {...busyAttrs} data-step="-1" data-focus={focusKey && `${focusKey}-minus`} onClick={guard(onDecrement)}>
          <Icon name="minus" class="size-3.5" strokeWidth="2.6" />
        </button>
        {!incrementHidden && (
          <button type="button" class={STEP} aria-label={incrementLabel} title={incrementLabel} disabled={disabled || atMax} {...busyAttrs} data-step="1" data-focus={focusKey && `${focusKey}-plus`} onClick={guard(onIncrement)}>
            <Icon name="plus" class="size-3.5" strokeWidth="2.6" />
          </button>
        )}
      </span>
    </div>
  );
}
