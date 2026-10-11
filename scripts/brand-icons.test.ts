import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Les logos sont embarqués (public/brands/) et référencés par chemin absolu (plateformes : registre shared/platforms.ts,
// services : ui/brand-icons.ts) : chaque chemin doit exister, rester léger, et aucun ne doit pointer vers le réseau.
describe('logos des plateformes et des services', () => {
  const source = ['src/shared/platforms.ts', 'src/ui/brand-icons.ts'].map((file) => readFileSync(file, 'utf8')).join('\n');
  const paths = [...source.matchAll(/(?:src|icon): '(\/brands\/[\w.-]+)'/g)].map((m) => m[1]);

  it('cinq logos locaux (Crunchyroll, ADN, Netflix, AniList, MyAnimeList)', () => {
    expect(paths).toEqual(['/brands/crunchyroll.png', '/brands/adn.png', '/brands/netflix.png', '/brands/anilist.png', '/brands/myanimelist.svg']);
  });

  it.each(paths)('%s : présent dans public/ et léger', (path) => {
    expect(statSync(`public${path}`).size).toBeLessThan(8 * 1024);
  });

  it('aucun chargement réseau', () => {
    expect(source).not.toMatch(/(?:src|icon): 'https?:/);
    expect(readFileSync('public/brands/myanimelist.svg', 'utf8')).not.toMatch(/href|<script|url\(/i);
  });
});
