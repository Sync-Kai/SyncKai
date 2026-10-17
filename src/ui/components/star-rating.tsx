// Notation 10 étoiles à demi-étoiles des pages (popup, panneau, Réglages) : un seul curseur role="slider" au clavier
// (← → ±0,5, Début / Fin, Entrée confirme), clic sur la moitié gauche (x,5) ou droite (x) d'une étoile, aperçu au survol,
// mode lecture seule. Composant réservé aux pages : ui/star-rating.ts (vanilla, partagé avec le toast de fin de série
// des scripts de contenu) reste inchangé ; sa refonte viendra avec celle des toasts.
import { useEffect, useRef, useState } from 'preact/hooks';
import { formatScoreLabel, halfValue, isStarValue, STAR_COUNT, STAR_STEP, starFill, stepStarValue, type StarFill } from '../rating';

const STAR_PATH = 'M12 2.6l2.85 5.95 6.55.85-4.8 4.55 1.25 6.5L12 17.3l-5.85 3.15 1.25-6.5-4.8-4.55 6.55-.85z';
/** Partie visible de l'étoile pleine selon son remplissage (même rendu que ui/star-rating.ts) */
const CLIP: Readonly<Record<StarFill, string>> = { full: 'none', half: 'inset(0 50% 0 0)', empty: 'inset(0 100% 0 0)' };
const STARS = Array.from({ length: STAR_COUNT }, (_, i) => i + 1);

export type StarSize = 'sm' | 'md';

/** sm : étoiles de 16 px (zone de 24 px de haut, popup) ; md : 20 px (zone de 26 px, maquette PageNote) */
const SIZES: Readonly<Record<StarSize, string>> = { sm: 'h-6 w-4', md: 'h-6.5 w-5' };
const GLYPHS: Readonly<Record<StarSize, string>> = { sm: 'size-4', md: 'size-5' };

export interface StarRatingProps {
  /** Nom du curseur (« Noter Frieren ») */
  label: string;
  /** Note affichée (0 : aucune) */
  value: number;
  /** Nouvelle valeur (clavier, clic) */
  onChange?: (value: number) => void;
  /** Valeur confirmée (clic, Entrée) */
  onConfirm?: (value: number) => void;
  readonly?: boolean;
  /** Envoi en cours : le curseur garde le focus, rien ne change */
  disabled?: boolean;
  size?: StarSize;
  /** Libellé « 8,5/10 » à droite (défaut : oui) */
  showValue?: boolean;
  focusKey?: string;
}

/** Valeur sous le pointeur : moitié gauche ou droite de l'étoile survolée, null hors des étoiles */
function valueAt(event: MouseEvent): number | null {
  const star = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-star]') : null;
  const index = Number(star?.dataset.star);
  if (!star || !Number.isInteger(index)) return null;
  const rect = star.getBoundingClientRect();
  return halfValue(index, event.clientX - rect.left < rect.width / 2 ? 'left' : 'right');
}

export function StarRating({ label, value, onChange, onConfirm, readonly = false, disabled = false, size = 'md', showValue = true, focusKey }: StarRatingProps) {
  const current = isStarValue(value) ? value : 0;
  const [hover, setHover] = useState<number | null>(null);
  const row = useRef<HTMLDivElement>(null);
  const inert = readonly || disabled;
  const shown = inert ? current : (hover ?? current);

  // Dernières props lues par les écouteurs du pointeur, posés une fois sur la rangée
  const latest = useRef({ inert, onChange, onConfirm });
  latest.current = { inert, onChange, onConfirm };

  // Écouteurs du pointeur sur la rangée : posés au montage, retirés au démontage (aucun écouteur du document)
  useEffect(() => {
    const el = row.current;
    if (!el) return;
    const onMove = (event: PointerEvent): void => {
      if (!latest.current.inert) setHover(valueAt(event));
    };
    const onLeave = (): void => setHover(null);
    const onClick = (event: MouseEvent): void => {
      const next = valueAt(event);
      if (latest.current.inert || next === null) return;
      latest.current.onChange?.(next);
      latest.current.onConfirm?.(next);
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    el.addEventListener('click', onClick);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      el.removeEventListener('click', onClick);
    };
  }, []);

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Enter') {
      if (inert || current === 0) return;
      event.preventDefault();
      onConfirm?.(current);
      return;
    }
    const next = stepStarValue(current, event.key);
    if (next === null) return;
    // Flèches capturées : ni défilement de la page, ni navigation de l'hôte
    event.preventDefault();
    event.stopPropagation();
    if (!inert) onChange?.(next);
  };

  return (
    <div class="flex min-w-0 items-center gap-1.5">
      <div
        ref={row}
        class={`flex flex-none rounded-control ${inert ? '' : 'cursor-pointer'}`}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={STAR_STEP}
        aria-valuemax={STAR_COUNT}
        aria-valuenow={current > 0 ? current : undefined}
        aria-valuetext={formatScoreLabel(current)}
        aria-readonly={readonly ? 'true' : undefined}
        aria-disabled={disabled ? 'true' : undefined}
        data-focus={focusKey}
        data-star-row=""
        onKeyDown={onKeyDown}
      >
        {STARS.map((index) => (
          <span key={index} class={`relative flex flex-none items-center justify-center ${SIZES[size]}`} data-star={index}>
            <svg class={`pointer-events-none absolute ${GLYPHS[size]} fill-none stroke-muted stroke-[1.6]`} viewBox="0 0 24 24" aria-hidden="true">
              <path d={STAR_PATH} stroke-linejoin="round" />
            </svg>
            <svg class={`pointer-events-none absolute ${GLYPHS[size]} fill-butter stroke-butter stroke-[1.6]`} viewBox="0 0 24 24" aria-hidden="true" style={{ clipPath: CLIP[starFill(index, shown)] }} data-fill="">
              <path d={STAR_PATH} stroke-linejoin="round" />
            </svg>
          </span>
        ))}
      </div>
      {showValue && (
        <span class="w-9 flex-none text-secondary font-extrabold text-butter tabular-nums" aria-hidden="true" data-star-value="">
          {formatScoreLabel(shown)}
        </span>
      )}
    </div>
  );
}
