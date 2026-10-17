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
