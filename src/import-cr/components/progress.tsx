// Étapes 2 et 3 de l'import (maquettes ImportLecture, ImportAnalyseFin, ImportErreurs) : lecture dans l'onglet
// (Crunchyroll / ADN : connexion, pages, vérification de la numérotation ; Netflix en trois temps), démarrage de
// l'analyse, tâche de fond en cours (analyse, et import de l'étape 5) avec ses pauses et « Arrêter », bilan d'une analyse
// arrêtée ou interrompue avec « Recommencer ».
import type { ComponentChildren } from 'preact';
import { t } from '../../i18n';
import { PLATFORMS } from '../../platforms/registry';
import type { CrImportJob, ImportPlatform } from '../../shared/cr-import';
import type { IconName } from '../../ui/icons';
import { Alert } from '../../ui/components/alert';
import { Button } from '../../ui/components/button';
import { Icon } from '../../ui/components/icon';
import { ServiceLogo } from '../../ui/components/service-logo';
import { jobPauseText } from '../../ui/job-pause';
import { useNow } from '../../ui/preact/hooks';
import { platformParams } from '../sources/sites';
import { analyzeEnd, jobProgress, netflixPhases, readingStatus, type Progress, type ReadingStep } from '../view';

const CARD = 'flex flex-col gap-2.5 rounded-card border border-line bg-surface p-4';
const SPIN = 'animate-spin motion-reduce:animate-none';
/** Compte à rebours d'une pause, relu chaque seconde */
const PAUSE_TICK_MS = 1_000;

export function ProgressBar({ progress, label, class: extra = '' }: { progress: Progress; label: string; class?: string }) {
  const percent = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  return (
    <div
      class={`h-1.5 overflow-hidden rounded-pill bg-raised ${extra}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={progress.total}
      aria-valuenow={progress.done}
    >
      <div class="h-full rounded-pill bg-lavender transition-[width]" style={{ width: `${percent}%` }} />
    </div>
  );
}

/** Ligne d'information sous une carte (onglet à garder ouvert, rien n'est encore écrit) */
function Hint({ icon, text }: { icon: IconName; text: string }) {
  return (
    <p class="m-0 flex items-start gap-2 text-secondary text-muted">
      <span class="flex shrink-0 pt-0.5">
        <Icon name={icon} class="size-3.5" strokeWidth="2.2" />
      </span>
      <span class="min-w-0 break-words">{text}</span>
    </p>
  );
}

/** En-tête d'une carte en cours : état (annoncé) et « Arrêter » */
function Head({ text, leading, stop }: { text: string; leading?: ComponentChildren; stop: { focusKey: string; stopping?: boolean; onClick: () => void } | null }) {
  return (
    <div class="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
      <p class="m-0 flex min-w-0 flex-1 basis-56 items-center gap-2 font-bold" role="status">
        {leading ?? <Icon name="spinner" class={`size-4 shrink-0 text-lavender ${SPIN}`} strokeWidth="2.6" />}
        <span class="min-w-0 break-words">{text}</span>
      </p>
      {stop && (
        <Button variant="danger" size="sm" busy={stop.stopping} focusKey={stop.focusKey} onClick={stop.onClick}>
          {stop.stopping ? t('compare.job.stopping') : t('compare.job.stop')}
        </Button>
      )}
    </div>
  );
}

/** Étape 2 : lecture de l'historique dans l'onglet de la plateforme */
export function ReadingCard({ step, platform, onStop }: { step: ReadingStep; platform: ImportPlatform; onStop: () => void }) {
  const stop = { focusKey: 'cr-read-stop', onClick: onStop };
  if (step.kind === 'reading') {
    const { text, progress } = readingStatus(step, PLATFORMS[platform].label);
    return (
      <section class={CARD} aria-label={t('crImport.read.progressAria')} data-reading={platform}>
        <Head text={text} stop={stop} />
        {progress && <ProgressBar progress={progress} label={t('crImport.read.progressAria')} />}
        <Hint icon="window" text={t('crImport.read.keepTab', platformParams(platform))} />
      </section>
    );
  }
  return (
    <section class={CARD} aria-label={t('crImport.read.progressAria')} data-reading="netflix">
      <Head text={t('crImport.netflix.heading')} leading={<ServiceLogo id="netflix" size="md" />} stop={stop} />
      <ol class="m-0 flex list-none flex-col gap-2 p-0 text-secondary">
        {netflixPhases(step).map((phase) =>
          phase.state === 'current' ? (
            <li key={phase.id} class="flex flex-col gap-1.5" aria-current="step" data-phase={phase.id}>
              <span class="flex items-start gap-2 font-bold" role="status">
                <span class="flex shrink-0 pt-0.5">
                  <Icon name="spinner" class={`size-3.5 text-lavender ${SPIN}`} strokeWidth="2.6" />
                </span>
                <span class="min-w-0 break-words">{phase.text}</span>
              </span>
              {phase.progress && <ProgressBar progress={phase.progress} label={t('crImport.read.progressAria')} class="ml-5.5" />}
            </li>
          ) : (
            <li key={phase.id} class="flex items-start gap-2 text-muted" data-phase={phase.id} data-phase-state={phase.state}>
              <span class="flex size-3.5 shrink-0 items-center justify-center pt-0.5" aria-hidden="true">
                {phase.state === 'done' ? <Icon name="check" class="size-3.5 text-mint" strokeWidth="3" /> : <span class="size-2 rounded-pill border-[1.5px] border-field" />}
              </span>
              <span class="min-w-0 break-words">{phase.text}</span>
            </li>
          ),
        )}
      </ol>
      <Hint icon="window" text={t('crImport.netflix.keepTab')} />
    </section>
  );
}

/** Étape 3 : historique lu, analyse demandée (pas encore de barre ni d'« Arrêter ») */
export function StartingCard() {
  return (
    <section class={CARD} data-analyze-starting="">
      <Head text={t('crImport.analyze.starting')} stop={null} />
    </section>
  );
}

/** Ligne de pause d'une tâche (limite de requêtes, quota AniList, reprise) : compte à rebours, sans région live */
function PauseLine({ text }: { text: string }) {
  return (
    <p class="m-0 flex items-start gap-2 text-secondary font-bold text-butter">
      <span class="flex shrink-0 pt-0.5">
        <Icon name="clock" class="size-3.5" strokeWidth="2.4" />
      </span>
      <span class="min-w-0 break-words" data-job-pause="">
        {text}
      </span>
    </p>
  );
}

/** Tâche de fond en cours (analyse, ou import de l'étape 5) : progression, pause, « Arrêter » (« Arrêt… » une fois demandé) */
export function JobCard({ job, onCancel }: { job: CrImportJob; onCancel: () => void }) {
  const paused = job.pausedUntil !== null;
  const now = useNow(PAUSE_TICK_MS, paused);
  const progress = jobProgress(job);
  const pause = jobPauseText(job, now, 'AniList');
  return (
    <section class={CARD} aria-label={progress.analyzing ? t('crImport.analyze.progressAria') : t('crImport.apply.progressAria')} data-job={job.kind}>
      <Head text={progress.text} stop={{ focusKey: 'cr-job-stop', stopping: job.cancelled, onClick: onCancel }} />
      <ProgressBar progress={progress.finalizing ? { done: 1, total: 1 } : progress} label={progress.analyzing ? t('crImport.analyze.progressAria') : t('crImport.apply.progressAria')} />
      {pause && <PauseLine text={pause} />}
      <Hint icon="shield" text={progress.analyzing ? t('crImport.analyze.hint') : t('crImport.apply.hint')} />
    </section>
  );
}

/** Analyse arrêtée ou interrompue avant l'aperçu : rien n'a été écrit, « Recommencer » revient au choix de la plateforme */
export function AnalyzeEnded({ job, onRestart }: { job: CrImportJob; onRestart: () => void }) {
  const end = analyzeEnd(job);
  return (
    <div class="flex flex-col gap-3" data-analyze-ended={job.status}>
      <Alert tone={end.tone} icon={end.tone === 'warn' ? 'info' : 'alert'} message={end.text} />
      <div class="flex justify-end">
        <Button focusKey="cr-restart" onClick={onRestart}>
          {t('crImport.restart')}
        </Button>
      </div>
    </div>
  );
}
