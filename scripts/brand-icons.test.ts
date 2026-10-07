import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Les logos sont embarqués (public/brands/) et référencés par chemin absolu : chaque chemin doit exister,
// rester léger, et aucun ne doit pointer vers le réseau.
describe('logos des plateformes et des services', () => {
  const source = readFileSync('src/ui/brand-icons.ts', 'utf8');
  const paths = [...source.matchAll(/src: '(\/brands\/[\w.-]+)'/g)].map((m) => m[1]);

  it('quatre logos locaux (Crunchyroll, ADN, AniList, MyAnimeList)', () => {
    expect(paths).toEqual(['/brands/crunchyroll.png', '/brands/adn.png', '/brands/anilist.png', '/brands/myanimelist.svg']);
  });

  it.each(paths)('%s : présent dans public/ et léger', (path) => {
    expect(statSync(`public${path}`).size).toBeLessThan(8 * 1024);
  });

  it('aucun chargement réseau', () => {
    expect(source).not.toMatch(/src: 'https?:/);
    expect(readFileSync('public/brands/myanimelist.svg', 'utf8')).not.toMatch(/href|<script|url\(/i);
  });
});
