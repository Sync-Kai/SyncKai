// CSP des pages de l'extension et du service worker (SEC-12) : chaque hôte qu'elle autorise est réellement contacté, et
// chaque hôte contacté y figure. Le service worker partage cette CSP (connect-src : API AniList / MAL, catalogues de
// traduction lus dans le paquet), comme les pages (img-src : affiches, voir shared/url.ts › IMAGE_HOSTS).
import { describe, expect, it } from 'vitest';
import manifest from '../../manifest.json';
import { contentScriptMatches } from '../platforms/target-pages';
import { IMAGE_HOSTS } from '../shared/url';
import { SOURCES } from '../test/import-graph';
import { ANILIST_GRAPHQL_URL } from './anilist/client';
import { MAL_TOKEN_URL } from './mal/auth';
import { MAL_API_URL } from './mal/client';

/** Directives de la CSP : nom → valeurs */
function directives(csp: string): Map<string, string[]> {
  return new Map(
    csp
      .split(';')
      .map((part) => part.trim().split(/\s+/))
      .filter((tokens) => tokens.length > 0 && tokens[0] !== '')
      .map(([name = '', ...values]) => [name, values]),
  );
}

const CSP = directives(manifest.content_security_policy.extension_pages);

/** `https://graphql.anilist.co/*` → `https://graphql.anilist.co` */
const originOf = (pattern: string): string => new URL(pattern.replace(/\*$/, '')).origin;

/** Sources des pages et du service worker : hors tests, aides de test et scripts de contenu (soumis à la CSP de la page) */
const pageSources = (): [string, string][] =>
  [...SOURCES].filter(([file]) => !file.endsWith('.test.ts') && !file.startsWith('content/') && !file.startsWith('test/') && !file.includes('__'));

describe('CSP des pages et du service worker (SEC-12)', () => {
  it('directives exactes : tout fermé par défaut, scripts du paquet seulement', () => {
    expect([...CSP.keys()].sort()).toEqual(['base-uri', 'connect-src', 'default-src', 'form-action', 'frame-ancestors', 'img-src', 'object-src', 'script-src']);
    expect(CSP.get('default-src')).toEqual(["'self'"]);
    expect(CSP.get('script-src')).toEqual(["'self'"]);
    expect(CSP.get('object-src')).toEqual(["'self'"]);
    expect(CSP.get('base-uri')).toEqual(["'none'"]);
    expect(CSP.get('form-action')).toEqual(["'none'"]);
    expect(CSP.get('frame-ancestors')).toEqual(["'none'"]);
    // Ni 'unsafe-inline' ni 'unsafe-eval' nulle part ; style-src et font-src suivent default-src ('self' : CSS et woff2 du paquet)
    expect(manifest.content_security_policy.extension_pages).not.toMatch(/unsafe-|\*/);
  });

  it('img-src = hôtes d’images autorisés (IMAGE_HOSTS)', () => {
    expect(CSP.get('img-src')).toEqual(["'self'", 'data:', ...IMAGE_HOSTS.map((host) => `https://${host}`)]);
  });

  it('connect-src = le paquet (catalogues de traduction) + les API de host_permissions, hors sites de streaming', () => {
    const sites = contentScriptMatches(manifest);
    const apis = manifest.host_permissions.filter((pattern) => !sites.includes(pattern)).map(originOf);
    expect(CSP.get('connect-src')).toEqual(["'self'", ...apis]);
  });

  it('chaque requête du service worker vise une origine de connect-src', () => {
    const allowed = CSP.get('connect-src') ?? [];
    for (const url of [ANILIST_GRAPHQL_URL, MAL_API_URL, MAL_TOKEN_URL]) expect(allowed, url).toContain(new URL(url).origin);
  });

  it('aucun attribut style posé par setAttribute dans les pages (bloqué sans style-src \'unsafe-inline\' : passer par element.style)', () => {
    const offenders = pageSources().flatMap(([file, code]) => (/setAttribute\(\s*['"`]style['"`]/.test(code) ? [file] : []));
    expect(offenders).toEqual([]);
  });
});
