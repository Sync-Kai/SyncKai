import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { SOURCES } from '../test/import-graph';
import baseline from './design-tokens.baseline.json';

// Cliquet de la charte graphique (docs/design/README.md › Ratchet) : par fichier de src/ (tests exclus), nombre de
// couleurs arbitraires Tailwind, de couleurs hexadécimales brutes et de tailles de police arbitraires en px dans les
// chaînes du code. Chaque compte est figé dans design-tokens.baseline.json : il peut seulement baisser (le test demande
// alors d'abaisser la valeur figée), un nouveau fichier part de 0. Les espacements arbitraires en px ne sont pas comptés
// (nettoyés pendant la migration Preact).

type Metric = 'arbitraryColors' | 'hexColors' | 'pxFontSizes';

const METRICS: Readonly<Record<Metric, string>> = {
  arbitraryColors: 'classe de couleur arbitraire (bg-[#…], text-[rgb(…)]…) : utiliser un jeton --color-* de src/ui/theme.css',
  hexColors: 'couleur hexadécimale brute : utiliser un jeton --color-* (var(--color-…) ou classe Tailwind)',
  pxFontSizes: 'taille de police arbitraire text-[NNpx] : utiliser un jeton --text-* (text-body, text-secondary…)',
};

/**
 * Dessins de la mascotte Kai, exemptés des couleurs hexadécimales brutes : dégradés et teintes propres au personnage,
 * hors palette de l'interface. `from` : seule la fin du fichier, à partir de ce repère, est exemptée (le début garde
 * des icônes de l'interface, comptées).
 */
const HEX_EXEMPT: Readonly<Record<string, { reason: string; from?: string }>> = {
  'ui/kai-small.ts': { reason: 'mascotte Kai : petit dessin et cadre commun (tracés de assets/brand/kai-icon*.svg)' },
  'ui/icons.ts': { reason: 'mascotte Kai : grand dessin, en fin de fichier', from: '// ── Mascotte Kai, grand dessin' },
};

/** Valeur arbitraire Tailwind qui porte une couleur (`bg-[#…]`, `text-[rgb(…)]`, `shadow-[…_rgba(…)]`, `text-[color:…]`, `[text-shadow:…]`) */
const ARBITRARY_COLOR = /(?:\b[a-z][a-z0-9-]*-\[|\[[a-z-]+:)(?:color:[^\]\s'"`]*|[^\]\s'"`]*?(?:#[0-9a-fA-F]{3,8}\b|(?<![a-z])(?:rgba?|hsla?)\()[^\]\s'"`]*)\]/g;
const HEX_COLOR = /(?<![\w&#])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g;
const PX_FONT_SIZE = /\btext-\[\d+(?:\.\d+)?px\]/g;

/** Chaînes d'un module (littéraux simples et morceaux de gabarits, commentaires exclus), avec leur position */
function stringTexts(file: string, code: string): { text: string; at: number }[] {
  const texts: { text: string; at: number }[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateLiteralToken(node)) texts.push({ text: node.text, at: node.end });
    ts.forEachChild(node, visit);
  };
  visit(ts.createSourceFile(file, code, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS));
  return texts;
}

/** Position à partir de laquelle les couleurs hexadécimales d'un fichier ne comptent plus (fin du fichier sans exemption) */
function hexExemptFrom(file: string, code: string): number {
  const exempt = HEX_EXEMPT[file];
  if (!exempt) return Infinity;
  return exempt.from === undefined ? 0 : code.indexOf(exempt.from);
}

/** Code de l'extension : ni tests, ni aides de test, ni données de test (__corpus__, __fixtures__) */
const isScanned = (file: string): boolean => !file.endsWith('.test.ts') && !file.startsWith('test/') && !/(?:^|\/)__\w+__\//.test(file);

function measure(): Record<Metric, Record<string, number>> {
  const counts: Record<Metric, Record<string, number>> = { arbitraryColors: {}, hexColors: {}, pxFontSizes: {} };
  for (const [file, code] of SOURCES) {
    if (!isScanned(file)) continue;
    const exemptFrom = hexExemptFrom(file, code);
    for (const { text, at } of stringTexts(file, code)) {
      const colors = text.match(ARBITRARY_COLOR) ?? [];
      // Une couleur hexadécimale déjà comptée dans une classe arbitraire ne compte pas deux fois
      const rest = text.replace(ARBITRARY_COLOR, ' ');
      const found: Record<Metric, number> = {
        arbitraryColors: colors.length,
        hexColors: at > exemptFrom ? 0 : (rest.match(HEX_COLOR) ?? []).length,
        pxFontSizes: (text.match(PX_FONT_SIZE) ?? []).length,
      };
      for (const metric of Object.keys(METRICS) as Metric[]) {
        if (found[metric] > 0) counts[metric][file] = (counts[metric][file] ?? 0) + found[metric];
      }
    }
  }
  return counts;
}

const FROZEN: Readonly<Record<Metric, Readonly<Record<string, number>>>> = baseline;
const current = measure();

describe('charte graphique : cliquet des valeurs en dur (docs/design/README.md)', () => {
  it('les motifs reconnaissent ce qu’ils doivent compter', () => {
    const count = (re: RegExp, text: string): number => (text.match(re) ?? []).length;
    expect(count(ARBITRARY_COLOR, 'p-2 bg-[#123456] text-[rgb(1,2,3)] border-[hsl(0_0%_0%)] text-[color:var(--x)] bg-ground')).toBe(4);
    expect(count(ARBITRARY_COLOR, 'shadow-[2px_2px_0_rgba(0,0,0,0.45)] w-[42px] text-[12px] grid-cols-[repeat(2,1fr)]')).toBe(1);
    expect(count(ARBITRARY_COLOR, '[text-shadow:0_1px_0_rgba(0,0,0,.35)] shadow-[inset_0_0_0_1px_rgba(255,255,255,.08)] [mask:none]')).toBe(2);
    expect(count(HEX_COLOR, "#1A0F1C #fff #ff8fb880 &#123; a#bad #section-x")).toBe(3);
    expect(count(PX_FONT_SIZE, 'text-[11px] text-[10.5px] text-[1em] leading-[11px]')).toBe(2);
  });

  it('le scan lit bien les sources', () => {
    expect(Object.keys(current.hexColors)).toContain('browser/badge.ts');
    expect(current.hexColors['ui/kai-small.ts']).toBeUndefined();
    expect(current.pxFontSizes['popup/components/watching-screen.ts']).toBeGreaterThan(0);
  });

  for (const metric of Object.keys(METRICS) as Metric[]) {
    it(`${metric} : aucun fichier au-dessus de sa valeur figée (nouveau fichier : 0) — ${METRICS[metric]}`, () => {
      const above = Object.entries(current[metric]).filter(([file, n]) => n > (FROZEN[metric][file] ?? 0)).map(([file, n]) => `${file} : ${n} (figé : ${FROZEN[metric][file] ?? 0})`);
      expect(above).toEqual([]);
    });

    it(`${metric} : la valeur figée suit chaque baisse (abaisser design-tokens.baseline.json, retirer un fichier à 0)`, () => {
      const stale = Object.entries(FROZEN[metric]).filter(([file, n]) => (current[metric][file] ?? 0) < n).map(([file, n]) => `${file} : ${current[metric][file] ?? 0} (figé : ${n})`);
      expect(stale).toEqual([]);
    });
  }

  it('chaque exemption désigne un fichier existant et, le cas échéant, un repère présent une seule fois', () => {
    const broken = Object.entries(HEX_EXEMPT).filter(([file, { from }]) => {
      const code = SOURCES.get(file);
      return code === undefined || (from !== undefined && code.split(from).length !== 2);
    });
    expect(broken.map(([file]) => file)).toEqual([]);
  });
});
