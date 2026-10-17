// Interrupteur : bouton role="switch" (aria-checked), 40 × 24 px. Activé : piste lavender et pastille on-fill ;
// désactivé : piste ground bordée `field`, pastille `field` (maquettes des Réglages).
export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Nom accessible direct, ou `labelledBy` (titre de la ligne des Réglages) */
  label?: string;
  labelledBy?: string;
  describedBy?: string;
  id?: string;
  focusKey?: string;
}

const TRACK =
  'relative inline-flex h-6 w-10 shrink-0 cursor-pointer rounded-pill border p-0 transition-colors duration-(--motion-enter) disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none';
const KNOB = 'absolute top-1/2 -translate-y-1/2 rounded-pill transition-all duration-(--motion-enter) motion-reduce:transition-none';

export function Switch({ checked, onChange, disabled = false, label, labelledBy, describedBy, id, focusKey }: SwitchProps) {
  const toggle = (): void => {
    if (!disabled) onChange(!checked);
  };
  return (
    <button
      type="button"
      role="switch"
      id={id}
      class={`${TRACK} ${checked ? 'border-lavender bg-lavender' : 'border-field bg-ground'}`}
      aria-checked={checked ? 'true' : 'false'}
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      disabled={disabled}
      data-focus={focusKey}
      onClick={toggle}
      // Clavier géré ici : le clic natif d'Entrée (keydown) et d'Espace (keyup) est annulé, une seule bascule
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        toggle();
      }}
      onKeyUp={(event) => {
        if (event.key === ' ') event.preventDefault();
      }}
    >
      <span class={`${KNOB} ${checked ? 'left-4.5 size-4.5 bg-on-fill' : 'left-0.5 size-4 bg-field'}`} aria-hidden="true" />
    </button>
  );
}
