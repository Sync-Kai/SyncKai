// Étape 1 de l'import (maquettes ImportChoix, ImportChoixEtats, ImportErreurs) : une tuile par plateforme avec son état
// (onglet prêt, aucun onglet, en attente de l'onglet, accès à autoriser), le message de la lecture précédente (erreur
// avec « Afficher / Recharger l'onglet », ou historique vide en information), « Comment ça marche », puis la barre
// d'action de la plateforme choisie (« Lire mon historique », « Ouvrir … », « Autoriser l'accès »). Sans compte connecté :
// les tuiles et l'alerte seulement.
import { t, type MessageKey } from '../../i18n';
import { PLATFORMS } from '../../platforms/registry';
import { IMPORT_PLATFORMS, type ImportPlatform } from '../../shared/cr-import';
import type { IconName } from '../../ui/icons';
import { Alert } from '../../ui/components/alert';
import { Button } from '../../ui/components/button';
import { FeedbackBanner } from '../../ui/components/feedback-banner';
import { Icon } from '../../ui/components/icon';
import { ServiceLogo } from '../../ui/components/service-logo';
import type { ImportActions } from '../actions';
import { platformParams } from '../sources/sites';
import type { PageState, Step } from '../state';
import { platformStatus, type PlatformStatus } from '../view';

const CARD = 'rounded-card border border-line bg-surface';
const SECTION_TITLE = 'm-0 mx-1 text-section uppercase text-muted';
const SPIN = 'animate-spin motion-reduce:animate-none';

/** Ligne d'état d'une tuile : icône et ton (le texte reste lisible sans la couleur) */
const TILE_STATUS: Readonly<Record<PlatformStatus['kind'], { key: MessageKey; icon: IconName; class: string }>> = {
  ready: { key: 'crImport.tile.ready', icon: 'check', class: 'font-bold text-mint' },
  none: { key: 'crImport.tile.none', icon: 'window', class: 'text-muted' },
  waiting: { key: 'crImport.tile.waiting', icon: 'spinner', class: 'font-bold text-lavender' },
  access: { key: 'crImport.tile.access', icon: 'alert', class: 'font-bold text-butter' },
};

function Tile({ platform, status, checked, onPick }: { platform: ImportPlatform; status: PlatformStatus; checked: boolean; onPick: () => void }) {
  const line = TILE_STATUS[status.kind];
  const statusId = `sk-import-tile-${platform}`;
  return (
    <label
      class={`flex min-w-0 cursor-pointer flex-col gap-2 rounded-card border p-3 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-lavender ${
        checked ? 'border-lavender bg-raised' : 'border-line bg-surface hover:bg-raised/60'
      }`}
      data-platform-tile={platform}
      data-status={status.kind}
    >
      <input
        class="sr-only"
        type="radio"
        name="sk-import-platform"
        value={platform}
        checked={checked}
        aria-describedby={statusId}
        data-focus={`platform-${platform}`}
        onChange={(event) => {
          if (event.currentTarget.checked) onPick();
        }}
      />
      <span class="flex min-w-0 items-center gap-2.5">
        <ServiceLogo id={platform} size="tile" />
        <span class="min-w-0 flex-1 truncate font-extrabold">{PLATFORMS[platform].label}</span>
        <span class={`flex size-4.5 shrink-0 items-center justify-center rounded-pill border-2 ${checked ? 'border-lavender' : 'border-field'}`} aria-hidden="true">
          {checked && <span class="size-2 rounded-pill bg-lavender" />}
        </span>
      </span>
      <span class={`flex min-w-0 items-start gap-1.5 text-secondary ${line.class}`} id={statusId}>
        <span class="flex shrink-0 pt-0.5">
          <Icon name={line.icon} class={`size-3.5 ${status.kind === 'waiting' ? SPIN : ''}`} strokeWidth={status.kind === 'ready' ? '3' : '2.2'} />
        </span>
        <span class="min-w-0 break-words">{t(line.key)}</span>
      </span>
    </label>
  );
}

/** Règles de l'import, et celle de Netflix (« Voir plus » seulement) */
function HowItWorks({ platform }: { platform: ImportPlatform }) {
  const rules: { key: MessageKey; icon: IconName }[] = [
    { key: 'crImport.rule.never', icon: 'arrowRight' },
    { key: 'crImport.rule.preview', icon: 'eye' },
    { key: 'crImport.rule.privacy', icon: 'shield' },
    ...(platform === 'netflix' ? [{ key: 'crImport.netflix.rule' as const, icon: 'pointer' as const }] : []),
  ];
  return (
    <section class="flex flex-col gap-2" aria-labelledby="sk-import-how">
      <h2 class={`${SECTION_TITLE} mt-2`} id="sk-import-how">
        {t('onboarding.howItWorks')}
      </h2>
      <div class={`${CARD} flex flex-col gap-3 p-4`}>
        <p class="m-0">{t('crImport.intro', platformParams(platform))}</p>
        <ul class="m-0 flex list-none flex-col gap-2.5 p-0 text-secondary text-muted">
          {rules.map((rule) => (
            <li key={rule.key} class="flex items-start gap-2.5">
              <span class="flex size-6 shrink-0 items-center justify-center rounded-control bg-lavender/16 text-lavender" aria-hidden="true">
                <Icon name={rule.icon} class="size-3.5" strokeWidth="2.4" />
              </span>
              <span class="min-w-0 pt-1 break-words">{t(rule.key)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Barre d'action de la plateforme choisie : état de son onglet (ou de son accès) et l'action principale */
function ActionBar({ platform, status, actions }: { platform: ImportPlatform; status: PlatformStatus; actions: ImportActions }) {
  const params = platformParams(platform);
  let line: { text: string; icon: IconName; class: string };
  let button;
  switch (status.kind) {
    case 'access':
      // Netflix : plateforme optionnelle, l'autorisation active aussi la synchro en direct (même accès que dans Réglages)
      line = { text: platform === 'netflix' ? t('crImport.connect.netflixAccess') : t('crImport.connect.access', params), icon: 'alert', class: 'font-bold text-butter' };
      button = (
        <Button variant="primary" focusKey="cr-access" onClick={() => actions.requestAccess(platform)}>
          {t('crImport.connect.allow')}
        </Button>
      );
      break;
    case 'ready': {
      const tabId = status.tabId;
      line = { text: status.title ? t('crImport.connect.foundTitled', { ...params, title: status.title }) : t('crImport.connect.found', params), icon: 'check', class: 'font-bold text-mint' };
      button = (
        <Button variant="primary" focusKey="cr-read" onClick={() => actions.read(tabId)}>
          {t('crImport.connect.read')}
        </Button>
      );
      break;
    }
    case 'waiting':
    case 'none':
      line =
        status.kind === 'waiting'
          ? { text: t('crImport.connect.waiting', params), icon: 'spinner', class: 'font-bold text-lavender' }
          : { text: t('crImport.connect.none', params), icon: 'window', class: 'text-muted' };
      button = (
        <Button variant="primary" busy={status.kind === 'waiting'} focusKey="cr-open" onClick={actions.openPlatform}>
          {t('crImport.connect.open', params)}
        </Button>
      );
      break;
  }
  return (
    <section class={`${CARD} flex flex-wrap items-center justify-end gap-3 py-3 pr-3 pl-4`} data-action-bar={status.kind}>
      <p class={`m-0 flex min-w-0 flex-1 basis-60 items-start gap-2 text-secondary ${line.class}`} role="status">
        <span class="flex shrink-0 pt-0.5">
          <Icon name={line.icon} class={`size-3.5 ${status.kind === 'waiting' ? SPIN : ''}`} strokeWidth={status.kind === 'ready' ? '3' : '2.2'} />
        </span>
        <span class="min-w-0 break-words">{line.text}</span>
      </p>
      {button}
    </section>
  );
}

export interface PlatformChoiceProps {
  page: PageState;
  step: Extract<Step, { kind: 'connect' }>;
  actions: ImportActions;
}

export function PlatformChoice({ page, step, actions }: PlatformChoiceProps) {
  const platform = page.platform;
  const status = (p: ImportPlatform): PlatformStatus => platformStatus(page.platforms[p], step.opening && p === platform);
  const current = status(platform);
  const alert = step.alert;
  const tabId = page.platforms[platform].tabId;
  const reloadTabId = alert?.reloadTabId ?? null;
  return (
    <>
      <section class="@container flex flex-col gap-2" aria-labelledby="sk-import-platform">
        <h2 class={SECTION_TITLE} id="sk-import-platform">
          {t('crImport.platform')}
        </h2>
        <fieldset class="m-0 grid min-w-0 grid-cols-1 gap-2 border-0 p-0 @min-[30rem]:grid-cols-3">
          <legend class="sr-only">{t('crImport.platform')}</legend>
          {IMPORT_PLATFORMS.map((p) => (
            <Tile key={p} platform={p} status={status(p)} checked={p === platform} onPick={() => actions.choosePlatform(p)} />
          ))}
        </fieldset>
      </section>

      {!page.connected && <Alert message={t('crImport.error.notConnected')} />}

      {page.connected &&
        alert &&
        (alert.tone === 'info' ? (
          <FeedbackBanner tone="info" text={alert.text} />
        ) : (
          <Alert
            message={alert.text}
            action={
              reloadTabId !== null
                ? { label: t('crImport.connect.reload'), focusKey: 'cr-reload', onClick: () => actions.reloadTab(reloadTabId) }
                : tabId !== null
                  ? { label: t('crImport.connect.showTab'), focusKey: 'cr-show-tab', onClick: () => actions.showTab(tabId) }
                  : undefined
            }
          />
        ))}

      {page.connected && current.kind !== 'access' && <HowItWorks platform={platform} />}
      {page.connected && <ActionBar platform={platform} status={current} actions={actions} />}
    </>
  );
}
