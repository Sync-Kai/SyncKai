/**
 * Identité visuelle « Kai » : génère les SVG à texte puis rastérise tous les visuels en PNG.
 *
 * 1. Polices : WOFF de @fontsource (M PLUS Rounded 1c 800, Nunito 600) décompressés en TTF,
 *    seules polices chargées par resvg (polices système désactivées → rendu identique partout).
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
const FONT_FILES = [join(FONT_CACHE, 'm-plus-rounded-1c-800.ttf'), join(FONT_CACHE, 'nunito-600.ttf')];
const display = loadFont(DISPLAY, FONT_FILES[0]);
const body = loadFont(BODY, FONT_FILES[1]);

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

/** Petite tuile promo du Chrome Web Store (440 × 280) : fond marine de la tuile Kai, icône, logotype, accroche. */
function promo(): string {
  const [width, height] = [440, 280];
  const iconArt = 128; // taille visible de la tuile (kai-icon.svg : 96 sur 128)
  const iconBox = (iconArt * 128) / 96;
  const gap = 26;
  const markSize = 50;
  const markLine = (60 * markSize) / 56;
  const taglineSize = 16;
  const taglineLine = 22;
  // Tuile promo commune à toutes les langues du Store : en anglais (comme la tuile 1400×560)
  const lines = ['Your anime list,', 'on autopilot'];
  const taglineRuns = lines.map((text): TextRun => ({ text, font: body, size: taglineSize }));

  const columnHeight = markLine + 10 + lines.length * taglineLine;
  const probe = wordmark(DARK, 'probe-', 0, 0, markSize);
  const columnWidth = Math.max(probe.right, ...taglineRuns.map(advance));
  const left = (width - (iconArt + gap + columnWidth)) / 2;
  const textX = left + iconArt + gap;
  const top = (height - columnHeight) / 2;
  const mark = wordmark(DARK, 'promo-', textX, top, markSize);

  return svgDocument(width, height, 'SyncKai – Your anime list, on autopilot', [
    `<defs>`,
    `<radialGradient id="promo-bg" cx="150" cy="110" r="380" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#2A3590"/><stop offset="0.5" stop-color="#1F2A66"/><stop offset="1" stop-color="#141A3D"/></radialGradient>`,
    `<radialGradient id="promo-glow" cx="${round(left + iconArt / 2)}" cy="140" r="150" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#7C5CFF" stop-opacity="0.35"/><stop offset="1" stop-color="#46D6FF" stop-opacity="0"/></radialGradient>`,
    `</defs>`,
    `<rect width="${width}" height="${height}" fill="url(#promo-bg)"/>`,
    `<rect width="${width}" height="${height}" fill="url(#promo-glow)"/>`,
    embed('kai-icon.svg', 'promo-', left - (iconBox - iconArt) / 2, (height - iconBox) / 2, round(iconBox)),
    mark.svg,
    ...taglineRuns.map(
      (run, i) => `<path fill="#C9CFF5" d="${outline(run, textX, baseline(body, taglineSize, taglineLine, top + markLine + 10 + i * taglineLine))}"/>`,
    ),
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
