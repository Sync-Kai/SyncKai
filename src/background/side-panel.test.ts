import { describe, expect, it } from 'vitest';
import manifest from '../../manifest.json';
import { contentScriptMatches } from '../shared/target-pages';
import { panelTabFromSender } from './side-panel';

const patterns = contentScriptMatches(manifest);

describe('panelTabFromSender', () => {
  it('cadre principal d’une page Crunchyroll / ADN → onglet', () => {
    expect(panelTabFromSender({ url: 'https://www.crunchyroll.com/watch/x', frameId: 0, tab: { id: 7 } }, patterns)).toBe(7);
    expect(panelTabFromSender({ url: 'https://animationdigitalnetwork.com/video/1', frameId: 0, tab: { id: 3 } }, patterns)).toBe(3);
  });

  it('autre site, sous-cadre ou expéditeur sans onglet → null', () => {
    expect(panelTabFromSender({ url: 'https://example.com/', frameId: 0, tab: { id: 7 } }, patterns)).toBeNull();
    expect(panelTabFromSender({ url: 'https://www.crunchyroll.com/watch/x', frameId: 2, tab: { id: 7 } }, patterns)).toBeNull();
    expect(panelTabFromSender({ url: 'https://www.crunchyroll.com/watch/x', frameId: 0 }, patterns)).toBeNull();
    expect(panelTabFromSender({ url: 'https://www.crunchyroll.com/watch/x', frameId: 0, tab: { id: -1 } }, patterns)).toBeNull();
    expect(panelTabFromSender({ frameId: 0, tab: { id: 7 } }, patterns)).toBeNull();
  });
});
