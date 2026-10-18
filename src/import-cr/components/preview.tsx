// Étapes 4 et 5 de l'import (maquettes ImportApercu, ImportApercuVariantes, ImportApplication, ImportTermine) :
// résumé de l'aperçu, séries à mettre à jour (cochables), saisons « À vérifier » (vérifications à créer, fiche proposée),
// « Déjà à jour » repliable et « Recommencer » ; pendant l'import, la carte de la tâche (progress.tsx › JobCard) au-dessus
// et l'aperçu figé ; après, le bilan jusqu'à « OK ». Règles d'affichage dans ../preview.ts.
import { useId } from 'preact/hooks';
import { formatList, t, tp } from '../../i18n';
import { PLATFORMS } from '../../platforms/registry';
import { hasUpdate, importPlatformOf, planCounts, type CrImportJob, type CrImportPlan, type CrPlanItem, type CrReviewItem, type CrServicePlan } from '../../shared/cr-import';
import { TRACKER_LABELS } from '../../shared/tracker.types';
import { candidateMeta } from '../../ui/review-view';
import { Button } from '../../ui/components/button';
import { Checkbox } from '../../ui/components/checkbox';
import { Collapsible } from '../../ui/components/collapsible';
import { Cover } from '../../ui/components/cover';
import { FeedbackBanner } from '../../ui/components/feedback-banner';
import { Icon } from '../../ui/components/icon';
import { ServiceLogo } from '../../ui/components/service-logo';
import type { ImportActions } from '../actions';
import { APPLY_HINTS, applyEnd, applyHint, isSelectable, itemResult, partialNotice, reviewGroups, reviewProposal, seasonPart, serviceChipText, summaryTiles, type SummaryTile } from '../preview';
import type { PageState } from '../state';

const CARD = 'rounded-card border border-line bg-surface';
const SECTION_TITLE = 'm-0 text-section uppercase';

const TILE_TONES: Readonly<Record<SummaryTile['tone'], { box: string; value: string }>> = {
  info: { box: 'bg-lavender/12', value: 'text-lavender' },
  warn: { box: 'bg-butter/10', value: 'text-butter' },
  danger: { box: 'bg-danger/10', value: 'text-danger' },
  neutral: { box: 'bg-raised', value: 'text-ink' },
};

const RESULT_TONES = { success: 'text-mint', error: 'text-danger', muted: 'text-muted' } as const;

/** Ligne d'information à icône (un seul service connecté, historique incomplet, aide des vérifications) */
function Note({ icon, tone, text }: { icon: 'info' | 'alert'; tone: string; text: string }) {
  return (
    <p class="m-0 flex items-start gap-2 text-secondary text-muted">
      <span class={`flex shrink-0 pt-0.5 ${tone}`}>
        <Icon name={icon} class="size-3.5" strokeWidth="2.4" />
      </span>
      <span class="min-w-0 break-words">{text}</span>
    </p>
  );
}

/** Résumé de l'aperçu : saisons lues, compteurs en cases, un seul service connecté, historique incomplet */
function Summary({ plan }: { plan: CrImportPlan }) {
  return (
    <section class={`${CARD} flex flex-col gap-2.5 px-4 py-3`} aria-label={t('crImport.step.preview')} data-preview-summary="">
      <p class="m-0 text-secondary text-muted">{tp('crImport.preview.seasons', plan.seasonCount)}</p>
      <ul class="m-0 flex list-none flex-wrap gap-2 p-0">
        {summaryTiles(plan).map((tile) => (
          <li key={tile.id} class={`flex min-w-24 flex-1 basis-24 flex-col rounded-panel px-2.5 py-2 ${TILE_TONES[tile.tone].box}`} data-tile={tile.id}>
            <span class={`font-display text-stat tabular-nums ${TILE_TONES[tile.tone].value}`}>{tile.count}</span>
            <span class="text-secondary text-muted break-words">{tile.label}</span>
          </li>
        ))}
      </ul>
      {plan.services.length < 2 && <Note icon="info" tone="text-lavender" text={t('crImport.preview.oneService', { service: TRACKER_LABELS[plan.services[0] ?? 'anilist'] })} />}
      {plan.stats.partial && <Note icon="alert" tone="text-butter" text={partialNotice(plan.stats)} />}
    </section>
  );
}

/** Pastille d'un service : logo, puis la progression (lavande) ou la raison de ne rien écrire (grise) */
function ServiceChip({ plan }: { plan: CrServicePlan }) {
  const label = TRACKER_LABELS[plan.service];
  const text = serviceChipText(plan);
  const update = plan.action === 'update';
  // Préfixe lu par les lecteurs d'écran (« AniList : » en français, « AniList: » en anglais et en allemand)
  const prefix = t('common.labelValue', { label }).split('{value}')[0] ?? '';
  return (
    <span
      class={`inline-flex min-h-5.5 items-center gap-1 rounded-pill py-0.5 pr-2 pl-0.75 text-secondary font-bold ${update ? 'bg-lavender/14 text-ink' : 'bg-raised text-muted'}`}
      title={t('common.labelValue', { label, value: text })}
      data-chip={plan.action}
    >
      <span class={`flex ${update ? '' : 'opacity-70'}`}>
        <ServiceLogo id={plan.service} size="sm" />
      </span>
      <span class="sr-only">{prefix}</span>
      {text}
    </span>
  );
}

/** Contenu d'une ligne : jaquette, titre, saisons de la plateforme, pastilles des services, résultat de l'import */
function ItemBody({ item, platform }: { item: CrPlanItem; platform: string }) {
  const result = itemResult(item);
  return (
    <>
      <Cover size="agenda" title={item.title} src={item.coverUrl} />
      <span class="flex min-w-0 flex-1 flex-col gap-1">
        <span class="font-bold break-words">{item.title}</span>
        <span class="text-secondary text-muted break-words" title={item.seasons.join('\n')}>
          {t('common.labelValue', { label: platform, value: item.seasons.join(' · ') })}
        </span>
        <span class="flex flex-wrap gap-1">
          {item.services.map((plan) => (
            <ServiceChip key={plan.service} plan={plan} />
          ))}
        </span>
        {/* Résultat d'une ligne : texte simple, pas de role="alert" relu à chaque avancée de l'import (le bilan annonce) */}
        {result && <span class={`text-secondary font-bold break-words ${RESULT_TONES[result.tone]}`}>{result.text}</span>}
      </span>
    </>
  );
}

const ROW = 'mx-3 border-t border-line py-2.5 first:border-t-0';

/** Ligne à mettre à jour : toute la ligne coche la case ; déjà écrite, la case est verte et figée */
function ItemRow({ item, platform, checked, locked, onToggle }: { item: CrPlanItem; platform: string; checked: boolean; locked: boolean; onToggle: (checked: boolean) => void }) {
  const done = item.result?.outcome === 'updated';
  return (
    <li class={ROW} data-item={item.mediaId}>
      <label class="flex cursor-pointer items-start gap-2.5 has-disabled:cursor-default">
        <span class="flex pt-0.5">
          <Checkbox checked={done || checked} done={done} disabled={locked || done} label={item.title} focusKey={`cr-item-${item.mediaId}`} onChange={onToggle} />
        </span>
        <ItemBody item={item} platform={platform} />
      </label>
    </li>
  );
}

interface UpdateProps {
  plan: CrImportPlan;
  page: PageState;
  job: CrImportJob | null;
  running: boolean;
  actions: ImportActions;
}

/** « À mettre à jour » : « Tout cocher », lignes, légende et « Mettre à jour N séries » ; rien à faire : un bandeau */
function UpdateSection({ plan, page, job, running, actions }: UpdateProps) {
  const titleId = useId();
  const platform = PLATFORMS[importPlatformOf(plan)].label;
  const items = plan.items.filter(hasUpdate);
  const selectable = items.filter(isSelectable);
  const selected = selectable.filter((item) => page.selected.has(item.id)).length;
  const locked = running || page.busy !== null;
  const allChecked = selectable.length > 0 && selected === selectable.length;
  const hint = applyHint({ selectable: selectable.length, selected, running, job });
  return (
    <section class="flex flex-col gap-2" aria-labelledby={titleId}>
      <div class="mx-1 mt-2 flex min-h-7 items-center justify-between gap-2">
        <h2 class={`${SECTION_TITLE} text-muted`} id={titleId}>
          {t('crImport.preview.updateSection')}
        </h2>
        {selectable.length > 0 && (
          <Button size="sm" disabled={locked} focusKey="cr-toggle-all" onClick={actions.toggleAll}>
            {allChecked ? t('crImport.preview.none') : t('crImport.preview.all')}
          </Button>
        )}
      </div>
      {items.length === 0 ? (
        <FeedbackBanner tone="success" text={t('crImport.preview.nothing', { platform })} />
      ) : (
        <ul class={`${CARD} m-0 flex list-none flex-col p-0`}>
          {items.map((item) => (
            <ItemRow key={item.id} item={item} platform={platform} checked={page.selected.has(item.id)} locked={locked} onToggle={(checked) => actions.toggleItem(item.id, checked)} />
          ))}
        </ul>
      )}
      {selectable.length > 0 && (
        <div class="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
          {hint && <p class="m-0 min-w-0 flex-1 basis-48 text-right text-secondary text-muted break-words">{t(APPLY_HINTS[hint])}</p>}
          <Button variant="primary" busy={page.busy === 'apply'} disabled={running || selected === 0} focusKey="cr-apply" onClick={actions.applySelected}>
            {tp('crImport.preview.apply', selected)}
          </Button>
        </div>
      )}
    </section>
  );
}

/** Fiche que proposera la vérification, puis les autres au choix (correspondance enregistrée comprise) */
function Proposal({ item }: { item: CrReviewItem }) {
  const { proposed, others } = reviewProposal(item);
  if (!proposed) return null;
  const alternatives = others.slice(0, 3).map((c) => c.title);
  return (
    <span class="mt-1 flex min-w-0 items-start gap-2" data-proposal={proposed.id}>
      <Cover size="agenda" title={proposed.title} src={proposed.coverUrl} />
      <span class="flex min-w-0 flex-1 flex-col">
        <span class="text-secondary font-bold break-words">
          {proposed.title}
          <span class="ml-1.5 inline-block rounded-pill bg-lavender/16 px-1.5 text-section tracking-normal text-lavender">{t('crImport.review.proposed')}</span>
        </span>
        <span class="text-secondary text-muted">{candidateMeta(proposed)}</span>
        {alternatives.length > 0 && (
          <span class="text-secondary text-muted break-words" title={others.map((c) => `${c.title} · ${candidateMeta(c)}`).join('\n')}>
            {t('crImport.review.alternatives', { titles: formatList(alternatives) })}
          </span>
        )}
      </span>
    </span>
  );
}

function ReviewRow({ item, checked, locked, onToggle }: { item: CrReviewItem; checked: boolean; locked: boolean; onToggle: (checked: boolean) => void }) {
  return (
    <li>
      <label class="flex cursor-pointer items-start gap-2.5 py-1 has-disabled:cursor-default">
        <span class="flex pt-px">
          <Checkbox checked={item.created || checked} done={item.created} disabled={locked || item.created} focusKey={`cr-review-${item.key}`} onChange={onToggle} />
        </span>
        <span class="flex min-w-0 flex-1 flex-col">
          <span class="font-semibold break-words">
            {seasonPart(item)} · {t('crImport.review.episode', { episode: item.episode.displayedEpisodeNumber ?? '?' })}
            {item.created && (
              <>
                {' · '}
                <span class="text-mint">{t('crImport.review.done')}</span>
              </>
            )}
          </span>
          {/* Saisons réunies (numérotation absolue vers la même fiche) : détail au survol */}
          {item.seasons.length > 1 && (
            <span class="text-secondary font-bold text-lavender" title={item.seasons.join('\n')}>
              {tp('crImport.review.merged', item.seasons.length)}
            </span>
          )}
          <span class="text-secondary text-muted break-words">{item.reason}</span>
          {!item.created && <Proposal item={item} />}
        </span>
      </label>
    </li>
  );
}

/** « À vérifier » : aide, saisons regroupées par série, « Créer N vérifications » tant qu'il en reste à créer */
function ReviewSection({ plan, page, running, actions }: { plan: CrImportPlan; page: PageState; running: boolean; actions: ImportActions }) {
  const titleId = useId();
  const locked = running || page.busy !== null;
  const pending = planCounts(plan).reviewPending;
  const chosen = plan.review.filter((r) => !r.created && page.reviewSelected.has(r.key)).length;
  return (
    <section class="flex flex-col gap-2" aria-labelledby={titleId} data-review-section="">
      <h2 class={`${SECTION_TITLE} mx-1 mt-2 text-butter`} id={titleId}>
        {tp('crImport.review.title', plan.review.length)}
      </h2>
      <div class={`${CARD} flex flex-col gap-2.5 px-4 py-3`}>
        <Note icon="info" tone="text-butter" text={t('crImport.review.help')} />
        <ul class="m-0 flex list-none flex-col p-0">
          {reviewGroups(plan.review).map((group) => (
            <li key={group.key} class="flex flex-col gap-0.5 border-t border-dotted border-line pt-2 pb-1">
              <span class="font-bold break-words">{group.title}</span>
              <ul class="m-0 flex list-none flex-col p-0">
                {group.items.map((item) => (
                  <ReviewRow key={item.key} item={item} checked={page.reviewSelected.has(item.key)} locked={locked} onToggle={(checked) => actions.toggleReview(item.key, checked)} />
                ))}
              </ul>
            </li>
          ))}
        </ul>
        {pending > 0 && (
          <div class="flex justify-end">
            <Button busy={page.busy === 'reviews'} disabled={running || chosen === 0} focusKey="cr-create-reviews" onClick={actions.createReviews}>
              {tp('crImport.review.create', chosen)}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

/** « Déjà à jour (N) » : replié par défaut, choix gardé d'un rendu à l'autre (UI-06) */
function UpToDateSection({ plan, open, onToggle }: { plan: CrImportPlan; open: boolean; onToggle: (open: boolean) => void }) {
  const items = plan.items.filter((item) => !hasUpdate(item));
  if (items.length === 0) return null;
  const platform = PLATFORMS[importPlatformOf(plan)].label;
  return (
    <div class={CARD} data-uptodate-section="">
      <Collapsible variant="row" title={tp('crImport.preview.upToDateTitle', items.length)} open={open} onToggle={onToggle} focusKey="cr-uptodate-toggle">
        <ul class="-mx-3 my-0 flex list-none flex-col border-t border-line p-0">
          {items.map((item) => (
            <li key={item.id} class={`${ROW} flex items-start gap-2.5`} data-item={item.mediaId}>
              <ItemBody item={item} platform={platform} />
            </li>
          ))}
        </ul>
      </Collapsible>
    </div>
  );
}

const END_TONES = {
  success: { box: 'border-mint/45 bg-mint/10', icon: 'checkCircle', color: 'text-mint' },
  warning: { box: 'border-butter/45 bg-butter/10', icon: 'info', color: 'text-butter' },
  error: { box: 'border-danger/45 bg-danger/10', icon: 'alert', color: 'text-danger' },
} as const;

/** Bilan de l'import (étape 5 finie, arrêtée ou interrompue), avec les raisons des échecs, jusqu'à « OK » */
export function ApplyEnd({ job, onDismiss }: { job: CrImportJob; onDismiss: () => void }) {
  const end = applyEnd(job);
  const tone = END_TONES[end.tone];
  return (
    <section class={`flex flex-col gap-2 rounded-menu border py-2.5 pr-3 pl-3.5 ${tone.box}`} role={end.tone === 'error' ? 'alert' : 'status'} data-apply-end={job.status}>
      <div class="flex items-start gap-2.5">
        <span class={`flex shrink-0 pt-1 ${tone.color}`}>
          <Icon name={tone.icon} class="size-4" strokeWidth="2.4" />
        </span>
        {/* Import allé au bout (échecs compris) : bilan en `ink`, le ton reste porté par l'icône et le cadre */}
        <p class={`m-0 min-w-0 flex-1 self-center font-extrabold break-words ${job.status === 'done' ? 'text-ink' : tone.color}`}>{end.text}</p>
        <Button size="sm" focusKey="cr-dismiss" onClick={onDismiss}>
          {t('compare.job.dismiss')}
        </Button>
      </div>
      {end.details.length > 0 && (
        <ul class="m-0 ml-6.5 flex list-none flex-col gap-1 p-0 text-secondary">
          {end.details.map((detail) => (
            <li key={detail} class="break-words">
              {detail}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export interface PreviewProps {
  plan: CrImportPlan;
  page: PageState;
  /** Import en cours ou fini (bilan) ; null : aperçu à valider */
  job: CrImportJob | null;
  actions: ImportActions;
}

/** Aperçu (étape 4), figé pendant l'import (étape 5) ; le résumé seulement avant l'import ou après « OK » */
export function Preview({ plan, page, job, actions }: PreviewProps) {
  const running = job?.status === 'running';
  return (
    <>
      {job === null && <Summary plan={plan} />}
      {job !== null && !running && <ApplyEnd job={job} onDismiss={actions.dismissJob} />}
      <UpdateSection plan={plan} page={page} job={job} running={running} actions={actions} />
      {plan.review.length > 0 && <ReviewSection plan={plan} page={page} running={running} actions={actions} />}
      <UpToDateSection plan={plan} open={page.upToDateOpen} onToggle={actions.setUpToDateOpen} />
      <div class="flex border-t border-dotted border-line pt-3">
        <Button size="sm" disabled={running} focusKey="cr-restart" onClick={actions.restart}>
          {t('crImport.restart')}
        </Button>
      </div>
    </>
  );
}
