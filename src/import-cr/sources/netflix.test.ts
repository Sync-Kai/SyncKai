import { describe, expect, it } from 'vitest';
import { netflixSource } from './netflix';
import { isTargetPage } from '../../platforms/target-pages';

// Onglet de l'historique Netflix : /viewingactivity redirige vers /settings/viewed (relevé le 2026-11-13)
describe('onglet de l’historique Netflix', () => {
  it('trouve la nouvelle page /settings/viewed et garde l’ancienne', () => {
    for (const url of ['https://www.netflix.com/settings/viewed', 'https://www.netflix.com/settings/viewed/', 'https://www.netflix.com/fr/settings/viewed', 'https://www.netflix.com/viewingactivity', 'https://www.netflix.com/be-fr/viewingactivity']) {
      expect(isTargetPage(url, netflixSource.tabPatterns), url).toBe(true);
    }
    for (const url of ['https://www.netflix.com/browse', 'https://www.netflix.com/settings/profile', 'https://www.netflix.com/watch/80000001']) {
      expect(isTargetPage(url, netflixSource.tabPatterns), url).toBe(false);
    }
  });

  it('ouvre la nouvelle page', () => {
    expect(netflixSource.home).toBe('https://www.netflix.com/settings/viewed');
  });
});
