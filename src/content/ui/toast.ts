import { t } from '../../i18n/content';
import type { TrackerId } from '../../shared/tracker.types';
import { happyKai } from '../../ui/kai-small';
// Feuille du Shadow DOM, minifiée au build : charte « Kotatsu », logos AniList / MyAnimeList dessinés (aucune image de
// l'extension exposée aux sites)
import STYLES from './toast.css?inline';

export type ToastTone = 'info' | 'success' | 'warning' | 'error';
/** bubble : bulle complète (Kai, titre, sous-titre, lignes, action) ; pill : pastille compacte = première ligne de la bulle */
export type ToastVariant = 'bubble' | 'pill';
/**
 * Pastille d'état dans le coin de Kai : synchro en cours (points), écrit (coche menthe), déjà à jour (coche lavande), rien
 * fait volontairement (tiret gris), attention, erreur, information, note (étoile), revisionnage. Absente : celle du ton
 */
export type ToastBadge = 'sync' | 'ok' | 'same' | 'off' | 'warn' | 'error' | 'info' | 'star' | 'rewatch';
/** Pastille du logo d'une ligne de service : écrit, déjà à jour, ignoré, échec */
export type ToastLineTone = 'ok' | 'neutral' | 'warning' | 'error';

/** Ligne de service d'une bulle : « AniList · enregistré », ou « AniList et MyAnimeList · statut Terminé » (même résultat) */
export interface ToastLine {
  services: TrackerId[];
  label: string;
  text: string;
  tone: ToastLineTone;
}

export interface ToastContent {
  tone: ToastTone;
  badge?: ToastBadge;
  /** Ce qui vient de se passer (« Épisode 6 enregistré ») */
  title: string;
  /** Série · épisode (bulle) ; pastille : après le titre */
  subtitle?: string;
  /** Explication sous le sous-titre (bulle) ; pastille : après le titre, faute de sous-titre */
  message?: string;
  /** Détail par service (bulle uniquement) */
  lines?: ToastLine[];
  /** Action principale (sakura, à droite, ex : « Réessayer ») */
  action?: { label: string; onClick: () => void };
  /** Contrôle interactif sous le texte (bulle uniquement, ex : notation) */
  body?: Node;
  /** Autres boutons, dans l'ordre affiché : discrets (texte) puis principal (sakura, à droite) */
  actions?: ToastAction[];
}

export interface ToastAction {
  label: string;
  kind: 'primary' | 'ghost';
  onClick: () => void;
}

/** close : bouton × ; timeout : fermeture automatique ; replaced : un autre toast prend la place ; programmatic : dismiss() */
export type ToastDismissReason = 'close' | 'timeout' | 'replaced' | 'programmatic';

export interface ToastOptions {
  variant?: ToastVariant;
  /** Fermeture automatique (sinon le toast reste affiché) */
  autoHideMs?: number;
  /** Appelé une fois à la fermeture ; une mise à jour sans ce rappel l'annule */
  onDismiss?: (reason: ToastDismissReason) => void;
}

export interface ToastHandle {
  /** Remplace le contenu (et éventuellement la forme) du toast */
  update(content: ToastContent, options?: ToastOptions): void;
  dismiss(reason?: ToastDismissReason): void;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
/** Durée de la sortie (fondu, voir toast.css), avant de retirer l'hôte de la page */
const EXIT_MS = 120;

// ─── Règles (testées sans DOM) ─────────────────────────────────────────────

/** Distance au haut de la fenêtre : 72 px, 56 px dans une fenêtre de moins de 600 px de haut */
export function toastTop(viewportHeight: number): number {
  return viewportHeight < 600 ? 56 : 72;
}

/** Ce qui décide du remplacement : bulle qui attend un clic (bouton, notation), alerte (à vérifier, erreur) */
export interface ToastPresence {
  waitsForClick: boolean;
  alert: boolean;
}

function isAlert(tone: ToastTone): boolean {
  return tone === 'warning' || tone === 'error';
}

export function presenceOf(content: ToastContent): ToastPresence {
  return { waitsForClick: Boolean(content.action || content.actions?.length || content.body), alert: isAlert(content.tone) };
}

/** Une seule bulle : la suivante la remplace, sauf une simple information face à une bulle qui attend un clic */
export function canReplace(current: ToastPresence | null, next: ToastPresence): boolean {
  return !current?.waitsForClick || next.waitsForClick || next.alert;
}

export type HoldReason = 'hover' | 'focus';

export interface ToastTimer {
  /** Nouveau délai (remplace le précédent) ; `undefined` garde le toast affiché */
  arm(ms: number | undefined): void;
  /** Pointeur ou focus dans la bulle : délai en pause tant qu'une raison tient */
  hold(reason: HoldReason, held: boolean): void;
}

/**
 * Fermeture automatique qui ne court que page visible (2-R12 : dans un onglet caché, l'animation d'entrée ne s'exécute pas,
 * le toast n'a jamais été vu) et hors pointeur / focus ; le temps restant est gardé pendant une pause. `onRun` suit l'état
 * (barre de délai). Rien après `signal`.
 */
export function createToastTimer(
  doc: EventTarget & { visibilityState: DocumentVisibilityState },
  signal: AbortSignal,
  onTimeout: () => void,
  onRun: (running: boolean) => void = () => undefined,
): ToastTimer {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let remaining: number | undefined;
  let startedAt = 0;
  let running = false;
  const holds = new Set<HoldReason>();
  const sync = (): void => {
    const run = remaining !== undefined && !signal.aborted && doc.visibilityState !== 'hidden' && holds.size === 0;
    if (run === running) return;
    running = run;
    if (run) {
      startedAt = Date.now();
      timer = setTimeout(onTimeout, remaining);
    } else {
      clearTimeout(timer);
      if (remaining !== undefined) remaining = Math.max(0, remaining - (Date.now() - startedAt));
    }
    onRun(run);
  };
  doc.addEventListener('visibilitychange', sync, { signal });
  signal.addEventListener('abort', () => clearTimeout(timer), { once: true });
  return {
    arm(ms) {
      clearTimeout(timer);
      running = false;
      remaining = ms;
      sync();
    },
    hold(reason, held) {
      if (held) holds.add(reason);
      else holds.delete(reason);
      sync();
    },
  };
}

// ─── Rendu ─────────────────────────────────────────────────────────────────

/** Élément HTML, ses enfants ajoutés tels quels (texte ou nœuds, jamais de HTML interprété) */
function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  node.append(...children);
  return node;
}

function hidden<T extends Element>(node: T): T {
  node.setAttribute('aria-hidden', 'true');
  return node;
}

type SvgAttrs = Record<string, string | number>;

/** Élément SVG construit sans innerHTML (pas d'injection possible dans la page) */
function svg(tag: string, attrs: SvgAttrs, children: SVGElement[] = []): SVGElement {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  node.append(...children);
  return node;
}

const CHECK = 'M2.6 5.3 4.4 7.1 7.6 3.3';
const BANG = 'M5 2.2v3.2|M5 7.6h0';
/**
 * Pictogramme de chaque pastille (repère 10×10) : tracés séparés par « | », « * » = tracé plein ; un point est un trait
 * de longueur nulle (bout arrondi)
 */
const GLYPHS: Record<ToastBadge, string> = {
  sync: 'M2.3 5h0|M5 5h0|M7.7 5h0',
  ok: CHECK,
  same: CHECK,
  off: 'M2.7 5h4.6',
  warn: BANG,
  error: BANG,
  info: 'M5 2.6h0|M5 4.6v3.1',
  star: '*M5 1.6 5.95 3.75 8.25 3.95 6.5 5.45 7.05 7.75 5 6.5 2.95 7.75 3.5 5.45 1.75 3.95 4.05 3.75Z',
  rewatch: 'M8 5.4A3 3 0 1 1 5 2.2|*M4.5.6 7 2.2 4.5 3.8Z',
};

const BADGE_OF_TONE: Record<ToastTone, ToastBadge> = { info: 'info', success: 'ok', warning: 'warn', error: 'error' };

/** Kai et sa pastille d'état (taille fixée par la feuille : pas de Tailwind dans le Shadow DOM) */
function avatar(content: ToastContent): HTMLElement {
  const badge = content.badge ?? BADGE_OF_TONE[content.tone];
  const paths = GLYPHS[badge].split('|').map((d) => (d.startsWith('*') ? svg('path', { class: 'f', d: d.slice(1) }) : svg('path', { d })));
  return hidden(el('span', 'avatar', happyKai(''), el('span', `badge ${badge}`, svg('svg', { class: 'glyph', viewBox: '0 0 10 10' }, paths))));
}

/** Logo 16 px dessiné (AniList : « A » clair devant un « L » bleu ; MyAnimeList : « MAL » sur fond bleu) */
function serviceLogo(service: TrackerId): SVGElement {
  const logo = svg('svg', { class: `logo ${service}`, width: 16, height: 16, viewBox: '0 0 16 16' }, [svg('rect', { width: 16, height: 16 })]);
  if (service === 'anilist') {
    logo.append(
      svg('path', { class: 'l', d: 'M7.4 4H10v6.5h4V13H7.4Z' }),
      svg('path', { class: 'a', 'fill-rule': 'evenodd', d: 'M5.3 4h2.4l3 9H8.5L8 11H5.1l-.6 2H2.3Zm1.2 2.2L5.7 9h1.6Z' }),
    );
  } else {
    const text = svg('text', { x: 8, y: 10.2, 'text-anchor': 'middle' });
    text.textContent = 'MAL';
    logo.append(text);
  }
  return logo;
}

/** Une ligne par résultat : logos (avec la pastille du résultat), noms en gras, puis le résultat */
function serviceLines(lines: ToastLine[]): HTMLElement {
  return el(
    'ul',
    'lines',
    ...lines.map((line) =>
      el(
        'li',
        'line',
        hidden(el('span', 'logos', ...line.services.map((service) => el('span', '', serviceLogo(service), el('span', `dot ${line.tone}`))))),
        el('span', 'line-text', el('span', 'line-label', line.label), ` · ${line.text}`),
      ),
    ),
  );
}

function button(className: string, onClick: () => void, ...children: (Node | string)[]): HTMLButtonElement {
  const node = el('button', className, ...children);
  node.type = 'button';
  node.onclick = onClick;
  return node;
}

function renderPill(toast: HTMLElement, content: ToastContent): void {
  toast.append(avatar(content), el('span', 'title', content.title));
  const rest = content.subtitle ?? content.message;
  if (rest) toast.append(el('span', 'sub', `· ${rest}`));
}

/** Bulle ; retourne la barre de délai (bulles à bouton), absente sinon */
function renderBubble(toast: HTMLElement, content: ToastContent, autoHideMs: number | undefined, onClose: () => void): HTMLElement | null {
  const text = el('div', 'text', el('span', 'title', content.title));
  if (content.subtitle) text.append(el('span', 'sub', content.subtitle));
  if (content.message) text.append(el('span', 'message', content.message));
  const close = button('close', onClose, svg('svg', { width: 12, height: 12, viewBox: '0 0 24 24' }, [svg('path', { d: 'M6 6 L18 18 M18 6 L6 18' })]));
  close.setAttribute('aria-label', t('common.close'));
  toast.append(el('div', 'head', avatar(content), text, close));
  if (content.lines?.length) toast.append(serviceLines(content.lines));
  if (content.body) toast.append(el('div', 'slot', content.body));

  // Discrètes d'abord (dans l'ordre donné), l'action principale sakura à droite
  const actions = [...(content.actions ?? []), ...(content.action ? [{ ...content.action, kind: 'primary' }] : [])];
  if (actions.length > 0) toast.append(el('div', 'actions', ...actions.map((a) => button(`action ${a.kind}`, a.onClick, a.label))));
  if ((actions.length === 0 && !content.body) || autoHideMs === undefined) return null;
  const fill = el('i', '');
  fill.style.animationDuration = `${autoHideMs}ms`;
  toast.append(hidden(el('span', 'timer', fill)));
  return fill;
}
// ─── Bulle unique de la page ───────────────────────────────────────────────

/** Hôte affiché : un seul à la fois, son contenu remplacé sur place */
interface Surface {
  host: HTMLElement;
  toast: HTMLElement;
  controller: AbortController;
  hovered: boolean;
  focused: boolean;
  /** Barre de délai du contenu affiché */
  bar: HTMLElement | null;
}

interface Owner {
  handle: ToastHandle;
  presence: ToastPresence;
  timer: ToastTimer;
}

let surface: Surface | null = null;
let owner: Owner | null = null;

/**
 * Hôte en Shadow DOM fermé, en haut à droite ; en plein écran, seul l'élément plein écran est visible : le toast y est
 * déplacé. Pointeur et focus dans la bulle mettent le délai du contenu affiché en pause.
 */
function openSurface(): Surface {
  const host = document.createElement('div');
  const shadow = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = STYLES;
  const toast = el('div', 'toast');
  toast.setAttribute('aria-live', 'polite');
  shadow.append(style, toast);

  const controller = new AbortController();
  const { signal } = controller;
  const opened: Surface = { host, toast, controller, hovered: false, focused: false, bar: null };
  const attach = (): void => {
    (document.fullscreenElement ?? document.body).append(host);
  };
  const place = (): void => {
    toast.style.top = `${toastTop(window.innerHeight)}px`;
  };
  const hold = (reason: HoldReason, held: boolean): void => {
    if (reason === 'hover') opened.hovered = held;
    else opened.focused = held;
    owner?.timer.hold(reason, held);
  };
  for (const type of ['mouseenter', 'mouseleave']) toast.addEventListener(type, () => hold('hover', type === 'mouseenter'), { signal });
  toast.addEventListener('focusin', () => hold('focus', true), { signal });
  toast.addEventListener(
    'focusout',
    (event) => {
      if (!(event.relatedTarget instanceof Node && toast.contains(event.relatedTarget))) hold('focus', false);
    },
    { signal },
  );
  // Bouton cliqué (avant son action) : la bulle a eu son clic, la progression qui suit (« Réessayer ») peut la remplacer
  toast.addEventListener(
    'click',
    (event) => {
      if (owner && event.target instanceof Element && event.target.closest('.action')) owner.presence = { ...owner.presence, waitsForClick: false };
    },
    { capture: true, signal },
  );
  document.addEventListener('fullscreenchange', attach, { signal });
  window.addEventListener('resize', place, { signal });
  attach();
  place();
  // Classe « visible » à la frame suivante : déclenche l'entrée (fondu + 6 px)
  requestAnimationFrame(() => toast.classList.add('visible'));
  return opened;
}

function closeSurface(closed: Surface): void {
  closed.controller.abort();
  closed.toast.classList.remove('visible');
  setTimeout(() => closed.host.remove(), EXIT_MS); // Laisse la sortie se terminer
  if (surface === closed) surface = null;
}

/** Toast refusé (bulle à bouton affichée) : rien n'apparaît, sauf une alerte portée par une mise à jour */
const REFUSED: ToastHandle = {
  update(next, nextOptions) {
    if (isAlert(next.tone)) showToast(next, nextOptions);
  },
  dismiss: () => undefined,
};

/**
 * Affiche le toast de la page : une seule bulle, la suivante remplace son contenu sur place. Une bulle qui attend un clic
 * n'est jamais chassée par une simple information (rien n'est affiché, une alerte passe). Aucun focus pris.
 */
export function showToast(content: ToastContent, options: ToastOptions = {}): ToastHandle {
  const presence = presenceOf(content);
  if (owner && !canReplace(owner.presence, presence)) return REFUSED;

  const shown = surface ?? (surface = openSurface());
  const controller = new AbortController();
  const timer = createToastTimer(
    document,
    controller.signal,
    () => handle.dismiss('timeout'),
    (running) => {
      shown.toast.classList.toggle('held', !running);
      if (shown.bar) shown.bar.style.animationPlayState = running ? 'running' : 'paused';
    },
  );
  // Pointeur ou focus déjà dans la bulle remplacée : le nouveau délai part en pause
  if (shown.hovered) timer.hold('hover', true);
  if (shown.focused) timer.hold('focus', true);
  let onDismiss: ToastOptions['onDismiss'];

  const handle: ToastHandle = {
    update(next, nextOptions = {}) {
      // Toast déjà fermé ou remplacé (ex : clic sur × pendant la synchro) : une alerte doit quand même apparaître
      if (controller.signal.aborted) {
        if (isAlert(next.tone)) showToast(next, nextOptions);
        return;
      }
      self.presence = presenceOf(next);
      const variant = nextOptions.variant ?? 'bubble';
      // Contenu reconstruit à chaque mise à jour : la forme peut changer (progression → résultat)
      const { toast } = shown;
      // État de l'hôte gardé : entrée déjà jouée, délai en pause (pointeur ou focus)
      const kept = ['visible', 'held'].filter((name) => toast.classList.contains(name));
      toast.replaceChildren();
      toast.className = ['toast', variant, ...kept].join(' ');
      toast.setAttribute('role', next.tone === 'error' ? 'alert' : 'status');
      if (variant === 'pill') {
        renderPill(toast, next);
        shown.bar = null;
      } else {
        shown.bar = renderBubble(toast, next, nextOptions.autoHideMs, () => handle.dismiss('close'));
      }
      onDismiss = nextOptions.onDismiss;
      timer.arm(nextOptions.autoHideMs);
    },
    dismiss(reason = 'programmatic') {
      if (controller.signal.aborted) return;
      controller.abort();
      onDismiss?.(reason);
      if (owner !== self) return;
      owner = null;
      if (reason !== 'replaced') closeSurface(shown);
    },
  };
  const self: Owner = { handle, presence, timer };

  owner?.handle.dismiss('replaced');
  owner = self;
  handle.update(content, options);
  return handle;
}
