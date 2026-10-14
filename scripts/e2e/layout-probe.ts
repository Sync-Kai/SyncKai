// Détecteur de débordements de texte et de mise en page (contrôle des langues, scripts/e2e/i18n-layout.e2e.ts),
// exécuté dans la page de test : servi par le serveur Vite du harnais et chargé après le rendu
// (`page.addScriptTag({ type: 'module' })`), il s'installe sur `window.__skLayout`. Vérifié sur une page témoin par
// layout-probe.e2e.ts. Aucune dépendance au code de l'extension : il lit le DOM rendu, quelle que soit la vue.
//
// Ce qui est relevé (tolérance 1 px, arrondis du moteur) :
// - texte d'un élément qui sort de sa boîte : coupé par une ellipse ou un nombre de lignes (`truncated`), coupé net par
//   overflow: hidden (`clipped`) ou débordant à l'air libre (`spill`) ;
// - élément qui dépasse de son parent (`overflow`) : rangée trop étroite pour des boutons qui ne rétrécissent pas, ou
//   boîte de hauteur fixe (bouton h-8, pastille) dont le libellé passe à la ligne ; élément positionné (menu) coupé par
//   la fenêtre ou un conteneur (`offscreen`) ; texte indicatif d'un champ plus large que le champ (`placeholder`) ;
// - document ou zone défilante plus large que sa partie visible sans autre coupable trouvé (`scroll`).
// Troncatures voulues ignorées (`flagged: false`) : texte qui ne vient pas du catalogue (titre, pseudo, date…), ou texte
// du catalogue qui tient une fois les données de démo remplacées par « X » (voir layout-text.ts).
import { attributeText, countLetters, createDataMatcher, indexCatalog, normalizeText, type CatalogEntries, type CatalogIndex } from './layout-text';

export type LayoutIssueKind = 'truncated' | 'clipped' | 'spill' | 'overflow' | 'offscreen' | 'placeholder' | 'scroll';

/** Origine du texte en cause : catalogue seul, catalogue avec données de démo, données seules, autre (date, nom de langue…) */
export type TextSource = 'catalog' | 'mixed' | 'data' | 'other' | 'none';

export interface LayoutIssue {
  /** Numéro dans le relevé (repère dessiné sur la capture) */
  id: number;
  kind: LayoutIssueKind;
  /** Dépassement horizontal / vertical en px au-delà du bord autorisé */
  dx: number;
  dy: number;
  /** Dépassement mesuré avec le seul texte du catalogue (données de démo remplacées) : seulement s'il a été recalculé */
  catalogDx?: number;
  catalogDy?: number;
  /** Texte en cause (abrégé) */
  text: string;
  /** Clés du catalogue qui l'expliquent (recherche inverse dans le catalogue de la langue) */
  keys: string[];
  source: TextSource;
  /** Faux : troncature voulue (donnée de démo), rapportée à titre d'information */
  flagged: boolean;
  /** Chemin CSS court depuis l'identifiant ou le corps de la page */
  path: string;
  /**
   * `data-focus` de l'élément ou de l'ancêtre le plus proche ; à défaut, précédé de « ~ », celui du premier contrôle de la
   * même ligne ou carte (repère stable d'une langue à l'autre)
   */
  focus: string | null;
  rect: { x: number; y: number; width: number; height: number };
}

export interface LayoutProbe {
  /** Catalogue de la langue affichée (anglais en repli) et données de démo affichables */
  configure(options: { catalog: CatalogEntries; data: readonly string[] }): void;
  /**
   * Relevé de la page telle qu'affichée ; `scope` (sélecteur) le limite à une zone (menu ouvert sur un écran déjà
   * relevé : le reste de la page n'est pas compté deux fois)
   */
  scan(scope?: string): LayoutIssue[];
  /** Encadre les éléments en cause du dernier relevé (capture d'écran) */
  highlight(ids: readonly number[]): void;
  /** Zones défilantes dépliées (capture de tout le contenu, largeurs inchangées) ; `false` les replie */
  expand(on: boolean): void;
}

declare global {
  interface Window {
    __skLayout?: LayoutProbe;
  }
}

const TOLERANCE = 1;
const OVERLAY_ID = 'sk-layout-overlay';
const EXPAND_ID = 'sk-layout-expand';
const TEXT_SNIPPET = 90;
const SINGLE_LINE_INPUTS = new Set(['text', 'search', 'email', 'url', 'tel', 'number', 'password']);

interface Edges {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

const px = (value: string): number => Number.parseFloat(value) || 0;
const positive = (value: number): number => (value > 0 ? value : 0);
const round = (value: number): number => Math.round(value * 10) / 10;

function snippet(text: string): string {
  return text.length > TEXT_SNIPPET ? `${text.slice(0, TEXT_SNIPPET - 1)}…` : text;
}

/** Scanner d'un relevé : styles calculés mis en cache le temps du relevé */
function createScanner(index: CatalogIndex, isData: (fragment: string) => boolean) {
  const styles = new Map<Element, CSSStyleDeclaration>();
  const transparent = new Map<Element, boolean>();
  const style = (el: Element): CSSStyleDeclaration => {
    let s = styles.get(el);
    if (!s) {
      s = getComputedStyle(el);
      styles.set(el, s);
    }
    return s;
  };

  /** Opacité nulle sur l'élément ou un ancêtre (badge « Enregistré » masqué…) */
  const isTransparent = (el: Element | null): boolean => {
    if (!el) return false;
    const known = transparent.get(el);
    if (known !== undefined) return known;
    const value = style(el).opacity === '0' || isTransparent(el.parentElement);
    transparent.set(el, value);
    return value;
  };

  /** Élément HTML affiché : boîte non vide, visible, ni masqué pour les lecteurs d'écran seuls (sr-only), ni superposition du relevé */
  const isShown = (el: Element): el is HTMLElement => {
    if (!(el instanceof HTMLElement) || el.id === OVERLAY_ID || el.closest(`#${OVERLAY_ID}`)) return false;
    const s = style(el);
    if (s.display === 'none' || s.display === 'contents' || s.visibility !== 'visible' || isTransparent(el)) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 1 && rect.height <= 1) return false;
    return !/inset\(50%/.test(s.clipPath);
  };

  /** Boîtes de rembourrage et de contenu (barre de défilement exclue) */
  const boxesOf = (el: HTMLElement): { padding: Edges; content: Edges } => {
    const s = style(el);
    const rect = el.getBoundingClientRect();
    const [bl, br, bt, bb] = [px(s.borderLeftWidth), px(s.borderRightWidth), px(s.borderTopWidth), px(s.borderBottomWidth)];
    const scrollbarX = Math.round(rect.width - bl - br) - el.clientWidth;
    const scrollbarY = Math.round(rect.height - bt - bb) - el.clientHeight;
    const padding: Edges = {
      left: rect.left + bl,
      right: rect.right - br - (scrollbarX >= 3 ? scrollbarX : 0),
      top: rect.top + bt,
      bottom: rect.bottom - bb - (scrollbarY >= 3 ? scrollbarY : 0),
    };
    const content: Edges = {
      left: padding.left + px(s.paddingLeft),
      right: padding.right - px(s.paddingRight),
      top: padding.top + px(s.paddingTop),
      bottom: padding.bottom - px(s.paddingBottom),
    };
    return { padding, content };
  };

  const truncatesX = (s: CSSStyleDeclaration): boolean => s.textOverflow === 'ellipsis' && s.overflowX !== 'visible';
  const clampsLines = (s: CSSStyleDeclaration): boolean => {
    const clamp = s.getPropertyValue('-webkit-line-clamp');
    return clamp !== '' && clamp !== 'none';
  };

  /**
   * Nœuds texte du contenu en ligne de l'élément : ses textes et ceux de ses descendants `inline` (lien d'un titre…),
   * sans les blocs, flex et inline-block (relevés pour eux-mêmes) ni les textes masqués
   */
  const inlineTextNodes = (el: Element): Text[] => {
    const found: Text[] = [];
    const walk = (node: Node): void => {
      for (const child of node.childNodes) {
        if (child instanceof Text) {
          if (child.data.trim()) found.push(child);
          continue;
        }
        if (!(child instanceof HTMLElement)) continue;
        const s = style(child);
        if (s.display === 'contents') walk(child);
        else if (s.display === 'inline' && s.visibility === 'visible' && !isTransparent(child)) walk(child);
      }
    };
    walk(el);
    return found;
  };

  const textEdges = (nodes: readonly Text[]): Edges | null => {
    let edges: Edges | null = null;
    const range = document.createRange();
    for (const node of nodes) {
      range.selectNodeContents(node);
      for (const r of range.getClientRects()) {
        if (r.width === 0) continue;
        edges = edges
          ? { left: Math.min(edges.left, r.left), right: Math.max(edges.right, r.right), top: Math.min(edges.top, r.top), bottom: Math.max(edges.bottom, r.bottom) }
          : { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
      }
    }
    return edges;
  };

  /**
   * Dépassement du texte : horizontal d'après les rectangles du texte (ellipse : dès le bord du contenu) ; vertical
   * d'après le défilement (lignes de trop, hauteur fixe), confirmé par le texte (la boîte de police d'une ligne serrée
   * dépasse un peu sans rien couper)
   */
  const measureText = (el: HTMLElement, nodes: readonly Text[]): { dx: number; dy: number } | null => {
    const text = textEdges(nodes);
    if (!text) return null;
    const s = style(el);
    const { padding, content } = boxesOf(el);
    const edgeX = truncatesX(s) ? content : padding;
    const edgeY = clampsLines(s) ? content : padding;
    const dx = positive(edgeX.left - text.left) + positive(text.right - edgeX.right);
    const scrollDy = el.scrollHeight - el.clientHeight;
    const textDy = positive(edgeY.top - text.top) + positive(text.bottom - edgeY.bottom);
    const dy = scrollDy > TOLERANCE && textDy > TOLERANCE ? Math.max(scrollDy, textDy) : 0;
    return { dx: round(dx), dy: round(dy) };
  };

  /** Même mesure sur une copie de l'élément (même largeur et hauteur, mêmes styles hérités) avec un autre texte */
  const measureWith = (el: HTMLElement, nodes: readonly Text[], replacement: string): { dx: number; dy: number } | null => {
    const parent = el.parentElement;
    if (!parent) return null;
    const pathOf = (node: Node): number[] => {
      const steps: number[] = [];
      for (let current: Node = node; current !== el && current.parentNode; current = current.parentNode) steps.unshift([...current.parentNode.childNodes].indexOf(current as ChildNode));
      return steps;
    };
    const clone = el.cloneNode(true) as HTMLElement;
    const copies = nodes.map((node) => pathOf(node).reduce<Node | undefined>((at, i) => at?.childNodes[i], clone));
    copies.forEach((copy, i) => {
      if (copy instanceof Text) copy.data = i === 0 ? replacement : '';
    });
    for (const withId of [clone, ...clone.querySelectorAll('[id]')]) withId.removeAttribute('id');
    const rect = el.getBoundingClientRect();
    clone.style.cssText += `;position:absolute;visibility:hidden;pointer-events:none;left:0;top:0;margin:0;transform:none;flex:none;box-sizing:border-box;width:${rect.width}px;min-width:0;max-width:none;height:${rect.height}px;min-height:0;max-height:none`;
    parent.append(clone);
    try {
      const texts = copies.filter((copy): copy is Text => copy instanceof Text && copy.data.length > 0);
      return measureText(clone, texts);
    } finally {
      clone.remove();
    }
  };

  /** Texte relevé : clés du catalogue, origine et, s'il contient des données, dépassement du texte du catalogue seul */
  const judgeText = (
    text: string,
    remeasure: ((catalogOnly: string) => { dx: number; dy: number } | null) | null,
  ): Pick<LayoutIssue, 'keys' | 'source' | 'flagged' | 'catalogDx' | 'catalogDy'> => {
    const attribution = attributeText(text, index, isData);
    if (!attribution) return { keys: [], source: isData(text) ? 'data' : 'other', flagged: false };
    const keys = [...new Set(attribution.keys)].slice(0, 4);
    if (attribution.data === 0 || !remeasure) return { keys, source: attribution.data === 0 ? 'catalog' : 'mixed', flagged: true };
    const alone = remeasure(attribution.catalogOnly);
    if (!alone) return { keys, source: 'mixed', flagged: true };
    return { keys, source: 'mixed', flagged: alone.dx > TOLERANCE || alone.dy > TOLERANCE, catalogDx: alone.dx, catalogDy: alone.dy };
  };

  /** Texte d'un élément (bloc compris) pour l'identifier, sans les zones masquées */
  const visibleText = (el: Element): string => {
    const parts: string[] = [];
    const walk = (node: Node): void => {
      for (const child of node.childNodes) {
        if (child instanceof Text) parts.push(child.data);
        else if (child instanceof HTMLElement && isVisible(child)) walk(child);
      }
    };
    walk(el);
    return normalizeText(parts.join(''));
  };

  /**
   * Textes qui dépassent d'un bord : texte en ligne de chaque porteur dont un nœud texte franchit `limit` (sinon tout
   * le texte de l'élément)
   */
  const stickingTexts = (el: Element, limit: Edges): string[] => {
    const range = document.createRange();
    const outside: string[] = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!(node instanceof Text) || !node.data.trim()) continue;
      const parent = node.parentElement;
      if (!parent || !isVisible(parent)) continue;
      range.selectNodeContents(node);
      if ([...range.getClientRects()].some((r) => r.width > 0 && (r.right > limit.right + TOLERANCE || r.left < limit.left - TOLERANCE))) {
        const carrier = carrierOf(parent);
        const text = visibleInline(carrier);
        if (text && !outside.includes(text)) outside.push(text);
      }
    }
    if (outside.length > 0) return outside;
    const all = visibleText(el);
    return all ? [all] : [];
  };

  /** Élément visible : ni masqué, ni transparent, ni réservé aux lecteurs d'écran (sr-only) */
  const isVisible = (el: HTMLElement): boolean => {
    const s = style(el);
    return s.display !== 'none' && s.visibility === 'visible' && !isTransparent(el) && !/inset\(50%/.test(s.clipPath);
  };
  /** Porteur du texte : premier ancêtre (ou lui-même) qui n'est pas en ligne */
  const carrierOf = (el: HTMLElement): HTMLElement => {
    let current: HTMLElement = el;
    while (current.parentElement && ['inline', 'contents'].includes(style(current).display)) current = current.parentElement;
    return current;
  };
  const visibleInline = (el: Element): string => normalizeText(inlineTextNodes(el).map((node) => node.data).join(''));

  /** Parent de mise en page : ancêtre le plus proche qui a une boîte (display: contents traversé) */
  const layoutParent = (el: Element): HTMLElement | null => {
    let parent = el.parentElement;
    while (parent && style(parent).display === 'contents') parent = parent.parentElement;
    return parent;
  };

  /** Zone défilante horizontale voulue (classe Tailwind explicite) : ses enfants peuvent dépasser */
  const scrollsSideways = (el: Element): boolean => /(^|\s)overflow-x-(auto|scroll)(\s|$)/.test(el.getAttribute('class') ?? '');

  /** Bloc conteneur d'un élément positionné (absolute : ancêtre positionné ou transformé ; fixed : la fenêtre) */
  const containingBlock = (el: Element, position: string): Element | null => {
    if (position === 'fixed') return null;
    for (let parent = el.parentElement; parent; parent = parent.parentElement) {
      const s = style(parent);
      if (s.position !== 'static' || s.transform !== 'none' || s.filter !== 'none') return parent;
    }
    return document.documentElement;
  };

  const hasOffset = (s: CSSStyleDeclaration): boolean =>
    s.position === 'relative' && [s.left, s.right, s.top, s.bottom].some((value) => value !== 'auto' && px(value) !== 0);

  /** Décor : élément (ou ancêtre) masqué aux lecteurs d'écran */
  const isDecorative = (el: Element): boolean => el.closest('[aria-hidden="true"]') !== null;

  const outside = (left: number, right: number, limit: Edges): boolean => right > limit.right + TOLERANCE || left < limit.left - TOLERANCE;

  /** L'élément ou l'un de ses textes franchit un bord horizontal de `limit` */
  const sticksOut = (el: Element, limit: Edges): boolean => {
    const rect = el.getBoundingClientRect();
    if (outside(rect.left, rect.right, limit)) return true;
    const text = textEdges(inlineTextNodes(el));
    return text !== null && outside(text.left, text.right, limit);
  };

  /** Élément affiché le plus profond (hors décor) qui franchit un bord de `limit`, ou dont le texte le franchit */
  const deepestOutside = (container: Element, limit: Edges): HTMLElement | null => {
    let found: HTMLElement | null = null;
    for (const el of container.querySelectorAll('*')) {
      if (!isShown(el) || isDecorative(el) || !sticksOut(el, limit)) continue;
      // Ordre du document : un descendant de l'élément retenu le remplace (plus précis)
      if (!found || found.contains(el)) found = el;
    }
    return found;
  };

  return {
    style,
    isShown,
    boxesOf,
    truncatesX,
    clampsLines,
    inlineTextNodes,
    measureText,
    measureWith,
    judgeText,
    visibleText,
    stickingTexts,
    layoutParent,
    scrollsSideways,
    containingBlock,
    hasOffset,
    isDecorative,
    sticksOut,
    deepestOutside,
  };
}

function cssPath(el: Element): string {
  const parts: string[] = [];
  for (let node: Element | null = el; node && node !== document.body && node !== document.documentElement && parts.length < 8; node = node.parentElement) {
    let part = node.tagName.toLowerCase();
    if (node.id) {
      parts.unshift(`${part}#${node.id}`);
      return parts.join(' > ');
    }
    const role = node.getAttribute('role');
    if (role) part += `[role=${role}]`;
    const parent: Element | null = node.parentElement;
    if (parent) {
      const same = [...parent.children].filter((child) => child.tagName === node?.tagName);
      if (same.length > 1) part += `:nth-of-type(${same.indexOf(node) + 1})`;
    }
    parts.unshift(part);
  }
  return parts.join(' > ');
}

function focusOf(el: Element): string | null {
  const own = el.closest('[data-focus]')?.getAttribute('data-focus');
  if (own) return own;
  const near = el.closest('li, article, [role="group"], section')?.querySelector('[data-focus]')?.getAttribute('data-focus');
  return near ? `~${near}` : null;
}

function rectOf(el: Element): LayoutIssue['rect'] {
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) };
}

export function createProbe(): LayoutProbe {
  let index: CatalogIndex = indexCatalog({});
  let isData: (fragment: string) => boolean = () => false;
  let lastElements: Element[] = [];

  function scan(scope?: string): LayoutIssue[] {
    const root = scope === undefined ? null : document.querySelector(scope);
    if (scope !== undefined && !root) throw new Error(`Zone du relevé absente : ${scope}`);
    /** Éléments relevés : toute la page, ou la zone et ses descendants */
    const scanned = root ? [root, ...root.querySelectorAll('*')] : [...document.body.querySelectorAll('*')];
    const scanner = createScanner(index, isData);
    const { style } = scanner;
    const issues: LayoutIssue[] = [];
    const elements: Element[] = [];
    const add = (el: Element, issue: Omit<LayoutIssue, 'id' | 'path' | 'focus' | 'rect'>): void => {
      elements.push(el);
      issues.push({ ...issue, id: issues.length + 1, path: cssPath(el), focus: focusOf(el), rect: rectOf(el) });
    };
    /** Enfants qui dépassent, regroupés par parent : une seule anomalie par rangée trop étroite ou boîte trop basse */
    const overflowing = new Map<HTMLElement, { child: HTMLElement; dx: number; dy: number }[]>();

    for (const el of scanned) {
      if (!scanner.isShown(el)) continue;
      const s = style(el);

      // ─── Texte de l'élément (hors champs : leur texte n'est pas mis en page dans le DOM) ───
      const field = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement;
      if (s.display !== 'inline' && !field) {
        const nodes = scanner.inlineTextNodes(el);
        const text = normalizeText(nodes.map((node) => node.data).join(''));
        if (/[\p{L}\p{N}]/u.test(text)) {
          const measured = scanner.measureText(el, nodes);
          if (measured && (measured.dx > TOLERANCE || measured.dy > TOLERANCE)) {
            const kind: LayoutIssueKind =
              (measured.dx > TOLERANCE && scanner.truncatesX(s)) || (measured.dy > TOLERANCE && scanner.clampsLines(s))
                ? 'truncated'
                : (measured.dx > TOLERANCE && s.overflowX !== 'visible') || (measured.dy > TOLERANCE && s.overflowY !== 'visible')
                  ? 'clipped'
                  : 'spill';
            const verdict = scanner.judgeText(text, (catalogOnly) => scanner.measureWith(el, nodes, catalogOnly));
            add(el, { kind, dx: measured.dx, dy: measured.dy, text: snippet(text), ...verdict });
          }
        }
      }

      // ─── Texte indicatif d'un champ d'une ligne ───
      if (el instanceof HTMLInputElement && SINGLE_LINE_INPUTS.has(el.type) && el.placeholder && el.value === '') {
        const probe = document.createElement('span');
        probe.textContent = el.placeholder;
        for (const prop of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontStretch', 'letterSpacing', 'wordSpacing', 'textTransform'] as const) probe.style[prop] = s[prop];
        probe.style.cssText += ';position:absolute;visibility:hidden;white-space:pre;left:0;top:0';
        document.body.append(probe);
        const width = probe.getBoundingClientRect().width;
        probe.remove();
        const available = el.clientWidth - px(s.paddingLeft) - px(s.paddingRight);
        const dx = round(width - available);
        if (dx > TOLERANCE) add(el, { kind: 'placeholder', dx, dy: 0, text: snippet(normalizeText(el.placeholder)), ...scanner.judgeText(el.placeholder, null) });
      }

      // ─── Boîte de l'élément ───
      if (s.display === 'inline' || s.transform !== 'none' || scanner.hasOffset(s)) continue;
      if (s.position === 'absolute' || s.position === 'fixed') {
        // Décor (masqué aux lecteurs d'écran) : dépassement voulu
        if (el.closest('[aria-hidden="true"]')) continue;
        const limit: Edges = { left: 0, right: document.documentElement.clientWidth, top: 0, bottom: 0 };
        const block = scanner.containingBlock(el, s.position);
        for (let clip: Element | null = block; clip && clip !== document.documentElement; clip = clip.parentElement) {
          if (!(clip instanceof HTMLElement) || style(clip).overflowX === 'visible') continue;
          const { padding } = scanner.boxesOf(clip);
          limit.left = Math.max(limit.left, padding.left);
          limit.right = Math.min(limit.right, padding.right);
        }
        const rect = el.getBoundingClientRect();
        const dx = round(positive(rect.right - limit.right) + positive(limit.left - rect.left));
        if (dx > TOLERANCE) {
          const texts = scanner.stickingTexts(el, limit);
          add(el, { kind: 'offscreen', dx, dy: 0, text: snippet(texts.join(' | ')), ...boxVerdict(scanner, texts) });
        }
        continue;
      }
      const parent = scanner.layoutParent(el);
      if (!parent || parent === document.documentElement || parent === document.body) continue;
      const ps = style(parent);
      if (ps.display === 'inline' || scanner.truncatesX(ps) || scanner.clampsLines(ps)) continue;
      const { content } = scanner.boxesOf(parent);
      const rect = el.getBoundingClientRect();
      // Marge négative : débord voulu (pleine largeur dans un conteneur à marge intérieure). Verticalement, seul un
      // parent de hauteur imposée (bouton h-8, pastille h-[18px]…) peut être dépassé ; une zone qui défile ne l'est pas
      const dx = scanner.scrollsSideways(parent)
        ? 0
        : positive(rect.right - content.right - positive(-px(s.marginRight))) + positive(content.left - rect.left - positive(-px(s.marginLeft)));
      const dy =
        ps.overflowY === 'auto' || ps.overflowY === 'scroll'
          ? 0
          : positive(rect.bottom - content.bottom - positive(-px(s.marginBottom))) + positive(content.top - rect.top - positive(-px(s.marginTop)));
      if (dx > TOLERANCE || dy > TOLERANCE) {
        const list = overflowing.get(parent) ?? [];
        list.push({ child: el, dx, dy });
        overflowing.set(parent, list);
      }
    }

    // Une anomalie par parent : l'enfant qui dépasse le plus, textes de tous ceux qui dépassent
    for (const [parent, children] of overflowing) {
      const size = (excess: { dx: number; dy: number }): number => Math.max(excess.dx, excess.dy);
      const worst = children.reduce((a, b) => (size(b) > size(a) ? b : a));
      const { content } = scanner.boxesOf(parent);
      const texts = [...new Set(children.flatMap(({ child }) => scanner.stickingTexts(child, content)))];
      const dx = round(Math.max(...children.map((child) => child.dx)));
      const dy = round(Math.max(...children.map((child) => child.dy)));
      add(worst.child, { kind: 'overflow', dx, dy, text: snippet(texts.join(' | ')), ...boxVerdict(scanner, texts) });
    }

    // Document et zones défilantes plus larges que leur partie visible, sans coupable déjà signalé à l'intérieur : le
    // coupable est un texte relevé mais ignoré (donnée trop longue) ou l'élément le plus profond qui dépasse ; un
    // dépassement de décor seul (masqué aux lecteurs d'écran) n'est pas une anomalie
    const recorded = (): { el: Element; flagged: boolean }[] => elements.map((el, i) => ({ el, flagged: issues[i]?.flagged === true }));
    const containers = (root ? scanned : [document.documentElement, document.body, ...scanned]).filter((el): el is HTMLElement => {
      if (!(el instanceof HTMLElement)) return false;
      if (el !== document.documentElement && el !== document.body && !scanner.isShown(el)) return false;
      const s = style(el);
      return (el === document.documentElement || s.overflowX !== 'visible') && !scanner.truncatesX(s) && !scanner.clampsLines(s) && !scanner.scrollsSideways(el);
    });
    for (const container of containers) {
      const dx = container.scrollWidth - container.clientWidth;
      if (dx <= TOLERANCE || recorded().some(({ el, flagged }) => flagged && container.contains(el))) continue;
      const limit: Edges =
        container === document.documentElement ? { left: 0, right: container.clientWidth, top: 0, bottom: 0 } : scanner.boxesOf(container).padding;
      const culprit =
        recorded().find(({ el }) => container.contains(el) && scanner.sticksOut(el, limit))?.el ?? scanner.deepestOutside(container, limit);
      if (!culprit) continue;
      const texts = scanner.stickingTexts(culprit, limit);
      add(culprit, { kind: 'scroll', dx, dy: 0, text: snippet(texts.join(' | ')), ...boxVerdict(scanner, texts) });
    }

    lastElements = elements;
    return issues;
  }

  function highlight(ids: readonly number[]): void {
    document.getElementById(OVERLAY_ID)?.remove();
    if (ids.length === 0) return;
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;pointer-events:none;z-index:2147483647';
    for (const id of ids) {
      const el = lastElements[id - 1];
      if (!el?.isConnected) continue;
      const r = el.getBoundingClientRect();
      const box = document.createElement('div');
      box.style.cssText = `position:absolute;left:${r.left + scrollX - 1}px;top:${r.top + scrollY - 1}px;width:${r.width + 2}px;height:${r.height + 2}px;outline:2px solid #ff2d55;outline-offset:0`;
      const label = document.createElement('span');
      label.textContent = String(id);
      label.style.cssText = 'position:absolute;right:-2px;top:-14px;padding:0 3px;background:#ff2d55;color:#fff;font:700 10px/13px system-ui,sans-serif;border-radius:3px';
      box.append(label);
      overlay.append(box);
    }
    document.body.append(overlay);
  }

  function expand(on: boolean): void {
    document.getElementById(EXPAND_ID)?.remove();
    if (!on) {
      document.getElementById(OVERLAY_ID)?.remove();
      return;
    }
    const sheet = document.createElement('style');
    sheet.id = EXPAND_ID;
    sheet.textContent = [
      'html, body, #app { height: auto !important; max-height: none !important; overflow: visible !important; }',
      'main, [role="tabpanel"], .sk-scroll { height: auto !important; max-height: none !important; flex: none !important; overflow: visible !important; }',
    ].join('\n');
    document.head.append(sheet);
  }

  return {
    configure({ catalog, data }) {
      index = indexCatalog(catalog);
      isData = createDataMatcher(data);
    },
    scan,
    highlight,
    expand,
  };
}

/**
 * Clés et origine des textes d'un élément qui dépasse de sa boîte. Toujours signalé, quelle que soit l'origine : une
 * donnée trop longue qui pousse une rangée hors de l'écran casse aussi la mise en page (à corriger dans le CSS)
 */
function boxVerdict(scanner: ReturnType<typeof createScanner>, texts: readonly string[]): Pick<LayoutIssue, 'keys' | 'source' | 'flagged'> {
  const verdicts = texts.filter((text) => countLetters(text) > 0).map((text) => scanner.judgeText(text, null));
  const keys = [...new Set(verdicts.flatMap((verdict) => verdict.keys))].slice(0, 4);
  const catalog = verdicts.some((verdict) => verdict.source === 'catalog' || verdict.source === 'mixed');
  const data = verdicts.some((verdict) => verdict.source === 'data' || verdict.source === 'mixed');
  const source: TextSource = verdicts.length === 0 ? 'none' : catalog ? (data ? 'mixed' : 'catalog') : data ? 'data' : 'other';
  return { keys, source, flagged: true };
}

export function install(): void {
  window.__skLayout = createProbe();
}
