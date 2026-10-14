/**
 * Textes du manifeste (nom, description, raccourcis) traduits par le navigateur : un dossier `public/_locales/<langue>`
 * par langue de l'interface (nom Chrome : `es_419`, `pt_BR`, `zh_CN`…), mêmes messages que l'anglais (langue par
 * défaut du manifeste), description dans la limite de Chrome. scripts/package.ts exige les mêmes dossiers.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isRecord } from '../src/shared/guards.ts';
import { chromeLocaleFolder, LOCALES } from '../src/i18n/locale-codes.ts';

const DIR = 'public/_locales';
/** Limite de Chrome pour la description du manifeste (au-delà, l'extension ne se charge pas) */
const MAX_DESCRIPTION = 132;

/** Messages d'un dossier : nom → texte (message absent ou vide : chaîne vide) */
function messages(folder: string): Map<string, string> {
  const parsed: unknown = JSON.parse(readFileSync(`${DIR}/${folder}/messages.json`, 'utf8'));
  if (!isRecord(parsed)) throw new Error(`${folder}/messages.json : objet attendu`);
  return new Map(Object.entries(parsed).map(([name, entry]) => [name, isRecord(entry) && typeof entry.message === 'string' ? entry.message : '']));
}

const folders = readdirSync(DIR, { withFileTypes: true });
const english = messages('en');

describe('public/_locales', () => {
  it('exactement un dossier par langue de l’interface, rien d’autre', () => {
    expect(folders.every((entry) => entry.isDirectory())).toBe(true);
    expect(folders.map((entry) => entry.name).sort()).toEqual(LOCALES.map(chromeLocaleFolder).sort());
  });

  it.each(LOCALES.map(chromeLocaleFolder))('%s : mêmes messages que l’anglais, aucun vide, description ≤ 132 caractères', (folder) => {
    const own = messages(folder);
    expect([...own.keys()].sort()).toEqual([...english.keys()].sort());
    expect([...own].filter(([, text]) => text.trim() === '').map(([name]) => name)).toEqual([]);
    expect([...(own.get('extDescription') ?? '')].length).toBeLessThanOrEqual(MAX_DESCRIPTION);
  });
});
