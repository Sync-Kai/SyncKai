// Construction d'éléments SVG nœud par nœud (aucun innerHTML : utilisable en Shadow DOM fermé). Feuille commune aux
// icônes (icons.ts) et à la mascotte (kai-small.ts).

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Élément SVG et ses attributs, construit par `shapes` */
export type Shape = readonly [keyof SVGElementTagNameMap, Record<string, string>];
/** Arrêts d'un dégradé : [offset, couleur, opacité ?] */
export type Stops = readonly (readonly [string, string, string?])[];

export function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string>): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  return el;
}

export function gradient(kind: 'radialGradient' | 'linearGradient', id: string, attrs: Record<string, string>, stops: Stops): SVGElement {
  const grad = svgEl(kind, { id, ...attrs });
  for (const [offset, color, opacity] of stops) {
    grad.append(svgEl('stop', opacity ? { offset, 'stop-color': color, 'stop-opacity': opacity } : { offset, 'stop-color': color }));
  }
  return grad;
}

export function shapes(list: readonly Shape[]): SVGElement[] {
  return list.map(([tag, attrs]) => svgEl(tag, attrs));
}
