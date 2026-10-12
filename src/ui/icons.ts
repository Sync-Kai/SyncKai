import {
  ANTENNA_L_D,
  ANTENNA_R_D,
  ARC_L_DOWN,
  ARC_L_UP,
  ARC_R_DOWN,
  ARC_R_UP,
  drawKai,
  EYE_CYAN,
  HEAD_D,
  ROUND,
  SMALL_KAI,
  TILE_STOPS,
  USER,
  VISOR_D,
  WAVY_MOUTH_D,
  type KaiDrawing,
  type KaiExpression,
  type KaiOptions,
} from './kai-small';
import { gradient, svgEl, type Shape } from './svg';

export type { KaiExpression, KaiOptions } from './kai-small';

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
  // Catégories des Réglages
  user: ['M16 8a4 4 0 1 1-8 0a4 4 0 1 1 8 0', 'M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6'],
  sync: ['M20 11a8 8 0 0 0-14.5-4.5L4 8', 'M4 4v4h4', 'M4 13a8 8 0 0 0 14.5 4.5L20 16', 'M20 20v-4h-4'],
  bell: ['M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z', 'M10 21h4'],
  folder: ['M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'],
  globe: ['M21 12a9 9 0 1 1-18 0a9 9 0 1 1 18 0', 'M3 12h18', 'M12 3c3 3 3 15 0 18', 'M12 3c-3 3-3 15 0 18'],
  help: ['M21 12a9 9 0 1 1-18 0a9 9 0 1 1 18 0', 'M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5V14', 'M12 17.2v.1'],
  // Clavier : touches en segments nuls (disques), barre d'espace
  keyboard: ['M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z', 'M6 10h.01', 'M10 10h.01', 'M14 10h.01', 'M18 10h.01', 'M8 14h8'],
  pencil: ['M12 20h9', 'M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z'],
} as const;

export type IconName = keyof typeof ICON_PATHS;

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

// ── Mascotte Kai, grand dessin (≥ 48 px) ; cadre commun et petit dessin : kai-small.ts ──

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
    case undefined: // yeux ouverts (expression par défaut)
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

const LARGE_KAI: KaiDrawing = {
  defs: largeDefs,
  tile: largeTile,
  body: (url, expression) => [...largeHead(url), ...largeEars(expression === 'sleep'), ...largeVisor(url), ...largeFace(url, expression), ...largeBadge(url)],
};

/**
 * Mascotte Kai (viewBox 320), grande taille par défaut. Ids de dégradés suffixés par instance pour que plusieurs
 * Kai sur une même page ne se marchent pas dessus.
 */
export function kai(className: string, options: KaiOptions = {}): SVGSVGElement {
  const { size = 'large', ...rest } = options;
  return drawKai(className, rest, size === 'large' ? LARGE_KAI : SMALL_KAI);
}
