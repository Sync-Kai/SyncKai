// Barres de l'écran Stats, en HTML et CSS seulement (aucune bibliothèque de graphiques) : colonnes (activité par jour ou
// par mois, notes, décennies) et lignes (statuts, genres, formats, studios). Hauteurs et largeurs en % de la plus grande
// valeur, par l'objet `style`. Les colonnes sont masquées aux lecteurs d'écran, qui lisent à la place la liste de leurs
// infobulles (barres non vides) ; une ligne garde son libellé et sa valeur lisibles, seule la barre est masquée.
import type { ComponentChildren } from 'preact';
import { TONE_BG, type Tone } from '../../ui/components/tone';

export interface BarColumn {
  key: string;
  /** Sous la colonne (toutes jusqu'à 12 colonnes, sinon la première et la dernière) */
  label: string;
  value: number;
  /** Infobulle, et texte lu à la place du graphique */
  title: string;
}

/** Libellés sous chaque colonne jusqu'à ce nombre, aux extrémités au-delà (30 jours) */
const MAX_LABELLED_COLUMNS = 12;

/** Part de la plus grande valeur, en %, au moins `floor` pour qu'une petite valeur reste visible (≈ 3 px) */
const percent = (value: number, max: number, floor: number): string => `${Math.max(floor, max > 0 ? Math.round((value / max) * 1000) / 10 : 0)}%`;

export function BarColumns({ bars, tone = 'info', caps }: { bars: readonly BarColumn[]; tone?: Tone; caps?: 'peak' | 'all' }) {
  const max = Math.max(0, ...bars.map((bar) => bar.value));
  const peak = bars.findIndex((bar) => bar.value === max && max > 0);
  const first = bars[0];
  const last = bars.at(-1);
  return (
    <div class="flex min-w-0 flex-1 flex-col gap-1">
      <div class="flex flex-col gap-1" aria-hidden="true" data-bar-columns="">
        {/* Marge haute : place de la valeur au-dessus de la colonne la plus haute */}
        <div class={`flex h-14 items-end gap-0.5 ${caps ? 'pt-4' : ''}`}>
          {bars.map((bar, index) => (
            <div key={bar.key} class="flex h-full min-w-0 flex-1 flex-col justify-end" title={bar.title}>
              {bar.value > 0 ? (
                <span class={`relative mx-auto block w-full max-w-7 rounded-t-logo ${TONE_BG[tone]}`} style={{ height: percent(bar.value, max, 6) }} data-bar="">
                  {(caps === 'all' || (caps === 'peak' && index === peak)) && (
                    <span class="absolute bottom-full left-1/2 mb-0.5 -translate-x-1/2 text-overline tracking-normal whitespace-nowrap text-muted tabular-nums">{bar.value}</span>
                  )}
                </span>
              ) : (
                <span class="mx-auto block h-0.5 w-full max-w-7 rounded-pill bg-line" data-bar="" />
              )}
            </div>
          ))}
        </div>
        {bars.length <= MAX_LABELLED_COLUMNS ? (
          <div class="flex gap-0.5 border-t border-line pt-1">
            {bars.map((bar) => (
              <span key={bar.key} class="min-w-0 flex-1 truncate text-center text-overline font-semibold tracking-normal text-muted" title={bar.label}>
                {bar.label}
              </span>
            ))}
          </div>
        ) : (
          first &&
          last && (
            <div class="flex justify-between gap-2 text-overline font-semibold tracking-normal text-muted">
              <span>{first.label}</span>
              <span>{last.label}</span>
            </div>
          )
        )}
      </div>
      {/* Chaque élément porte sr-only lui-même (le relevé de mise en page ignore ainsi le texte lu seulement) */}
      <ul class="m-0 list-none p-0" data-bar-list="">
        {bars
          .filter((bar) => bar.value > 0)
          .map((bar) => (
            <li key={bar.key} class="sr-only">
              {bar.title}
            </li>
          ))}
      </ul>
    </div>
  );
}

export interface BarRow {
  key: string;
  label: string;
  value: number;
  /** Valeur affichée (chiffres de la langue) */
  display: string;
  /** Point devant le libellé et couleur de la barre (statuts) ; défaut lavande, sans point */
  tone?: Tone;
  /** Colonne de plus à droite (note moyenne d'un genre) */
  extra?: ComponentChildren;
}

export function BarRows({ rows }: { rows: readonly BarRow[] }) {
  const max = Math.max(0, ...rows.map((row) => row.value));
  const extra = rows.some((row) => row.extra !== undefined);
  return (
    <ul class="m-0 flex list-none flex-col gap-1.5 p-0">
      {rows.map((row) => (
        <li
          key={row.key}
          class={`grid items-center gap-2 text-secondary ${extra ? 'grid-cols-[minmax(0,7.5rem)_1fr_auto_2.5rem]' : 'grid-cols-[minmax(0,7.5rem)_1fr_auto]'}`}
          data-bar-row={row.key}
        >
          <span class="flex min-w-0 items-center gap-1.5">
            {row.tone && <span class={`size-2 shrink-0 rounded-pill ${TONE_BG[row.tone]}`} aria-hidden="true" />}
            <span class="truncate text-ink" title={row.label}>
              {row.label}
            </span>
          </span>
          <span class="flex min-w-0" aria-hidden="true">
            <span class={`block h-2 rounded-pill ${TONE_BG[row.tone ?? 'info']}`} style={{ width: percent(row.value, max, 2) }} data-bar="" />
          </span>
          <span class="text-right font-extrabold text-ink tabular-nums">{row.display}</span>
          {extra && <span class="flex items-center justify-end gap-0.5 text-muted tabular-nums">{row.extra}</span>}
        </li>
      ))}
    </ul>
  );
}
