import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import en from '../src/i18n/locales/en.json';

// Notes de contexte des traducteurs (docs/i18n/context.json) : une par clé de l'anglais, tenues à jour avec le catalogue
// (une clé ajoutée sans note laisserait les traducteurs deviner où et comment le texte s'affiche)
const notes = JSON.parse(readFileSync(new URL('../docs/i18n/context.json', import.meta.url), 'utf8')) as Record<string, unknown>;

describe('notes de contexte des traductions', () => {
  it('une note par clé de en.json, aucune note orpheline', () => {
    expect(Object.keys(notes).sort()).toEqual(Object.keys(en).sort());
  });

  it('chaque note est un texte non vide', () => {
    expect(Object.entries(notes).filter(([, note]) => typeof note !== 'string' || note.trim() === '').map(([key]) => key)).toEqual([]);
  });
});
