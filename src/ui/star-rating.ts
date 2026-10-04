import { formatScoreLabel, halfValue, isStarValue, rateAriaLabel, STAR_COUNT, starFill, stepStarValue, type StarFill } from './rating';

const SVG_NS = 'http://www.w3.org/2000/svg';
const STAR_PATH = 'M12 2.6l2.85 5.95 6.55.85-4.8 4.55 1.25 6.5L12 17.3l-5.85 3.15 1.25-6.5-4.8-4.55 6.55-.85z';
/** Partie visible de l'étoile pleine selon son remplissage */
const CLIP: Record<StarFill, string> = { full: 'none', half: 'inset(0 50% 0 0)', empty: 'inset(0 100% 0 0)' };

/** Classes fournies par l'appelant : Tailwind (popup) ou feuille du Shadow DOM (toast sur la page) */
export interface StarRatingClasses {
  /** Conteneur : rangée d'étoiles + libellé de la valeur */
  group: string;
  /** Rangée des étoiles */
  row: string;
  /** Libellé visible de la valeur survolée / choisie ("8,5/10") */
  value: string;
  /** Boîte d'une étoile (dimensions) */
  star: string;
  /** Contour de l'étoile vide */
  outline: string;
  /** Étoile pleine (couleur) */
  fill: string;
  /** Bouton transparent couvrant une moitié d'étoile (curseur, focus) */
  half: string;
}

export interface StarRatingOptions {
  /** Libellé du groupe pour les lecteurs d'écran */
  label: string;
  classes: StarRatingClasses;
  /** Préfixe data-focus (popup : focus restauré après un nouveau rendu) */
  focusKey?: string;
  disabled?: boolean;
  /** Note actuelle affichée au repos (0 ou absente = aucune) */
  value?: number;
  /** Clic, Entrée ou Espace sur une valeur */
  onConfirm: (value: number) => void;
}

function starSvg(className: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', className);
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', STAR_PATH);
  path.setAttribute('stroke-linejoin', 'round');
  svg.append(path);
  return svg;
}

/**
 * Notation 10 étoiles à demi-étoiles : chaque étoile porte deux boutons (moitié gauche = x,5).
 * Survol et focus prévisualisent ; flèches ±0,5 (focus itinérant, un seul arrêt de tabulation) ;
 * Entrée/clic confirme. Les écouteurs vivent sur les éléments créés : rien à nettoyer.
 */
export function createStarRating({ label, classes, focusKey, disabled = false, value = 0, onConfirm }: StarRatingOptions): HTMLElement {
  /** Note au repos : valeur valide (pas de 0,5) ou aucune */
  const current = isStarValue(value) ? value : 0;
  const group = document.createElement('div');
  group.className = classes.group;
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', label);
  const row = document.createElement('div');
  row.className = classes.row;
  const valueLabel = document.createElement('span');
  valueLabel.className = classes.value;
  valueLabel.setAttribute('aria-live', 'polite');
  valueLabel.setAttribute('aria-atomic', 'true');
  group.append(row, valueLabel);

  const fills: SVGSVGElement[] = [];
  const buttons = new Map<number, HTMLButtonElement>();
  /** Valeur portant le focus itinérant (seul bouton atteignable par Tab) */
  let anchor = current > 0 ? current : halfValue(1, 'left');

  const preview = (value: number): void => {
    fills.forEach((fill, i) => {
      fill.style.clipPath = CLIP[starFill(i + 1, value)];
    });
    valueLabel.textContent = formatScoreLabel(value);
  };

  const setAnchor = (value: number): void => {
    anchor = value;
    for (const [v, button] of buttons) button.tabIndex = v === value ? 0 : -1;
  };

  for (let index = 1; index <= STAR_COUNT; index++) {
    const star = document.createElement('span');
    star.className = classes.star;
    star.style.position = 'relative';
    star.style.display = 'inline-block';
    star.style.flex = 'none';

    const outline = starSvg(classes.outline);
    const fill = starSvg(classes.fill);
    for (const svg of [outline, fill]) {
      svg.style.position = 'absolute';
      svg.style.inset = '0';
      svg.style.width = '100%';
      svg.style.height = '100%';
      svg.style.pointerEvents = 'none';
    }
    fills.push(fill);
    star.append(outline, fill);

    for (const side of ['left', 'right'] as const) {
      const value = halfValue(index, side);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = classes.half;
      button.setAttribute('aria-label', rateAriaLabel(value));
      if (focusKey) button.dataset.focus = `${focusKey}-${value}`;
      button.disabled = disabled;
      // Moitié d'étoile cliquable : positionnement par CSSOM (indépendant des classes de l'appelant)
      Object.assign(button.style, { position: 'absolute', top: '0', bottom: '0', width: '50%', margin: '0', padding: '0', border: '0', background: 'transparent' });
      button.style[side] = '0';
      button.addEventListener('mouseenter', () => preview(value));
      button.addEventListener('focus', () => {
        setAnchor(value);
        preview(value);
      });
      button.addEventListener('click', () => onConfirm(value));
      buttons.set(value, button);
      star.append(button);
    }
    row.append(star);
  }

  group.addEventListener('keydown', (event) => {
    const next = stepStarValue(anchor, event.key);
    if (next === null) return;
    // Flèches capturées : ni défilement de la page, ni raccourcis du lecteur vidéo
    event.preventDefault();
    event.stopPropagation();
    buttons.get(next)?.focus();
  });
  row.addEventListener('mouseleave', () => preview(group.contains(document.activeElement) || isFocusedInShadow(group) ? anchor : current));
  group.addEventListener('focusout', (event) => {
    if (!(event.relatedTarget instanceof Node && group.contains(event.relatedTarget))) preview(current);
  });

  setAnchor(anchor);
  preview(current);
  return group;
}

/** Dans un Shadow DOM, document.activeElement est l'hôte : on regarde l'élément actif de la racine */
function isFocusedInShadow(el: HTMLElement): boolean {
  const root = el.getRootNode();
  return root instanceof ShadowRoot && root.activeElement !== null && el.contains(root.activeElement);
}
