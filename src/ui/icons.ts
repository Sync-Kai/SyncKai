const SVG_NS = 'http://www.w3.org/2000/svg';

// Tracés en style "stroke" (viewBox 24x24), inspirés de Lucide
const ICON_PATHS = {
  spinner: ['M21 12a9 9 0 1 1-6.219-8.56'],
  external: ['M15 3h6v6', 'M10 14 21 3', 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6'],
  alert: ['M22 12a10 10 0 1 1-20 0a10 10 0 1 1 20 0', 'M12 8v4', 'M12 16h.01'],
  check: ['M5 12.5 10 17.5 19 7'],
  search: ['M19 11a8 8 0 1 1-16 0a8 8 0 1 1 16 0', 'm21 21-4.3-4.3'],
  trash: ['M3 6h18', 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6', 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'],
  gear: [
    'M15 12a3 3 0 1 1-6 0a3 3 0 1 1 6 0',
    'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  ],
  back: ['M19 12H5', 'M11 6 5 12l6 6'],
  chevronDown: ['M6 9l6 6 6-6'],
  chevronRight: ['M9 6l6 6-6 6'],
  sortNext: ['M7 4v16', 'M3 16l4 4 4-4', 'M14 6h7', 'M14 12h5', 'M14 18h3'],
  screen: ['M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M8 21h8'],
  // Points de suspension : segments nuls rendus en disques par stroke-linecap="round"
  more: ['M5 12h.01', 'M12 12h.01', 'M19 12h.01'],
  ban: ['M22 12a10 10 0 1 1-20 0a10 10 0 1 1 20 0', 'm4.9 4.9 14.2 14.2'],
  minus: ['M5 12h14'],
  plus: ['M12 5v14', 'M5 12h14'],
  pause: ['M9 5v14', 'M15 5v14'],
  xCircle: ['M22 12a10 10 0 1 1-20 0a10 10 0 1 1 20 0', 'm15 9-6 6', 'm9 9 6 6'],
  checkCircle: ['M22 12a10 10 0 1 1-20 0a10 10 0 1 1 20 0', 'm8 12.5 2.8 2.8L16.5 9.5'],
  retry: ['M3 12a9 9 0 1 0 3-6.7L3 8', 'M3 3v5h5'],
  clock: ['M22 12a10 10 0 1 1-20 0a10 10 0 1 1 20 0', 'M12 7v5l3 2'],
  // Fenêtre avec volet à droite : panneau latéral
  panel: ['M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M15 4v16'],
  calendar: ['M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z', 'M3 10h18', 'M8 3v4', 'M16 3v4'],
  star: ['M12 2.6l2.85 5.95 6.55.85-4.8 4.55 1.25 6.5L12 17.3l-5.85 3.15 1.25-6.5-4.8-4.55 6.55-.85z'],
} as const;

export type IconName = keyof typeof ICON_PATHS;

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string>): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  return el;
}

export function icon(name: IconName, className = 'h-4 w-4', strokeWidth = '2'): SVGSVGElement {
  const svg = svgEl('svg', {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': strokeWidth,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
    class: `shrink-0 ${className}`,
  });
  for (const d of ICON_PATHS[name]) svg.append(svgEl('path', { d }));
  // Petit triangle "lecture" plein à l'intérieur de l'écran
  if (name === 'screen') svg.append(svgEl('path', { d: 'M10 8l5 2.5-5 2.5z', fill: 'currentColor' }));
  return svg;
}

/** Triangle d'avertissement plein (couleur via currentColor, point d'exclamation sombre) */
export function warnIcon(className = 'h-3.5 w-3.5'): SVGSVGElement {
  const svg = svgEl('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', class: `shrink-0 ${className}` });
  svg.append(
    svgEl('path', { d: 'M12 3 22 20H2Z', fill: 'currentColor', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linejoin': 'round' }),
    svgEl('path', { d: 'M12 10v4', stroke: '#1A0F1C', 'stroke-width': '2.4', 'stroke-linecap': 'round' }),
    svgEl('circle', { cx: '12', cy: '17', r: '1.3', fill: '#1A0F1C' }),
  );
  return svg;
}

/** Triangle "lecture" plein */
export function playIcon(className = 'h-3 w-3'): SVGSVGElement {
  const svg = svgEl('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', class: `shrink-0 ${className}` });
  svg.append(svgEl('path', { d: 'M7 4.5 19.5 12 7 19.5Z', fill: 'currentColor', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linejoin': 'round' }));
  return svg;
}

/** Étincelle beurre posée sur la barre de progression de la carte « Reprendre » */
export function sparkIcon(className: string): SVGSVGElement {
  const svg = svgEl('svg', { viewBox: '0 0 10 10', 'aria-hidden': 'true', class: className });
  svg.append(svgEl('path', { d: 'M5 0 6.2 3.8 10 5 6.2 6.2 5 10 3.8 6.2 0 5 3.8 3.8Z', fill: '#FFD37A' }));
  return svg;
}

// ── Mascotte Kai (robot astronaute) ─────────────────────────────────────────
// Tracés repris tels quels de assets/brand/kai-icon*.svg et du board « 3 · Expressions »
// (repère 320×320). Aucun innerHTML : construit nœud par nœud (utilisable en Shadow DOM fermé).

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

type Shape = readonly [keyof SVGElementTagNameMap, Record<string, string>];
type Stops = readonly (readonly [string, string, string?])[];

const ROUND = { 'stroke-linecap': 'round' } as const;
const EYE_CYAN = '#5FE3FF';
const ZZZ = '#B9A4FF';

// Contours partagés entre les deux tailles
const HEAD_D = 'M160 98 C234 98 280 134 280 188 C280 242 234 278 160 278 C86 278 40 242 40 188 C40 134 86 98 160 98 Z';
const VISOR_D = 'M160 126 C216 126 252 150 252 192 C252 234 216 260 160 260 C104 260 68 234 68 192 C68 150 104 126 160 126 Z';
const ANTENNA_L_D = 'M76 146 C40 122 32 86 54 62 C68 47 86 44 100 46';
const ANTENNA_R_D = 'M244 146 C282 124 290 98 276 80 C264 64 246 60 230 62';
// Yeux fermés : arcs « ^^ » (ravi) et arcs retournés (endormi)
const ARC_L_UP = 'M92 196 Q106 168 120 196';
const ARC_R_UP = 'M200 196 Q214 168 228 196';
const ARC_L_DOWN = 'M92 184 Q106 206 120 184';
const ARC_R_DOWN = 'M200 184 Q214 206 228 184';
const WAVY_MOUTH_D = 'M150 213 Q155 220 160 213 Q165 220 170 213';

let kaiInstance = 0;

function gradient(kind: 'radialGradient' | 'linearGradient', id: string, attrs: Record<string, string>, stops: Stops): SVGElement {
  const grad = svgEl(kind, { id, ...attrs });
  for (const [offset, color, opacity] of stops) {
    grad.append(svgEl('stop', opacity ? { offset, 'stop-color': color, 'stop-opacity': opacity } : { offset, 'stop-color': color }));
  }
  return grad;
}

function shapes(list: readonly Shape[]): SVGElement[] {
  return list.map(([tag, attrs]) => svgEl(tag, attrs));
}

const USER = { gradientUnits: 'userSpaceOnUse' } as const;
const TILE_STOPS: Stops = [['0', '#2A3590'], ['0.5', '#1F2A66'], ['1', '#141A3D']];

function largeDefs(id: (name: string) => string): SVGElement[] {
  return [
    gradient('radialGradient', id('T'), { cx: '160', cy: '140', r: '210', ...USER }, TILE_STOPS),
    gradient('radialGradient', id('G'), { cx: '160', cy: '180', r: '150', ...USER }, [['0', '#7C5CFF', '0.5'], ['0.6', '#5B6BFF', '0.14'], ['1', '#46D6FF', '0']]),
    gradient('radialGradient', id('H'), { cx: '132', cy: '132', r: '180', ...USER }, [['0', '#FFFFFF'], ['0.42', '#F4F6FF'], ['0.78', '#DDE1FA'], ['1', '#C9CFF5']]),
    gradient('radialGradient', id('V'), { cx: '150', cy: '170', r: '110', ...USER }, [['0', '#20275F'], ['0.6', '#121633'], ['1', '#0A0D24']]),
    gradient('linearGradient', id('E'), { x1: '0', y1: '0', x2: '0', y2: '1' }, [['0', '#C8F8FF'], ['0.45', EYE_CYAN], ['1', '#2E9BF0']]),
    gradient('linearGradient', id('L'), { x1: '72', y1: '146', x2: '118', y2: '44', ...USER }, [['0', '#7C5CFF'], ['1', '#46D6FF']]),
    gradient('linearGradient', id('R'), { x1: '248', y1: '146', x2: '206', y2: '62', ...USER }, [['0', '#46D6FF'], ['1', '#7C5CFF']]),
    gradient('linearGradient', id('B'), { x1: '0', y1: '0', x2: '1', y2: '1' }, [['0', EYE_CYAN], ['1', '#5A6BFF']]),
  ];
}

function largeTile(url: (name: string) => string): Shape[] {
  return [
    ['rect', { width: '320', height: '320', rx: '60', fill: url('T') }],
    ['rect', { width: '320', height: '320', rx: '60', fill: url('G') }],
    ['rect', { x: '1.5', y: '1.5', width: '317', height: '317', rx: '58.5', fill: 'none', stroke: '#8C7BFF', 'stroke-opacity': '0.35', 'stroke-width': '3' }],
    ['path', { d: 'M266 30 Q268 44 282 46 Q268 48 266 62 Q264 48 250 46 Q264 44 266 30 Z', fill: '#CFF6FF' }],
    ['path', { d: 'M292 238 Q293 247 302 248 Q293 249 292 258 Q291 249 282 248 Q291 247 292 238 Z', fill: '#A9B6FF', opacity: '0.8' }],
  ];
}

function largeHead(url: (name: string) => string): Shape[] {
  return [
    ['path', { d: ANTENNA_L_D, fill: 'none', stroke: '#7C5CFF', 'stroke-opacity': '0.22', 'stroke-width': '34', ...ROUND }],
    ['path', { d: ANTENNA_L_D, fill: 'none', stroke: url('L'), 'stroke-width': '22', ...ROUND }],
    ['path', { d: 'M96 24 L130 47 L98 70 Z', fill: '#46D6FF', stroke: '#46D6FF', 'stroke-width': '6', 'stroke-linejoin': 'round' }],
    ['path', { d: 'M50 96 C47 82 52 70 62 61', fill: 'none', stroke: '#FFFFFF', 'stroke-opacity': '0.45', 'stroke-width': '5', ...ROUND }],
    ['path', { d: ANTENNA_R_D, fill: 'none', stroke: '#46D6FF', 'stroke-opacity': '0.2', 'stroke-width': '34', ...ROUND }],
    ['path', { d: ANTENNA_R_D, fill: 'none', stroke: url('R'), 'stroke-width': '22', ...ROUND }],
    ['path', { d: 'M234 39 L198 64 L232 87 Z', fill: '#8A6BFF', stroke: '#8A6BFF', 'stroke-width': '6', 'stroke-linejoin': 'round' }],
    ['path', { d: 'M281 112 C288 100 287 88 280 79', fill: 'none', stroke: '#FFFFFF', 'stroke-opacity': '0.4', 'stroke-width': '5', ...ROUND }],
    ['ellipse', { cx: '160', cy: '282', rx: '66', ry: '16', fill: '#C9CFF5' }],
    ['path', { d: HEAD_D, fill: url('H') }],
    ['path', { d: 'M58 236 C84 266 120 278 160 278 C200 278 236 266 262 236 C236 258 200 268 160 268 C120 268 84 258 58 236 Z', fill: '#B7BEEE', opacity: '0.6' }],
  ];
}

/** Écouteurs : coque + lumière cyan (atténuée quand Kai dort) */
function largeEars(asleep: boolean): Shape[] {
  const ear = (shellX: string, lightX: string, glintX: string): Shape[] => [
    ['ellipse', { cx: shellX, cy: '192', rx: '20', ry: '36', fill: '#E3E7FC', stroke: '#B9C1F0', 'stroke-width': '2' }],
    ...(asleep ? [] : [['ellipse', { cx: lightX, cy: '192', rx: '14', ry: '27', fill: 'none', stroke: '#46D6FF', 'stroke-opacity': '0.35', 'stroke-width': '10' }] as Shape]),
    ['ellipse', { cx: lightX, cy: '192', rx: '12', ry: '25', fill: '#1A2160', stroke: EYE_CYAN, 'stroke-width': '4', ...(asleep ? { 'stroke-opacity': '0.35' } : {}) }],
    ...(asleep ? [] : [['ellipse', { cx: glintX, cy: '181', rx: '3', ry: '7', fill: '#C8F8FF', opacity: '0.85' }] as Shape]),
  ];
  return [...ear('46', '39', '36'), ...ear('274', '281', '284')];
}

function largeVisor(url: (name: string) => string): Shape[] {
  return [
    ['path', { d: VISOR_D, fill: url('V'), stroke: '#3D4FC4', 'stroke-opacity': '0.75', 'stroke-width': '3' }],
    ['path', { d: 'M92 168 C104 146 128 136 156 135', fill: 'none', stroke: '#FFFFFF', 'stroke-opacity': '0.13', 'stroke-width': '7', ...ROUND }],
  ];
}

function largeOpenEye(url: (name: string) => string, cx: string): Shape[] {
  const x = Number(cx);
  return [
    ['ellipse', { cx, cy: '188', rx: '21', ry: '27', fill: '#46D6FF', opacity: '0.16' }],
    ['ellipse', { cx, cy: '188', rx: '12.5', ry: '17', fill: url('E') }],
    ['ellipse', { cx: String(x - 4.5), cy: '180', rx: '4.6', ry: '6', fill: '#FFFFFF' }],
    ['circle', { cx: String(x + 5), cy: '197', r: '2.3', fill: '#FFFFFF', opacity: '0.85' }],
  ];
}

const LARGE_ARC_GLOW = (cx: string): Shape => ['ellipse', { cx, cy: '186', rx: '22', ry: '18', fill: '#46D6FF', opacity: '0.16' }];
const LARGE_BLUSH: Shape[] = [
  ['ellipse', { cx: '88', cy: '220', rx: '11', ry: '5.5', fill: '#FF7FB0', opacity: '0.85' }],
  ['ellipse', { cx: '232', cy: '220', rx: '11', ry: '5.5', fill: '#FF7FB0', opacity: '0.85' }],
];
const LARGE_SOFT_BLUSH: Shape[] = [
  ['ellipse', { cx: '90', cy: '220', rx: '10', ry: '5', fill: '#FF7FB0', opacity: '0.6' }],
  ['ellipse', { cx: '230', cy: '220', rx: '10', ry: '5', fill: '#FF7FB0', opacity: '0.6' }],
];
const LARGE_MOUTH: Shape[] = [
  ['path', { d: 'M149 207 Q160 211 171 207 Q169 225 160 225 Q151 225 149 207 Z', fill: '#D2407F', stroke: '#FF7FB0', 'stroke-width': '2.5', 'stroke-linejoin': 'round' }],
  ['ellipse', { cx: '160', cy: '220', rx: '6', ry: '3.2', fill: '#FF9CC4' }],
];
const LARGE_WAVY_MOUTH: Shape = ['path', { d: WAVY_MOUTH_D, fill: 'none', stroke: '#FF7FB0', 'stroke-width': '3.5', ...ROUND, 'stroke-linejoin': 'round' }];
const largeArc = (d: string, opacity?: string): Shape => ['path', { d, fill: 'none', stroke: EYE_CYAN, 'stroke-width': '9', ...ROUND, ...(opacity ? { opacity } : {}) }];

function largeFace(url: (name: string) => string, expression: KaiExpression | undefined): Shape[] {
  switch (expression) {
    case 'happy':
      return [
        LARGE_ARC_GLOW('106'), LARGE_ARC_GLOW('214'), largeArc(ARC_L_UP), largeArc(ARC_R_UP),
        ['ellipse', { cx: '88', cy: '218', rx: '12', ry: '6', fill: '#FF7FB0', opacity: '0.9' }],
        ['ellipse', { cx: '232', cy: '218', rx: '12', ry: '6', fill: '#FF7FB0', opacity: '0.9' }],
        ['path', { d: 'M146 204 Q160 210 174 204 Q172 230 160 230 Q148 230 146 204 Z', fill: '#D2407F', stroke: '#FF7FB0', 'stroke-width': '2.5', 'stroke-linejoin': 'round' }],
        ['ellipse', { cx: '160', cy: '223', rx: '7', ry: '3.8', fill: '#FF9CC4' }],
      ];
    case 'neutral':
      return [
        ['ellipse', { cx: '108', cy: '192', rx: '18', ry: '20', fill: '#46D6FF', opacity: '0.16' }],
        ['ellipse', { cx: '212', cy: '192', rx: '18', ry: '20', fill: '#46D6FF', opacity: '0.16' }],
        ['ellipse', { cx: '108', cy: '192', rx: '10.5', ry: '13', fill: url('E') }],
        ['ellipse', { cx: '212', cy: '192', rx: '10.5', ry: '13', fill: url('E') }],
        ['ellipse', { cx: '104.5', cy: '186', rx: '3.8', ry: '4.8', fill: '#FFFFFF' }],
        ['ellipse', { cx: '208.5', cy: '186', rx: '3.8', ry: '4.8', fill: '#FFFFFF' }],
        ['circle', { cx: '112', cy: '198', r: '1.9', fill: '#FFFFFF', opacity: '0.85' }],
        ['circle', { cx: '216', cy: '198', r: '1.9', fill: '#FFFFFF', opacity: '0.85' }],
        ...LARGE_SOFT_BLUSH,
        LARGE_WAVY_MOUTH,
      ];
    case 'wink':
      return [...largeOpenEye(url, '106'), LARGE_ARC_GLOW('214'), largeArc(ARC_R_UP), ...LARGE_BLUSH, ...LARGE_MOUTH];
    case 'sleep':
      return [largeArc(ARC_L_DOWN, '0.75'), largeArc(ARC_R_DOWN, '0.75'), ...LARGE_SOFT_BLUSH, LARGE_WAVY_MOUTH];
    default:
      return [...largeOpenEye(url, '106'), ...largeOpenEye(url, '214'), ...LARGE_BLUSH, ...LARGE_MOUTH];
  }
}

function largeBadge(url: (name: string) => string): Shape[] {
  return [
    ['circle', { cx: '160', cy: '284', r: '29', fill: '#46D6FF', opacity: '0.22' }],
    ['circle', { cx: '160', cy: '284', r: '21', fill: url('B'), stroke: '#E8FBFF', 'stroke-width': '3' }],
    ['path', { d: 'M155 274 L170 284 L155 294 Z', fill: '#FFFFFF', stroke: '#FFFFFF', 'stroke-width': '3', 'stroke-linejoin': 'round' }],
  ];
}

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

function smallFace(expression: KaiExpression | undefined): Shape[] {
  switch (expression) {
    case 'happy':
      return [smallArc(ARC_L_UP), smallArc(ARC_R_UP), ...SMALL_BLUSH, SMALL_MOUTH];
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
    default:
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

/**
 * Mascotte Kai (viewBox 320). Ids de dégradés suffixés par instance pour que plusieurs
 * Kai sur une même page ne se marchent pas dessus.
 */
export function kai(className: string, options: KaiOptions = {}): SVGSVGElement {
  const { expression, size = 'large', tile = false, squish = false } = options;
  const prefix = `sk-kai${++kaiInstance}`;
  const id = (name: string): string => `${prefix}-${name}`;
  const url = (name: string): string => `url(#${id(name)})`;
  const asleep = expression === 'sleep';

  const svg = svgEl('svg', {
    viewBox: '0 0 320 320',
    'aria-hidden': 'true',
    focusable: 'false',
    class: `shrink-0 overflow-visible ${className}`,
  });
  const defs = svgEl('defs', {});
  defs.append(...(size === 'large' ? largeDefs(id) : smallDefs(id)));
  svg.append(defs);

  if (tile) {
    svg.append(...shapes(size === 'large' ? largeTile(url) : [['rect', { width: '320', height: '320', rx: '60', fill: url('T') }]]));
  }

  const body = svgEl('g', squish ? { class: 'origin-[160px_298px] motion-safe:animate-squish' } : {});
  body.append(
    ...shapes(
      size === 'large'
        ? [...largeHead(url), ...largeEars(asleep), ...largeVisor(url), ...largeFace(url, expression), ...largeBadge(url)]
        : [...smallHead(url, asleep), ...smallFace(expression)],
    ),
  );
  svg.append(body);
  if (asleep) svg.append(...sleepZ());
  return svg;
}
