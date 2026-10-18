// Lecture de la réponse AniList des vraies jaquettes (captures du Store) : seules les URL https de s4.anilist.co passent,
// comme toImageSrc dans les vues ; une forme inattendue donne null (jaquettes de remplacement).
import { describe, expect, it } from 'vitest';
import { parseCovers } from './anilist-covers.ts';
import { DEMO_MEDIA_IDS } from './demo-media.ts';

const CDN = 'https://s4.anilist.co/file/anilistcdn/media/anime';

describe('parseCovers', () => {
  it('garde la plus grande jaquette, la bannière et la couleur de chaque fiche', () => {
    const body = {
      data: {
        Page: {
          media: [
            { id: 154587, coverImage: { large: `${CDN}/cover/medium/bx154587.jpg`, extraLarge: `${CDN}/cover/large/bx154587.jpg`, color: '#E4A15D' }, bannerImage: `${CDN}/banner/154587.jpg` },
            { id: 170068, coverImage: { large: `${CDN}/cover/medium/bx170068.jpg`, extraLarge: null, color: null }, bannerImage: null },
          ],
        },
      },
    };
    expect(parseCovers(body)).toEqual({
      154587: { cover: `${CDN}/cover/large/bx154587.jpg`, banner: `${CDN}/banner/154587.jpg`, color: '#e4a15d' },
      170068: { cover: `${CDN}/cover/medium/bx170068.jpg`, banner: null, color: null },
    });
  });

  it('refuse les URL hors de s4.anilist.co ou sans https', () => {
    const body = { data: { Page: { media: [{ id: 21, coverImage: { large: 'http://s4.anilist.co/a.jpg', extraLarge: 'https://evil.example/a.jpg', color: 'red' }, bannerImage: 'javascript:alert(1)' }] } } };
    expect(parseCovers(body)).toEqual({ 21: { cover: null, banner: null, color: null } });
  });

  it('rend null pour une réponse d’erreur', () => {
    expect(parseCovers({ errors: [{ message: 'Too Many Requests.' }], data: null })).toBeNull();
    expect(parseCovers('nope')).toBeNull();
  });

  it('demande toutes les fiches de démo en une requête (Page(perPage: 50))', () => {
    expect(DEMO_MEDIA_IDS.length).toBeGreaterThan(0);
    expect(DEMO_MEDIA_IDS.length).toBeLessThanOrEqual(50);
  });
});
