// Registre des plateformes de streaming : tout ce que SyncKai sait d'une plateforme hors de son adaptateur de contenu
// (libellé, logo, hôtes, liens, accès optionnel, filtre « anime »). Module feuille : aucun import, pour rester
// utilisable partout (shared, ui, background, content) sans cycle. Ajouter une plateforme : l'ajouter à
// STREAMING_PLATFORMS, puis le compilateur exige son descripteur (Record exhaustif) et les Record qui en dépendent.

/** Ordre fixe des plateformes (liens, réglages, repli de « Ouvrir ») */
export const STREAMING_PLATFORMS = ['crunchyroll', 'adn', 'netflix'] as const;

export type StreamingPlatform = (typeof STREAMING_PLATFORMS)[number];

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

/** Domaine exact ou l'un de ses sous-domaines (« crunchyroll.com », « www.crunchyroll.com », pas « evilcrunchyroll.com ») */
function domainOrSubdomain(...domains: readonly string[]): (hostname: string) => boolean {
  return (hostname) => {
    const host = hostname.toLowerCase();
    return domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
  };
}

const CRUNCHYROLL_ID = /^[A-Z0-9]{4,20}$/i;
const ADN_ID = /^\d{1,9}$/;
const NETFLIX_ID = /^\d{1,12}$/;

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
    optionalMatches: ['*://*.netflix.com/*'],
    seriesIdInPath: /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?title\/(\d+)(?:\/|$)/i,
    seriesUrl: (seriesId) => (seriesId !== null && NETFLIX_ID.test(seriesId) ? `https://www.netflix.com/title/${seriesId}` : null),
    searchUrl: (query) => `https://www.netflix.com/search?q=${query}`,
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

/** Motifs de toutes les plateformes à accès optionnel (= `optional_host_permissions` du manifeste) */
export const OPTIONAL_PLATFORM_MATCHES: readonly string[] = STREAMING_PLATFORMS.flatMap((platform) => PLATFORMS[platform].optionalMatches);

/** Libellés des plateformes (même forme que TRACKER_LABELS) */
export const PLATFORM_LABELS: Readonly<Record<StreamingPlatform, string>> = platformRecord((platform) => PLATFORMS[platform].label);

/** Record exhaustif construit plateforme par plateforme (ex : délais par défaut de l'agenda) */
export function platformRecord<T>(value: (platform: StreamingPlatform) => T): Record<StreamingPlatform, T> {
  // Construit sur STREAMING_PLATFORMS, donc complet : la conversion de type est sûre
  return Object.fromEntries(STREAMING_PLATFORMS.map((platform) => [platform, value(platform)])) as Record<StreamingPlatform, T>;
}
