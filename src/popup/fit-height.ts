/** Hauteur demandée à Chrome (px CSS) ; il plafonne un popup à 600 DIP, donc moins en CSS dès que le zoom dépasse 100 % */
const REQUESTED_HEIGHT = 600;

/**
 * Ramène la hauteur du popup à celle que Chrome accorde vraiment (`--popup-height`, lue par popup.css).
 * Pas d'unité vh : un popup se dimensionne sur son contenu, vh s'effondrerait. On remet donc d'abord les 600 px
 * demandés, puis on lit `innerHeight` (hauteur de la fenêtre, indépendante du contenu) et on réduit si besoin.
 */
export function fitPopupHeight(): void {
  const style = document.documentElement.style;
  const fit = (): void => {
    style.setProperty('--popup-height', `${REQUESTED_HEIGHT}px`);
    const available = window.innerHeight;
    if (available > 0 && available < REQUESTED_HEIGHT) style.setProperty('--popup-height', `${available}px`);
  };
  fit();
  window.addEventListener('resize', fit);
}
