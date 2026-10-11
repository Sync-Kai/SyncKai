import { h } from './dom';
import { icon } from './icons';

interface AlertProps {
  message: string;
  action?: { label: string; onClick: () => void };
}

export function renderAlert({ message, action }: AlertProps): HTMLElement {
  return h(
    'div',
    {
      class: 'flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-[12px] text-danger',
      attrs: { role: 'alert' },
    },
    icon('alert', 'mt-px h-3.5 w-3.5'),
    h('p', { class: 'min-w-0 flex-1 break-words' }, message),
    action &&
      h(
        'button',
        {
          class: 'shrink-0 cursor-pointer rounded-full px-1 font-bold text-ink underline-offset-2 hover:underline',
          attrs: { type: 'button' },
          on: { click: action.onClick },
        },
        action.label,
      ),
  );
}
