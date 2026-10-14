import { describe, expect, it } from 'vitest';
import manifest from '../../manifest.json';
import type { PageMediaInfo } from '../shared/page-media.types';
import { contentScriptMatches } from '../shared/target-pages';
import { answersAsTarget, classifyTabUrl } from './presence';

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

describe('answersAsTarget (URL masquée, script de contenu joignable)', () => {
  const page = (platform: 'crunchyroll' | 'prime'): PageMediaInfo => ({ platform, kind: 'series', seriesId: null, seriesSlug: null, seriesTitle: 'X', seasonNumber: 1, seasonTitle: null, episode: null });

  it('page d’une plateforme dont l’accès a été retiré (script encore actif) : hors page cible', async () => {
    expect(await answersAsTarget(page('prime'), () => Promise.resolve(false))).toBe(false);
    expect(await answersAsTarget(page('prime'), () => Promise.resolve(true))).toBe(true);
  });

  it('plateforme du manifeste, ou page sans série : page cible', async () => {
    expect(await answersAsTarget(page('crunchyroll'), () => Promise.resolve(false))).toBe(true);
    expect(await answersAsTarget(null, () => Promise.resolve(false))).toBe(true);
  });
});
