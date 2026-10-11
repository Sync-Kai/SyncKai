/** N'accepte que des URLs https (optionnellement restreintes à un domaine) venant de l'API. */
export function toSafeUrl(value: string | null | undefined, allowedHost?: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    if (allowedHost && url.hostname !== allowedHost) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Hôtes des images affichées par les pages de l'extension (SEC-02) : affiches, bannières et avatars d'AniList et de
 * MyAnimeList. Les mêmes figurent dans `content_security_policy.extension_pages` › `img-src` du manifeste (test de
 * cohérence dans url.test.ts) : une image d'un autre hôte n'est jamais chargée.
 */
export const IMAGE_HOSTS: readonly string[] = ['s4.anilist.co', 'cdn.myanimelist.net', 'api-cdn.myanimelist.net'];

/** Longueur maximale d'une URL d'image conservée */
const MAX_IMAGE_URL_LENGTH = 2000;

/** URL d'image https d'un hôte autorisé (IMAGE_HOSTS), normalisée ; null sinon (affiche de remplacement) */
export function toSafeImageUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > MAX_IMAGE_URL_LENGTH) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username !== '' || url.password !== '' || url.port !== '') return null;
    if (!IMAGE_HOSTS.includes(url.hostname)) return null;
    const normalized = url.toString();
    return normalized.length <= MAX_IMAGE_URL_LENGTH ? normalized : null;
  } catch {
    return null;
  }
}

/** Image https d'un hôte autorisé, déjà normalisée (gardes des données enregistrées ou importées) */
export function isSafeImageUrl(value: unknown): value is string {
  return typeof value === 'string' && toSafeImageUrl(value) === value;
}

/**
 * Source d'une balise <img> des pages de l'extension : image d'un hôte autorisé, ou image `data:` (locale, aucune
 * requête réseau) ; null sinon. Dernier filtre avant l'affichage, quelle que soit l'origine de la donnée (cache d'une
 * version précédente, sauvegarde).
 */
export function toImageSrc(value: string | null | undefined): string | null {
  if (typeof value === 'string' && value.startsWith('data:image/') && value.length <= 200_000) return value;
  return toSafeImageUrl(value);
}
