// Indicateur des cinq étapes de l'import (maquettes Import*) : étape en cours en lavande, étapes faites cochées en mint
// (et leur trait), suivantes bordées. Fenêtre étroite : seul le nom de l'étape en cours reste visible (les autres
// restent lus par le lecteur d'écran).
import { Fragment } from 'preact';
import { t, type MessageKey } from '../../i18n';
import { Icon } from '../../ui/components/icon';
import { IMPORT_STEPS } from '../view';

const CIRCLE = 'flex size-5 shrink-0 items-center justify-center rounded-pill text-section tracking-normal';

export function ImportSteps({ current }: { current: number }) {
  return (
    <ol class="@container m-0 my-1 flex list-none items-center gap-2 p-0 text-secondary font-bold text-muted" aria-label={t('crImport.steps')} data-import-steps={current}>
      {IMPORT_STEPS.map((id, index) => {
        const number = index + 1;
        const state = number < current ? 'done' : number === current ? 'current' : 'todo';
        return (
          <Fragment key={id}>
            {index > 0 && <li class={`h-px min-w-2 flex-1 ${number - 1 < current ? 'bg-mint/50' : 'bg-line'}`} aria-hidden="true" />}
            <li class={`flex min-w-0 shrink-0 items-center gap-1.5 ${state === 'current' ? 'text-ink' : ''}`} aria-current={state === 'current' ? 'step' : undefined} data-step={state}>
              <span class={`${CIRCLE} ${state === 'current' ? 'bg-lavender text-on-fill' : state === 'done' ? 'bg-mint/16 text-mint' : 'border border-line'}`} aria-hidden="true">
                {state === 'done' ? <Icon name="check" class="size-3" strokeWidth="3" /> : number}
              </span>
              <span class={state === 'current' ? 'truncate' : '@max-[34rem]:sr-only'}>{t(`crImport.step.${id}` satisfies MessageKey)}</span>
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
