// Bouton d'icône rond de 28 px (jeton icon-button) : le libellé est obligatoire, il devient aria-label et infobulle.
import type { IconName } from '../icons';
import { Icon } from './icon';

export interface IconButtonProps {
  icon: IconName;
  /** Nom accessible et infobulle */
  label: string;
  onClick?: (event: MouseEvent) => void;
  disabled?: boolean;
  /** Bordure `line` (« J'ai vu, masquer » de la barre d'état) */
  outlined?: boolean;
  /** Bouton qui ouvre un menu : aria-haspopup / aria-expanded (ouvert : bordure `field`, fond `raised`) */
  haspopup?: 'menu' | 'dialog';
  expanded?: boolean;
  /** Bouton bascule : aria-pressed */
  pressed?: boolean;
  focusKey?: string;
  /** Taille de l'icône (défaut 16 px) */
  iconClass?: string;
}

const BASE =
  'inline-flex size-icon-button shrink-0 cursor-pointer items-center justify-center rounded-pill border bg-transparent p-0 text-muted transition-colors hover:bg-raised hover:text-ink disabled:pointer-events-none disabled:opacity-50 aria-expanded:border-field aria-expanded:bg-raised aria-expanded:text-ink aria-pressed:border-field aria-pressed:bg-raised aria-pressed:text-ink';

export function IconButton({ icon, label, onClick, disabled = false, outlined = false, haspopup, expanded, pressed, focusKey, iconClass = 'size-4' }: IconButtonProps) {
  return (
    <button
      type="button"
      class={`${BASE} ${outlined ? 'border-line' : 'border-transparent'}`}
      aria-label={label}
      title={label}
      aria-haspopup={haspopup}
      aria-expanded={haspopup ? (expanded ? 'true' : 'false') : undefined}
      aria-pressed={pressed === undefined ? undefined : pressed ? 'true' : 'false'}
      disabled={disabled}
      data-focus={focusKey}
      onClick={onClick}
    >
      <Icon name={icon} class={iconClass} strokeWidth="2.4" />
    </button>
  );
}
