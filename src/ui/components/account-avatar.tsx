// Avatar d'un compte AniList / MyAnimeList (menu du compte, Réglages › Comptes) : photo du profil, sinon dégradé de la
// marque avec une silhouette ; logo du service de 16 px dans le coin. Session expirée : grisé ; non connecté : cercle
// en pointillés sans couleur de marque (maquettes MenuCompte, Comptes, ComptesConnexion).
import { useEffect, useState } from 'preact/hooks';
import type { TrackerId } from '../../shared/tracker.types';
import { Icon } from './icon';
import { ServiceLogo } from './service-logo';

export type AvatarSize = 'sm' | 'md';
export type AvatarState = 'connected' | 'expired' | 'disconnected';

export interface AccountAvatarProps {
  service: TrackerId;
  /** Image du profil (déjà passée par toImageSrc) ; null : dégradé */
  url: string | null;
  state?: AvatarState;
  /** sm 36 px (menu du compte), md 44 px (Réglages › Comptes) */
  size?: AvatarSize;
  /** Fond derrière le logo du coin (son liseré) : celui du menu (`raised`) ou de la carte (`surface`) */
  ring?: 'surface' | 'raised';
}

/** Fond de l'avatar sans image : dégradé de la marque du service */
const GRADIENT: Readonly<Record<TrackerId, string>> = { anilist: 'from-lavender to-sakura', mal: 'from-mint to-mal' };
const SIZES: Readonly<Record<AvatarSize, { box: string; glyph: string }>> = {
  sm: { box: 'size-9', glyph: 'size-7' },
  md: { box: 'size-11', glyph: 'size-8.5' },
};
const RINGS = { surface: 'border-surface bg-surface', raised: 'border-raised bg-raised' } as const;

export function AccountAvatar({ service, url, state = 'connected', size = 'sm', ring = 'raised' }: AccountAvatarProps) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  const { box, glyph } = SIZES[size];
  const dimmed = state === 'expired' ? 'opacity-55' : '';
  let face;
  if (state === 'disconnected') {
    face = (
      <span class={`flex ${box} items-end justify-center overflow-hidden rounded-pill border border-dashed border-field text-field`} aria-hidden="true">
        <Icon name="user" class={glyph} strokeWidth="2" />
      </span>
    );
  } else if (url && !failed) {
    face = <img class={`block ${box} rounded-pill object-cover ${dimmed}`} src={url} alt="" referrerpolicy="no-referrer" onError={() => setFailed(true)} />;
  } else {
    face = (
      <span class={`flex ${box} items-end justify-center overflow-hidden rounded-pill bg-linear-135 text-ink ${GRADIENT[service]} ${dimmed}`} aria-hidden="true">
        <Icon name="user" class={`${glyph} opacity-90`} strokeWidth="2.2" />
      </span>
    );
  }
  return (
    <span class={`relative block ${box} shrink-0`} data-avatar={state}>
      {face}
      <span class={`absolute -right-0.75 -bottom-0.75 flex rounded-logo border-2 ${RINGS[ring]} ${state === 'disconnected' ? 'opacity-55' : ''}`}>
        <ServiceLogo id={service} size="sm" ring={ring} />
      </span>
    </span>
  );
}
