// Registre des plateformes de streaming : tout ce que SyncKai sait d'une plateforme hors de son adaptateur de contenu
// (libellé, logo, hôtes, liens, accès optionnel, filtre « anime »). Seuls imports : platforms/ids.ts et shared/hosts.ts
// (feuilles), pour rester utilisable partout (shared, ui, background, content) sans cycle. Ajouter une plateforme :
// l'ajouter à STREAMING_PLATFORMS (platforms/ids.ts), puis le compilateur exige son descripteur (Record exhaustif)
// et les Record qui en dépendent.

import { domainOrSubdomain } from '../shared/hosts';
import { platformRecord, STREAMING_PLATFORMS, type StreamingPlatform } from './ids';

// Identifiants (liste, type, platformRecord) : platforms/ids.ts, repris ici
export { platformRecord, STREAMING_PLATFORMS, type StreamingPlatform } from './ids';

export interface PlatformDescriptor {
  /** Nom affiché (marque, non traduit) */
  label: string;
  /** Logo embarqué (public/brands/), jamais chargé depuis le réseau */
  icon: string;
  /** Page d'accueil (liens « Ouvrir Crunchyroll » de l'écran vide) */
  homeUrl: string;
  /** Hôte de la plateforme, sous-domaines compris (lien externe AniList, lien appris) */
  matchesHost: (hostname: string) => boolean;
  /**
   * Catalogue généraliste : une série n'est traitée comme un anime que si une fiche AniList y renvoie, ou à défaut
   * porte le même titre (à vérifier). Voir gateByPlatformLink.
   */
  linkRequired: boolean;
  /** Proposée en recherche (« Chercher sur… ») sans lien connu vers l'anime */
  searchable: boolean;
  /**
   * Motifs d'accès optionnel (`optional_host_permissions`), scripts enregistrés à la demande. Vide : plateforme
   * déclarée dans `content_scripts` du manifeste.
   */
  optionalMatches: readonly string[];
  /** Identifiant de série dans le chemin d'un lien de la plateforme (préfixe de langue optionnel), groupe 1 */
  seriesIdInPath: RegExp;
  /** Page canonique de la série ; `slug` déjà validé (minuscules) ou null. null si l'identifiant n'a pas la forme attendue */
  seriesUrl: (seriesId: string | null, slug: string | null) => string | null;
  /** Page de recherche ; `query` déjà encodée pour l'URL */
  searchUrl: (query: string) => string;
}

const CRUNCHYROLL_ID = /^[A-Z0-9]{4,20}$/i;
const ADN_ID = /^\d{1,9}$/;
const NETFLIX_ID = /^\d{1,12}$/;
const DISNEY_ENTITY_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** GTI compact de Prime Video (26 caractères, chemin /detail/{id} d'une page de saison) */
const PRIME_COMPACT_GTI = /^[0-9A-Z]{26}$/i;

export const PLATFORMS: Readonly<Record<StreamingPlatform, PlatformDescriptor>> = {
  crunchyroll: {
    label: 'Crunchyroll',
    icon: '/brands/crunchyroll.png',
    homeUrl: 'https://www.crunchyroll.com',
    matchesHost: domainOrSubdomain('crunchyroll.com'),
    linkRequired: false,
    searchable: true,
    optionalMatches: [],
    seriesIdInPath: /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?series\/([A-Z0-9]+)(?:\/|$)/i,
    // Slug facultatif : Crunchyroll redirige vers la forme complète
    seriesUrl: (seriesId, slug) =>
      seriesId !== null && CRUNCHYROLL_ID.test(seriesId) ? `https://www.crunchyroll.com/series/${seriesId.toUpperCase()}${slug ? `/${slug}` : ''}` : null,
    searchUrl: (query) => `https://www.crunchyroll.com/search?q=${query}`,
  },
  adn: {
    label: 'ADN',
    icon: '/brands/adn.png',
    homeUrl: 'https://animationdigitalnetwork.com',
    matchesHost: domainOrSubdomain('animationdigitalnetwork.com', 'animationdigitalnetwork.fr', 'animationdigitalnetwork.de'),
    linkRequired: false,
    searchable: true,
    optionalMatches: [],
    // Page de série ou d'épisode : /video/{seriesId}-{slug}[/{episodeId}-…]
    seriesIdInPath: /^\/(?:[a-z]{2}\/)?video\/(\d+)-/i,
    // Slug obligatoire : /video/{id} seul ne mène nulle part
    seriesUrl: (seriesId, slug) =>
      seriesId !== null && ADN_ID.test(seriesId) && slug !== null ? `https://animationdigitalnetwork.com/video/${seriesId}-${slug}` : null,
    // SearchAction du JSON-LD de la page d'accueil
    searchUrl: (query) => `https://animationdigitalnetwork.com/video?search=${query}`,
  },
  netflix: {
    label: 'Netflix',
    icon: '/brands/netflix.png',
    homeUrl: 'https://www.netflix.com',
    matchesHost: domainOrSubdomain('netflix.com'),
    linkRequired: true,
    // Catalogue généraliste : une recherche par titre proposerait n'importe quelle série homonyme
    searchable: false,
    optionalMatches: ['https://*.netflix.com/*'],
    seriesIdInPath: /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?title\/(\d+)(?:\/|$)/i,
    seriesUrl: (seriesId) => (seriesId !== null && NETFLIX_ID.test(seriesId) ? `https://www.netflix.com/title/${seriesId}` : null),
    searchUrl: (query) => `https://www.netflix.com/search?q=${query}`,
  },
  disney: {
    label: 'Disney+',
    icon: '/brands/disney.png',
    homeUrl: 'https://www.disneyplus.com',
    matchesHost: domainOrSubdomain('disneyplus.com'),
    // Catalogue généraliste : seuls les animes (langue originale japonaise) liés à Disney+ sur AniList sont suivis
    linkRequired: true,
    searchable: false,
    optionalMatches: ['https://*.disneyplus.com/*'],
    // Page de série actuelle : /{langue}/browse/entity-{uuid} (les anciens liens /series/{slug}/{id} n'ont pas de clé)
    seriesIdInPath: /^\/(?:[a-z]{2,3}(?:-[a-z0-9]{2,4})?\/)?browse\/entity-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/|$)/i,
    seriesUrl: (seriesId) => (seriesId !== null && DISNEY_ENTITY_ID.test(seriesId) ? `https://www.disneyplus.com/browse/entity-${seriesId.toLowerCase()}` : null),
    searchUrl: (query) => `https://www.disneyplus.com/search?q=${query}`,
  },
  prime: {
    label: 'Prime Video',
    icon: '/brands/prime.png',
    homeUrl: 'https://www.primevideo.com',
    // primevideo.com seulement : les sites amazon.<tld> (boutique) ne sont ni lus ni ciblés (hors v1)
    matchesHost: domainOrSubdomain('primevideo.com'),
    // Catalogue généraliste, mais filtre par genre (av_genre_anime…) côté script de contenu : résolution normale
    linkRequired: false,
    searchable: false,
    optionalMatches: ['https://*.primevideo.com/*'],
    // Page de détail : /[region/{xx}/][-/{langue}/]detail/{id} ; id = ASIN (10), GTI compact (26) ou GTI complet
    seriesIdInPath: /^\/(?:region\/[a-z]{2}\/)?(?:-\/[a-z]{2}(?:-[a-z]{2})?\/)?detail\/([A-Z0-9]{10}|[0-9A-Z]{26}|amzn1\.dv\.gti\.[0-9a-f-]{36})(?:\/|$)/i,
    // Page canonique d'une saison : GTI compact seulement (un ASIN régional ou un GTI complet n'y mène pas toujours)
    seriesUrl: (seriesId) => (seriesId !== null && PRIME_COMPACT_GTI.test(seriesId) ? `https://www.primevideo.com/detail/${seriesId.toUpperCase()}` : null),
    searchUrl: (query) => `https://www.primevideo.com/search?phrase=${query}`,
  },
};

/** Plateforme dont l'hôte correspond, null sinon */
export function platformFromHost(hostname: string): StreamingPlatform | null {
  return STREAMING_PLATFORMS.find((platform) => PLATFORMS[platform].matchesHost(hostname)) ?? null;
}

/** Plateforme activée à la demande (permission d'hôte optionnelle) */
export function isOptionalPlatform(platform: StreamingPlatform): boolean {
  return PLATFORMS[platform].optionalMatches.length > 0;
}

/**
 * Motifs `*://` (http et https) que les versions ≤ 2.3.1 demandaient pour la plateforme, avant le passage en `https://`
 * seulement (SEC-02). Chrome réduit l'accès déjà accordé au nouveau motif à la mise à jour ; Firefox le garde tel quel
 * dans ses permissions accordées : `contains(https://…)` reste vrai (englobement), mais `remove(https://…)` ne le retire
 * pas (comparaison exacte des chaînes), d'où ce motif, retiré en second (browser/platform-access.ts).
 */
export function legacyAccessMatches(platform: StreamingPlatform): string[] {
  return PLATFORMS[platform].optionalMatches.map((pattern) => pattern.replace(/^https:\/\//, '*://'));
}

/** Motifs de toutes les plateformes à accès optionnel (= `optional_host_permissions` du manifeste) */
export const OPTIONAL_PLATFORM_MATCHES: readonly string[] = STREAMING_PLATFORMS.flatMap((platform) => PLATFORMS[platform].optionalMatches);

/** Libellés des plateformes (même forme que TRACKER_LABELS) */
export const PLATFORM_LABELS: Readonly<Record<StreamingPlatform, string>> = platformRecord((platform) => PLATFORMS[platform].label);

