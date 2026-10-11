import { t } from '../../i18n/content';
import { kai } from '../../ui/icons';

export type ToastTone = 'info' | 'success' | 'warning' | 'error';
/** bubble : bulle complète (Kai, titre, détail, action) ; pill : pastille compacte de succès */
export type ToastVariant = 'bubble' | 'pill';
/** Pastille de couleur devant une ligne de détail */
export type ToastLineTone = 'ok' | 'neutral' | 'warning' | 'error';

/** Ligne de détail d'une bulle : "AniList · épisode 2 enregistré" */
export interface ToastLine {
  label: string;
  text: string;
  tone: ToastLineTone;
}

export interface ToastContent {
  tone: ToastTone;
  title: string;
  message?: string;
  /** Détail par service (bulle uniquement) */
  lines?: ToastLine[];
  /** Bouton d'action (ex : "Réessayer") */
  action?: { label: string; onClick: () => void };
  /** Contrôle interactif sous le texte (bulle uniquement, ex : notation) */
  body?: Node;
  /** Boutons alignés à droite, après `action` : principal (sakura) ou discret */
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
const FONT_STACK = `"M PLUS Rounded 1c", "Nunito", ui-rounded, system-ui, sans-serif`;

// Palette "Yoru Mochi" — styles isolés dans un Shadow DOM : ni la page ne les écrase, ni ils ne fuient
const STYLES = `
  :host { all: initial; }
  .toast {
    --surface: #211C2E; --raised: #2C2640; --border: #3D3554; --text: #F4EFFA; --muted: #B3A9C9;
    --sakura: #FF8FB8; --lavender: #B9A4FF; --butter: #FFD37A; --mint: #7EE0C3; --danger: #FF8A8A;
    --on-fill: #1A0F1C; --sticker: 2px 2px 0 rgba(0, 0, 0, 0.45);
    position: fixed; right: 24px; bottom: 96px; z-index: 2147483647; box-sizing: border-box;
    border: 1px solid var(--border); box-shadow: var(--sticker);
    color: var(--text); font: 600 12px/16px ${FONT_STACK};
    opacity: 0; transform: translateY(8px); transition: opacity 0.2s ease, transform 0.2s ease;
  }
  .toast.visible { opacity: 1; transform: none; }
  .toast * { box-sizing: border-box; }

  /* Bulle */
  .bubble {
    width: 280px; padding: 10px 8px 12px 12px; border-radius: 14px; background: var(--raised);
    display: flex; flex-direction: column; gap: 8px;
  }
  .head { display: flex; align-items: flex-start; gap: 10px; }
  .avatar { flex: none; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border-radius: 999px; }
  .avatar.warning { background: var(--butter); }
  .avatar.error { background: var(--danger); }
  .info .avatar svg { animation: bob 1.2s ease-in-out infinite; }
  .body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .brand { font-weight: 800; font-size: 10px; line-height: 13px; letter-spacing: 1px; text-transform: uppercase; color: var(--muted); }
  .title { font-weight: 700; font-size: 13px; line-height: 17px; overflow-wrap: anywhere; }
  .message { color: var(--muted); overflow-wrap: anywhere; }
  .lines { list-style: none; margin: 0; padding: 0 4px 0 0; display: flex; flex-direction: column; gap: 4px; }
  .line { display: flex; align-items: center; gap: 8px; }
  .dot { flex: none; width: 8px; height: 8px; border-radius: 999px; }
  .dot.ok { background: var(--mint); }
  .dot.neutral { background: var(--lavender); }
  .dot.warning { background: var(--butter); }
  .dot.error { background: var(--danger); }
  .line-label { font-weight: 700; }
  .line-text { color: var(--muted); overflow-wrap: anywhere; }
  .actions { display: flex; justify-content: flex-end; gap: 4px; }
  .slot { display: flex; padding-left: 30px; }
  .action {
    height: 30px; padding: 0 14px; border: none; border-radius: 999px; background: var(--sakura); color: var(--on-fill);
    box-shadow: var(--sticker); font: 700 12px/1 ${FONT_STACK}; cursor: pointer;
  }
  .action:active { transform: translate(1px, 1px); box-shadow: 1px 1px 0 rgba(0, 0, 0, 0.45); }
  .action.ghost { background: transparent; color: var(--muted); box-shadow: none; }
  .action.ghost:hover { background: var(--border); color: var(--text); }
  .action.ghost:active { transform: none; }

  /* Notation 10 étoiles (boutons demi-étoile, voir ui/star-rating) : étoile de 18 px, zone cliquable de 24 px de haut */
  .stars { display: flex; align-items: center; gap: 6px; min-width: 0; }
  .stars-row { display: flex; flex: none; }
  .star { width: 18px; height: 24px; }
  .stars-value { flex: none; min-width: 36px; font-weight: 800; font-size: 12px; line-height: 16px; font-variant-numeric: tabular-nums; color: var(--butter); }
  .star-outline { fill: none; stroke: var(--muted); stroke-width: 1.6; }
  .star-fill { fill: var(--butter); stroke: var(--butter); stroke-width: 1.6; }
  .star-half { cursor: pointer; border-radius: 4px; }
  .star-half:focus-visible { outline: 2px solid var(--lavender); outline-offset: -2px; }
  .close {
    flex: none; width: 28px; height: 28px; margin: -4px -2px 0 0; padding: 0; border: none; border-radius: 999px;
    background: transparent; display: flex; align-items: center; justify-content: center; cursor: pointer;
  }
  .close:hover { background: var(--border); }
  .action:focus-visible, .close:focus-visible { outline: 2px solid var(--lavender); outline-offset: 2px; }
  .tail { position: absolute; top: 100%; right: 28px; margin-top: -1px; }

  /* Pastille */
  .pill {
    height: 32px; max-width: 320px; padding: 0 12px 0 8px; border-radius: 999px; background: rgba(33, 28, 46, 0.92);
    display: flex; align-items: center; gap: 6px; white-space: nowrap;
  }
  .pill .title { flex: none; font-size: 12px; line-height: 16px; overflow-wrap: normal; }
  .pill .message { min-width: 0; overflow: hidden; text-overflow: ellipsis; }

  @keyframes bob { 50% { transform: translateY(-2px); } }
  @media (prefers-reduced-motion: reduce) {
    .toast { transition: none; transform: none; }
    .info .avatar svg { animation: none; }
  }
`;

let current: ToastHandle | null = null;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
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

function icon(size: number, viewBox: string, children: SVGElement[], extra: SvgAttrs = {}): SVGElement {
  return svg('svg', { width: size, height: size, viewBox, 'aria-hidden': 'true', ...extra }, children);
}

/** Mascotte Kai ravie (24 px, dessin simplifié) — taille fixée en attributs : pas de Tailwind dans le Shadow DOM */
function kaiIcon(): SVGElement {
  const mascot = kai('', { expression: 'happy', size: 'small' });
  mascot.setAttribute('width', '24');
  mascot.setAttribute('height', '24');
  return mascot;
}

function warningIcon(): SVGElement {
  return icon(14, '0 0 24 24', [
    svg('path', { d: 'M12 3.5 L21 19.5 H3 Z', fill: 'none', stroke: '#1A0F1C', 'stroke-width': 2.4, 'stroke-linejoin': 'round' }),
    svg('path', { d: 'M12 10 V13.5', stroke: '#1A0F1C', 'stroke-width': 2.4, 'stroke-linecap': 'round' }),
    svg('circle', { cx: 12, cy: 16.6, r: 1.3, fill: '#1A0F1C' }),
  ]);
}

function errorIcon(): SVGElement {
  return icon(12, '0 0 24 24', [svg('path', { d: 'M12 5 V13 M12 19 V19.2', stroke: '#1A0F1C', 'stroke-width': 4, 'stroke-linecap': 'round' })], {
    fill: 'none',
  });
}

function checkIcon(): SVGElement {
  return icon(16, '0 0 24 24', [
    svg('circle', { cx: 12, cy: 12, r: 11, fill: '#7EE0C3' }),
    svg('path', { d: 'M7 12.5 L10.5 16 L17 8.5', fill: 'none', stroke: '#1A0F1C', 'stroke-width': 2.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
  ], { style: 'flex: none' });
}

function closeIcon(): SVGElement {
  return icon(12, '0 0 24 24', [svg('path', { d: 'M6 6 L18 18 M18 6 L6 18' })], {
    fill: 'none', stroke: '#B3A9C9', 'stroke-width': 3, 'stroke-linecap': 'round',
  });
}

/** Petite queue de bulle, orientée vers le bas à droite */
function tailIcon(): SVGElement {
  return svg('svg', { class: 'tail', width: 16, height: 10, viewBox: '0 0 16 10', 'aria-hidden': 'true' }, [
    svg('path', { d: 'M0 0 L10 9 L16 0 Z', fill: '#2C2640' }),
    svg('path', { d: 'M0.5 0 L10 9 L15.5 0', fill: 'none', stroke: '#3D3554', 'stroke-width': 1, 'stroke-linejoin': 'round' }),
  ]);
}

/** Avatar de la bulle : Kai, ou pictogramme coloré quand il faut agir */
function avatarFor(tone: ToastTone): HTMLElement {
  const avatar = el('span', `avatar ${tone}`);
  avatar.setAttribute('aria-hidden', 'true');
  avatar.append(tone === 'warning' ? warningIcon() : tone === 'error' ? errorIcon() : kaiIcon());
  return avatar;
}

function renderPill(toast: HTMLElement, content: ToastContent): void {
  toast.append(checkIcon(), el('span', 'title', content.title));
  if (content.message) toast.append(el('span', 'message', `· ${content.message}`));
}

function actionButton(label: string, kind: ToastAction['kind'], onClick: () => void): HTMLButtonElement {
  const button = el('button', kind === 'ghost' ? 'action ghost' : 'action', label);
  button.type = 'button';
  button.onclick = () => onClick();
  return button;
}

function renderBubble(toast: HTMLElement, content: ToastContent, onClose: () => void): void {
  const head = el('div', 'head');
  const body = el('div', 'body');
  body.append(el('span', 'brand', 'SyncKai'), el('span', 'title', content.title));
  if (content.message) body.append(el('span', 'message', content.message));

  const close = el('button', 'close');
  close.type = 'button';
  close.setAttribute('aria-label', t('common.close'));
  close.append(closeIcon());
  close.onclick = onClose;

  head.append(avatarFor(content.tone), body, close);
  toast.append(head);

  if (content.lines?.length) {
    const list = el('ul', 'lines');
    for (const line of content.lines) {
      const item = el('li', 'line');
      const dot = el('span', `dot ${line.tone}`);
      dot.setAttribute('aria-hidden', 'true');
      const text = el('span', '');
      text.append(el('span', 'line-label', line.label), el('span', 'line-text', ` · ${line.text}`));
      item.append(dot, text);
      list.append(item);
    }
    toast.append(list);
  }

  if (content.body) {
    const slot = el('div', 'slot');
    slot.append(content.body);
    toast.append(slot);
  }

  const buttons = [
    ...(content.action ? [actionButton(content.action.label, 'primary', content.action.onClick)] : []),
    ...(content.actions ?? []).map((a) => actionButton(a.label, a.kind, a.onClick)),
  ];
  if (buttons.length > 0) {
    const actions = el('div', 'actions');
    actions.append(...buttons);
    toast.append(actions);
  }
  toast.append(tailIcon());
}

function isAlert(tone: ToastTone): boolean {
  return tone === 'warning' || tone === 'error';
}

/**
 * Affiche un toast unique (le précédent est remplacé).
 * En plein écran, seul l'élément plein écran est visible : le toast y est donc déplacé.
 */
export function showToast(content: ToastContent, options: ToastOptions = {}): ToastHandle {
  current?.dismiss('replaced');

  const host = document.createElement('div');
  const shadow = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = STYLES;
  const toast = el('div', 'toast');
  toast.setAttribute('aria-live', 'polite');
  shadow.append(style, toast);

  const controller = new AbortController();
  let hideTimer: ReturnType<typeof setTimeout> | undefined;
  let onDismiss: ToastOptions['onDismiss'];

  const attach = (): void => {
    (document.fullscreenElement ?? document.body).append(host);
  };

  const handle: ToastHandle = {
    update(next, nextOptions = {}) {
      // Toast déjà fermé (ex : clic sur × pendant la synchro) : une alerte doit quand même apparaître
      if (controller.signal.aborted) {
        if (isAlert(next.tone)) showToast(next, nextOptions);
        return;
      }
      const variant = nextOptions.variant ?? 'bubble';
      // Contenu reconstruit à chaque mise à jour : la forme peut changer (progression → résultat)
      toast.replaceChildren();
      toast.className = `toast visible ${variant} ${next.tone}`;
      toast.setAttribute('role', next.tone === 'error' ? 'alert' : 'status');
      if (variant === 'pill') renderPill(toast, next);
      else renderBubble(toast, next, () => handle.dismiss('close'));

      onDismiss = nextOptions.onDismiss;
      clearTimeout(hideTimer);
      if (nextOptions.autoHideMs !== undefined) hideTimer = setTimeout(() => handle.dismiss('timeout'), nextOptions.autoHideMs);
    },
    dismiss(reason = 'programmatic') {
      if (controller.signal.aborted) return;
      controller.abort();
      onDismiss?.(reason);
      clearTimeout(hideTimer);
      toast.classList.remove('visible');
      setTimeout(() => host.remove(), 200); // Laisse la transition de sortie se terminer
      if (current === handle) current = null;
    },
  };

  document.addEventListener('fullscreenchange', attach, { signal: controller.signal });

  attach();
  handle.update(content, options);
  // Classe "visible" retirée puis remise à la frame suivante pour déclencher l'animation d'entrée
  toast.classList.remove('visible');
  requestAnimationFrame(() => toast.classList.add('visible'));

  current = handle;
  return handle;
}
