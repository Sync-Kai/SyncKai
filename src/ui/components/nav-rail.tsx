// Rail de navigation du popup (remplace les onglets du haut) : Kai en haut, une icône par section (44 × 44), les
// boutons du pied (panneau, Réglages) après un séparateur, même gabarit. Sélection neutre (fond `raised`, bordure
// `field`, jamais sakura), pastille beurre sur le coin de l'icône (ou point lavande sans compte). Boutons dans des listes (pas un tablist : ce sont
// des destinations, `aria-current="page"`) ; sections et pied forment UN groupe : un seul arrêt de tabulation
// (tabindex itinérant), ↑ ↓ en boucle et Début / Fin déplacent le focus sans activer. Une bulle unique, à droite de
// l'élément survolé (souris) ou focalisé (clavier), donne le libellé (masquée aux lecteurs d'écran : le bouton porte
// déjà son nom).
import { useRef, useState } from 'preact/hooks';
import { kai, type IconName } from '../icons';
import { Icon, MountedNode } from './icon';

export interface NavRailItem<Id extends string> {
  id: Id;
  icon: IconName;
  label: string;
  /** Pastille de compte (éléments à traiter) */
  badge?: number;
  /** Pastille lavande sans chiffre (nouveauté sans compte) ; absente quand une pastille de compte s'affiche */
  dot?: boolean;
  /** Nom accessible quand la pastille ne se lit pas seule (« Activité, 3 éléments à traiter ») ; pastille alors masquée */
  ariaLabel?: string;
}

/** Bouton du pied du rail (panneau latéral, Réglages) : une action, pas une destination */
export interface NavRailFooterItem {
  /** Clé data-focus du bouton (« panel », « gear ») */
  id: string;
  icon: IconName;
  label: string;
  /** Bouton bascule (Réglages ouverts) : aria-pressed ; absent = bouton simple */
  pressed?: boolean;
  onClick: () => void;
}

export interface NavRailProps<Id extends string> {
  /** Nom accessible du <nav> */
  label: string;
  items: readonly NavRailItem<Id>[];
  /** Section courante ; null pendant les Réglages */
  current: Id | null;
  onSelect: (id: Id) => void;
  /** Boutons du bas (panneau latéral, Réglages), après le séparateur */
  footerItems: readonly NavRailFooterItem[];
}

interface Tip {
  /** `s:<id>` (section) ou `f:<id>` (pied) */
  key: string;
  /** Centre vertical de l'élément dans le <nav> */
  top: number;
}

const RAIL_BUTTON = 'relative flex size-rail-item cursor-pointer items-center justify-center rounded-panel border p-0 transition-colors';
const ON = 'border-field bg-raised text-ink';
const OFF = 'border-transparent bg-transparent text-muted hover:text-ink';

export function NavRail<Id extends string>({ label, items, current, onSelect, footerItems }: NavRailProps<Id>) {
  const nav = useRef<HTMLElement>(null);
  // Focus venu d'un pointeur (clic, toucher) : pas de bulle, elle resterait collée ; seul le clavier la montre
  const pointerFocus = useRef(false);
  const [hover, setHover] = useState<Tip | null>(null);
  const [focus, setFocus] = useState<Tip | null>(null);
  const shown = hover ?? focus;
  const labels = new Map<string, string>([...items.map((item): [string, string] => [`s:${item.id}`, item.label]), ...footerItems.map((item): [string, string] => [`f:${item.id}`, item.label])]);
  const shownLabel = shown ? labels.get(shown.key) : undefined;
  // Un seul arrêt de tabulation pour tout le rail : la section courante, sinon la première (Réglages ouverts), sinon le
  // premier bouton du pied (accueil, sans sections)
  const currentItem = items.find((item) => item.id === current) ?? items[0];
  const stop = currentItem ? `s:${currentItem.id}` : footerItems[0] ? `f:${footerItems[0].id}` : null;

  const tipOf = (target: EventTarget | null, key: string): Tip => {
    const button = target instanceof HTMLElement ? target : null;
    return { key, top: button ? button.offsetTop + button.offsetHeight / 2 : 0 };
  };

  /** Bulle : survol à la souris (un toucher émet un survol émulé, sans bulle au tactile) et focus au clavier */
  const tipHandlers = (key: string) => ({
    onPointerEnter: (event: PointerEvent) => {
      if (event.pointerType !== 'touch') setHover(tipOf(event.currentTarget, key));
    },
    onPointerLeave: () => setHover(null),
    onPointerDown: () => {
      pointerFocus.current = true;
    },
    onKeyDown: () => {
      pointerFocus.current = false;
    },
    onFocus: (event: FocusEvent) => {
      if (!pointerFocus.current) setFocus(tipOf(event.currentTarget, key));
      pointerFocus.current = false;
    },
    onBlur: () => setFocus(null),
  });

  const onKeyDown = (event: KeyboardEvent): void => {
    const buttons = [...(nav.current?.querySelectorAll<HTMLElement>('[data-rail-section], [data-rail-footer]') ?? [])];
    const index = buttons.findIndex((button) => button === event.target);
    if (index < 0) return;
    const last = buttons.length - 1;
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? last : event.key === 'ArrowDown' ? (index >= last ? 0 : index + 1) : event.key === 'ArrowUp' ? (index <= 0 ? last : index - 1) : null;
    if (next === null) return;
    event.preventDefault();
    buttons[next]?.focus();
  };

  return (
    <nav ref={nav} class="relative flex h-full w-rail shrink-0 flex-col items-center border-r border-line bg-surface py-2" aria-label={label} onKeyDown={onKeyDown}>
      <MountedNode build={() => kai('size-7', { size: 'small', tile: true })} inputs={[]} />
      {/* Accueil (aucune section) : pas de liste vide annoncée par les lecteurs d'écran */}
      {items.length > 0 && (
        <ul class="m-0 mt-3 flex list-none flex-col items-center gap-1 p-0">
          {items.map((item) => {
            const on = item.id === current;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  class={`${RAIL_BUTTON} ${on ? ON : OFF}`}
                  aria-current={on ? 'page' : undefined}
                  aria-label={item.ariaLabel ?? (item.badge ? `${item.label}, ${item.badge}` : item.label)}
                  tabIndex={`s:${item.id}` === stop ? 0 : -1}
                  data-focus={`rail-${item.id}`}
                  data-rail-section=""
                  onClick={() => onSelect(item.id)}
                  {...tipHandlers(`s:${item.id}`)}
                >
                  <Icon name={item.icon} class={`size-5 ${item.icon === 'play' ? 'fill-current' : ''}`} strokeWidth="2.2" />
                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      class="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-pill bg-butter px-1 text-section tracking-normal text-on-fill tabular-nums"
                      aria-hidden="true"
                      data-rail-badge=""
                    >
                      {item.badge}
                    </span>
                  )}
                  {item.dot && !(item.badge !== undefined && item.badge > 0) && (
                    <span class="absolute top-1 right-1 size-2 rounded-pill bg-lavender" aria-hidden="true" data-rail-dot="" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <span class="flex-1" />
      {footerItems.length > 0 && (
        <ul class="m-0 mt-2 flex w-full list-none flex-col items-center gap-0.5 border-t border-line p-0 pt-2">
          {footerItems.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                class={`${RAIL_BUTTON} ${item.pressed ? ON : OFF}`}
                aria-label={item.label}
                aria-pressed={item.pressed === undefined ? undefined : item.pressed ? 'true' : 'false'}
                tabIndex={`f:${item.id}` === stop ? 0 : -1}
                data-focus={item.id}
                data-rail-footer=""
                onClick={item.onClick}
                {...tipHandlers(`f:${item.id}`)}
              >
                <Icon name={item.icon} class="size-5" strokeWidth="2.2" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <span
        class="pointer-events-none absolute left-full z-10 ml-1.5 -translate-y-1/2 rounded-control border border-field bg-raised px-2 py-1 text-secondary whitespace-nowrap text-ink shadow-pop"
        hidden={shownLabel === undefined}
        aria-hidden="true"
        data-rail-tooltip=""
        // Position verticale mesurée (CSSOM, pas de classe par valeur)
        style={{ top: `${shown?.top ?? 0}px` }}
      >
        {shownLabel}
      </span>
    </nav>
  );
}
