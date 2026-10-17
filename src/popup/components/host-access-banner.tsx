// Bandeau « SyncKai n'a pas accès à Crunchyroll / ADN » (maquettes PopupAccesInitial, PopupAcces ; Firefox : accès aux
// sites retirable) sous les onglets : titre et « Autoriser l'accès », plus la ligne « Accès refusé… » après un refus.
// Annoncé une fois (région live de la page), puis à nouveau seulement si son texte change.
import { joinSentences, t } from '../../i18n';
import { alertAttrs } from '../../ui/live-region';
import { Button } from '../../ui/components/button';
import { Icon } from '../../ui/components/icon';
import type { HostAccessState } from '../state';

export interface HostAccessBannerProps {
  state: HostAccessState;
  onAllow: () => void;
}

/** Rien tant que l'accès est accordé ou pas encore vérifié */
export function HostAccessBanner({ state, onAllow }: HostAccessBannerProps) {
  if (state.status !== 'missing') return null;
  const message = state.denied ? joinSentences([t('popup.hostAccessMissing'), t('popup.hostAccessDenied')]) : t('popup.hostAccessMissing');
  return (
    <div class="mx-4 mb-2 flex shrink-0 flex-wrap items-center gap-x-2.5 gap-y-2 rounded-card border border-butter/30 bg-butter/8 px-3 py-2.5" {...alertAttrs(message)} data-host-access="">
      <span class="flex shrink-0 self-start pt-0.5 text-butter">
        <Icon name="triangle" class="size-4" strokeWidth="2.4" />
      </span>
      <div class="min-w-0 flex-[1_1_200px]">
        <p class="m-0 font-extrabold break-words text-butter">{t('popup.hostAccessMissing')}</p>
        {state.denied && <p class="m-0 mt-0.5 text-secondary break-words text-muted">{t('popup.hostAccessDenied')}</p>}
      </div>
      <Button variant="primary" focusKey="host-access" class="ml-auto" onClick={onAllow}>
        {t('popup.hostAccessAllow')}
      </Button>
    </div>
  );
}
