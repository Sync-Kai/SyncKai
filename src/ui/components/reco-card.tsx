// Carte « Pour toi » (popup, panneau) : la suggestion tirée, la raison du tirage (case lavande), les plateformes et les
// actions « Autre » / « + À regarder » / « Pas intéressé ». Aucun accès au service worker : tout vient du contrôleur
// (ui/reco-controller.ts). Mouvement réduit : le dé ne tourne pas, la fiche apparaît en fondu seul.
import { useEffect, useRef, useState } from 'preact/hooks';
import { getLocale, t } from '../../i18n';
import { PLATFORM_LABELS, isOptionalPlatform, type StreamingPlatform } from '../../platforms/registry';
import { genreKey } from '../../shared/genres';
import type { RecoItem } from '../../shared/recommendations';
import { TRACKER_LABELS } from '../../shared/tracker.types';
import { toImageSrc, toSafeUrl } from '../../shared/url';
import { useMediaQuery } from '../preact/hooks';
import type { RecoView } from '../reco-controller';
import { Button } from './button';
import { Cover } from './cover';
import { Icon } from './icon';

type ReadyView = Extract<RecoView, { status: 'ready' }>;

export interface RecoCardProps {
  item: RecoItem;
  /** Popup : une colonne étroite, sans la liste « Déjà tirées » */
  compact?: boolean;
  view: ReadyView;
  onAnother: () => void;
  onAdd: () => void;
  onDismiss: () => void;
  onUndo: () => void;
  /** Plateformes optionnelles dont l'accès est accordé */
  granted: readonly StreamingPlatform[];
  /** Clic sur « Activer {plateforme} » (la demande d'accès part dans le clic) */
  onEnable: (platform: StreamingPlatform) => void;
}

/** Durée du tour du dé (theme.css › --animate-dice-turn) */
const DICE_MS = 360;
const MAX_CHIPS = 4;

/** Couleur dominante AniList (#rrggbb) ; autre forme : ignorée */
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

const chipClass = 'inline-flex max-w-full items-center truncate rounded-pill bg-raised px-2 py-0.5 text-secondary text-muted';
const genreChipClass = 'inline-flex max-w-full items-center truncate rounded-pill bg-lavender/14 px-2 py-0.5 text-secondary font-bold text-lavender';
const tagChipClass = 'inline-flex max-w-full items-center truncate rounded-pill border border-line px-2 py-0.5 text-secondary text-muted';

/** Note de l'utilisateur au format de la langue (« 8,5 » en français) */
const formatScore = (score: number): string => new Intl.NumberFormat(getLocale(), { maximumFractionDigits: 1 }).format(score);

/** Genre traduit, sinon le nom AniList (étiquette ou genre inconnu) */
function chipLabel(name: string): string {
  const key = genreKey(name);
  return key ? t(key) : name;
}

function PlatformChips({ item, granted, onEnable }: Pick<RecoCardProps, 'item' | 'granted' | 'onEnable'>) {
  const links = item.card.platforms;
  if (links.length === 0) return null;
  return (
    <div class="flex flex-col gap-1">
      <span class="text-overline uppercase text-muted">{t('reco.where')}</span>
      <div class="flex flex-wrap gap-1.5">
        {links.map(({ platform, url }) => {
          const label = PLATFORM_LABELS[platform];
          const href = toSafeUrl(url);
          if (isOptionalPlatform(platform) && !granted.includes(platform)) {
            // Accès non accordé : puce grisée, le clic demande l'accès
            return (
              <button key={platform} type="button" class={`${chipClass} cursor-pointer opacity-55 hover:opacity-100`} data-platform={platform} onClick={() => onEnable(platform)}>
                {t('panel.enablePlatform', { platform: label })}
              </button>
            );
          }
          return href ? (
            <a key={platform} class={`${chipClass} no-underline hover:text-ink`} href={href} target="_blank" rel="noopener noreferrer" data-platform={platform}>
              {label}
            </a>
          ) : null;
        })}
      </div>
    </div>
  );
}

export function RecoCard({ item: liveItem, compact = false, view: liveView, onAnother, onAdd, onDismiss, onUndo, granted, onEnable }: RecoCardProps) {
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  // Tirage en cours : l'ancienne fiche reste affichée le temps du tour du dé, puis la nouvelle apparaît en fondu
  const [held, setHeld] = useState<{ item: RecoItem; view: ReadyView } | null>(null);
  const rollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const root = useRef<HTMLElement>(null);
  const wasDismissed = useRef(false);
  useEffect(
    () => () => {
      if (rollTimer.current !== null) clearTimeout(rollTimer.current);
    },
    [],
  );

  // Focus : « Pas intéressé » disparaît, « Annuler » le reprend ; après l'annulation ou le délai, retour sur « Autre »
  const dismissedNow = liveView.dismissedTitle !== null;
  useEffect(() => {
    const section = root.current;
    if (!section || wasDismissed.current === dismissedNow) return;
    wasDismissed.current = dismissedNow;
    const active = document.activeElement;
    // Focus ailleurs dans la page : on ne le vole pas
    if (active && active !== document.body && !section.contains(active)) return;
    section.querySelector<HTMLElement>(`[data-focus="${dismissedNow ? 'reco-undo' : 'reco-another'}"]`)?.focus();
  }, [dismissedNow]);

  const shown = held ?? { item: liveItem, view: liveView };
  const { item, view } = shown;
  const { card, reason } = item;
  const rolling = held !== null;

  const another = (): void => {
    if (held) return;
    if (!reduced) {
      setHeld({ item: liveItem, view: liveView });
      rollTimer.current = setTimeout(() => {
        rollTimer.current = null;
        setHeld(null);
      }, DICE_MS);
    }
    onAnother();
  };

  // Pendant le tour du dé la fiche affichée n'est plus celle du contrôleur : ajouter ou écarter agirait sur une série jamais vue
  const add = (): void => {
    if (!held) onAdd();
  };
  const dismiss = (): void => {
    if (!held) onDismiss();
  };

  const notOnMal = view.malOnly && card.idMal === null;
  const bannerSrc = toImageSrc(card.bannerUrl);
  const bannerColor = card.color !== null && HEX_COLOR.test(card.color) ? card.color : null;
  // Genres et étiquettes de la raison, séparés (leurs puces n'ont pas la même couleur)
  const matched = reason ? reason.matched.slice(0, MAX_CHIPS) : [];
  const href = toSafeUrl(card.siteUrl);
  const meta = [card.format, card.year, card.episodes !== null ? t('review.episodes', { count: card.episodes }) : null].filter((part): part is string | number => part !== null && part !== '');
  const dismissed = view.dismissedTitle !== null;

  return (
    <section ref={root} class="flex flex-col gap-2.5 overflow-hidden rounded-card border border-line bg-surface p-3" aria-label={t('reco.title')} data-reco="">
      {/* Une clé par fiche : le contenu apparaît en fondu à chaque tirage, les boutons gardent leur focus */}
      <div key={card.id} class="flex animate-reco-in flex-col gap-2.5 motion-reduce:animate-reco-in" data-reco-item={card.id}>
        <div class="relative -mx-3 -mt-3 h-18 overflow-hidden bg-raised" style={bannerColor ? { backgroundColor: bannerColor } : undefined} data-reco-banner="">
          {bannerSrc && <img class="absolute inset-0 size-full object-cover" src={bannerSrc} alt="" referrerpolicy="no-referrer" loading="lazy" decoding="async" draggable={false} />}
          <span class="absolute inset-0 bg-linear-to-b from-transparent to-surface" aria-hidden="true" />
        </div>
        <div class="flex items-start gap-3">
          <div class={`relative shrink-0 ${compact ? '-mt-7' : '-mt-9'}`}>
            <Cover size={compact ? 'card' : 'hero'} title={card.title} src={card.coverLarge ?? card.coverUrl} />
          </div>
          <div class="flex min-w-0 flex-1 flex-col gap-0.5">
            {href ? (
              <a class="line-clamp-2 text-row-title text-ink no-underline hover:underline" href={href} target="_blank" rel="noopener noreferrer" title={card.title}>
                {card.title}
              </a>
            ) : (
              <span class="line-clamp-2 text-row-title text-ink" title={card.title}>
                {card.title}
              </span>
            )}
            <span class="text-secondary text-muted">{meta.join(' · ')}</span>
            {card.averageScore !== null && <span class="text-secondary font-bold text-butter">★ {(card.averageScore / 10).toFixed(1)}</span>}
          </div>
        </div>
        {reason && (
          <div class="flex flex-col gap-1.5 rounded-panel bg-raised px-2.5 py-2" data-reco-why="">
            <span class="flex items-start gap-1.5 text-body text-ink">
              <Icon name="sparkles" class="mt-0.5 size-3.5 shrink-0 text-lavender" />
              {reason.rated ? t('reco.because', { title: reason.seedTitle, score: formatScore(reason.seedScore) }) : t('reco.becauseWatched', { title: reason.seedTitle })}
            </span>
            {matched.length > 0 && (
              <div class="flex flex-wrap gap-1.5">
                {matched.map((name) => (
                  <span key={name} class={card.genres.includes(name) ? genreChipClass : tagChipClass} data-reco-chip={card.genres.includes(name) ? 'genre' : 'tag'}>
                    {chipLabel(name)}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
        <PlatformChips item={item} granted={granted} onEnable={onEnable} />
      </div>

      <div class="flex flex-wrap items-center gap-2">
        {dismissed ? (
          <span class="inline-flex min-w-0 items-center gap-1 rounded-panel bg-raised py-0.5 pl-3 pr-1 text-secondary text-muted">
            {/* Titre long ou traduction longue : le message passe à la ligne au lieu d'être tronqué */}
            <span class="min-w-0 break-words">{t('reco.dismissed', { title: view.dismissedTitle ?? '' })}</span>
            <Button variant="text" size="sm" focusKey="reco-undo" onClick={onUndo}>
              {t('reco.undo')}
            </Button>
          </span>
        ) : view.added ? (
          <span class="inline-flex h-8 items-center gap-1.5 rounded-pill bg-raised px-4 text-body font-extrabold text-muted" data-reco-added="">
            <Icon name="check" class="size-4" />
            {t('reco.inPlanning')}
          </span>
        ) : notOnMal ? (
          <span class="text-secondary text-muted">{t('reco.notOnMal')}</span>
        ) : (
          <Button variant="primary" focusKey="reco-add" onClick={add}>
            {t('page.addPlanning')}
          </Button>
        )}
        {/* Même bouton à chaque rendu : il garde le focus d'un tirage à l'autre */}
        <Button variant="secondary" focusKey="reco-another" ariaLabel={t('reco.anotherAria')} onClick={another}>
          <Icon name="dice" class={`size-4 ${rolling ? 'animate-dice-turn motion-reduce:animate-none' : ''}`} />
          {rolling ? t('reco.rolling') : t('reco.another')}
        </Button>
        {!dismissed && (
          <Button variant="text" size="sm" focusKey="reco-dismiss" ariaLabel={t('reco.dismissAria', { title: card.title })} onClick={dismiss}>
            {t('reco.dismiss')}
          </Button>
        )}
        {href && (
          <Button variant="text" size="sm" href={href} target="_blank" icon="external">
            {t('page.openOn', { service: TRACKER_LABELS.anilist })}
          </Button>
        )}
      </div>

      {view.addError && (
        <span class="text-secondary text-danger" data-alert={view.addError}>
          {view.addError}
        </span>
      )}

      {!compact && view.previous.length > 0 && (
        <div class="flex flex-col gap-1 border-t border-line pt-2">
          <span class="text-overline uppercase text-muted">{t('reco.previous')}</span>
          <ul class="m-0 flex list-none flex-col gap-0.5 p-0">
            {view.previous.map((earlier) => {
              const earlierHref = toSafeUrl(earlier.card.siteUrl);
              return (
                <li key={earlier.card.id} class="truncate text-secondary">
                  {earlierHref ? (
                    <a class="text-muted no-underline hover:text-ink" href={earlierHref} target="_blank" rel="noopener noreferrer">
                      {earlier.card.title}
                    </a>
                  ) : (
                    <span class="text-muted">{earlier.card.title}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Annonce polie de la nouvelle suggestion (le focus reste sur « Autre ») */}
      <div class="sr-only" role="status" aria-live="polite">
        {reason ? t(reason.rated ? 'reco.announce' : 'reco.announceWatched', { title: card.title, seed: reason.seedTitle }) : t('reco.announceCold', { title: card.title })}
      </div>
    </section>
  );
}
