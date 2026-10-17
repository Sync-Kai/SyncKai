// État de la série dans chaque liste connectée (maquette PopupPageRetours, « Lignes par service ») : logo AniList /
// MyAnimeList de 16 px avec sa pastille d'état (dans la liste : mint ; erreur : danger), puis « En cours · Ép. 6 / 28 »,
// « Pas dans ta liste », « Fiche absente de ce service » ou le message d'erreur. Carte « Sur cette page » du popup, prévu
// pour le panneau latéral.
import type { TrackerId } from '../../shared/tracker.types';
import { ServiceLogo } from './service-logo';

export interface ServiceLine {
  service: TrackerId;
  /** Nom du service (texte alternatif du logo) */
  serviceLabel: string;
  text: string;
  /** `in-list` : texte `ink`, pastille mint ; `error` : texte danger, pastille rouge ; `absent` : texte `muted` */
  state: 'in-list' | 'absent' | 'error';
}

const TEXT: Readonly<Record<ServiceLine['state'], string>> = { 'in-list': 'text-ink', absent: 'text-muted', error: 'text-danger' };

export function ServiceLines({ label, lines }: { label: string; lines: readonly ServiceLine[] }) {
  return (
    <ul class="m-0 flex list-none flex-col gap-1 p-0" aria-label={label} data-service-lines="">
      {lines.map((line) => (
        <li key={line.service} class={`flex min-w-0 items-center gap-2.5 text-secondary font-bold ${TEXT[line.state]}`} data-service-line={line.service}>
          <ServiceLogo id={line.service} size="sm" label={line.serviceLabel} badge={line.state === 'in-list' ? 'ok' : line.state === 'error' ? 'error' : undefined} />
          <span class="min-w-0 break-words">{line.text}</span>
        </li>
      ))}
    </ul>
  );
}
