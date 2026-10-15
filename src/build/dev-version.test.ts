import { describe, expect, it } from 'vitest';
import { devVersionName } from './dev-version';

describe('devVersionName', () => {
  it('version, suffixe dev et commit abrégé', () => {
    expect(devVersionName('2.3.1', { sha: '3c8ec4f', dirty: false })).toBe('2.3.1-dev · 3c8ec4f');
  });

  it('fichiers suivis modifiés au build : « + »', () => {
    expect(devVersionName('2.3.1', { sha: '3c8ec4f', dirty: true })).toBe('2.3.1-dev · 3c8ec4f+');
  });

  it('hors dépôt git : suffixe dev seul', () => {
    expect(devVersionName('2.3.1', null)).toBe('2.3.1-dev');
  });
});
