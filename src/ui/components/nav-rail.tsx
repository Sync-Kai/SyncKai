// Rail de navigation du popup (remplace les onglets du haut) : Kai en haut, une icône par section (44 × 44), le pied
// fourni par l'hôte (panneau, Réglages) après un séparateur. Sélection neutre (fond `raised`, bordure `field`, jamais
// sakura), pastille beurre sur le coin de l'icône. Boutons dans une liste (pas un tablist : ce sont des destinations,
// `aria-current="page"`), tabindex itinérant, ↑ ↓ en boucle et Début / Fin déplacent le focus sans sélectionner.
// Une bulle unique, à droite de l'élément survolé ou focalisé, donne le libellé (masquée aux lecteurs d'écran : le
// bouton porte déjà son nom).
import type { ComponentChildren } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { kai, type IconName } from '../icons';
import { Icon, MountedNode } from './icon';

export interface NavRailItem<Id extends string> {
  id: Id;
  icon: IconName;
  label: string;
  /** Pastille de compte (éléments à traiter) */
  badge?: number;
  /** Nom accessible quand la pastille ne se lit pas seule (« Activité, 3 éléments à traiter ») ; pastille alors masquée */
  ariaLabel?: string;
}

export interface NavRailProps<Id extends string> {
  /** Nom accessible du <nav> */
  label: string;
  items: readonly NavRailItem<Id>[];
  /** Section courante ; null pendant les Réglages */
  current: Id | null;
  onSelect: (id: Id) => void;
  /** Boutons du bas (panneau latéral, Réglages), fournis par l'hôte */
  footer: ComponentChildren;
}

interface Tip {
  id: string;
  /** Centre vertical de l'élément dans le <nav> */
  top: number;
}

export function NavRail<Id extends string>({ label, items, current, onSelect, footer }: NavRailProps<Id>) {
  const list = useRef<HTMLUListElement>(null);
  const [hover, setHover] = useState<Tip | null>(null);
  const [focus, setFocus] = useState<Tip | null>(null);
  const shown = hover ?? focus;
  const shownItem = shown ? items.find((item) => item.id === shown.id) : undefined;
  // Un seul arrêt de tabulation : la section courante, sinon la première (Réglages ouverts)
  const stop = items.some((item) => item.id === current) ? current : items[0]?.id;

  const tipOf = (target: EventTarget | null, id: string): Tip => {
    const button = target instanceof HTMLElement ? target : null;
    return { id, top: button ? button.offsetTop + button.offsetHeight / 2 : 0 };
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    const buttons = [...(list.current?.querySelectorAll<HTMLElement>('button') ?? [])];
    const index = buttons.findIndex((button) => button === event.target);
    if (index < 0) return;
    const last = buttons.length - 1;
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? last : event.key === 'ArrowDown' ? (index >= last ? 0 : index + 1) : event.key === 'ArrowUp' ? (index <= 0 ? last : index - 1) : null;
    if (next === null) return;
    event.preventDefault();
    buttons[next]?.focus();
  };

  return (
    <nav class="relative flex h-full w-rail shrink-0 flex-col items-center border-r border-line bg-surface py-2" aria-label={label}>
      <MountedNode build={() => kai('size-7', { size: 'small', tile: true })} inputs={[]} />
      <ul ref={list} class="m-0 mt-3 flex list-none flex-col items-center gap-1 p-0" onKeyDown={onKeyDown}>
        {items.map((item) => {
          const on = item.id === current;
          return (
            <li key={item.id}>
              <button
                type="button"
                class={`relative flex size-rail-item cursor-pointer items-center justify-center rounded-panel border transition-colors ${
                  on ? 'border-field bg-raised text-ink' : 'border-transparent bg-transparent text-muted hover:text-ink'
                }`}
                aria-current={on ? 'page' : undefined}
                aria-label={item.ariaLabel ?? item.label}
                tabIndex={item.id === stop ? 0 : -1}
                data-focus={`rail-${item.id}`}
                onClick={() => onSelect(item.id)}
                onMouseOver={(event) => setHover(tipOf(event.currentTarget, item.id))}
                onMouseOut={() => setHover(null)}
                onFocus={(event) => setFocus(tipOf(event.currentTarget, item.id))}
                onBlur={() => setFocus(null)}
              >
                <Icon name={item.icon} class={`size-5 ${item.icon === 'play' ? 'fill-current' : ''}`} strokeWidth="2.2" />
                {item.badge !== undefined && (
                  <span
                    class="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-pill bg-butter px-1 text-section tracking-normal text-on-fill tabular-nums"
                    aria-hidden="true"
                    data-rail-badge=""
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <span class="flex-1" />
      <div class="mt-2 flex w-full flex-col items-center gap-1 border-t border-line pt-2">{footer}</div>
      <span
        class="pointer-events-none absolute left-full z-10 ml-1.5 -translate-y-1/2 rounded-control border border-field bg-raised px-2 py-1 text-secondary whitespace-nowrap text-ink shadow-pop"
        hidden={!shownItem}
        aria-hidden="true"
        data-rail-tooltip=""
        // Position verticale mesurée (CSSOM, pas de classe par valeur)
        style={{ top: `${shown?.top ?? 0}px` }}
      >
        {shownItem?.label}
      </span>
    </nav>
  );
}
