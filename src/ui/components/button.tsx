// Bouton de la charte (docs/design/README.md › Principles) : une seule action principale (sakura plein) par surface,
// les actions secondaires bordées du jeton `field` ou en texte. Lien <a> quand `href` est donné.
import type { ComponentChildren } from 'preact';
import type { IconName } from '../icons';
import { Icon } from './icon';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'text';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps {
  /** Défaut : secondaire (bordure `field`) ; `primary` : une seule par surface */
  variant?: ButtonVariant;
  /** sm : 28 px, 12 px ; md (défaut) : 32 px, 13 px */
  size?: ButtonSize;
  /** Icône de tête, décorative */
  icon?: IconName;
  /** Action en cours : aria-busy + aria-disabled (le bouton garde le focus clavier), clics ignorés, icône en rotation */
  busy?: boolean;
  /** Rien à faire : bouton désactivé */
  disabled?: boolean;
  /** Lien : rendu en <a> ; `target="_blank"` ajoute rel="noopener noreferrer" */
  href?: string;
  target?: '_blank';
  onClick?: (event: MouseEvent) => void;
  type?: 'button' | 'submit';
  title?: string;
  /** Nom accessible quand le texte visible ne suffit pas */
  ariaLabel?: string;
  /** Clé data-focus (focus retrouvé après un rendu, useFocusFallback) */
  focusKey?: string;
  /** Classes de placement (marges, alignement) ; jamais de couleur ni de taille */
  class?: string;
  children: ComponentChildren;
}

const BASE =
  'inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-pill font-extrabold no-underline transition-colors disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50';

/** Taille par variante : le bouton texte n'a ni fond ni marges latérales larges */
const SIZES: Readonly<Record<'box' | 'text', Readonly<Record<ButtonSize, string>>>> = {
  box: { sm: 'h-7 px-3 text-secondary', md: 'h-8 px-4 text-body' },
  text: { sm: 'min-h-7 px-1 text-secondary', md: 'min-h-8 px-1 text-body' },
};

const VARIANTS: Readonly<Record<ButtonVariant, string>> = {
  primary: 'bg-sakura text-on-fill shadow-pop hover:brightness-105',
  secondary: 'border border-field bg-raised text-ink hover:bg-line',
  ghost: 'bg-transparent text-muted hover:bg-raised hover:text-ink',
  danger: 'border border-danger bg-transparent text-danger hover:bg-danger/10',
  text: 'bg-transparent text-muted hover:text-ink',
};

const ICON_SIZES: Readonly<Record<ButtonSize, string>> = { sm: 'size-3.5', md: 'size-4' };

/** Classes d'un bouton de la charte, aussi pour un élément qui n'est pas un <Button> (lien de l'hôte, label) */
export function buttonClass(variant: ButtonVariant = 'secondary', size: ButtonSize = 'md'): string {
  return `${BASE} ${SIZES[variant === 'text' ? 'text' : 'box'][size]} ${VARIANTS[variant]}`;
}

export function Button({ variant = 'secondary', size = 'md', icon, busy = false, disabled = false, href, target, onClick, type = 'button', title, ariaLabel, focusKey, class: extra, children }: ButtonProps) {
  const className = extra ? `${buttonClass(variant, size)} ${extra}` : buttonClass(variant, size);
  const leading = busy ? (
    <Icon name="spinner" class={`${ICON_SIZES[size]} animate-spin motion-reduce:animate-none`} strokeWidth="2.6" />
  ) : (
    icon && <Icon name={icon} class={ICON_SIZES[size]} />
  );
  // Action en cours (ou lien désactivé) : clic annulé, y compris au clavier (Entrée déclenche un clic)
  const handleClick = (event: MouseEvent): void => {
    if (busy || (href !== undefined && disabled)) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };
  const shared = {
    class: className,
    title,
    'aria-label': ariaLabel,
    'aria-busy': busy ? ('true' as const) : undefined,
    'data-focus': focusKey,
    'data-variant': variant,
    'data-size': size,
    onClick: handleClick,
  };
  if (href !== undefined) {
    return (
      <a {...shared} href={href} target={target} rel={target === '_blank' ? 'noopener noreferrer' : undefined} aria-disabled={busy || disabled ? 'true' : undefined}>
        {leading}
        {children}
      </a>
    );
  }
  return (
    <button {...shared} type={type} disabled={disabled} aria-disabled={busy ? 'true' : undefined}>
      {leading}
      {children}
    </button>
  );
}
