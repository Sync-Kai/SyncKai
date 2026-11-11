// Suggestion de l'état vide de « Mes séries » : une fiche compacte (RecoCard) du lot « Pour toi » et « Plus d'idées › »
// (ouvre la section « Pour toi »). Le contrôleur (ui/reco-controller.ts) demande le lot au service worker une seule fois, qui sert celui
// qu'il garde en cache (24 h) avant d'en calculer un. Aucun compte, erreur, lot vide ou chargement : rien n'est affiché.
import { useEffect, useState } from 'preact/hooks';
import { t } from '../../i18n';
import type { StreamingPlatform } from '../../shared/episode.types';
import { Button } from '../../ui/components/button';
import { RecoCard } from '../../ui/components/reco-card';
import { useLocale, useStore } from '../../ui/preact/hooks';
import { createRecoController } from '../../ui/reco-controller';

export interface EmptyRecoProps {
  /** Plateformes à accès optionnel accordées */
  granted: readonly StreamingPlatform[];
  onEnable: (platform: StreamingPlatform) => void;
  /** « Plus d'idées » : ouvre la section « Pour toi » */
  onMore: () => void;
}

export function EmptyReco({ granted, onEnable, onMore }: EmptyRecoProps) {
  useLocale();
  // Un contrôleur par affichage de l'état vide, coupé au démontage (minuterie d'« Annuler »)
  const [ctl] = useState(createRecoController);
  useEffect(() => () => ctl.dispose(), [ctl]);
  const view = useStore(ctl.store);
  if (view.status !== 'ready') return null;
  return (
    <section class="flex flex-col gap-2" aria-label={t('reco.idea')} data-empty-reco="">
      <h3 class="m-0 text-section text-muted uppercase">{t('reco.idea')}</h3>
      <RecoCard
        compact
        item={view.current}
        view={view}
        granted={granted}
        onAnother={ctl.another}
        onAdd={() => void ctl.add()}
        onDismiss={() => void ctl.dismiss()}
        onUndo={() => void ctl.undo()}
        onEnable={onEnable}
      />
      <Button variant="secondary" icon="sparkles" focusKey="reco-more" onClick={onMore}>
        {t('reco.more')} ›
      </Button>
    </section>
  );
}
