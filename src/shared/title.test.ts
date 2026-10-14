import { describe, expect, it } from 'vitest';
import { slugSearchTitle, withoutDiacritics } from './title';

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
