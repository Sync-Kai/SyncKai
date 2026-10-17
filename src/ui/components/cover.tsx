// Jaquette : `row` 42 × 57 (ligne « Mes séries ») ou `agenda` 32 × 44 (ligne de l'Agenda), image ou initiales.
// Barre de progression lavender de 3 px dessous (role="progressbar"), absente quand le total est inconnu.
import { useState } from 'preact/hooks';
import { toImageSrc } from '../../shared/url';
import { initials } from '../kit';

export type CoverSize = 'row' | 'agenda';

export interface CoverProgress {
  value: number;
  /** Nombre d'épisodes ; null ou 0 : inconnu, pas de barre */
  total: number | null;
  /** Nom de la barre (« Progression ») */
  label: string;
}

export interface CoverProps {
  size: CoverSize;
  /** Titre de la série : initiales de repli */
  title: string;
  /** URL de l'image ; hôte hors liste (IMAGE_HOSTS) : initiales, aucune requête (SEC-02) */
  src: string | null;
  progress?: CoverProgress;
  /** Épisode vu de l'Agenda : jaquette atténuée */
  dimmed?: boolean;
}

const BOXES: Readonly<Record<CoverSize, string>> = {
  row: 'h-cover-row-h w-cover-row-w',
  agenda: 'h-cover-agenda-h w-cover-agenda-w',
};

const WIDTHS: Readonly<Record<CoverSize, string>> = { row: 'w-cover-row-w', agenda: 'w-cover-agenda-w' };

/** Largeur de la barre en pourcentage, deux décimales au plus */
const percent = (value: number, total: number): string => `${Math.round((value / total) * 10_000) / 100}%`;

export function Cover({ size, title, src, progress, dimmed = false }: CoverProps) {
  const image = toImageSrc(src);
  // Image en échec : retirée (initiales visibles) jusqu'au changement d'URL
  const [failed, setFailed] = useState<string | null>(null);
  const showImage = image !== null && failed !== image;
  const total = progress?.total ?? null;
  const bar = progress && total !== null && total > 0 ? Math.min(Math.max(progress.value, 0), total) : null;
  return (
    <div class={`flex shrink-0 flex-col gap-0.75 ${WIDTHS[size]} ${dimmed ? 'opacity-55' : ''}`}>
      <div class={`relative shrink-0 overflow-hidden rounded-cover bg-raised ${BOXES[size]}`} data-cover="">
        <span class="absolute inset-0 flex items-center justify-center font-display text-secondary font-bold text-muted" aria-hidden="true" data-cover-initials="">
          {initials(title)}
        </span>
        {showImage && (
          <img
            class="absolute inset-0 size-full object-cover"
            src={image}
            alt=""
            referrerpolicy="no-referrer"
            loading="lazy"
            decoding="async"
            draggable={false}
            onError={() => setFailed(image)}
          />
        )}
      </div>
      {progress && bar !== null && total !== null && (
        <div class="h-0.75 overflow-hidden rounded-pill bg-line" role="progressbar" aria-label={progress.label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={bar}>
          <span class="block h-full rounded-pill bg-lavender" style={{ width: percent(bar, total) }} />
        </div>
      )}
    </div>
  );
}
