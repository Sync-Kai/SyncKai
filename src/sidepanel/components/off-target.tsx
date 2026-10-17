// « En lecture » hors page de streaming (maquettes PanelHorsPage, PanelHorsPageVariantes, bloc préféré du propriétaire) :
// icône, « SyncKai fonctionne sur … » et les plateformes réellement suivies en pastilles (logo + nom), puis, sous un
// trait, « … : à activer dans Réglages › Plateformes » (le chemin ouvre la page) et un bouton « Activer {plateforme} »
// avec son logo par plateforme optionnelle encore inactive. Toutes actives : la première phrase et les pastilles seules.
// La notice n'apparaît que si l'utilisateur choisit « En lecture » hors streaming (sinon le panneau passe sur l'Agenda).
import { t } from '../../i18n';
import { activePlatforms } from '../../browser/platform-access';
import { isOptionalPlatform, PLATFORMS, STREAMING_PLATFORMS } from '../../platforms/registry';
import type { StreamingPlatform } from '../../shared/episode.types';
import { Icon } from '../../ui/components/icon';
import { ServiceLogo } from '../../ui/components/service-logo';
import { splitAround } from '../../ui/page-media-view';
import { formatPlatformList } from '../../ui/platform-list';
import { settingsPath } from '../../ui/settings/navigation';

export interface OffTargetNoticeProps {
  /** Plateformes à accès optionnel accordées ; undefined : pas encore lues */
  granted: readonly StreamingPlatform[] | undefined;
  /** « Activer {plateforme} » : demande d'accès envoyée dans le clic (geste utilisateur) */
  onEnable: (platform: StreamingPlatform) => void;
  /** Lien « Réglages › Plateformes » */
  onOpenPlatformsSettings: () => void;
}

/** Plateformes à accès optionnel encore désactivées (ordre de STREAMING_PLATFORMS) */
export function disabledPlatforms(granted: readonly StreamingPlatform[]): StreamingPlatform[] {
  return STREAMING_PLATFORMS.filter((platform) => isOptionalPlatform(platform) && !granted.includes(platform));
}

/** Phrase « … : à activer dans Réglages › Plateformes. », le chemin en lien vers la page */
function EnableText({ platforms, onOpen }: { platforms: readonly StreamingPlatform[]; onOpen: () => void }) {
  const path = settingsPath('platforms');
  const text = t('panel.offTargetEnable', { platforms: formatPlatformList(platforms, 'conjunction'), path });
  const parts = splitAround(text, path);
  return (
    <p class="m-0 text-muted">
      {parts ? (
        <>
          {parts[0]}
          <button
            type="button"
            class="cursor-pointer border-0 bg-transparent p-0 font-extrabold text-ink underline decoration-field underline-offset-2 hover:decoration-ink"
            data-focus="off-target-settings"
            onClick={onOpen}
          >
            {path}
          </button>
          {parts[1]}
        </>
      ) : (
        text
      )}
    </p>
  );
}

export function OffTargetNotice({ granted = [], onEnable, onOpenPlatformsSettings }: OffTargetNoticeProps) {
  const active = activePlatforms(granted);
  const disabled = disabledPlatforms(granted);
  return (
    <section class="flex flex-col items-center gap-3 rounded-card border border-line bg-surface px-4 py-5 text-center" data-off-target="">
      <span class="flex text-lavender">
        <Icon name="screen" class="size-6" />
      </span>
      <p class="m-0 text-muted" role="status">
        {t('panel.offTargetPlatforms', { platforms: formatPlatformList(active, 'conjunction') })}
      </p>
      <ul class="m-0 flex list-none flex-wrap justify-center gap-1.5 p-0">
        {active.map((platform) => (
          <li key={platform} class="flex h-7 items-center gap-1.5 rounded-pill bg-raised pr-2.5 pl-1.5 text-secondary font-bold" data-platform-chip={platform}>
            <ServiceLogo id={platform} size="sm" />
            {PLATFORMS[platform].label}
          </li>
        ))}
      </ul>
      {disabled.length > 0 && (
        <>
          <span class="h-px self-stretch bg-line" aria-hidden="true" />
          <EnableText platforms={disabled} onOpen={onOpenPlatformsSettings} />
          <div class="flex flex-wrap justify-center gap-2">
            {disabled.map((platform) => (
              <button
                key={platform}
                type="button"
                class="inline-flex h-9 cursor-pointer items-center gap-2 rounded-pill border border-field bg-raised pr-3.5 pl-2.5 text-body font-extrabold text-ink transition-colors hover:bg-line"
                data-enable-platform={platform}
                onClick={() => onEnable(platform)}
              >
                <ServiceLogo id={platform} size="md" />
                {t('panel.enablePlatform', { platform: PLATFORMS[platform].label })}
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
