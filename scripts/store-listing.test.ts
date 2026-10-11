/**
 * Fiche AMO alignée sur les fiches du Chrome Web Store : chaque plateforme citée dans docs/store/listing-*.md
 * figure aussi dans la description de docs/store/amo-metadata.json (en-US, fr, de). Tant que le module n'est pas
 * public sur AMO, release.yml renvoie cette fiche complète avec chaque version (Netflix oublié en 2.1.0).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isRecord } from '../src/shared/guards.ts';

interface AmoMetadata {
  summary: Record<string, string>;
  description: Record<string, string>;
}

/** Langue de la fiche du Chrome Web Store → locale AMO et intertitre « plateformes » commun aux deux fiches */
const LOCALES = [
  { listing: 'en', amo: 'en-US', heading: 'Supported platforms' },
  { listing: 'fr', amo: 'fr', heading: 'Plateformes prises en charge' },
  { listing: 'de', amo: 'de', heading: 'Unterstützte Plattformen' },
] as const;

function isAmoMetadata(value: unknown): value is AmoMetadata {
  return isRecord(value) && isRecord(value.summary) && isRecord(value.description);
}

/** Puces qui suivent l'intertitre (jusqu'à la première ligne qui n'en est pas une) → noms de plateformes */
function platformsAfter(lines: readonly string[], heading: string, bullet: RegExp): string[] {
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start < 0) return [];
  const names: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (!line.trim() && names.length === 0) continue;
    const match = bullet.exec(line);
    if (!match) break;
    // « Netflix, optional (…) » → « Netflix » ; « ADN (Animation Digital Network) » gardé entier
    names.push(match[1].split(',')[0].trim());
  }
  return names;
}

const amo: unknown = JSON.parse(readFileSync(new URL('../docs/store/amo-metadata.json', import.meta.url), 'utf8'));

describe('docs/store/amo-metadata.json', () => {
  it('a la forme attendue par l’API AMO (summary, description)', () => {
    expect(isAmoMetadata(amo)).toBe(true);
  });

  for (const { listing, amo: locale, heading } of LOCALES) {
    it(`cite les plateformes de listing-${listing}.md (${locale})`, () => {
      if (!isAmoMetadata(amo)) throw new Error('amo-metadata.json invalide');
      const listingLines = readFileSync(new URL(`../docs/store/listing-${listing}.md`, import.meta.url), 'utf8').split(/\r?\n/);
      const expected = platformsAfter(listingLines, heading, /^•\s*(.+)$/);
      expect(expected.length, `intertitre « ${heading} » introuvable dans listing-${listing}.md`).toBeGreaterThan(0);

      const description = amo.description[locale] ?? '';
      const actual = platformsAfter(description.split('\n'), `**${heading}**`, /^-\s*(.+)$/);
      expect(actual).toEqual(expected);
    });
  }
});
