import type { StreamingPlatform } from '../shared/episode.types';
import type { TrackerId } from '../shared/tracker.types';
import { h } from './dom';

// Logos des plateformes et des services, embarqués dans l'extension (public/brands/) : jamais chargés
// depuis le réseau. Utilisés seulement dans les pages de l'extension (popup, panneau latéral, réglages),
// donc sans web_accessible_resources. Sources officielles (PNG redimensionnés en 64×64) :
// - crunchyroll.png : https://crunchyroll.com/build/assets/img/pwa/v2/512.png (manifest.json du site)
// - adn.png : https://animationdigitalnetwork.com/images/favicon/adn-logo-512x512.webp (manifest.json du site)
// - anilist.png : https://anilist.co/img/icons/android-chrome-512x512.png (manifest.json du site)
// - myanimelist.svg : https://cdn.myanimelist.net/images/favicon.svg (favicon du site, nettoyé)
// Marques de leurs propriétaires respectifs ; SyncKai n'est affilié à aucun de ces services.

const PLATFORM_ICONS: Record<StreamingPlatform, { src: string; alt: string }> = {
  crunchyroll: { src: '/brands/crunchyroll.png', alt: 'Crunchyroll' },
  adn: { src: '/brands/adn.png', alt: 'ADN' },
};

const SERVICE_ICONS: Record<TrackerId, { src: string; alt: string }> = {
  anilist: { src: '/brands/anilist.png', alt: 'AniList' },
  mal: { src: '/brands/myanimelist.svg', alt: 'MyAnimeList' },
};

interface BrandIconOptions {
  /** Purement décoratif (libellé déjà porté par le parent) : alt vide, ignoré des lecteurs d'écran */
  decorative?: boolean;
  /** Infobulle (ex : abréviation « CR ») */
  title?: string;
}

function brandIcon(icon: { src: string; alt: string }, size: string, options: BrandIconOptions): HTMLImageElement {
  return h('img', {
    class: `shrink-0 object-contain ${size}`,
    attrs: {
      src: icon.src,
      alt: options.decorative ? '' : icon.alt,
      ...(options.title ? { title: options.title } : {}),
      draggable: 'false',
      decoding: 'async',
    },
  });
}

/** Logo Crunchyroll / ADN ; `size` : classes Tailwind de taille (ex : 'h-3.5 w-3.5') */
export function platformIcon(platform: StreamingPlatform, size: string, options: BrandIconOptions = {}): HTMLImageElement {
  return brandIcon(PLATFORM_ICONS[platform], size, options);
}

/** Logo AniList / MyAnimeList ; `size` : classes Tailwind de taille */
export function serviceIcon(service: TrackerId, size: string, options: BrandIconOptions = {}): HTMLImageElement {
  return brandIcon(SERVICE_ICONS[service], size, options);
}
