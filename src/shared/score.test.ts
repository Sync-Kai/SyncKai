import { describe, expect, it } from 'vitest';
import { scoresMatch } from './compare';
import {
  aniListScoreOn10,
  aniListScores,
  fromAniListScore,
  fromMalScore,
  isAniListScoreFormat,
  MAL_SCORES,
  scoreCodec,
  toAniListScore,
  toMalScore,
  type AniListScoreFormat,
  type ScoreCodec,
} from './score';

describe('toAniListScore', () => {
  it('POINT_100 : note × 10', () => {
    expect(toAniListScore(8.5, 'POINT_100')).toBe(85);
    expect(toAniListScore(0.5, 'POINT_100')).toBe(5);
  });

  it('POINT_10_DECIMAL : note telle quelle', () => {
    expect(toAniListScore(7.5, 'POINT_10_DECIMAL')).toBe(7.5);
    expect(toAniListScore(10, 'POINT_10_DECIMAL')).toBe(10);
  });

  it('POINT_10 : arrondi inférieur comme MAL, minimum 1', () => {
    expect(toAniListScore(7.5, 'POINT_10')).toBe(7);
    expect(toAniListScore(8, 'POINT_10')).toBe(8);
    expect(toAniListScore(0.5, 'POINT_10')).toBe(1);
  });

  it('POINT_5 : moitié arrondie, minimum 1', () => {
    expect(toAniListScore(9, 'POINT_5')).toBe(5);
    expect(toAniListScore(6, 'POINT_5')).toBe(3);
    expect(toAniListScore(0.5, 'POINT_5')).toBe(1);
  });

  it('POINT_3 : paliers 4 / 7', () => {
    expect(toAniListScore(4, 'POINT_3')).toBe(1);
    expect(toAniListScore(4.5, 'POINT_3')).toBe(1);
    expect(toAniListScore(5, 'POINT_3')).toBe(2);
    expect(toAniListScore(7, 'POINT_3')).toBe(2);
    expect(toAniListScore(7.5, 'POINT_3')).toBe(2);
    expect(toAniListScore(8, 'POINT_3')).toBe(3);
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

// ─── Contrat commun des codecs (audit 6-P2, prolonge B1) ────────────────

const FORMATS: readonly AniListScoreFormat[] = ['POINT_100', 'POINT_10_DECIMAL', 'POINT_10', 'POINT_5', 'POINT_3'];
/** Toutes les notes SyncKai : 0,5 à 10 par demi-point */
const SCORES: readonly number[] = Array.from({ length: 20 }, (_, i) => (i + 1) / 2);
const CODECS: readonly [string, ScoreCodec][] = [['MAL', MAL_SCORES], ...FORMATS.map((format): [string, ScoreCodec] => [`AniList ${format}`, aniListScores(format)])];

describe.each(CODECS)('contrat du codec de notes : %s', (_name, codec) => {
  it('une note écrite se relit toujours comme une note (jamais « non notée »), entre 0,5 et 10', () => {
    for (const score of SCORES) {
      const read = codec.decode(codec.encode(score));
      expect(read, `note ${score}`).not.toBeNull();
      expect(read ?? 0).toBeGreaterThanOrEqual(0.5);
      expect(read ?? 11).toBeLessThanOrEqual(10);
      expect(codec.on10(codec.encode(score)), `note ${score}`).not.toBeNull();
    }
  });

  it('aller-retour stable : réécrire la note relue écrit la même valeur', () => {
    for (const score of SCORES) {
      const raw = codec.encode(score);
      expect(codec.encode(codec.decode(raw) ?? 0), `note ${score}`).toBe(raw);
    }
  });

  it('une note plus haute ne s’écrit jamais plus bas', () => {
    for (let i = 1; i < SCORES.length; i++) expect(codec.encode(SCORES[i] ?? 0)).toBeGreaterThanOrEqual(codec.encode(SCORES[i - 1] ?? 0));
  });

  it('0 = non notée', () => {
    expect(codec.decode(0)).toBeNull();
    expect(codec.on10(0)).toBeNull();
  });
});

describe.each(FORMATS)('parité AniList ↔ MAL (B1) : %s', (format) => {
  const anilist = aniListScores(format);

  it('une même note SyncKai écrite sur les deux services n’est jamais un écart', () => {
    for (const score of SCORES) expect(scoresMatch(anilist.encode(score), MAL_SCORES.encode(score), format), `note ${score}`).toBe(true);
  });

  it('alignement dans les deux sens : la valeur recopiée n’est pas un écart', () => {
    for (const score of SCORES) {
      const raw = anilist.encode(score);
      expect(scoresMatch(raw, MAL_SCORES.encode(anilist.on10(raw) ?? 0), format), `AniList ${raw} → MAL`).toBe(true);
    }
    for (let mal = 1; mal <= 10; mal++) expect(scoresMatch(anilist.encode(mal), mal, format), `MAL ${mal} → AniList`).toBe(true);
  });

  it('scoreCodec : le codec de chaque service', () => {
    expect(scoreCodec('anilist', format).encode(8.5)).toBe(anilist.encode(8.5));
    expect(scoreCodec('mal', format)).toBe(MAL_SCORES);
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
