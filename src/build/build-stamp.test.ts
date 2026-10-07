import { describe, expect, it } from 'vitest';
import { resolveBuildStamp } from './build-stamp';

const now = new Date('2026-10-07T12:00:00.000Z');
const none = { epochEnv: undefined, epochFile: null, gitCommitTime: null, now };

describe('resolveBuildStamp', () => {
  it('SOURCE_DATE_EPOCH en priorité', () => {
    expect(resolveBuildStamp({ ...none, epochEnv: '1790000000', epochFile: '1', gitCommitTime: '2026-01-01T00:00:00Z' })).toBe('2026-09-21T14:13:20.000Z');
  });

  it('puis le fichier .source-date-epoch', () => {
    expect(resolveBuildStamp({ ...none, epochFile: '1790000000\n', gitCommitTime: '2026-01-01T00:00:00Z' })).toBe('2026-09-21T14:13:20.000Z');
  });

  it('puis la date du dernier commit (fuseau normalisé en UTC)', () => {
    expect(resolveBuildStamp({ ...none, gitCommitTime: '2026-10-05T20:00:00+02:00\n' })).toBe('2026-10-05T18:00:00.000Z');
  });

  it('valeurs invalides ignorées, repli sur maintenant', () => {
    expect(resolveBuildStamp({ ...none, epochEnv: 'abc', epochFile: '', gitCommitTime: 'pas une date' })).toBe(now.toISOString());
  });
});
