// Identifiants des plateformes de streaming, sans leurs descripteurs (platforms/registry.ts : libellés, logos, hôtes, liens).
// Module feuille, seule partie du registre dont ont besoin les scripts de contenu (validation des épisodes, réglages).

/** Ordre fixe des plateformes (liens, réglages, repli de « Ouvrir ») */
export const STREAMING_PLATFORMS = ['crunchyroll', 'adn', 'netflix', 'disney', 'prime'] as const;

export type StreamingPlatform = (typeof STREAMING_PLATFORMS)[number];

/** Record exhaustif construit plateforme par plateforme (ex : délais par défaut de l'agenda) */
export function platformRecord<T>(value: (platform: StreamingPlatform) => T): Record<StreamingPlatform, T> {
  // Construit sur STREAMING_PLATFORMS, donc complet : la conversion de type est sûre
  return Object.fromEntries(STREAMING_PLATFORMS.map((platform) => [platform, value(platform)])) as Record<StreamingPlatform, T>;
}
