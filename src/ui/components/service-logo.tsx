// Logo AniList / MyAnimeList ou d'une plateforme à 16, 18, 22 ou 28 px, avec une pastille d'état facultative dans le coin
// bas droit (lignes par service des toasts, logos de la barre d'état). Session expirée : logo grisé et point rouge.
import type { StreamingPlatform } from '../../platforms/ids';
import { isStreamingPlatform } from '../../shared/episode.types';
import type { TrackerId } from '../../shared/tracker.types';
import { platformIcon, serviceIcon } from '../brand-icons';
import { MountedNode } from './icon';
import { TONE_BG } from './tone';

export type LogoSize = 'sm' | 'md' | 'lg' | 'tile';
export type LogoBadge = 'ok' | 'info' | 'warn' | 'error' | 'expired';

export interface ServiceLogoProps {
  id: TrackerId | StreamingPlatform;
  /**
   * sm 16 px (toasts, menu du compte), md 18 px (lignes, bouton « Ouvrir »), lg 22 px (barre d'état), tile 28 px (lignes
   * des Réglages › Plateformes, à la place de la pastille d'icône) ; défaut md
   */
  size?: LogoSize;
  badge?: LogoBadge;
  /** Texte alternatif (état compris : « MyAnimeList, session expirée ») ; absent : logo décoratif */
  label?: string;
  /** Fond derrière la pastille (son liseré de 2 px) : `surface` (barre d'état, défaut) ou `raised` (toasts, menus) */
  ring?: 'surface' | 'raised';
}

const SIZES: Readonly<Record<LogoSize, string>> = {
  sm: 'size-logo-sm rounded-logo',
  md: 'size-logo-md rounded-logo',
  lg: 'size-logo-lg rounded-cover',
  tile: 'size-icon-button rounded-control',
};

/** Pastille : 8 px (10 px sur le logo de 22 px) et liseré de 2 px, débordant de 3 px du coin */
const BADGE_SIZES: Readonly<Record<LogoSize, string>> = { sm: 'size-2', md: 'size-2', lg: 'size-2.5', tile: 'size-2.5' };

const BADGE_COLORS: Readonly<Record<LogoBadge, string>> = {
  ok: TONE_BG.ok,
  info: TONE_BG.info,
  warn: TONE_BG.warn,
  error: TONE_BG.error,
  expired: TONE_BG.error,
};

const RINGS = { surface: 'border-surface', raised: 'border-raised' } as const;

export function ServiceLogo({ id, size = 'md', badge, label, ring = 'surface' }: ServiceLogoProps) {
  const dimmed = badge === 'expired';
  const build = (): Node => {
    const classes = `${SIZES[size]} ${dimmed ? 'opacity-45' : ''}`;
    const img = isStreamingPlatform(id) ? platformIcon(id, classes, { decorative: label === undefined }) : serviceIcon(id, classes, { decorative: label === undefined });
    if (label !== undefined) img.alt = label;
    if (dimmed) img.dataset.dimmed = '';
    return img;
  };
  return (
    <span class="relative inline-flex shrink-0">
      <MountedNode build={build} inputs={[id, size, label, dimmed]} />
      {badge && <span class={`absolute -right-0.75 -bottom-0.75 box-content rounded-pill border-2 ${RINGS[ring]} ${BADGE_SIZES[size]} ${BADGE_COLORS[badge]}`} aria-hidden="true" data-badge={badge} />}
    </span>
  );
}
