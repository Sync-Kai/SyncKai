import { describe, expect, it } from 'vitest';
import { SOURCES } from '../test/import-graph';
import en from './locales/en.json';

// Clés mortes (audit 2026-11-10, ARCH-05) : chaque clé de en.json doit être citée par le code de production de src/, en
// littéral ('watching.refresh') ou sous un préfixe construit (`page.status.${…}`, 'genre.' + …). Une clé citée par un test
// seulement est morte : 21 catalogues et une note de contexte à tenir pour rien.

const KEY_PREFIX = /^[a-z][A-Za-z]*(?:\.[A-Za-z0-9_]+)*\.$/;
const production = [...SOURCES].filter(([path]) => !/\.test\.tsx?$/.test(path) && !path.startsWith('test/') && !path.startsWith('i18n/locales/'));

const literals = new Set<string>();
const prefixes = new Set<string>();
for (const [, code] of production) {
  for (const m of code.matchAll(/'([^'\\\n]*)'|"([^"\\\n]*)"/g)) {
    const text = m[1] ?? m[2] ?? '';
    literals.add(text);
    if (KEY_PREFIX.test(text)) prefixes.add(text);
  }
  // Préfixe statique d'un gabarit (`panel.nowPlaying.season.${season}`) : seulement s'il a la forme d'un début de clé
  for (const m of code.matchAll(/`([^`$\\]*)\$\{/g)) if (m[1] !== undefined && KEY_PREFIX.test(m[1])) prefixes.add(m[1]);
}

const baseKey = (key: string): string => key.replace(/_(zero|one|two|few|many|other)$/, '');
const isReferenced = (key: string): boolean => {
  const base = baseKey(key);
  return literals.has(key) || literals.has(base) || [...prefixes].some((prefix) => base.startsWith(prefix));
};

describe('clés de traduction utilisées', () => {
  it('les préfixes dynamiques connus sont bien lus', () => {
    expect([...prefixes]).toEqual(expect.arrayContaining(['genre.', 'page.status.', 'panel.nowPlaying.season.', 'friends.status.']));
  });

  it('chaque clé de en.json est citée par le code de production', () => {
    expect(Object.keys(en).filter((key) => !isReferenced(key))).toEqual([]);
  });
});
