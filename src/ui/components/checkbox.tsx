// Case à cocher (maquettes ImportApercu, ImportApplication, Sauvegarde) : vraie case native (clic, Espace, focus,
// libellé englobant), dessinée en 18 px aux angles de 6 px : bordure `field` vide, lavande cochée avec la coche
// `on-fill`. `done` : élément déjà fait (ligne de l'import écrite, vérification créée), coche mint sur fond teinté,
// figée. Désactivée : atténuée. La case reste la cible du clic : un `<label>` autour la rend cochable sur toute la ligne.
import { Icon } from './icon';

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Élément déjà fait : coche mint figée (la case doit aussi être `disabled`) */
  done?: boolean;
  id?: string;
  /** Nom accessible quand aucun `<label>` ne l'englobe, ou pour un nom plus court que la ligne */
  label?: string;
  describedBy?: string;
  focusKey?: string;
}

const BOX =
  'peer m-0 size-4.5 shrink-0 cursor-pointer appearance-none rounded-cover border-2 border-field bg-transparent transition-colors duration-(--motion-enter) disabled:cursor-default motion-reduce:transition-none';

export function Checkbox({ checked, onChange, disabled = false, done = false, id, label, describedBy, focusKey }: CheckboxProps) {
  const tone = done ? 'checked:border-transparent checked:bg-mint/16' : 'checked:border-lavender checked:bg-lavender disabled:opacity-50';
  return (
    <span class="relative flex size-4.5 shrink-0">
      <input
        type="checkbox"
        class={`${BOX} ${tone}`}
        id={id}
        checked={checked}
        disabled={disabled}
        aria-label={label}
        aria-describedby={describedBy}
        data-focus={focusKey}
        data-done={done ? '' : undefined}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      <span
        class={`pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 peer-checked:opacity-100 ${done ? 'text-mint' : 'text-on-fill peer-checked:peer-disabled:opacity-50'}`}
        aria-hidden="true"
      >
        <Icon name="check" class="size-3" strokeWidth="3.2" />
      </span>
    </span>
  );
}
