// Note de l'utilisateur dans les détails d'une série (maquette PopupSeriesDeplie, « Ta note ») : titre en petites capitales,
// 10 étoiles à demi-étoiles (StarRating) et « 8,5/10 ». La note choisie reste affichée pendant l'envoi, jusqu'à la note
// relue (ou rendue par l'hôte en cas d'échec). Note sur 10 ; la conversion vers le format AniList / MAL reste au service
// worker. Carte « Sur cette page » du popup, prévu pour le panneau.
import { useEffect, useState } from 'preact/hooks';
import { StarRating } from './star-rating';

export interface RatingBlockProps {
  /** « Ta note » */
  label: string;
  /** Nom du curseur (« Noter Frieren ») */
  sliderLabel: string;
  /** Note enregistrée sur 10 (0 : aucune) */
  value: number;
  /** Envoi en cours ou fiche relue */
  disabled?: boolean;
  /** Note confirmée (clic, Entrée) */
  onRate: (value: number) => void;
  focusKey?: string;
}

export function RatingBlock({ label, sliderLabel, value, disabled = false, onRate, focusKey }: RatingBlockProps) {
  /** Valeur choisie au clavier ou confirmée, en attendant la note relue */
  const [chosen, setChosen] = useState<number | null>(null);
  // Note relue, ou envoi terminé (échec compris) : la note enregistrée prime à nouveau
  useEffect(() => setChosen(null), [value]);
  useEffect(() => {
    if (!disabled) setChosen(null);
  }, [disabled]);
  return (
    <div class="flex min-w-0 flex-col gap-1" role="group" aria-label={label} data-rating-block="">
      <span class="text-section text-muted uppercase" aria-hidden="true">
        {label}
      </span>
      <StarRating
        label={sliderLabel}
        value={chosen ?? value}
        disabled={disabled}
        onChange={setChosen}
        onConfirm={(next) => {
          setChosen(next);
          onRate(next);
        }}
        focusKey={focusKey}
      />
    </div>
  );
}
