// Fermeture des menus déroulants (popup, panneau latéral) : écouteurs globaux du document présents seulement
// pendant qu'un menu est ouvert, retirés dès sa fermeture (aucun écouteur permanent).

export interface MenuDismissHandlers {
  /** Pointeur enfoncé n'importe où (phase de capture, avant tout nouveau rendu) : l'appelant vérifie s'il est hors du menu */
  onPointerDown?(target: Element | null): void;
  /** Clic n'importe où (phase de bouillonnement, après l'action du clic) : l'appelant vérifie s'il est hors du menu */
  onClick?(target: Element | null): void;
  /** Échap (phase de capture) : ferme le menu sans fermer le popup ni le panneau */
  onEscape?(): void;
}

export interface MenuDismiss {
  /** État du menu : écouteurs ajoutés à l'ouverture, retirés à la fermeture (appels répétés sans effet) */
  setOpen(open: boolean): void;
}

const targetOf = (event: Event): Element | null => (event.target instanceof Element ? event.target : null);

export function createMenuDismiss(handlers: MenuDismissHandlers, doc: EventTarget = document): MenuDismiss {
  let listening = false;
  // Options en objet (et non `true`) : retirées à coup sûr par removeEventListener, quel que soit l'environnement
  const capture: AddEventListenerOptions = { capture: true };

  const onPointerDown = (event: Event): void => handlers.onPointerDown?.(targetOf(event));
  const onClick = (event: Event): void => handlers.onClick?.(targetOf(event));
  const onKeyDown = (event: Event): void => {
    if (!('key' in event) || event.key !== 'Escape' || !handlers.onEscape) return;
    event.preventDefault();
    event.stopPropagation();
    handlers.onEscape();
  };

  return {
    setOpen(open) {
      if (open === listening) return;
      listening = open;
      if (open) {
        if (handlers.onPointerDown) doc.addEventListener('pointerdown', onPointerDown, capture);
        if (handlers.onClick) doc.addEventListener('click', onClick);
        if (handlers.onEscape) doc.addEventListener('keydown', onKeyDown, capture);
      } else {
        doc.removeEventListener('pointerdown', onPointerDown, capture);
        doc.removeEventListener('click', onClick);
        doc.removeEventListener('keydown', onKeyDown, capture);
      }
    },
  };
}

const MENU_NAV_KEYS: ReadonlySet<string> = new Set(['ArrowDown', 'ArrowUp', 'Home', 'End']);

/** Déplace le focus clavier entre les options du menu (flèches en boucle, Début, Fin) */
function moveMenuFocus(menu: HTMLElement, key: string): void {
  const items = [...menu.querySelectorAll<HTMLElement>('[role^="menuitem"]:not(:disabled)')];
  const index = items.findIndex((item) => item === document.activeElement);
  const last = items.length - 1;
  const next = key === 'Home' ? 0 : key === 'End' ? last : key === 'ArrowDown' ? (index >= last ? 0 : index + 1) : index <= 0 ? last : index - 1;
  items[next]?.focus();
}

/** Clavier d'un menu (popup, panneau) : flèches / Début / Fin entre les options, Tab ferme (focus rendu au bouton) */
export function onMenuKeyDown(menu: HTMLElement, event: KeyboardEvent, onClose: () => void): void {
  if (MENU_NAV_KEYS.has(event.key)) {
    event.preventDefault();
    moveMenuFocus(menu, event.key);
  } else if (event.key === 'Tab') {
    event.preventDefault();
    onClose();
  }
}
