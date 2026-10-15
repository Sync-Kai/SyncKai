import { gradient, shapes, svgEl, type Shape, type Stops } from './svg';

// ── Mascotte Kai (robot astronaute) ─────────────────────────────────────────
// Tracés repris tels quels de assets/brand/kai-icon*.svg et du board « 3 · Expressions »
// (repère 320×320). Aucun innerHTML : construit nœud par nœud (utilisable en Shadow DOM fermé).
// Ce module porte le cadre commun et le petit dessin (16/32 px) ; les scripts de contenu n'en prennent que `happyKai` (bulle de
// synchro) : le grand dessin et les icônes restent dans icons.ts, hors des pages de streaming.

export type KaiExpression = 'happy' | 'neutral' | 'wink' | 'sleep';

export interface KaiOptions {
  /** Absent : visage du logo (kai-icon.svg / kai-icon-32.svg) */
  expression?: KaiExpression;
  /** small : dessin simplifié 16/32 px ; large : détail complet (≥ 48 px) */
  size?: 'small' | 'large';
  /** Tuile bleu nuit derrière Kai (look icône de barre d'outils) */
  tile?: boolean;
  /** Anime le corps (squish), désactivé si l'utilisateur préfère réduire les animations */
  squish?: boolean;
}

export const ROUND = { 'stroke-linecap': 'round' } as const;
export const EYE_CYAN = '#5FE3FF';
const ZZZ = '#B9A4FF';

// Contours partagés entre les deux tailles
export const HEAD_D = 'M160 98 C234 98 280 134 280 188 C280 242 234 278 160 278 C86 278 40 242 40 188 C40 134 86 98 160 98 Z';
export const VISOR_D = 'M160 126 C216 126 252 150 252 192 C252 234 216 260 160 260 C104 260 68 234 68 192 C68 150 104 126 160 126 Z';
export const ANTENNA_L_D = 'M76 146 C40 122 32 86 54 62 C68 47 86 44 100 46';
export const ANTENNA_R_D = 'M244 146 C282 124 290 98 276 80 C264 64 246 60 230 62';
// Yeux fermés : arcs « ^^ » (ravi) et arcs retournés (endormi)
export const ARC_L_UP = 'M92 196 Q106 168 120 196';
export const ARC_R_UP = 'M200 196 Q214 168 228 196';
export const ARC_L_DOWN = 'M92 184 Q106 206 120 184';
export const ARC_R_DOWN = 'M200 184 Q214 206 228 184';
export const WAVY_MOUTH_D = 'M150 213 Q155 220 160 213 Q165 220 170 213';

export const USER = { gradientUnits: 'userSpaceOnUse' } as const;
export const TILE_STOPS: Stops = [['0', '#2A3590'], ['0.5', '#1F2A66'], ['1', '#141A3D']];

function smallDefs(id: (name: string) => string): SVGElement[] {
  return [
    gradient('radialGradient', id('T'), { cx: '160', cy: '140', r: '210', ...USER }, TILE_STOPS),
    gradient('radialGradient', id('H'), { cx: '132', cy: '132', r: '180', ...USER }, [['0', '#FFFFFF'], ['0.5', '#F4F6FF'], ['1', '#C9CFF5']]),
    gradient('linearGradient', id('L'), { x1: '72', y1: '146', x2: '118', y2: '44', ...USER }, [['0', '#8A6BFF'], ['1', '#46D6FF']]),
    gradient('linearGradient', id('R'), { x1: '248', y1: '146', x2: '206', y2: '62', ...USER }, [['0', '#46D6FF'], ['1', '#8A6BFF']]),
  ];
}

function smallHead(url: (name: string) => string, asleep: boolean): Shape[] {
  const earLight: Record<string, string> = asleep ? { fill: EYE_CYAN, opacity: '0.35' } : { fill: EYE_CYAN };
  return [
    ['path', { d: ANTENNA_L_D, fill: 'none', stroke: url('L'), 'stroke-width': '28', ...ROUND }],
    ['path', { d: 'M94 20 L134 47 L96 74 Z', fill: '#46D6FF', stroke: '#46D6FF', 'stroke-width': '8', 'stroke-linejoin': 'round' }],
    ['path', { d: ANTENNA_R_D, fill: 'none', stroke: url('R'), 'stroke-width': '28', ...ROUND }],
    ['path', { d: 'M236 35 L194 64 L234 91 Z', fill: '#8A6BFF', stroke: '#8A6BFF', 'stroke-width': '8', 'stroke-linejoin': 'round' }],
    ['path', { d: HEAD_D, fill: url('H') }],
    ['ellipse', { cx: '42', cy: '192', rx: '16', ry: '30', ...earLight }],
    ['ellipse', { cx: '278', cy: '192', rx: '16', ry: '30', ...earLight }],
    ['path', { d: VISOR_D, fill: '#121633' }],
  ];
}

// Petites tailles : mêmes formes que le board, traits épaissis comme dans kai-icon-32.svg
const smallOpenEye = (cx: string): Shape[] => [
  ['ellipse', { cx, cy: '188', rx: '16', ry: '21', fill: EYE_CYAN }],
  ['ellipse', { cx: String(Number(cx) - 5), cy: '179', rx: '6', ry: '7.5', fill: '#FFFFFF' }],
];
const smallArc = (d: string, opacity?: string): Shape => ['path', { d, fill: 'none', stroke: EYE_CYAN, 'stroke-width': '16', ...ROUND, ...(opacity ? { opacity } : {}) }];
const SMALL_BLUSH: Shape[] = [
  ['ellipse', { cx: '86', cy: '223', rx: '13', ry: '7', fill: '#FF7FB0' }],
  ['ellipse', { cx: '234', cy: '223', rx: '13', ry: '7', fill: '#FF7FB0' }],
];
const SMALL_SOFT_BLUSH: Shape[] = SMALL_BLUSH.map(([tag, attrs]) => [tag, { ...attrs, opacity: '0.6' }] as const);
const SMALL_MOUTH: Shape = ['path', { d: 'M146 206 Q160 212 174 206 Q172 228 160 228 Q148 228 146 206 Z', fill: '#FF7FB0' }];
const SMALL_WAVY_MOUTH: Shape = ['path', { d: WAVY_MOUTH_D, fill: 'none', stroke: '#FF7FB0', 'stroke-width': '8', ...ROUND, 'stroke-linejoin': 'round' }];
const smallHappyFace = (): Shape[] => [smallArc(ARC_L_UP), smallArc(ARC_R_UP), ...SMALL_BLUSH, SMALL_MOUTH];

function smallFace(expression: KaiExpression | undefined): Shape[] {
  switch (expression) {
    case 'happy':
      return smallHappyFace();
    case 'neutral':
      return [
        ['ellipse', { cx: '108', cy: '192', rx: '13', ry: '16', fill: EYE_CYAN }],
        ['ellipse', { cx: '212', cy: '192', rx: '13', ry: '16', fill: EYE_CYAN }],
        ['ellipse', { cx: '104', cy: '185', rx: '4.8', ry: '6', fill: '#FFFFFF' }],
        ['ellipse', { cx: '208', cy: '185', rx: '4.8', ry: '6', fill: '#FFFFFF' }],
        ...SMALL_SOFT_BLUSH,
        SMALL_WAVY_MOUTH,
      ];
    case 'wink':
      return [...smallOpenEye('106'), smallArc(ARC_R_UP), ...SMALL_BLUSH, SMALL_MOUTH];
    case 'sleep':
      return [smallArc(ARC_L_DOWN, '0.75'), smallArc(ARC_R_DOWN, '0.75'), ...SMALL_SOFT_BLUSH, SMALL_WAVY_MOUTH];
    case undefined: // yeux ouverts (expression par défaut)
      return [...smallOpenEye('106'), ...smallOpenEye('214'), ...SMALL_BLUSH, SMALL_MOUTH];
  }
}

/** « z z » lavande au-dessus de la tête, entre les antennes */
function sleepZ(): SVGElement[] {
  const z1 = svgEl('text', { x: '146', y: '88', fill: ZZZ, 'font-weight': '800', 'font-size': '56', class: 'font-display' });
  z1.textContent = 'z';
  const z2 = svgEl('text', { x: '186', y: '44', fill: ZZZ, 'font-weight': '800', 'font-size': '40', opacity: '0.75', class: 'font-display' });
  z2.textContent = 'z';
  return [z1, z2];
}

/** Dessin d'une taille de Kai, posé dans le cadre commun (`drawKai`) */
export interface KaiDrawing {
  defs(id: (name: string) => string): SVGElement[];
  tile(url: (name: string) => string): Shape[];
  body(url: (name: string) => string, expression: KaiExpression | undefined): Shape[];
}

export const SMALL_KAI: KaiDrawing = {
  defs: smallDefs,
  tile: (url) => [['rect', { width: '320', height: '320', rx: '60', fill: url('T') }]],
  body: (url, expression) => [...smallHead(url, expression === 'sleep'), ...smallFace(expression)],
};

let kaiInstance = 0;

/** Ids de dégradés suffixés par instance, pour que plusieurs Kai sur une même page ne se marchent pas dessus */
function kaiIds(): { id: (name: string) => string; url: (name: string) => string } {
  const prefix = `sk-kai${++kaiInstance}`;
  const id = (name: string): string => `${prefix}-${name}`;
  return { id, url: (name) => `url(#${id(name)})` };
}

/** Cadre commun (viewBox 320) et ses dégradés */
function kaiFrame(className: string, gradients: SVGElement[]): SVGSVGElement {
  const svg = svgEl('svg', {
    viewBox: '0 0 320 320',
    'aria-hidden': 'true',
    focusable: 'false',
    class: `shrink-0 overflow-visible ${className}`,
  });
  const defs = svgEl('defs', {});
  defs.append(...gradients);
  svg.append(defs);
  return svg;
}

/** Mascotte Kai (viewBox 320) dessinée par `drawing` */
export function drawKai(className: string, options: Omit<KaiOptions, 'size'>, drawing: KaiDrawing): SVGSVGElement {
  const { expression, tile = false, squish = false } = options;
  const { id, url } = kaiIds();
  const svg = kaiFrame(className, drawing.defs(id));

  if (tile) svg.append(...shapes(drawing.tile(url)));

  const body = svgEl('g', squish ? { class: 'origin-[160px_298px] motion-safe:animate-squish' } : {});
  body.append(...shapes(drawing.body(url, expression)));
  svg.append(body);
  if (expression === 'sleep') svg.append(...sleepZ());
  return svg;
}

/** Kai en petite taille (dessin simplifié 16/32 px), sans le grand dessin ni les icônes */
export function smallKai(className: string, options: Omit<KaiOptions, 'size'> = {}): SVGSVGElement {
  return drawKai(className, options, SMALL_KAI);
}

/**
 * Même dessin que `smallKai(className, { expression: 'happy' })`, sans tuile ni animation. Seule mascotte des scripts de
 * contenu (bulle de synchro) : ils n'embarquent ainsi ni les autres expressions, ni la tuile, ni les « z z »
 */
export function happyKai(className: string): SVGSVGElement {
  const { id, url } = kaiIds();
  const svg = kaiFrame(className, smallDefs(id));
  const body = svgEl('g', {});
  body.append(...shapes([...smallHead(url, false), ...smallHappyFace()]));
  svg.append(body);
  return svg;
}
