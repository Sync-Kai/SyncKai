import { describe, expect, it } from 'vitest';
import { slugSearchTitle, stripVersionTags, withoutDiacritics } from './title';

describe('withoutDiacritics', () => {
  it('retire les accents, garde la ponctuation et la casse', () => {
    expect(withoutDiacritics('Moi, quand je me réincarne en Slime')).toBe('Moi, quand je me reincarne en Slime');
    expect(withoutDiacritics('Pokémon')).toBe('Pokemon');
  });

  it('rien à retirer (ou écriture sans accents latins) : null', () => {
    expect(withoutDiacritics('Black Clover')).toBeNull();
    expect(withoutDiacritics('転生したらスライムだった件')).toBeNull();
  });
});

describe('slugSearchTitle', () => {
  it('tirets et soulignés en espaces, encodage décodé', () => {
    expect(slugSearchTitle('that-time-i-got-reincarnated-as-a-slime')).toBe('that time i got reincarnated as a slime');
    expect(slugSearchTitle('re%3Azero__kara')).toBe('re:zero kara');
  });

  it('slug absent, vide ou mal encodé', () => {
    expect(slugSearchTitle(null)).toBeNull();
    expect(slugSearchTitle('---')).toBeNull();
    expect(slugSearchTitle('100%-ok')).toBe('100% ok');
  });
});

describe('stripVersionTags', () => {
  it.each([
    ['Tokyo Ghoul √A (Original Japanese Version)', 'Tokyo Ghoul √A'],
    ['Attack on Titan (English Dubbed)', 'Attack on Titan'],
    ['VINLAND SAGA Season 2 (Simuldub)', 'VINLAND SAGA Season 2'],
    ['Tokyo Ghoul - Uncut', 'Tokyo Ghoul'],
    ['Dororo (dubbed)', 'Dororo'],
    ['Dororo [Subtitled]', 'Dororo'],
    ['From Old Country Bumpkin to Master Swordsman', 'From Old Country Bumpkin to Master Swordsman'],
  ])('« %s » → « %s »', (title, expected) => {
    expect(stripVersionTags(title)).toBe(expected);
  });

  it('parenthèses d’un autre sens gardées, titre vide évité', () => {
    expect(stripVersionTags('Re:ZERO (Director’s Cut)')).toBe('Re:ZERO (Director’s Cut)');
    expect(stripVersionTags('Uncut Gems')).toBe('Uncut Gems');
    expect(stripVersionTags('(Simuldub)')).toBe('(Simuldub)');
  });
});
