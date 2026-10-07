import { describe, expect, it } from 'vitest';
import manifest from '../../manifest.json';
import { contentScriptMatches } from '../shared/target-pages';
import { classifyTabUrl } from './presence';

const patterns = contentScriptMatches(manifest);

describe('classifyTabUrl', () => {
  it('URL visible : Crunchyroll / ADN ou autre site', () => {
    expect(classifyTabUrl('https://www.crunchyroll.com/watch/x', patterns)).toBe('target');
    expect(classifyTabUrl('https://animationdigitalnetwork.com/video/1', patterns)).toBe('target');
    expect(classifyTabUrl('https://anilist.co/home', patterns)).toBe('other');
  });

  it('URL masquée (pas de permission d’hôte) : le script de contenu tranchera', () => {
    expect(classifyTabUrl(undefined, patterns)).toBe('unknown');
    expect(classifyTabUrl('', patterns)).toBe('unknown');
  });
});
