import type { StreamingPlatform } from '../../shared/episode.types';
import type { TrackerId } from '../../shared/tracker.types';
import { platformIcon, serviceIcon } from '../../ui/brand-icons';
import { h, type Child } from '../../ui/dom';

// Classes partagées par les écrans du popup (direction « Kotatsu »)

export const CARD = 'rounded-card bg-surface';
export const BTN_GHOST =
  'inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-full px-3 text-[12px] font-bold transition-colors hover:bg-raised disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent';
export const BTN_PRIMARY =
  'inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-sakura px-4 text-[12px] font-bold text-on-fill shadow-pop transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50';
export const LINK = 'text-sakura hover:underline';

export const PLATFORM_LABELS: Record<StreamingPlatform, string> = { crunchyroll: 'Crunchyroll', adn: 'ADN', netflix: 'Netflix' };

export const SERVICE_CHIPS: Record<TrackerId, { short: string; class: string }> = {
  anilist: { short: 'AL', class: 'bg-anilist text-[11px]' },
  mal: { short: 'MAL', class: 'bg-mal text-[10px]' },
};

/** Titre de section en capitales discrètes (écran Réglages) */
export function sectionLabel(text: string, id?: string): HTMLElement {
  return h('h2', { class: 'm-0 text-[11px] font-bold tracking-[0.06em] text-muted uppercase', attrs: id ? { id } : {} }, text);
}

/** Titre de section du contenu (« Mes séries », « À vérifier »…) avec son sous-titre katakana décoratif */
export function sectionTitle(text: string, kana?: { text: string; class: string }): HTMLElement {
  return h(
    'div',
    { class: 'flex items-baseline gap-1.5' },
    h('h2', { class: 'm-0 text-[13px] font-bold' }, text),
    kana && kanaLabel(kana.text, kana.class),
  );
}

/** Katakana décoratif (masqué aux lecteurs d'écran) */
export function kanaLabel(text: string, colorClass = 'text-muted'): HTMLElement {
  return h('span', { class: `font-display text-[10px] font-bold tracking-[1px] opacity-70 ${colorClass}`, attrs: { 'aria-hidden': 'true' } }, text);
}

/** Logo de plateforme en coin de jaquette (décoratif : la plateforme est annoncée ailleurs) */
export function platformChip(platform: StreamingPlatform, position: string): HTMLElement {
  return h(
    'span',
    { class: `absolute flex rounded-[5px] ring-2 ring-surface ${position}`, attrs: { 'aria-hidden': 'true' } },
    platformIcon(platform, 'h-3 w-3 rounded-[3px]', { decorative: true }),
  );
}

/** Pastille ronde (logo AniList / MyAnimeList, ou avatar `extra`) avec point d'état (vert connecté, rouge session expirée) */
export function serviceAvatar(service: TrackerId, dot: 'ok' | 'expired' | null, extra: Child = null): HTMLElement {
  const chip = SERVICE_CHIPS[service];
  return h(
    'span',
    // Fond transparent : le logo seul (sans pastille colorée) ; l'avatar `extra` garde sa couleur de repli
    { class: `relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-bold text-on-fill ${extra ? chip.class : ''}`, attrs: { 'aria-hidden': 'true' } },
    extra ?? serviceIcon(service, 'h-6 w-6 rounded-[6px]', { decorative: true }),
    dot &&
      h('span', {
        class: `absolute right-0 bottom-0 h-2 w-2 rounded-full border-2 border-surface ${dot === 'ok' ? 'bg-mint' : 'bg-danger'}`,
      }),
  );
}

// Couleurs de repli des jaquettes (listées en entier pour que Tailwind les génère)
const COVER_COLORS = ['bg-[#8A3B5C]', 'bg-[#6B4A8F]', 'bg-[#2B6A73]', 'bg-[#8A5A2B]', 'bg-[#3E5C8A]', 'bg-[#2F6E5E]'] as const;

export function initials(title: string): string {
  const words = title.split(/[\s:·\-–]+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
  return words
    .slice(0, 2)
    .map((w) => [...w][0] ?? '')
    .join('')
    .toUpperCase();
}

function coverColor(title: string): string {
  let hash = 0;
  for (const char of title) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  return COVER_COLORS[hash % COVER_COLORS.length] ?? COVER_COLORS[0];
}

/**
 * Jaquette : image si disponible, sinon (ou en cas d'échec de chargement) initiales sur fond coloré.
 * `size` porte les dimensions et l'arrondi ; `textSize` la taille des initiales.
 */
export function renderCover(title: string, coverUrl: string | null, size: string, textSize: string, overlay: Child = null): HTMLElement {
  const fallback = h(
    'span',
    {
      class: `absolute inset-0 flex items-center justify-center font-display font-bold text-white [text-shadow:0_1px_0_rgba(0,0,0,.35)] ${textSize}`,
      attrs: { 'aria-hidden': 'true' },
    },
    initials(title),
  );
  const box = h(
    'div',
    { class: `relative shrink-0 rounded-lg shadow-[inset_0_0_0_1px_rgba(255,255,255,.08)] ${coverColor(title)} ${size}` },
    fallback,
  );
  if (coverUrl) {
    const img = h('img', {
      class: 'absolute inset-0 h-full w-full rounded-lg object-cover',
      attrs: { src: coverUrl, alt: '', referrerpolicy: 'no-referrer', loading: 'lazy', decoding: 'async' },
    });
    img.addEventListener('error', () => img.remove(), { once: true });
    box.append(img);
  }
  if (overlay) box.append(overlay);
  return box;
}

interface SegmentedProps<T extends string> {
  options: readonly { value: T; label: string; aria?: string }[];
  current: T;
  onPick: (value: T) => void;
  /** Attributs du groupe (aria-label ou aria-labelledby) */
  attrs: Record<string, string>;
  /** Préfixe des clés de focus (le focus est restauré après un nouveau rendu) */
  focusKey: string;
  activeClass: string;
  trackClass?: string;
  /** Groupe inactif (réglage dépendant désactivé) */
  disabled?: boolean;
}

/** Contrôle segmenté (boutons aria-pressed) */
export function segmented<T extends string>({ options, current, onPick, attrs, focusKey, activeClass, trackClass = 'bg-surface', disabled = false }: SegmentedProps<T>): HTMLElement {
  return h(
    'div',
    { class: `flex h-8 shrink-0 gap-0.5 rounded-full p-0.5 ${trackClass} ${disabled ? 'opacity-50' : ''}`, attrs: { role: 'group', ...attrs } },
    ...options.map((opt) => {
      const on = opt.value === current;
      return h(
        'button',
        {
          class: `h-7 cursor-pointer rounded-full px-3 text-[11px] transition-colors disabled:cursor-default ${on ? `${activeClass} font-bold text-on-fill` : 'font-semibold text-muted hover:text-ink disabled:hover:text-muted'}`,
          attrs: {
            type: 'button',
            'aria-pressed': String(on),
            'data-focus': `${focusKey}-${opt.value}`,
            ...(opt.aria ? { 'aria-label': opt.aria } : {}),
            ...(disabled ? { disabled: '' } : {}),
          },
          on: { click: () => !on && onPick(opt.value) },
        },
        opt.label,
      );
    }),
  );
}
