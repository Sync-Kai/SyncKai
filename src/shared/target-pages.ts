import { OPTIONAL_PLATFORM_MATCHES, PLATFORMS } from './platforms';

/**
 * Pages ciblées par SyncKai (Crunchyroll, ADN) : exactement les `matches` du script de contenu.
 * Sert à n'activer le panneau latéral et le bouton « Ouvrir le panneau » que sur ces pages.
 */

interface ManifestContentScripts {
  content_scripts?: { matches?: string[] }[];
}

/** Motifs de correspondance des scripts de contenu, sans doublon */
export function contentScriptMatches(source: ManifestContentScripts): string[] {
  return [...new Set((source.content_scripts ?? []).flatMap((script) => script.matches ?? []))];
}

/**
 * Netflix : accès optionnel (optional_host_permissions), scripts enregistrés à la demande par le service worker
 * (background/netflix-access.ts) et absents de `content_scripts`.
 */
export const NETFLIX_MATCHES: readonly string[] = PLATFORMS.netflix.optionalMatches;

/**
 * Motifs du manifeste chargé (lu à l'exécution : le manifeste n'est pas embarqué dans les bundles), plus les
 * plateformes à accès optionnel (Netflix).
 * Netflix sans accès accordé n'est jamais reconnu : l'URL de l'onglet reste masquée (pas de permission "tabs")
 * et aucun script de contenu n'y répond ni ne signale le panneau.
 */
export function targetPagePatterns(): string[] {
  return [...new Set([...contentScriptMatches(chrome.runtime.getManifest()), ...OPTIONAL_PLATFORM_MATCHES])];
}

/** Page du panneau latéral (chemin conservé tel quel par le build, comme le popup) */
export const SIDE_PANEL_PATH = 'src/sidepanel/sidepanel.html';

const MATCH_PATTERN = /^(\*|https?):\/\/(\*|\*\.[^/*]+|[^/*]+)(\/.*)$/;

function escapeRegExp(text: string): string {
  return text.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Teste une URL contre un motif de correspondance d'extension (sous-ensemble http/https) :
 * schéma `*` = http ou https, hôte `*.exemple.com` = le domaine et ses sous-domaines, `*` du chemin = n'importe quoi.
 */
export function matchesPattern(pattern: string, url: URL): boolean {
  const parts = MATCH_PATTERN.exec(pattern);
  if (!parts) return false;
  const [, scheme, host, path] = parts;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  if (scheme !== '*' && `${scheme}:` !== url.protocol) return false;

  const hostname = url.hostname.toLowerCase();
  if (host.startsWith('*.')) {
    const domain = host.slice(2).toLowerCase();
    if (hostname !== domain && !hostname.endsWith(`.${domain}`)) return false;
  } else if (host !== '*' && hostname !== host.toLowerCase()) {
    return false;
  }

  const pathRegExp = new RegExp(`^${path.split('*').map(escapeRegExp).join('.*')}$`);
  return pathRegExp.test(`${url.pathname}${url.search}`);
}

/** true si l'URL est une page Crunchyroll / ADN (où tourne le script de contenu) ; URL absente ou invalide → false */
export function isTargetPage(url: string | null | undefined, patterns?: readonly string[]): boolean {
  if (!url) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return (patterns ?? targetPagePatterns()).some((pattern) => matchesPattern(pattern, parsed));
}
