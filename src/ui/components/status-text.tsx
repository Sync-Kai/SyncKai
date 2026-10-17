// Statut court : point de 6 px et texte dans la couleur du ton (« ● Disponible », « ● Sam. 18:00 »), tronqué avec
// infobulle (texte complet).
import { TONE_TEXT, type Tone } from './tone';

export interface StatusTextProps {
  tone: Tone;
  children: string;
  /** Infobulle ; défaut : le texte */
  title?: string;
}

export function StatusText({ tone, children, title }: StatusTextProps) {
  return (
    <span class={`flex min-w-0 items-center gap-1.5 text-secondary font-bold ${TONE_TEXT[tone]}`} title={title ?? children} data-status-text="" data-tone={tone}>
      <span class="size-1.5 shrink-0 rounded-pill bg-current" aria-hidden="true" />
      <span class="truncate">{children}</span>
    </span>
  );
}
