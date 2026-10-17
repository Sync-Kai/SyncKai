// Accueil du popup sans compte connecté (maquettes PopupOnboarding, PopupOnboardingEtats) : Kai, « Bienvenue ! »,
// boutons de connexion AniList / MyAnimeList (connexion en cours, session expirée, erreur sous le bouton), les trois
// étapes de « Comment ça marche » et l'astuce des Réglages › Plateformes.
import { t } from '../../i18n';
import { TRACKER_IDS, TRACKER_LABELS, type TrackerId } from '../../shared/tracker.types';
import type { IconName } from '../../ui/icons';
import { kai } from '../../ui/icons';
import type { AccountState } from '../../ui/state';
import { Alert } from '../../ui/components/alert';
import { Icon, MountedNode } from '../../ui/components/icon';
import { ServiceLogo } from '../../ui/components/service-logo';
import { PlatformsTipText } from './platforms-tip';

export interface OnboardingProps {
  accounts: Readonly<Record<TrackerId, AccountState<unknown>>>;
  onLogin: (service: TrackerId) => void;
  /** Lien de l'astuce : Réglages › Plateformes */
  onOpenPlatformsSettings: () => void;
}

/** Bouton de connexion d'un service ; erreur de la dernière tentative juste dessous */
function ConnectButton({ service, state, onLogin }: { service: TrackerId; state: AccountState<unknown>; onLogin: (service: TrackerId) => void }) {
  const pending = state.status === 'logged-out' && state.pending === true;
  const expired = state.status === 'logged-out' && state.expired === true;
  const error = state.status === 'logged-out' ? state.error : null;
  return (
    <>
      <button
        type="button"
        class="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-pill border border-field bg-surface py-1.5 pr-3.5 pl-2 text-left text-ink transition-colors hover:border-muted hover:bg-raised aria-disabled:cursor-wait aria-disabled:hover:border-field aria-disabled:hover:bg-surface"
        aria-disabled={pending ? 'true' : undefined}
        aria-busy={pending ? 'true' : undefined}
        data-focus={`connect-${service}`}
        onClick={() => {
          // Fenêtre de connexion déjà ouverte : le clic est sans effet (le bouton garde le focus)
          if (!pending) onLogin(service);
        }}
      >
        <ServiceLogo id={service} size="tile" badge={expired ? 'expired' : undefined} />
        <span class="flex min-w-0 flex-1 flex-col">
          <span class={`text-row-title ${pending ? 'text-muted' : ''}`}>
            {pending ? t('common.connecting') : t(expired ? 'common.reconnectService' : 'common.connectService', { service: TRACKER_LABELS[service] })}
          </span>
          {expired && <span class="text-secondary font-bold text-danger">{t('common.sessionExpired')}</span>}
        </span>
        <span class="flex shrink-0 text-muted">
          {pending ? <Icon name="spinner" class="size-4 animate-spin motion-reduce:animate-none" strokeWidth="2.4" /> : <Icon name="chevronRight" class="size-4" strokeWidth="2.4" />}
        </span>
      </button>
      {error && <Alert message={error} />}
    </>
  );
}

const STEPS: readonly { icon: IconName; text: 'onboarding.step1' | 'onboarding.step2' | 'onboarding.step3'; ok?: boolean }[] = [
  { icon: 'play', text: 'onboarding.step1' },
  { icon: 'search', text: 'onboarding.step2' },
  { icon: 'check', text: 'onboarding.step3', ok: true },
];

export function Onboarding({ accounts, onLogin, onOpenPlatformsSettings }: OnboardingProps) {
  return (
    <div class="flex min-h-full flex-col gap-4 pb-1">
      <section class="flex flex-col items-center gap-1 pt-1 text-center" aria-labelledby="sk-welcome-title">
        <MountedNode build={() => kai('h-16 w-16', { expression: 'happy', size: 'large', squish: true })} inputs={[]} />
        <span class="mt-2 font-display text-overline text-sakura" aria-hidden="true">
          ヨウコソ
        </span>
        <h1 class="m-0 font-display text-xl leading-6.5 font-extrabold" id="sk-welcome-title">
          {t('onboarding.welcome')}
        </h1>
        <p class="m-0 mt-1 max-w-84 font-semibold text-muted">{t('onboarding.intro')}</p>
      </section>
      <div class="flex flex-col gap-2">
        {TRACKER_IDS.map((service) => (
          <ConnectButton key={service} service={service} state={accounts[service]} onLogin={onLogin} />
        ))}
      </div>
      <section class="flex flex-col gap-2" aria-labelledby="sk-how-title">
        <h2 class="mx-1 my-0 text-section text-muted uppercase" id="sk-how-title">
          {t('onboarding.howItWorks')}
        </h2>
        <ol class="relative m-0 grid list-none grid-cols-3 gap-2 rounded-card border border-line bg-surface px-2 pt-3.5 pb-3">
          {/* Fil entre les trois étapes, du lavande (lecture) au menthe (liste à jour) */}
          <span class="absolute top-7 right-1/6 left-1/6 h-0.5 rounded-pill bg-linear-to-r from-lavender via-lavender to-mint" aria-hidden="true" />
          {STEPS.map((step) => (
            <li key={step.text} class="relative flex flex-col items-center gap-2 text-center">
              <span class={`flex size-logo-button items-center justify-center rounded-pill border bg-raised ${step.ok ? 'border-mint text-mint' : 'border-lavender text-lavender'}`} aria-hidden="true">
                <Icon name={step.icon} class="size-3.5" strokeWidth="2.4" />
              </span>
              <span class="text-secondary font-bold text-ink">{t(step.text)}</span>
            </li>
          ))}
        </ol>
      </section>
      <p class="mx-1 my-0 text-secondary text-muted">
        <PlatformsTipText onOpen={onOpenPlatformsSettings} />
      </p>
    </div>
  );
}
