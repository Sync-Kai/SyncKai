// Composition d'une capture 1280×800 (ou de la tuile promo 1400×560, `?shot=marquee`) :
// légende + vraie UI (popup ou bulle sur lecteur) dans des iframes.
import kaiIcon from '../../assets/brand/kai-icon-32.svg?url';
import lockup from '../../assets/brand/kai-lockup-dark.svg?url';
import { CAPTIONS, MARQUEE, SHOT_IDS, type Caption } from './captions';
import { localeParam, markReady, param, waitFor } from './params';

const marquee = param('shot') === 'marquee';
const shot = SHOT_IDS.find((s) => String(s) === param('shot')) ?? 1;
// La tuile promo n'est pas localisable sur le Store : toujours en anglais
const locale = marquee ? 'en' : localeParam();
const caption: Caption = CAPTIONS[locale][shot];
const canvas = document.querySelector<HTMLElement>('#canvas');
if (!canvas) throw new Error('#canvas introuvable');
document.documentElement.lang = locale;

const POPUP = { width: 400, height: 580, zoom: 1.2 };

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, style: Partial<CSSStyleDeclaration> = {}): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  Object.assign(node.style, style);
  return node;
}

const px = (n: number): string => `${n}px`;

/** Titre avec mot(s) mis en valeur entre astérisques */
function headline(text: string): HTMLElement {
  const h1 = el('h1', 'headline');
  text.split(/(\*[^*]+\*)/).forEach((part) => {
    if (!part) return;
    if (part.startsWith('*')) {
      const span = el('span', 'accent');
      span.textContent = part.slice(1, -1);
      h1.append(span);
    } else h1.append(part);
  });
  return h1;
}

function copy(width: number, compact = false): HTMLElement {
  const box = el('div', compact ? 'copy compact' : 'copy', { width: px(width) });
  const eyebrow = el('span', 'eyebrow');
  eyebrow.textContent = caption.eyebrow;
  const sub = el('p', 'sub');
  sub.textContent = caption.sub;
  box.append(eyebrow, headline(caption.title), sub);
  return box;
}

function frame(src: string, width: number, height: number): HTMLIFrameElement {
  const iframe = el('iframe', 'frame', { width: px(width), height: px(height) });
  iframe.src = src;
  return iframe;
}

const popupSrc = (scenario: string, zoom = POPUP.zoom): string => `./popup.html?locale=${locale}&scenario=${scenario}&zoom=${zoom}`;

/** Barre d'outils minimale : icône Kai mise en avant (le popup en descend) */
function toolbar(left: number, top: number, width: number, badge: string | null): { node: HTMLElement; kaiCenter: number } {
  const bar = el('div', 'toolbar', { left: px(left), top: px(top), width: px(width) });
  const dots = el('div', 'dots');
  dots.append(el('i', ''), el('i', ''), el('i', ''));
  const omni = el('div', 'omnibox');
  omni.append(el('b', '', { width: '34%' }));
  const puzzle = el('span', 'ext');
  puzzle.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M10 4a2 2 0 1 1 4 0v2h4v4h-2a2 2 0 1 0 0 4h2v4h-4v-2a2 2 0 1 0-4 0v2H6v-4h2a2 2 0 1 0 0-4H6V6h4z"/></svg>';
  const kai = el('span', 'ext kai');
  const img = el('img', '');
  img.src = kaiIcon;
  img.alt = '';
  kai.append(img);
  if (badge) {
    const b = el('span', 'badge');
    b.textContent = badge;
    kai.append(b);
  }
  bar.append(dots, omni, puzzle, kai);
  // Icône Kai : dernier élément, padding droit 14 px, 34 px de large
  return { node: bar, kaiCenter: left + width - 14 - 17 };
}

function popupWindow(scenario: string, right: number, top: number, badge: string | null): HTMLElement[] {
  const w = POPUP.width * POPUP.zoom;
  const h = POPUP.height * POPUP.zoom;
  const bar = toolbar(600, 22, 1240 - 600, badge);
  const win = el('div', 'window', { left: px(right - w), top: px(top), width: px(w), height: px(h) });
  win.append(frame(popupSrc(scenario), w, h));
  return [bar.node, win];
}

function player(kind: 'sync' | 'rate'): HTMLElement {
  const width = 680;
  const height = Math.round((width * 9) / 16);
  const box = el('div', 'player', { left: px(1232 - width), top: px((800 - height) / 2), width: px(width), height: px(height) });
  box.append(frame(`./player.html?locale=${locale}&kind=${kind}&toastZoom=1.5`, width, height));
  return box;
}


/** Ligne « Crunchyroll · ADN → AniList · MyAnimeList » de la tuile promo */
function flow(): HTMLElement {
  const row = el('div', 'flow');
  const pill = (text: string, tone: string): HTMLElement => {
    const span = el('span', `pill ${tone}`);
    span.textContent = text;
    return span;
  };
  const arrow = el('span', 'arrow');
  arrow.textContent = '→';
  row.append(pill('Crunchyroll', 'stream'), pill('ADN', 'stream'), arrow, pill('AniList', 'tracker'), pill('MyAnimeList', 'tracker'));
  return row;
}

/** Tuile promo 1400×560 : lockup, accroche, flux des services, popup réel rogné en bas à droite */
function marqueeParts(): HTMLElement[] {
  document.documentElement.classList.add('marquee');
  const logo = el('img', 'lockup');
  logo.src = lockup;
  logo.alt = 'SyncKai';
  const box = el('div', 'copy');
  const sub = el('p', 'sub');
  sub.textContent = MARQUEE.sub;
  box.append(headline(MARQUEE.title), sub, flow());
  const zoom = 1.1;
  const w = POPUP.width * zoom;
  const h = POPUP.height * zoom;
  const win = el('div', 'window', { left: px(MARQUEE.width - 96 - w), top: px(56), width: px(w), height: px(h) });
  win.append(frame(popupSrc('watching', zoom), w, h));
  return [logo, box, win];
}

function shotParts(): HTMLElement[] {
  const logo = el('img', 'lockup');
  logo.src = lockup;
  logo.alt = 'SyncKai';
  switch (shot) {
    case 1:
      return [logo, copy(440, true), player('sync')];
    case 2:
      return [logo, copy(600), ...popupWindow('page', 1232, 80, null)];
    case 3:
      return [logo, copy(600), ...popupWindow('menu', 1232, 80, null)];
    case 4:
      return [logo, copy(600), ...popupWindow('compare', 1232, 80, null)];
    case 5:
      return [logo, copy(600), ...popupWindow('activity', 1232, 80, '1')];
  }
}

canvas.append(...(marquee ? marqueeParts() : shotParts()));

// Prêt quand chaque iframe a terminé son rendu
await Promise.all(
  [...document.querySelectorAll('iframe')].map((iframe) =>
    waitFor(() => iframe.contentDocument?.documentElement.dataset.ready === '1', 20_000),
  ),
);
await markReady();
