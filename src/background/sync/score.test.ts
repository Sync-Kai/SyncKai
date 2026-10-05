import { describe, expect, it } from 'vitest';
import { aniListScoreOn10, fromAniListScore, fromMalScore, isAniListScoreFormat, toAniListScore, toMalScore } from './score';

describe('toAniListScore', () => {
  it('POINT_100 : note × 10', () => {
    expect(toAniListScore(8.5, 'POINT_100')).toBe(85);
    expect(toAniListScore(0.5, 'POINT_100')).toBe(5);
  });

  it('POINT_10_DECIMAL : note telle quelle', () => {
    expect(toAniListScore(7.5, 'POINT_10_DECIMAL')).toBe(7.5);
    expect(toAniListScore(10, 'POINT_10_DECIMAL')).toBe(10);
  });

  it('POINT_10 : arrondi, minimum 1', () => {
    expect(toAniListScore(7.5, 'POINT_10')).toBe(8);
    expect(toAniListScore(0.5, 'POINT_10')).toBe(1);
  });

  it('POINT_5 : moitié arrondie, minimum 1', () => {
    expect(toAniListScore(9, 'POINT_5')).toBe(5);
    expect(toAniListScore(6, 'POINT_5')).toBe(3);
    expect(toAniListScore(0.5, 'POINT_5')).toBe(1);
  });

  it('POINT_3 : paliers 4 / 7', () => {
    expect(toAniListScore(4, 'POINT_3')).toBe(1);
    expect(toAniListScore(4.5, 'POINT_3')).toBe(2);
    expect(toAniListScore(7, 'POINT_3')).toBe(2);
    expect(toAniListScore(7.5, 'POINT_3')).toBe(3);
  });
});

describe('toMalScore', () => {
  it("arrondit à l'inférieur et borne entre 1 et 10", () => {
    expect(toMalScore(0.5)).toBe(1);
    expect(toMalScore(6.5)).toBe(6);
    expect(toMalScore(8.5)).toBe(8);
    expect(toMalScore(10)).toBe(10);
  });
});

describe('isAniListScoreFormat', () => {
  it('reconnaît les formats AniList', () => {
    expect(isAniListScoreFormat('POINT_5')).toBe(true);
    expect(isAniListScoreFormat('POINT_7')).toBe(false);
    expect(isAniListScoreFormat(null)).toBe(false);
  });
});

describe('note du service → note sur 10 (affichage)', () => {
  it('convertit chaque format AniList au demi-point', () => {
    expect(fromAniListScore(85, 'POINT_100')).toBe(8.5);
    expect(fromAniListScore(87, 'POINT_100')).toBe(8.5);
    expect(fromAniListScore(7.3, 'POINT_10_DECIMAL')).toBe(7.5);
    expect(fromAniListScore(8, 'POINT_10')).toBe(8);
    expect(fromAniListScore(4, 'POINT_5')).toBe(8);
    expect(fromAniListScore(3, 'POINT_3')).toBe(10);
  });

  it('0 = non notée ; MAL entier', () => {
    expect(fromAniListScore(0, 'POINT_100')).toBeNull();
    expect(fromMalScore(0)).toBeNull();
    expect(fromMalScore(9)).toBe(9);
  });

  it('aller-retour stable pour une note SyncKai sur 100', () => {
    expect(fromAniListScore(toAniListScore(7.5, 'POINT_100'), 'POINT_100')).toBe(7.5);
  });
});

describe('aniListScoreOn10', () => {
  it('valeur sur 10 non arrondie, null si non notée', () => {
    expect(aniListScoreOn10(78, 'POINT_100')).toBe(7.8);
    expect(aniListScoreOn10(8.5, 'POINT_10_DECIMAL')).toBe(8.5);
    expect(aniListScoreOn10(4, 'POINT_5')).toBe(8);
    expect(aniListScoreOn10(3, 'POINT_3')).toBe(10);
    expect(aniListScoreOn10(0, 'POINT_100')).toBeNull();
  });
});
