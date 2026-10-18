/**
 * Identité visuelle « Kai » : génère les SVG à texte puis rastérise tous les visuels en PNG.
 *
 * 1. Polices : WOFF de @fontsource (M PLUS Rounded 1c 800 latin + sous-ensemble des kana, Nunito 600 et 800) décompressés
 *    en TTF, seules polices chargées par resvg (polices système désactivées → rendu identique partout).
 * 2. Lockups + tuile promo : texte vectorisé en <path> (aucune dépendance de police à l'affichage),
 *    écrits dans assets/brand/.
 * 3. Rastérisation (@resvg/resvg-js) : icônes de l'extension (public/icons) et visuels du store (docs/store).
 *
 * Usage : npm run icons
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync, inflateSync } from 'node:zlib';
import { Resvg, type ResvgRenderOptions } from '@resvg/resvg-js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BRAND = join(ROOT, 'assets', 'brand');
const FONT_CACHE = join(ROOT, 'node_modules', '.cache', 'synckai-fonts');
const FONTSOURCE = join(ROOT, 'node_modules', '@fontsource');

interface FontSpec {
  family: string;
  weight: number;
  woff: string;
}

interface Font extends FontSpec {
  /** Ascendant / descendant (hhea) en fraction de l'em : sert à placer la ligne de base comme en CSS. */
  ascent: number;
  descent: number;
}

interface TextRun {
  text: string;
  font: Font;
  size: number;
  letterSpacing?: number;
}

const DISPLAY: FontSpec = {
  family: 'M PLUS Rounded 1c',
  weight: 800,
  woff: join(FONTSOURCE, 'm-plus-rounded-1c', 'files', 'm-plus-rounded-1c-latin-800-normal.woff'),
};
const BODY: FontSpec = {
  family: 'Nunito',
  weight: 600,
  woff: join(FONTSOURCE, 'nunito', 'files', 'nunito-latin-600-normal.woff'),
};
/** Kana de la tuile promo (シンカイ, ジドウ) : sous-ensemble [119] de la police (hiragana, katakana), même famille */
const KANA: FontSpec = {
  family: 'M PLUS Rounded 1c',
  weight: 800,
  woff: join(FONTSOURCE, 'm-plus-rounded-1c', 'files', 'm-plus-rounded-1c-119-800-normal.woff'),
};
const EYEBROW: FontSpec = {
  family: 'Nunito',
  weight: 800,
  woff: join(FONTSOURCE, 'nunito', 'files', 'nunito-latin-800-normal.woff'),
};

// ─── Polices : WOFF 1.0 → SFNT (TTF) ──────────────────────────────────────

/** Reconstruit un fichier SFNT à partir d'un WOFF 1.0 (tables zlib) : resvg ne lit que TTF/OTF. */
function woffToSfnt(woff: Buffer): Buffer {
  if (woff.toString('ascii', 0, 4) !== 'wOFF') throw new Error('WOFF 1.0 attendu');
  const flavor = woff.readUInt32BE(4);
  const numTables = woff.readUInt16BE(12);
  const tables = Array.from({ length: numTables }, (_, i) => {
    const entry = 44 + i * 20;
    const offset = woff.readUInt32BE(entry + 4);
    const compLength = woff.readUInt32BE(entry + 8);
    const origLength = woff.readUInt32BE(entry + 12);
    const raw = woff.subarray(offset, offset + compLength);
    return {
      tag: woff.readUInt32BE(entry),
      checksum: woff.readUInt32BE(entry + 16),
      data: compLength < origLength ? inflateSync(raw) : raw,
    };
  });

  let entrySelector = 0;
  while (1 << (entrySelector + 1) <= numTables) entrySelector++;
  const searchRange = (1 << entrySelector) * 16;
  const header = Buffer.alloc(12 + numTables * 16);
  header.writeUInt32BE(flavor, 0);
  header.writeUInt16BE(numTables, 4);
  header.writeUInt16BE(searchRange, 6);
  header.writeUInt16BE(entrySelector, 8);
  header.writeUInt16BE(numTables * 16 - searchRange, 10);

  const parts: Buffer[] = [header];
  let offset = header.length;
  tables.forEach(({ tag, checksum, data }, i) => {
    const record = 12 + i * 16;
    header.writeUInt32BE(tag, record);
    header.writeUInt32BE(checksum, record + 4);
    header.writeUInt32BE(offset, record + 8);
    header.writeUInt32BE(data.length, record + 12);
    const padding = (4 - (data.length % 4)) % 4; // tables alignées sur 4 octets
    parts.push(data, Buffer.alloc(padding));
    offset += data.length + padding;
  });
  return Buffer.concat(parts);
}

function sfntTable(sfnt: Buffer, tag: string): Buffer {
  const numTables = sfnt.readUInt16BE(4);
  for (let i = 0; i < numTables; i++) {
    const record = 12 + i * 16;
    if (sfnt.toString('ascii', record, record + 4) !== tag) continue;
    const offset = sfnt.readUInt32BE(record + 8);
    return sfnt.subarray(offset, offset + sfnt.readUInt32BE(record + 12));
  }
  throw new Error(`Table ${tag} absente`);
}

function loadFont(spec: FontSpec, file: string): Font {
  const sfnt = woffToSfnt(readFileSync(spec.woff));
  writeFileSync(file, sfnt);
  const unitsPerEm = sfntTable(sfnt, 'head').readUInt16BE(18);
  const hhea = sfntTable(sfnt, 'hhea');
  return { ...spec, ascent: hhea.readInt16BE(4) / unitsPerEm, descent: -hhea.readInt16BE(6) / unitsPerEm };
}

mkdirSync(FONT_CACHE, { recursive: true });
const FONT_FILES = [
  join(FONT_CACHE, 'm-plus-rounded-1c-800.ttf'),
  join(FONT_CACHE, 'nunito-600.ttf'),
  join(FONT_CACHE, 'm-plus-rounded-1c-kana-800.ttf'),
  join(FONT_CACHE, 'nunito-800.ttf'),
];
const display = loadFont(DISPLAY, FONT_FILES[0]);
const body = loadFont(BODY, FONT_FILES[1]);
const kana = loadFont(KANA, FONT_FILES[2]);
const eyebrowFont = loadFont(EYEBROW, FONT_FILES[3]);

const RENDER_FONTS: ResvgRenderOptions['font'] = {
  loadSystemFonts: false,
  fontFiles: FONT_FILES,
  defaultFontFamily: BODY.family,
};

// ─── Texte vectorisé ──────────────────────────────────────────────────────

const escapeXml = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const round = (value: number): number => Math.round(value * 100) / 100;

function textSvg({ text, font, size, letterSpacing = 0 }: TextRun, x: number, y: number): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="2000" height="400">` +
    `<text x="${x}" y="${y}" font-family="${font.family}" font-weight="${font.weight}" font-size="${size}" letter-spacing="${letterSpacing}">${escapeXml(text)}</text></svg>`
  );
}

/** Contours du texte (ligne de base en y), via la sortie usvg de resvg. */
function outline(run: TextRun, x: number, y: number): string {
  const usvg = new Resvg(textSvg(run, x, y), { font: RENDER_FONTS }).toString();
  const paths = [...usvg.matchAll(/ d="([^"]+)"/g)].map((match) => match[1]);
  if (paths.length === 0) throw new Error(`Police introuvable pour « ${run.text} »`);
  return paths.join(' ').replace(/-?\d+\.\d+/g, (n) => String(round(Number(n))));
}

function inkRight(run: TextRun): number {
  const box = new Resvg(textSvg(run, 0, 200), { font: RENDER_FONTS }).getBBox();
  if (!box) throw new Error(`Rendu vide pour « ${run.text} »`);
  return box.x + box.width;
}

/** Chasse (avance) du texte comme en CSS, espacement final inclus : bord droit de « texte+H » − celui de « H ». */
function advance(run: TextRun): number {
  return inkRight({ ...run, text: `${run.text}H` }) - inkRight({ ...run, text: 'H' });
}

/** Ligne de base d'une ligne CSS (line-height donné) commençant en `top`. */
function baseline(font: Font, size: number, lineHeight: number, top: number): number {
  const content = (font.ascent + font.descent) * size;
  return top + (lineHeight - content) / 2 + font.ascent * size;
}

// ─── Composition SVG ──────────────────────────────────────────────────────

/** Imbrique un SVG de assets/brand (ids préfixés pour rester uniques) à la position donnée. */
function embed(file: string, idPrefix: string, x: number, y: number, size: number): string {
  const source = readFileSync(join(BRAND, file), 'utf8');
  const viewBox = /viewBox="([^"]+)"/.exec(source)?.[1];
  if (!viewBox) throw new Error(`${file} : viewBox manquant`);
  const content = source
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/<title>[\s\S]*?<\/title>|<!--[\s\S]*?-->/g, '')
    .replace(/id="([^"]+)"/g, `id="${idPrefix}$1"`)
    .replace(/url\(#([^)]+)\)/g, `url(#${idPrefix}$1)`)
    .trim();
  return `<svg x="${round(x)}" y="${round(y)}" width="${size}" height="${size}" viewBox="${viewBox}">\n${content}\n</svg>`;
}

interface WordmarkTheme {
  sync: string;
  kai: readonly [string, string, string];
  sparkle: string;
}

/**
 * Logotype « Sync » + « Kai » en dégradé + étincelle (lockup §4, 56 px / interligne 60).
 * Renvoie les éléments SVG et le bord droit occupé (étincelle comprise).
 */
function wordmark(theme: WordmarkTheme, idPrefix: string, x: number, top: number, size: number): { svg: string; right: number } {
  const run = (text: string): TextRun => ({ text, font: display, size, letterSpacing: -0.01 * size });
  const scale = size / 56;
  const y = baseline(display, size, 60 * scale, top);
  const kaiX = x + advance(run('Sync'));
  const kaiRight = kaiX + advance(run('Kai'));
  // Étincelle : position CSS absolue right:-11px, top:-6px sur la boîte « Kai » (20 × 20)
  const sparkleX = kaiRight - 9 * scale;
  const sparkleY = top - 6 * scale;
  const [c0, c1, c2] = theme.kai;
  const svg = [
    `<defs><linearGradient id="${idPrefix}kai" x1="${round(kaiX)}" y1="0" x2="${round(kaiRight)}" y2="0" gradientUnits="userSpaceOnUse">` +
      `<stop offset="0" stop-color="${c0}"/><stop offset="0.55" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>`,
    `<path fill="${theme.sync}" d="${outline(run('Sync'), x, y)}"/>`,
    `<path fill="url(#${idPrefix}kai)" d="${outline(run('Kai'), kaiX, y)}"/>`,
    `<path fill="${theme.sparkle}" transform="translate(${round(sparkleX)} ${round(sparkleY)}) scale(${round(scale)})" d="M10 0 Q11 9 20 10 Q11 11 10 20 Q9 11 0 10 Q9 9 10 0 Z"/>`,
  ].join('\n');
  return { svg, right: sparkleX + 20 * scale };
}

const DARK: WordmarkTheme = { sync: '#FFFFFF', kai: ['#8A6BFF', '#5B7BFF', '#46B4FF'], sparkle: '#46D6FF' };
const LIGHT: WordmarkTheme = { sync: '#1B1F4A', kai: ['#7C5CFF', '#4F6BFF', '#2F8CF0'], sparkle: '#2FB8F0' };

const svgDocument = (width: number, height: number, title: string, content: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n` +
  `<title>${title}</title>\n<!-- Généré par scripts/generate-icons.ts (texte vectorisé) : ne pas éditer à la main -->\n${content}\n</svg>\n`;

/** Lockup horizontal (§4) : icône 100 px, gouttière 22, logotype + baseline « WATCH · SYNC · KEEP TRACK ». */
function lockup(theme: WordmarkTheme, taglineColor: string, idPrefix: string): string {
  const textX = 122;
  const top = 8; // colonne texte (60 + 8 + 16 = 84 px) centrée sur l'icône de 100 px
  const mark = wordmark(theme, idPrefix, textX, top, 56);
  const tagline: TextRun = { text: 'WATCH · SYNC · KEEP TRACK', font: body, size: 13, letterSpacing: 0.32 * 13 };
  const taglineRight = textX + advance(tagline) - 0.32 * 13;
  const width = Math.ceil(Math.max(mark.right, taglineRight)) + 2;
  return svgDocument(width, 100, 'SyncKai', [
    embed('src/kai-mark-lockup.svg', idPrefix, 0, 0, 100),
    mark.svg,
    `<path fill="${taglineColor}" d="${outline(tagline, textX, baseline(body, 13, 16, top + 68))}"/>`,
  ].join('\n'));
}

// ─── Petite tuile promo (direction C « Duo / éditorial », comme les captures du Store) ───

/** Jetons de la charte (src/ui/theme.css) et des captures (scripts/screenshots/banner.css) */
const C = { ground: '#16131F', stage: '#1B1726', watermark: '#241E34', line: '#3D3554', ink: '#F4EFFA', muted: '#B3A9C9', lavender: '#B9A4FF', sakura: '#FF8FB8' };

/** Kai « ravi » du lockup des captures (petit dessin de src/ui/kai-small.ts, sans tuile), repère 320 */
function smallKai(idPrefix: string, x: number, y: number, size: number): string {
  const id = (name: string): string => `${idPrefix}${name}`;
  return [
    `<svg x="${round(x)}" y="${round(y)}" width="${size}" height="${size}" viewBox="0 0 320 320" overflow="visible">`,
    `<defs><radialGradient id="${id('H')}" cx="132" cy="132" r="180" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FFFFFF"/><stop offset="0.5" stop-color="#F4F6FF"/><stop offset="1" stop-color="#C9CFF5"/></radialGradient>`,
    `<linearGradient id="${id('L')}" x1="72" y1="146" x2="118" y2="44" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#8A6BFF"/><stop offset="1" stop-color="#46D6FF"/></linearGradient>`,
    `<linearGradient id="${id('R')}" x1="248" y1="146" x2="206" y2="62" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#46D6FF"/><stop offset="1" stop-color="#8A6BFF"/></linearGradient></defs>`,
    `<path d="M76 146 C40 122 32 86 54 62 C68 47 86 44 100 46" fill="none" stroke="url(#${id('L')})" stroke-width="28" stroke-linecap="round"/>`,
    `<path d="M94 20 L134 47 L96 74 Z" fill="#46D6FF" stroke="#46D6FF" stroke-width="8" stroke-linejoin="round"/>`,
    `<path d="M244 146 C282 124 290 98 276 80 C264 64 246 60 230 62" fill="none" stroke="url(#${id('R')})" stroke-width="28" stroke-linecap="round"/>`,
    `<path d="M236 35 L194 64 L234 91 Z" fill="#8A6BFF" stroke="#8A6BFF" stroke-width="8" stroke-linejoin="round"/>`,
    `<path d="M160 98 C234 98 280 134 280 188 C280 242 234 278 160 278 C86 278 40 242 40 188 C40 134 86 98 160 98 Z" fill="url(#${id('H')})"/>`,
    `<ellipse cx="42" cy="192" rx="16" ry="30" fill="#5FE3FF"/><ellipse cx="278" cy="192" rx="16" ry="30" fill="#5FE3FF"/>`,
    `<path d="M160 126 C216 126 252 150 252 192 C252 234 216 260 160 260 C104 260 68 234 68 192 C68 150 104 126 160 126 Z" fill="#121633"/>`,
    `<path d="M92 196 Q106 168 120 196" fill="none" stroke="#5FE3FF" stroke-width="16" stroke-linecap="round"/>`,
    `<path d="M200 196 Q214 168 228 196" fill="none" stroke="#5FE3FF" stroke-width="16" stroke-linecap="round"/>`,
    `<ellipse cx="86" cy="223" rx="13" ry="7" fill="#FF7FB0"/><ellipse cx="234" cy="223" rx="13" ry="7" fill="#FF7FB0"/>`,
    `<path d="M146 206 Q160 212 174 206 Q172 228 160 228 Q148 228 146 206 Z" fill="#FF7FB0"/>`,
    `</svg>`,
  ].join('');
}

/** Logos embarqués (public/brands) en data: URI, coins arrondis comme dans les captures */
const LOGOS = ['crunchyroll.png', 'adn.png', 'netflix.png', 'disney.png', 'prime.png', 'anilist.png', 'myanimelist.svg'] as const;

function logo(file: (typeof LOGOS)[number], x: number, y: number, size: number): string {
  const type = file.endsWith('.svg') ? 'image/svg+xml' : 'image/png';
  const data = readFileSync(join(ROOT, 'public', 'brands', file)).toString('base64');
  const id = `promo-logo-${file.split('.')[0]}`;
  return (
    `<clipPath id="${id}"><rect x="${round(x)}" y="${round(y)}" width="${size}" height="${size}" rx="${round(size * 0.28)}"/></clipPath>` +
    `<image x="${round(x)}" y="${round(y)}" width="${size}" height="${size}" clip-path="url(#${id})" href="data:${type};base64,${data}"/>`
  );
}

/**
 * Petite tuile promo du Chrome Web Store (440 × 280), direction C des captures : dos avec le kana ジドウ (自動,
 * « automatique ») en filigrane et filet, lockup, surtitre + kana sakura, titre (un mot en lavande), filet, rangée de
 * logos (plateformes → AniList / MAL), et à droite la surface plus claire avec son disque et l'icône Kai.
 */
function promo(): string {
  const [width, height] = [440, 280];
  const spine = 56;
  const textX = 80;
  const watermark = 'ジドウ';

  // Dos : kana empilés (écriture verticale), coupés par le bord gauche
  const kanaSize = 50;
  const spineKana = [...watermark].map(
    (char, i) => `<path fill="${C.watermark}" d="${outline({ text: char, font: kana, size: kanaSize }, 3, baseline(display, kanaSize, kanaSize, 22 + i * (kanaSize + 6)))}"/>`,
  );

  // Lockup : Kai, « SyncKai », « シンカイ » (lignes de base communes)
  const lockTop = 24;
  const kaiSize = 22;
  const nameRun: TextRun = { text: 'SyncKai', font: display, size: 15, letterSpacing: -0.2 };
  const nameX = textX + kaiSize + 7;
  const lockBase = baseline(display, 15, kaiSize, lockTop);
  const lockupSvg = [
    smallKai('promo-kai-', textX, lockTop, kaiSize),
    `<path fill="${C.ink}" d="${outline(nameRun, nameX, lockBase)}"/>`,
    `<path fill="${C.muted}" d="${outline({ text: 'シンカイ', font: kana, size: 9 }, nameX + advance(nameRun) + 6, lockBase)}"/>`,
  ];

  // Surtitre (majuscules espacées) + kana sakura
  const eyebrowTop = 78;
  const eyebrowRun: TextRun = { text: 'ANIME TRACKING', font: eyebrowFont, size: 10, letterSpacing: 1.2 };
  const eyebrowBase = baseline(eyebrowFont, 10, 12, eyebrowTop);
  const eyebrowSvg = [
    `<path fill="${C.muted}" d="${outline(eyebrowRun, textX, eyebrowBase)}"/>`,
    `<path fill="${C.sakura}" d="${outline({ text: watermark, font: kana, size: 11, letterSpacing: 0.4 }, textX + advance(eyebrowRun) + 6, eyebrowBase)}"/>`,
  ];

  // Titre sur deux lignes, « autopilot » en lavande
  const titleSize = 25;
  const titleLine = 29;
  const titleTop = eyebrowTop + 24;
  const run = (text: string): TextRun => ({ text, font: display, size: titleSize, letterSpacing: -0.3 });
  const line2 = titleTop + titleLine;
  const titleSvg = [
    `<path fill="${C.ink}" d="${outline(run('Your anime list,'), textX, baseline(display, titleSize, titleLine, titleTop))}"/>`,
    `<path fill="${C.ink}" d="${outline(run('on'), textX, baseline(display, titleSize, titleLine, line2))}"/>`,
    `<path fill="${C.lavender}" d="${outline(run('autopilot'), textX + advance(run('on ')), baseline(display, titleSize, titleLine, line2))}"/>`,
  ];
  const titleRight = textX + Math.max(advance(run('Your anime list,')), advance(run('on autopilot')));
  const ruleTop = line2 + titleLine + 14;

  // Rangée de logos : cinq plateformes → AniList, MyAnimeList
  const logoSize = 20;
  const gap = 7;
  const logoTop = height - 26 - logoSize;
  let x = textX;
  const logos: string[] = [];
  for (const file of LOGOS.slice(0, 5)) {
    logos.push(logo(file, x, logoTop, logoSize));
    x += logoSize + gap;
  }
  logos.push(
    `<g transform="translate(${round(x + 2)} ${logoTop}) scale(${round(logoSize / 24)})" fill="none" stroke="${C.muted}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h15M13 6l6 6-6 6"/></g>`,
  );
  x += logoSize + 4 + gap;
  for (const file of LOGOS.slice(5)) {
    logos.push(logo(file, x, logoTop, logoSize));
    x += logoSize + gap;
  }
  const textRight = Math.max(titleRight, x - gap);

  // Surface de droite, disque et Kai
  const stageX = Math.round(textRight + 18);
  const discR = 70;
  const discX = stageX + discR + 4;
  const discY = 142;
  const iconArt = 76; // taille visible de la tuile (kai-icon.svg : 96 sur 128)
  const iconBox = (iconArt * 128) / 96;

  return svgDocument(width, height, 'SyncKai – Your anime list, on autopilot', [
    `<defs><radialGradient id="promo-disc" cx="${round(discX - discR * 0.2)}" cy="${round(discY - discR * 0.3)}" r="${round(discR * 1.6)}" gradientUnits="userSpaceOnUse">` +
      `<stop offset="0" stop-color="#2E2744"/><stop offset="0.6" stop-color="#241E35"/><stop offset="1" stop-color="#1F1A2D"/></radialGradient></defs>`,
    `<rect width="${width}" height="${height}" fill="${C.ground}"/>`,
    `<rect x="${stageX}" width="${width - stageX}" height="${height}" fill="${C.stage}"/>`,
    `<circle cx="${round(discX)}" cy="${discY}" r="${discR}" fill="url(#promo-disc)"/>`,
    embed('kai-icon.svg', 'promo-', discX - iconBox / 2, discY - iconBox / 2, round(iconBox)),
    ...spineKana,
    `<rect x="${spine}" y="20" width="1" height="${height - 40}" fill="${C.line}"/>`,
    ...lockupSvg,
    ...eyebrowSvg,
    ...titleSvg,
    `<rect x="${textX}" y="${ruleTop}" width="40" height="3" rx="1.5" fill="${C.line}"/>`,
    ...logos,
  ].join('\n'));
}

// ─── Rastérisation ────────────────────────────────────────────────────────

/** PNG RGB 8 bits sans alpha (exigé par le Chrome Web Store pour les visuels promo). */
function encodeOpaquePng(width: number, height: number, rgba: Buffer): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc32 = (data: Buffer): number => {
    let crc = 0xffffffff;
    for (const byte of data) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer): Buffer => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const content = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(content));
    return Buffer.concat([length, content, crc]);
  };

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.writeUInt8(8, 8); // 8 bits par canal
  header.writeUInt8(2, 9); // RGB
  const stride = width * 3 + 1;
  const raw = Buffer.alloc(height * stride); // octet de filtre 0 en tête de chaque ligne
  for (let i = 0; i < width * height; i++) {
    const target = Math.floor(i / width) * stride + 1 + (i % width) * 3;
    raw[target] = rgba[i * 4];
    raw[target + 1] = rgba[i * 4 + 1];
    raw[target + 2] = rgba[i * 4 + 2];
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function rasterize(source: string, output: string, width: number, opaque = false): void {
  const svg = readFileSync(join(BRAND, source), 'utf8');
  const image = new Resvg(svg, { font: RENDER_FONTS, fitTo: { mode: 'width', value: width }, shapeRendering: 2 }).render();
  const png = opaque ? encodeOpaquePng(image.width, image.height, image.pixels) : image.asPng();
  const target = join(ROOT, output);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, png);
  console.log(`${output} (${image.width}×${image.height})`);
}

const generated: ReadonlyArray<readonly [string, string]> = [
  ['kai-lockup-dark.svg', lockup(DARK, '#8E96C8', 'dark-')],
  ['kai-lockup-light.svg', lockup(LIGHT, '#5A6190', 'light-')],
  ['promo-440x280.svg', promo()],
];
for (const [file, svg] of generated) {
  writeFileSync(join(BRAND, file), svg);
  console.log(`assets/brand/${file}`);
}

rasterize('kai-icon-16.svg', 'public/icons/icon-16.png', 16);
rasterize('kai-icon-32.svg', 'public/icons/icon-32.png', 32);
rasterize('kai-icon-48.svg', 'public/icons/icon-48.png', 48);
rasterize('kai-icon.svg', 'public/icons/icon-128.png', 128);
rasterize('kai-icon.svg', 'docs/store/icon-128.png', 128);
rasterize('promo-440x280.svg', 'docs/store/promo-440x280.png', 440, true);
