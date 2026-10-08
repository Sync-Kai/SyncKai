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

/** Fenêtre de navigateur : barre d'adresse (texte facultatif) puis zone de contenu */
function browserWindow(left: number, top: number, width: number, height: number, address: string | null): { node: HTMLElement; body: HTMLElement } {
  const win = el('div', 'window browser', { left: px(left), top: px(top), width: px(width), height: px(height) });
  const bar = el('div', 'browser-bar');
  const dots = el('div', 'dots');
  dots.append(el('i', ''), el('i', ''), el('i', ''));
  const omni = el('div', 'omnibox');
  if (address) {
    const text = el('span', 'address');
    text.textContent = address;
    omni.append(text);
  } else omni.append(el('b', '', { width: '34%' }));
  const kai = el('span', 'ext kai small');
  const img = el('img', '');
  img.src = kaiIcon;
  img.alt = '';
  kai.append(img);
  bar.append(dots, omni, kai);
  const body = el('div', 'browser-body');
  win.append(bar, body);
  return { node: win, body };
}

const SP_ICONS =
  '<svg class="sp-caret" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
  '<span class="grow"></span>' +
  '<svg viewBox="0 0 24 24"><path d="M15 4l5 5-3 1-4 4 1 4-2 2-4-4-4 4M9 11l4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
  '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

/** En-tête du panneau latéral de Chrome (icône, nom de l'extension, épingle, fermeture) */
function sidePanelHeader(): HTMLElement {
  const head = el('div', 'sp-head');
  const img = el('img', '');
  img.src = kaiIcon;
  img.alt = '';
  const name = el('span', 'sp-name');
  name.textContent = 'SyncKai';
  head.append(img, name);
  head.insertAdjacentHTML('beforeend', SP_ICONS);
  return head;
}

type PanelTabName = 'nowPlaying' | 'agenda';
const SP_HEAD = 36;

/** Panneau latéral (vraie page du panneau, sous l'en-tête Chrome si `chromeHeader`), `width` × `height` px à l'écran */
function sidePanel(tab: PanelTabName, width: number, height: number, zoom: number, chromeHeader: boolean, revealRelations = false): HTMLElement {
  const box = el('div', 'sp', { width: px(width), height: px(height) });
  const src = `./sidepanel.html?locale=${locale}&tab=${tab}&zoom=${zoom}${revealRelations ? '&reveal=relations' : ''}`;
  if (chromeHeader) box.append(sidePanelHeader(), frame(src, width, height - SP_HEAD));
  else box.append(frame(src, width, height));
  return box;
}

/** Page de lecture Crunchyroll simulée : lecteur, titre de l'épisode, épisodes suivants en traits */
function watchPage(width: number): HTMLElement {
  const page = el('div', 'watch-page', { width: px(width) });
  page.append(frame(`./player.html?locale=${locale}&kind=watch`, width, Math.round((width * 9) / 16)));
  const info = el('div', 'watch-info');
  const series = el('span', 'watch-series');
  series.textContent = 'Frieren: Beyond Journey’s End';
  const ep = el('span', 'watch-ep');
  ep.textContent = 'S1 E27';
  info.append(series, ep, el('b', '', { width: '82%' }), el('b', '', { width: '64%' }));
  const next = el('div', 'watch-next');
  for (let i = 0; i < 3; i++) {
    const row = el('div', 'watch-row');
    row.append(el('i', ''), el('span', ''));
    next.append(row);
  }
  page.append(info, next);
  return page;
}

const BROWSER_BAR = 46;

/** Capture 2 : page de lecture Crunchyroll, panneau latéral ancré à droite */
function sidePanelScene(): HTMLElement {
  const width = 744;
  const height = 772;
  const panelWidth = 420;
  const { node, body } = browserWindow(1244 - width, 14, width, height, 'crunchyroll.com/watch/…');
  body.classList.add('split');
  body.append(watchPage(width - panelWidth - 1), sidePanel('nowPlaying', panelWidth, height - BROWSER_BAR, 1, false, true));
  return node;
}

/** Capture 3 : panneau latéral seul, onglet « Agenda » */
function agendaScene(): HTMLElement {
  const zoom = 1.2;
  const width = Math.round(380 * zoom);
  const height = 724;
  const win = el('div', 'window', { left: px(1232 - width), top: px(38), width: px(width), height: px(height) });
  win.append(sidePanel('agenda', width, height, zoom, true));
  return win;
}

/** Capture 5 : page « Importer depuis Crunchyroll » (aperçu) dans un onglet */
function importScene(): HTMLElement {
  const zoom = 1;
  const width = 640;
  const height = 736;
  const { node, body } = browserWindow(1240 - width, 32, width, height, null);
  body.append(frame(`./import-cr.html?locale=${locale}&zoom=${zoom}`, width, height - BROWSER_BAR));
  return node;
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
  box.style.width = px(520);
  // Popup (carte « Sur cette page ») et, devant, le panneau latéral (« En lecture ») : rognés en bas
  const w = POPUP.width;
  const h = POPUP.height;
  const popup = el('div', 'window', { left: px(636), top: px(48), width: px(w), height: px(h) });
  popup.append(frame(popupSrc('page', 1), w, h));
  const panelWidth = 372;
  const panel = el('div', 'window', { left: px(MARQUEE.width - 56 - panelWidth), top: px(92), width: px(panelWidth), height: px(MARQUEE.height - 92 + 40) });
  panel.append(sidePanel('nowPlaying', panelWidth, MARQUEE.height - 92 + 40, 1, true));
  return [logo, box, popup, panel];
}

function shotParts(): HTMLElement[] {
  const logo = el('img', 'lockup');
  logo.src = lockup;
  logo.alt = 'SyncKai';
  switch (shot) {
    case 1:
      return [logo, copy(440, true), player('sync')];
    case 2:
      return [logo, copy(400, true), sidePanelScene()];
    case 3:
      return [logo, copy(600), agendaScene()];
    case 4:
      return [logo, copy(600), ...popupWindow('page', 1232, 80, null)];
    case 5:
      return [logo, copy(480, true), importScene()];
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
