// Liste déroulante (maquette PlateformesLecteur) : la ligne entière est un bouton (libellé à gauche, logo et valeur
// choisie à droite, chevron) qui ouvre une liste role="listbox" sous la ligne, alignée à droite (`raised`, bordure `field`,
// `radius-menu`, `shadow-pop`, comme les menus). Le focus passe sur la liste, l'option active est désignée par
// aria-activedescendant : ↑ ↓ Début Fin la déplacent (options indisponibles comprises, annoncées comme telles), Entrée
// ou Espace choisit, Échap ferme (focus rendu au bouton), Tab ou pointeur enfoncé dehors ferme. Une option indisponible
// (plateforme à activer d'abord) reste visible, grisée, avec son indication à droite ; elle ne se choisit pas.
import type { ComponentChildren, RefObject } from 'preact';
import { useId, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { useDismiss } from '../preact/hooks';
import { Icon } from './icon';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  /** Visuel de tête (logo de plateforme), décoratif */
  leading?: ComponentChildren;
  /** Indisponible : visible, grisée, jamais choisie */
  disabled?: boolean;
  /** Indication à droite d'une option indisponible (« Activer d'abord ») */
  hint?: string;
}

export interface SelectProps<T extends string> {
  /** Libellé visible à gauche du bouton, nom de la liste */
  label: string;
  options: readonly SelectOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Texte qui décrit le choix (aide sous la carte) */
  describedBy?: string;
  /** Repère `data-focus` du bouton ; options : `${focusKey}-${value}` */
  focusKey?: string;
  /** Ouverte au premier rendu (galerie, captures) */
  defaultOpen?: boolean;
}

export function Select<T extends string>({ label, options, value, onChange, describedBy, focusKey, defaultOpen = false }: SelectProps<T>) {
  const id = useId();
  const [open, setOpen] = useState(defaultOpen);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const selected = options.find((option) => option.value === value);

  const close = (restore: boolean): void => {
    setOpen(false);
    if (restore) trigger.current?.focus();
  };

  return (
    <div ref={root} class="relative" data-select="">
      <button
        ref={trigger}
        type="button"
        class="flex min-h-11 w-full min-w-0 cursor-pointer items-center gap-2 rounded-card border-0 bg-transparent px-3 py-2.5 text-left text-body text-ink transition-colors hover:bg-raised/60"
        aria-haspopup="listbox"
        aria-expanded={open ? 'true' : 'false'}
        aria-labelledby={`${id}-label ${id}-value`}
        aria-describedby={describedBy}
        data-focus={focusKey}
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => {
          if (open || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) return;
          event.preventDefault();
          setOpen(true);
        }}
      >
        <span class="min-w-0 flex-1 font-bold" id={`${id}-label`}>
          {label}
        </span>
        {selected?.leading && (
          <span class="flex shrink-0" aria-hidden="true">
            {selected.leading}
          </span>
        )}
        <span class="min-w-0 truncate font-bold" id={`${id}-value`} data-select-value="">
          {selected?.label}
        </span>
        <Icon name="chevronDown" class={`size-4 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`} strokeWidth="2.4" />
      </button>
      {open && (
        <SelectList
          id={id}
          options={options}
          value={value}
          root={root}
          focusKey={focusKey}
          onClose={close}
          onPick={(next) => {
            close(true);
            if (next !== value) onChange(next);
          }}
        />
      )}
    </div>
  );
}

interface SelectListProps<T extends string> {
  id: string;
  options: readonly SelectOption<T>[];
  value: T;
  root: RefObject<HTMLDivElement | null>;
  focusKey: string | undefined;
  onClose: (restore: boolean) => void;
  onPick: (value: T) => void;
}

/** Liste ouverte : montée à l'ouverture (focus posé dessus), démontée à la fermeture (écouteurs du document retirés) */
function SelectList<T extends string>({ id, options, value, root, focusKey, onClose, onPick }: SelectListProps<T>) {
  const list = useRef<HTMLUListElement>(null);
  const start = options.findIndex((option) => option.value === value);
  const [active, setActive] = useState(start >= 0 ? start : 0);

  // Échap : fermeture, focus rendu au bouton ; pointeur dehors : fermeture sans déplacer le focus
  useDismiss(root, () => onClose(true), { outside: false });
  useDismiss(root, () => onClose(false), { escape: false });

  useLayoutEffect(() => {
    list.current?.focus({ preventScroll: true });
  }, []);

  useLayoutEffect(() => {
    list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView?.({ block: 'nearest' });
  }, [active]);

  const pick = (index: number): void => {
    const option = options[index];
    if (option && !option.disabled) onPick(option.value);
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    const last = options.length - 1;
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
      case 'Home':
      case 'End':
        event.preventDefault();
        setActive(event.key === 'Home' ? 0 : event.key === 'End' ? last : event.key === 'ArrowDown' ? Math.min(last, active + 1) : Math.max(0, active - 1));
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        pick(active);
        break;
      case 'Escape':
        // Traité ici aussi (focus sur la liste) : Échap ne remonte jamais à la page (retour des Réglages, fermeture du popup)
        event.preventDefault();
        event.stopPropagation();
        onClose(true);
        break;
      case 'Tab':
        onClose(false);
        break;
      default:
    }
  };

  const optionId = (index: number): string => `${id}-option-${index}`;
  return (
    <ul
      ref={list}
      class="absolute top-full right-2 z-10 m-0 mt-1 flex w-max max-w-[calc(100%-1rem)] min-w-52 list-none flex-col rounded-menu border border-field bg-raised p-1.5 shadow-pop outline-none"
      role="listbox"
      tabIndex={-1}
      aria-labelledby={`${id}-label`}
      aria-activedescendant={optionId(active)}
      data-select-list=""
      onKeyDown={onKeyDown}
    >
      {options.map((option, index) => {
        const chosen = option.value === value;
        return (
          <li
            key={option.value}
            id={optionId(index)}
            class={`flex min-h-menu-item min-w-0 items-center gap-2.5 rounded-control px-2.5 text-body ${index === active ? 'bg-line' : ''} ${
              option.disabled ? 'cursor-default' : 'cursor-pointer font-bold'
            }`}
            role="option"
            aria-selected={chosen ? 'true' : 'false'}
            aria-disabled={option.disabled ? 'true' : undefined}
            data-index={index}
            data-focus={focusKey ? `${focusKey}-${option.value}` : undefined}
            onPointerMove={() => setActive(index)}
            onClick={() => pick(index)}
          >
            {option.leading && (
              <span class={`flex shrink-0 ${option.disabled ? 'opacity-45' : ''}`} aria-hidden="true">
                {option.leading}
              </span>
            )}
            <span class={`min-w-0 flex-1 truncate ${option.disabled ? 'font-bold text-muted' : ''}`}>{option.label}</span>
            {option.disabled && option.hint && <span class="shrink-0 text-secondary font-bold text-butter">{option.hint}</span>}
            {chosen && <Icon name="check" class="size-4 shrink-0 text-lavender" strokeWidth="2.6" />}
          </li>
        );
      })}
    </ul>
  );
}
