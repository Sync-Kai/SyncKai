// Composition d'une capture 1280×800 (ou de la tuile promo 1400×560, `?shot=marquee`), direction C « Duo / éditorial » :
// dos avec kana, colonne de texte, vraie UI (popup, panneau, page d'import, bulle sur lecteur) en carte flottante.
import { kai } from '../../src/ui/icons';
import { PLATFORMS } from '../../src/platforms/registry';
import { CAPTIONS, KANA, MARQUEE, SHOT_IDS } from './captions';
import { localeParam, markReady, param, waitFor } from './params';

const marquee = param('shot') === 'marquee';
const shot = SHOT_IDS.find((s) => String(s) === param('shot')) ?? 1;
// La tuile promo n'est pas localisable sur le Store : toujours en anglais
const locale = marquee ? 'en' : localeParam();
const canvas = document.querySelector<HTMLElement>('#canvas');
if (!canvas) throw new Error('#canvas introuvable');
document.documentElement.lang = locale;

const POPUP = { width: 400, height: 580 };

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, style: Partial<CSSStyleDeclaration> = {}): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  Object.assign(node.style, style);
  return node;
}

const px = (n: number): string => `${n}px`;

/** Boîte positionnée : gauche, haut, largeur, hauteur */
interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

const place = (box: Box): Partial<CSSStyleDeclaration> => ({ left: px(box.left), top: px(box.top), width: px(box.width), height: px(box.height) });

/** Dos : kana vertical en filigrane, coupé par le bord gauche, et filet qui le sépare de la colonne de texte */
function spine(kana: string): HTMLElement[] {
  const box = el('div', 'spine');
  box.setAttribute('aria-hidden', 'true');
  const text = el('div', 'spine-kana');
  text.textContent = kana;
  box.append(text);
  return [box, el('div', 'spine-rule')];
}

/** Surface de droite et disque derrière l'UI ; `discTop` : disque remonté (et rogné par le haut) */
function stage(discTop?: number): HTMLElement[] {
  return [el('div', 'stage'), el('div', 'disc', discTop === undefined ? {} : { top: px(discTop) })];
}

/** Lockup : Kai, « SyncKai », kana de la marque */
function lockup(): HTMLElement {
  const box = el('div', 'lockup');
  const name = el('span', 'lockup-name');
  name.textContent = 'SyncKai';
  const kana = el('span', 'lockup-kana');
  kana.textContent = 'シンカイ';
  box.append(kai('', { size: 'small', expression: 'happy' }), name, kana);
  return box;
}

/** Titre : `\n` = retour à la ligne, `*mot*` = mise en valeur (peut couvrir un retour à la ligne) */
function headline(text: string): HTMLElement {
  const h1 = el('h1', 'headline');
  text.split(/(\*[^*]+\*)/).forEach((part) => {
    if (!part) return;
    const accent = part.startsWith('*');
    const target = accent ? el('span', 'accent') : h1;
    (accent ? part.slice(1, -1) : part).split('\n').forEach((line, i) => {
      if (i > 0) target.append(document.createElement('br'));
      if (line) target.append(line);
    });
    if (accent) h1.append(target);
  });
  return h1;
}

/** Colonne de texte : surtitre + kana sakura, titre, filet, sous-titre */
function copy(text: { eyebrow: string; kana: string; title: string; sub: string }): HTMLElement {
  const box = el('div', 'copy');
  const eyebrow = el('div', 'eyebrow');
  const label = el('span', '');
  label.textContent = text.eyebrow;
  const kana = el('span', 'eyebrow-kana');
  kana.textContent = text.kana;
  eyebrow.append(label, kana);
  const sub = el('p', 'sub');
  sub.textContent = text.sub;
  box.append(eyebrow, headline(text.title), el('div', 'rule'), sub);
  return box;
}

const ARROW =
  '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="#b3a9c9" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h15M13 6l6 6-6 6"/></svg>';

/** Rangée de logos : les cinq plateformes → AniList / MyAnimeList (public/brands) */
function serviceFlow(): HTMLElement {
  const row = el('div', 'services');
  const logo = (src: string, alt: string): HTMLImageElement => Object.assign(el('img', ''), { src, alt });
  row.append(...(['crunchyroll', 'adn', 'netflix', 'disney', 'prime'] as const).map((p) => logo(PLATFORMS[p].icon, PLATFORMS[p].label)));
  row.insertAdjacentHTML('beforeend', ARROW);
  row.append(logo('/brands/anilist.png', 'AniList'), logo('/brands/myanimelist.svg', 'MyAnimeList'));
  return row;
}

function frame(src: string, width: number, height: number): HTMLIFrameElement {
  const iframe = el('iframe', 'frame', { width: px(width), height: px(height) });
  iframe.src = src;
  return iframe;
}

/** Carte flottante (coins arrondis, ombre douce) contenant une vraie page de l'extension */
function card(box: Box, src: string, variant = ''): HTMLElement {
  const node = el('div', `card ${variant}`.trim(), place(box));
  node.append(frame(src, box.width, box.height));
  return node;
}

const popupSrc = (scenario: string, zoom: number): string => `./popup.html?locale=${locale}&scenario=${scenario}&zoom=${zoom}`;
const panelSrc = (tab: 'nowPlaying' | 'agenda', zoom: number, extra = ''): string => `./sidepanel.html?locale=${locale}&tab=${tab}&zoom=${zoom}${extra}`;

/** Iframe de la bulle : la bulle s'y place en bas à gauche (player-frame.ts, `layer=toast`), le reste est transparent */
const BUBBLE = { width: 487, height: 230 };

/**
 * Capture 1 : lecteur au générique, bulle de synchro (×1,6) posée au-dessus, débordant de son coin haut droit ; le bas
 * de la bulle reste juste au-dessus du titre du lecteur, quelle que soit sa hauteur (ligne repliée en allemand)
 */
function syncScene(): HTMLElement[] {
  const player: Box = { left: 636, top: 326, width: 560, height: 315 };
  const bubble = el('iframe', 'bubble', place({ left: 1232 - BUBBLE.width, top: player.top + 8 - BUBBLE.height, ...BUBBLE }));
  bubble.src = `./player.html?locale=${locale}&kind=sync&layer=toast&toastZoom=1.6`;
  return [card(player, `./player.html?locale=${locale}&kind=sync&layer=scene`, 'player'), bubble];
}

/** Capture 2 : lecteur (lecture en cours) en arrière-plan, panneau latéral « En lecture » devant, à côté */
function sidePanelScene(): HTMLElement[] {
  const player: Box = { left: 636, top: 56, width: 540, height: 304 };
  const panel: Box = { left: 844, top: 128, width: 392, height: 636 };
  return [card(player, `./player.html?locale=${locale}&kind=watch&layer=scene`, 'player'), card(panel, panelSrc('nowPlaying', 1), 'panel')];
}

/** Capture 3 : panneau latéral seul, onglet « Agenda », agrandi ×1,25 */
function agendaScene(): HTMLElement[] {
  const zoom = 1.25;
  // 408 px CSS : la ligne « Vu · heure · plateforme · Japon heure » tient sans points de suspension, même en anglais (12 h)
  const width = Math.round(408 * zoom);
  const panel: Box = { left: 610 + (670 - width) / 2, top: 40, width, height: 720 };
  return [card(panel, panelSrc('agenda', zoom), 'panel')];
}

/** Capture 4 : popup (carte « Sur cette page ») agrandi ×1,2 */
function popupScene(): HTMLElement[] {
  const zoom = 1.2;
  const width = POPUP.width * zoom;
  const height = POPUP.height * zoom;
  return [card({ left: 610 + (670 - width) / 2, top: (800 - height) / 2, width, height }, popupSrc('page', zoom))];
}

/** Capture 5 : page « Importer un historique » (aperçu) */
function importScene(): HTMLElement[] {
  // Rognée sous « Mettre à jour 3 séries » : aucune carte coupée par le bas
  return [card({ left: 640, top: 80, width: 600, height: 640 }, `./import-cr.html?locale=${locale}&zoom=1`)];
}

/** Tuile promo 1400×560 : dos et texte à gauche, popup (« Sur cette page ») et panneau (« En lecture ») à droite, rognés en bas */
function marqueeParts(): HTMLElement[] {
  document.documentElement.classList.add('marquee');
  const popup = card({ left: 736, top: 44, width: POPUP.width, height: POPUP.height }, popupSrc('page', 1));
  const panelWidth = 372;
  const panel = card({ left: MARQUEE.width - 48 - panelWidth, top: 96, width: panelWidth, height: MARQUEE.height - 96 + 40 }, panelSrc('nowPlaying', 1), 'panel');
  return [...stage(), ...spine(MARQUEE.kana), lockup(), copy(MARQUEE), serviceFlow(), popup, panel];
}

function shotParts(): HTMLElement[] {
  const caption = CAPTIONS[locale][shot];
  const kana = KANA[shot];
  const left = [...spine(kana), lockup(), copy({ ...caption, kana }), serviceFlow()];
  switch (shot) {
    case 1:
      return [...stage(), ...left, ...syncScene()];
    case 2:
      return [...stage(), ...left, ...sidePanelScene()];
    case 3:
      // Panneau presque pleine hauteur : disque remonté, rogné par le haut
      return [...stage(-120), ...left, ...agendaScene()];
    case 4:
      return [...stage(), ...left, ...popupScene()];
    case 5:
      return [...stage(), ...left, ...importScene()];
  }
}

canvas.append(...(marquee ? marqueeParts() : shotParts()));

// Prêt quand chaque iframe a terminé son rendu
await Promise.all(
  [...document.querySelectorAll('iframe')].map((iframe) =>
    waitFor(() => iframe.contentDocument?.documentElement?.dataset.ready === '1', 20_000),
  ),
);

// Retours à la ligne voulus : une ligne de titre qui déborde de la colonne est une erreur (relevée par capture.ts),
// mesurée une fois les polices chargées
await document.fonts.ready;
const title = document.querySelector<HTMLElement>('.headline');
if (title && title.scrollWidth > title.clientWidth) console.error(`Titre trop large (${title.scrollWidth} px > ${title.clientWidth} px) : ${title.innerText}`);
await markReady();
