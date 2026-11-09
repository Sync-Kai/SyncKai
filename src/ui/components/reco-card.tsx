// Carte « Pour toi » (popup, panneau) : la suggestion tirée, la raison du tirage (case lavande), les plateformes et les
// actions « Autre » / « + À regarder » / « Pas intéressé ». Aucun accès au service worker : tout vient du contrôleur
// (ui/reco-controller.ts). Mouvement réduit : le dé ne tourne pas, la fiche apparaît en fondu seul.
import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { PLATFORM_LABELS, isOptionalPlatform, type StreamingPlatform } from '../../platforms/registry';
import { genreKey } from '../../shared/genres';
import type { RecoItem } from '../../shared/recommendations';
import { toSafeUrl } from '../../shared/url';
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
  onEnable?: (platform: StreamingPlatform) => void;
}

/** Durée du tour du dé (theme.css › --animate-dice-turn) */
const DICE_MS = 360;
const MAX_CHIPS = 4;

const chipClass = 'inline-flex max-w-full items-center truncate rounded-pill bg-raised px-2 py-0.5 text-secondary text-muted';

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
              <button key={platform} type="button" class={`${chipClass} cursor-pointer opacity-55 hover:opacity-100`} data-platform={platform} onClick={() => onEnable?.(platform)}>
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

export function RecoCard({ item, compact = false, view, onAnother, onAdd, onDismiss, onUndo, granted, onEnable }: RecoCardProps) {
  const { card, reason } = item;
  const [rolling, setRolling] = useState(false);
  const rollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (rollTimer.current !== null) clearTimeout(rollTimer.current);
    },
    [],
  );

  const another = (): void => {
    setRolling(true);
    if (rollTimer.current !== null) clearTimeout(rollTimer.current);
    rollTimer.current = setTimeout(() => setRolling(false), DICE_MS);
    onAnother();
  };

  const notOnMal = view.malOnly && card.idMal === null;
  const href = toSafeUrl(card.siteUrl);
  const meta = [card.format, card.year, card.episodes !== null ? t('review.episodes', { count: card.episodes }) : null].filter((part): part is string | number => part !== null && part !== '');
  const dismissed = view.dismissedTitle !== null;

  return (
    <section class="flex flex-col gap-2.5 rounded-card border border-line bg-surface p-3" aria-label={t('reco.title')} data-reco="">
      {/* Une clé par fiche : le contenu apparaît en fondu à chaque tirage, les boutons gardent leur focus */}
      <div key={card.id} class="flex animate-reco-in flex-col gap-2.5 motion-reduce:animate-reco-in" data-reco-item={card.id}>
        <div class="flex items-start gap-3">
          <Cover size={compact ? 'card' : 'hero'} title={card.title} src={card.coverLarge ?? card.coverUrl} />
          <div class="flex min-w-0 flex-1 flex-col gap-0.5">
            {href ? (
              <a class="text-row-title text-ink no-underline hover:underline" href={href} target="_blank" rel="noopener noreferrer">
                {card.title}
              </a>
            ) : (
              <span class="text-row-title text-ink">{card.title}</span>
            )}
            <span class="text-secondary text-muted">{meta.join(' · ')}</span>
            {card.averageScore !== null && <span class="text-secondary font-bold text-butter">★ {(card.averageScore / 10).toFixed(1)}</span>}
          </div>
        </div>
        {reason && (
          <div class="flex flex-col gap-1.5 rounded-panel bg-lavender/14 px-2.5 py-2" data-reco-why="">
            <span class="text-body text-ink">{t('reco.because', { title: reason.seedTitle, score: reason.seedScore })}</span>
            {reason.matched.length > 0 && (
              <div class="flex flex-wrap gap-1.5">
                {reason.matched.slice(0, MAX_CHIPS).map((name) => (
                  <span key={name} class={chipClass} data-reco-chip="">
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
          <span class="inline-flex min-w-0 items-center gap-1 rounded-pill bg-raised py-0.5 pl-3 pr-1 text-secondary text-muted">
            <span class="min-w-0 truncate">{t('reco.dismissed', { title: view.dismissedTitle ?? '' })}</span>
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
          <Button variant="primary" focusKey="reco-add" onClick={onAdd}>
            {t('page.addPlanning')}
          </Button>
        )}
        {/* Même bouton à chaque rendu : il garde le focus d'un tirage à l'autre */}
        <Button variant="secondary" focusKey="reco-another" ariaLabel={t('reco.anotherAria')} onClick={another}>
          <Icon name="dice" class={`size-4 ${rolling ? 'animate-dice-turn motion-reduce:animate-none' : ''}`} />
          {rolling ? t('reco.rolling') : t('reco.another')}
        </Button>
        {!dismissed && (
          <Button variant="text" size="sm" focusKey="reco-dismiss" ariaLabel={t('reco.dismissAria', { title: card.title })} onClick={onDismiss}>
            {t('reco.dismiss')}
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
        {reason ? t('reco.announce', { title: card.title, seed: reason.seedTitle }) : ''}
      </div>
    </section>
  );
}
