import { describe, expect, it } from 'vitest';
import { GIT_COMMIT_EPOCH_ARGS, resolveBuildStamp } from './build-stamp';

const now = new Date('2026-10-07T12:00:00.000Z');
const none = { epochEnv: undefined, epochFile: null, gitCommitEpoch: null, now };

describe('resolveBuildStamp', () => {
  it('SOURCE_DATE_EPOCH en priorité', () => {
    expect(resolveBuildStamp({ ...none, epochEnv: '1790000000', epochFile: '1', gitCommitEpoch: '1' })).toBe('2026-09-21T14:13:20.000Z');
  });

  it('puis le fichier .source-date-epoch', () => {
    expect(resolveBuildStamp({ ...none, epochFile: '1790000000\n', gitCommitEpoch: '1' })).toBe('2026-09-21T14:13:20.000Z');
  });

  it('puis la date du dernier commit (secondes Unix, comme .source-date-epoch)', () => {
    expect(resolveBuildStamp({ ...none, gitCommitEpoch: '1790000000\n' })).toBe('2026-09-21T14:13:20.000Z');
  });

  it('valeurs invalides ignorées, repli sur maintenant', () => {
    expect(resolveBuildStamp({ ...none, epochEnv: 'abc', epochFile: '', gitCommitEpoch: '2026-10-05T20:00:00+02:00' })).toBe(now.toISOString());
  });

  it('git : date du commit en secondes Unix (même format que .source-date-epoch)', () => {
    expect(GIT_COMMIT_EPOCH_ARGS).toEqual(['log', '-1', '--format=%ct', 'HEAD']);
  });
});
