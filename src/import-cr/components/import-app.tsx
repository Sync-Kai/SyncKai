// Page « Importer un historique » (onglet de 720 px, maquettes Import*) : en-tête SyncKai, titre, indicateur des cinq
// étapes, notice et erreur de la page, puis l'écran de l'étape (view.ts › importScreen).
import { render } from 'preact';
import { useRef } from 'preact/hooks';
import { t } from '../../i18n';
import { Alert } from '../../ui/components/alert';
import { FeedbackBanner } from '../../ui/components/feedback-banner';
import { Icon } from '../../ui/components/icon';
import { PageHeader } from '../../ui/components/page-header';
import { useFocusFallback, useLocale, useStore } from '../../ui/preact/hooks';
import type { ImportActions } from '../actions';
import { platformParams } from '../sources/sites';
import { currentPlatform, view } from '../state';
import { currentStep, importScreen } from '../view';
import { PlatformChoice } from './platform-choice';
import { Preview } from './preview';
import { AnalyzeEnded, JobCard, ReadingCard, StartingCard } from './progress';
import { ImportSteps } from './steps';

/** Colonne de la page : 576 px de contenu dans l'onglet de 720 px, gouttières de 16 px en fenêtre étroite */
const COLUMN = 'mx-auto w-full max-w-152 px-4';

function Loading() {
  return (
    <section class="flex items-center gap-2 rounded-card border border-line bg-surface p-4 text-muted" role="status" aria-busy="true">
      <Icon name="spinner" class="size-4 shrink-0 animate-spin motion-reduce:animate-none" strokeWidth="2.6" />
      {t('crImport.loading')}
    </section>
  );
}

export function ImportApp({ actions }: { actions: ImportActions }) {
  useLocale();
  const page = useStore(view);
  const root = useRef<HTMLDivElement>(null);
  useFocusFallback(root);
  const screen = importScreen(page);
  const platform = currentPlatform(page);

  function body() {
    switch (screen.kind) {
      case 'loading':
        return <Loading />;
      case 'choose':
        return page.step.kind === 'connect' ? <PlatformChoice page={page} step={page.step} actions={actions} /> : null;
      case 'reading':
        return <ReadingCard step={screen.step} platform={platform} onStop={actions.stopReading} />;
      case 'starting':
        return <StartingCard />;
      case 'analyzing':
        return <JobCard job={screen.job} onCancel={actions.cancelJob} />;
      case 'analyze-ended':
        return <AnalyzeEnded job={screen.job} onRestart={actions.restart} />;
      case 'preview':
        return (
          <>
            {screen.job?.status === 'running' && <JobCard job={screen.job} onCancel={actions.cancelJob} />}
            <Preview plan={screen.plan} page={page} job={screen.job} actions={actions} />
          </>
        );
    }
  }

  return (
    <div ref={root} class="flex min-h-full flex-col">
      <PageHeader column={COLUMN} />
      <main class={`${COLUMN} flex flex-1 flex-col gap-3 pt-6 pb-8`}>
        <div class="flex flex-col gap-0.5">
          <h1 class="m-0 font-display text-stat">{t('crImport.title')}</h1>
          <p class="m-0 text-secondary text-muted">{t('crImport.subtitle', platformParams(platform))}</p>
        </div>
        <ImportSteps current={currentStep(screen)} />
        {page.notice && <FeedbackBanner tone="success" text={page.notice} />}
        {page.error && <Alert message={page.error} />}
        {body()}
      </main>
    </div>
  );
}

/** Monte la page dans `container` ; renvoie le démontage */
export function mountImportApp(container: HTMLElement, actions: ImportActions): () => void {
  render(<ImportApp actions={actions} />, container);
  return () => render(null, container);
}
