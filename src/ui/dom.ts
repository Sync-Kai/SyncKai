export type Child = Node | string | null | undefined | false;

/** Retire les enfants "vides" (null, undefined, false) pour replaceChildren / append */
export function nodes(children: Child[]): (Node | string)[] {
  return children.filter((child): child is Node | string => child !== null && child !== undefined && child !== false);
}

type EventHandlers = { [K in keyof HTMLElementEventMap]?: (event: HTMLElementEventMap[K]) => void };

interface ElementProps {
  class?: string;
  attrs?: Record<string, string>;
  on?: EventHandlers;
}

/** Élément marqué indisponible par `busyAttrs` (aria-disabled) : il garde le focus mais ses clics sont ignorés */
function isAriaDisabled(el: Element): boolean {
  return el.getAttribute('aria-disabled') === 'true';
}

/** Clic sur un élément aria-disabled : action annulée (envoi de formulaire, lien) et écouteurs suivants court-circuités */
function blockAriaDisabledClick(event: Event): void {
  if (!(event.currentTarget instanceof Element) || !isAriaDisabled(event.currentTarget)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
}

/**
 * Crée un élément DOM. Les chaînes enfants sont insérées comme nœuds texte (jamais d'innerHTML),
 * ce qui protège contre l'injection de HTML venant des API.
 */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: ElementProps = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props.class) el.className = props.class;
  // `style` par le CSSOM : la CSP des pages (sans 'unsafe-inline') refuse un attribut style posé par setAttribute
  for (const [name, value] of Object.entries(props.attrs ?? {})) {
    if (name === 'style') el.style.cssText = value;
    else el.setAttribute(name, value);
  }
  // Garde posée avant les autres écouteurs : un bouton aria-disabled (action en cours) ne relance rien
  if (tag === 'button' || props.on?.click) el.addEventListener('click', blockAriaDisabledClick);
  for (const [type, handler] of Object.entries(props.on ?? {})) {
    el.addEventListener(type, handler as EventListener);
  }
  el.append(...nodes(children));
  return el;
}

/**
 * Attributs d'un bouton dont l'action est en cours (envoi, enregistrement…) : `aria-disabled` plutôt que `disabled`,
 * pour que le bouton reste focalisable (le focus clavier n'est pas perdu pendant l'envoi). `h()` ignore ses clics.
 * Un bouton sans objet (rien à faire) garde `disabled`.
 */
export function busyAttrs(busy: boolean, ariaBusy = false): Record<string, string> {
  if (!busy) return {};
  return ariaBusy ? { 'aria-disabled': 'true', 'aria-busy': 'true' } : { 'aria-disabled': 'true' };
}

/**
 * Clé où rendre le focus après un nouveau rendu : l'élément lui-même s'il est toujours disponible, sinon le repli
 * déclaré (`data-focus-fallback`), sinon le voisin suivant puis précédent dans l'ordre d'avant le rendu.
 */
export function pickFocusKey(key: string, before: readonly string[], fallbacks: readonly string[], available: (key: string) => boolean): string | null {
  if (available(key)) return key;
  const declared = fallbacks.find(available);
  if (declared !== undefined) return declared;
  const index = before.indexOf(key);
  if (index < 0) return null;
  const after = before.slice(index + 1).find((k) => k !== key && available(k));
  if (after !== undefined) return after;
  return before.slice(0, index).reverse().find((k) => k !== key && available(k)) ?? null;
}

function focusKeyOf(el: Element): string | undefined {
  return el instanceof HTMLElement ? el.dataset.focus : undefined;
}

/** Éléments focalisables (ni désactivés, ni dans une zone masquée) par clé data-focus, le premier pour chaque clé */
function focusableByKey(container: HTMLElement): Map<string, HTMLElement> {
  const map = new Map<string, HTMLElement>();
  for (const el of container.querySelectorAll<HTMLElement>('[data-focus]')) {
    const key = el.dataset.focus;
    if (key && !map.has(key) && !el.matches(':disabled') && el.closest('[hidden], [inert]') === null) map.set(key, el);
  }
  return map;
}

/**
 * Redessine `container` via `draw` en conservant le focus clavier : l'élément actif est retrouvé après coup par son
 * attribut data-focus (les vues sont recréées, pas mises à jour). Élément retiré ou désactivé : le focus passe au
 * repli `data-focus-fallback` (porté par l'élément ou un ancêtre) ou au voisin le plus proche, jamais sur <body>.
 */
export function preserveFocus(container: HTMLElement, draw: () => void): void {
  const active = document.activeElement;
  const inside = active instanceof HTMLElement && container.contains(active);
  const key = inside ? active.dataset.focus : undefined;
  const before = key ? [...container.querySelectorAll('[data-focus]')].flatMap((el) => focusKeyOf(el) ?? []) : [];
  // Replis déclarés de l'élément actif jusqu'au conteneur inclus, du plus proche au plus lointain
  const fallbacks: string[] = [];
  for (let el: HTMLElement | null = inside ? active : null; el; el = el === container ? null : el.parentElement) {
    if (el.dataset.focusFallback) fallbacks.push(el.dataset.focusFallback);
  }
  draw();
  // Élément toujours présent (non recréé) : le focus n'a pas bougé, sauf s'il a été déplacé (élément persistant
  // réinséré, ex : la zone de texte du commentaire) : il le retrouve, curseur compris
  if (active?.isConnected) {
    const lost = document.activeElement === null || document.activeElement === document.body;
    if (key && lost && active instanceof HTMLElement && container.contains(active)) active.focus({ preventScroll: true });
    return;
  }
  if (!key) return;
  // Focus déjà rendu dans le conteneur (preserveFocus imbriqué)
  const current = document.activeElement;
  if (current instanceof HTMLElement && current !== document.body && container.contains(current)) return;
  const focusable = focusableByKey(container);
  const target = pickFocusKey(key, before, fallbacks, (k) => focusable.has(k));
  if (target !== null) focusable.get(target)?.focus({ preventScroll: true });
}
