import { describe, expect, it } from 'vitest';
import { cleanPageTitle, cleanText, createLabelGuard, flattenJsonLd, labelKey, slugToTitle, stripAudioTag, toNumber } from './parsing';

describe('toNumber / cleanText', () => {
  it('lit les nombres, y compris avec virgule décimale', () => {
    expect(toNumber('12')).toBe(12);
    expect(toNumber(25)).toBe(25);
    expect(toNumber('12,5')).toBe(12.5);
    expect(toNumber('abc')).toBeNull();
    expect(toNumber(null)).toBeNull();
  });

  it('normalise les espaces et rejette le vide', () => {
    expect(cleanText('  One   Piece \n')).toBe('One Piece');
    expect(cleanText('   ')).toBeNull();
    expect(cleanText(42)).toBeNull();
  });
});

describe('flattenJsonLd', () => {
  it('aplatit tableaux et @graph', () => {
    const nodes = flattenJsonLd([{ '@type': 'A' }, { '@graph': [{ '@type': 'B' }] }]);
    expect(nodes.map((n) => n['@type'])).toEqual(['A', undefined, 'B']);
  });
});

describe('createLabelGuard', () => {
  it('signale un libellé déjà attribué à un autre épisode (DOM périmé)', () => {
    const guard = createLabelGuard();
    guard.remember('ep-1179', labelKey(1179, 'Titre A'));
    expect(guard.isStale('ep-1180', labelKey(1179, 'Titre A'))).toBe(true);
    expect(guard.isStale('ep-1179', labelKey(1179, 'Titre A'))).toBe(false);
    expect(guard.isStale('ep-1180', labelKey(1180, 'Titre B'))).toBe(false);
  });

  it('ignore les libellés sans titre', () => {
    const guard = createLabelGuard();
    guard.remember('ep-1', labelKey(1, null));
    expect(guard.isStale('ep-2', labelKey(1, null))).toBe(false);
  });
});

describe('titres de page de série', () => {
  it('slugToTitle : dernier repli lisible', () => {
    expect(slugToTitle('black-clover')).toBe('black clover');
    expect(slugToTitle('re%3Azero')).toBe('re:zero');
    expect(slugToTitle(null)).toBeNull();
  });

  it('cleanPageTitle retire la plateforme et l’appel à l’action', () => {
    expect(cleanPageTitle('Black Clover - Watch on Crunchyroll', /crunchyroll/i)).toBe('Black Clover');
    expect(cleanPageTitle('Regarder Black Clover | Crunchyroll', /crunchyroll/i)).toBe('Black Clover');
    expect(cleanPageTitle('TOUGEN ANKI - ADN', /\bADN\b/i)).toBe('TOUGEN ANKI');
    expect(cleanPageTitle('Crunchyroll', /crunchyroll/i)).toBeNull();
  });

  it('stripAudioTag retire la mention de version', () => {
    expect(stripAudioTag('Elbaph (VF)')).toBe('Elbaph');
    expect(stripAudioTag('Frieren (English Dub)')).toBe('Frieren');
    expect(stripAudioTag('Re:Zero (Director’s Cut)')).toBe('Re:Zero (Director’s Cut)');
  });
});
