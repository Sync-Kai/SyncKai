import { describe, expect, it } from 'vitest';
import manifest from '../../manifest.json';
import { IMAGE_HOSTS, isSafeImageUrl, toImageSrc, toSafeImageUrl, toSafeUrl } from './url';

describe('toSafeUrl', () => {
  it('https seulement, domaine facultatif', () => {
    expect(toSafeUrl('https://anilist.co/anime/1', 'anilist.co')).toBe('https://anilist.co/anime/1');
    expect(toSafeUrl('http://anilist.co/anime/1')).toBeNull();
    expect(toSafeUrl('https://evil.example/', 'anilist.co')).toBeNull();
    expect(toSafeUrl('javascript:alert(1)')).toBeNull();
  });
});

describe('images : liste des hôtes autorisés (SEC-02)', () => {
  it('accepte les affiches, bannières et avatars d’AniList et de MyAnimeList', () => {
    for (const url of [
      'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx1-x.jpg',
      'https://s4.anilist.co/file/anilistcdn/user/avatar/medium/default.png',
      'https://cdn.myanimelist.net/images/anime/1015/138006.jpg',
      'https://api-cdn.myanimelist.net/images/anime/1015/138006l.jpg',
    ]) {
      expect(toSafeImageUrl(url), url).toBe(url);
      expect(isSafeImageUrl(url), url).toBe(true);
    }
  });

  it('refuse les autres hôtes, http, identifiants, port, sous-domaines trompeurs et schémas exotiques', () => {
    for (const url of [
      'https://tracker.example/p?id=victime',
      'http://s4.anilist.co/x.jpg',
      'https://s4.anilist.co.tracker.example/x.jpg',
      'https://tracker.example/s4.anilist.co/x.jpg',
      'https://user:pass@s4.anilist.co/x.jpg',
      'https://s4.anilist.co:8443/x.jpg',
      'https://anilist.co/img/x.jpg',
      'javascript:alert(1)',
      'data:image/png;base64,AAAA',
      `https://s4.anilist.co/${'a'.repeat(2000)}`,
      '',
    ]) {
      expect(toSafeImageUrl(url), url).toBeNull();
      expect(isSafeImageUrl(url), url).toBe(false);
    }
    expect(toSafeImageUrl(null)).toBeNull();
    expect(toSafeImageUrl(42)).toBeNull();
  });

  it('isSafeImageUrl n’accepte que la forme normalisée (donnée enregistrée telle qu’affichée)', () => {
    expect(toSafeImageUrl('https://S4.AniList.co/x.jpg')).toBe('https://s4.anilist.co/x.jpg');
    expect(isSafeImageUrl('https://S4.AniList.co/x.jpg')).toBe(false);
  });

  it('toImageSrc : hôte autorisé ou image data: locale, rien d’autre', () => {
    expect(toImageSrc('https://s4.anilist.co/x.jpg')).toBe('https://s4.anilist.co/x.jpg');
    expect(toImageSrc('data:image/svg+xml,%3Csvg%3E%3C/svg%3E')).toBe('data:image/svg+xml,%3Csvg%3E%3C/svg%3E');
    expect(toImageSrc('https://tracker.example/x.jpg')).toBeNull();
    expect(toImageSrc('data:text/html,<script>')).toBeNull();
    expect(toImageSrc(null)).toBeNull();
  });

  it('la CSP des pages de l’extension autorise exactement ces hôtes, et garde script-src / object-src par défaut', () => {
    const csp = manifest.content_security_policy.extension_pages;
    const directives = new Map(
      csp
        .split(';')
        .map((part) => part.trim().split(/\s+/))
        .filter((tokens) => tokens.length > 0 && tokens[0] !== '')
        .map(([name = '', ...values]) => [name, values]),
    );
    expect(directives.get('script-src')).toEqual(["'self'"]);
    expect(directives.get('object-src')).toEqual(["'self'"]);
    expect(directives.get('img-src')).toEqual(["'self'", 'data:', ...IMAGE_HOSTS.map((host) => `https://${host}`)]);
    expect([...directives.keys()].sort()).toEqual(['img-src', 'object-src', 'script-src']);
  });
});
