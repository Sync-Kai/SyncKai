// Vue « Pour toi » (onglet « Découvrir » du panneau latéral, section « Pour toi » du popup) : la carte « Pour toi » (ui/components/reco-card.tsx) et les états du lot
// (chargement, démarrage à froid avec « En attendant », note MAL seul, erreur, vide, aucun compte). Données et requêtes :
// ui/reco-controller.ts (créé au premier affichage de l'onglet par sidepanel.ts, de la section par popup.ts), sans accès direct au service worker.
import { t } from '../../i18n';
import type { StreamingPlatform } from '../../shared/episode.types';
import { Alert } from './alert';
import { Button } from './button';
import { Icon } from './icon';
import { RecoCard } from './reco-card';
import { useLocale, useStore } from '../preact/hooks';
import type { RecoView } from '../reco-controller';
import type { ReadonlyStore } from '../state';

export interface DiscoverProps {
  state: ReadonlyStore<RecoView>;
  /** Plateformes à accès optionnel accordées */
  granted: readonly StreamingPlatform[];
  onAnother: () => void;
  onAdd: () => void;
  onDismiss: () => void;
  onUndo: () => void;
  onRetry: () => void;
  /** « Revoir les écartées » */
  onRestore: () => void;
  onEnable: (platform: StreamingPlatform) => void;
  /** Aucun compte : Réglages › Comptes */
  onOpenAccounts: () => void;
  /** « Retirer le filtre » (état `filtered`, seulement dans le popup) */
  onClearFilter?: () => void;
}

const NOTE = 'm-0 text-secondary text-muted';

export function Discover({ state, granted, onAnother, onAdd, onDismiss, onUndo, onRetry, onRestore, onEnable, onOpenAccounts, onClearFilter }: DiscoverProps) {
  useLocale();
  const view = useStore(state);
  switch (view.status) {
    case 'loading':
      return (
        <div class="flex items-center justify-center gap-2 py-8 text-muted" role="status">
          <span class="flex text-lavender motion-safe:animate-spin">
            <Icon name="spinner" class="size-4" strokeWidth="2.4" />
          </span>
          {t('reco.loading')}
        </div>
      );
    case 'error':
      return <Alert message={t('reco.error', { error: view.message ?? '' })} action={{ label: t('common.retry'), onClick: onRetry, focusKey: 'reco-retry' }} />;
    case 'empty':
      return (
        <div class="flex flex-col items-start gap-2 py-4">
          <p class="m-0 text-body font-bold text-ink">{t('reco.empty.title')}</p>
          <Button variant="secondary" focusKey="reco-restore" onClick={onRestore}>
            {t('reco.empty.action')}
          </Button>
        </div>
      );
    case 'filtered':
      return (
        <div class="flex flex-col items-start gap-2 py-4">
          <p class="m-0 text-body text-muted">{t('compare.filter.empty')}</p>
          <Button variant="secondary" focusKey="reco-clear-filter" onClick={() => onClearFilter?.()}>
            {t('reco.filter.clear')}
          </Button>
        </div>
      );
    case 'none':
      return (
        <div class="flex flex-col items-start gap-2 py-4">
          <p class="m-0 text-body text-muted">{t('settings.summary.noAccount')}</p>
          <Button variant="primary" focusKey="reco-connect" onClick={onOpenAccounts}>
            {t('common.connect')}
          </Button>
        </div>
      );
    case 'ready':
      return (
        <div class="flex flex-col gap-2.5 pt-2">
          {view.cold && (
            <div class="flex flex-col gap-0.5" data-reco-cold="">
              <p class="m-0 text-body font-bold text-ink">{t('reco.cold.title')}</p>
              <p class={NOTE}>{t('reco.cold.text')}</p>
              <p class="m-0 mt-1 text-overline uppercase text-muted">{t('reco.cold.meanwhile')}</p>
            </div>
          )}
          {view.malOnly && <p class={NOTE}>{t('reco.malOnly')}</p>}
          <RecoCard item={view.current} view={view} granted={granted} onAnother={onAnother} onAdd={onAdd} onDismiss={onDismiss} onUndo={onUndo} onEnable={onEnable} />
        </div>
      );
  }
}
