// Annonces des messages d'erreur aux lecteurs d'écran. Les vues sont recréées à chaque rendu : un élément
// role="alert" réinséré serait relu à chaque fois. Les alertes visibles portent donc seulement `data-alert`
// (leur texte) et une région live unique, créée une fois par page, annonce chaque message nouvellement affiché.

export interface AnnouncerState {
  /** Messages visibles au dernier relevé */
  shown: ReadonlySet<string>;
  /** Texte actuel de la région live */
  text: string;
}

/**
 * Prochain état de la région live : les messages apparus depuis le dernier relevé sont annoncés ; quand plus aucun
 * message annoncé n'est visible, la région est vidée (un message qui revient sera de nouveau annoncé).
 */
export function nextAnnouncement(state: AnnouncerState, visible: readonly string[]): AnnouncerState {
  const shown = new Set(visible.filter((message) => message.length > 0));
  const fresh = [...shown].filter((message) => !state.shown.has(message));
  if (fresh.length > 0) return { shown, text: fresh.join(' ') };
  const stillShown = state.text.length > 0 && [...state.shown].some((message) => shown.has(message) && state.text.includes(message));
  return { shown, text: stillShown ? state.text : '' };
}

let region: HTMLElement | null = null;
let state: AnnouncerState = { shown: new Set(), text: '' };

/** Relevé des alertes visibles (hors zones masquées) après chaque lot de modifications du DOM */
function scan(): void {
  if (!region) return;
  const visible = [...document.querySelectorAll<HTMLElement>('[data-alert]')].filter((el) => el.closest('[hidden], [inert]') === null).map((el) => el.dataset.alert ?? '');
  state = nextAnnouncement(state, visible);
  if (region.textContent !== state.text) region.textContent = state.text;
}

/** Crée la région live de la page au premier message (sans DOM ni MutationObserver, en test : rien) */
function ensureAnnouncer(): void {
  if (region || typeof document === 'undefined' || typeof MutationObserver !== 'function' || !document.body) return;
  region = document.createElement('div');
  region.className = 'sr-only';
  region.setAttribute('role', 'alert');
  region.setAttribute('aria-atomic', 'true');
  region.dataset.liveRegion = '';
  document.body.append(region);
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'inert', 'data-alert'] });
  queueMicrotask(scan);
}

/** Attributs d'un message d'erreur affiché : annoncé une seule fois, tant qu'il reste à l'écran */
export function alertAttrs(message: string): Record<string, string> {
  ensureAnnouncer();
  return { 'data-alert': message };
}
