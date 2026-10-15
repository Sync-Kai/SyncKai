// Carte de lignes des Réglages pour les pages Preact : même conteneur que rowsCard() (rows.ts).
import type { ComponentChildren } from 'preact';
import { ROWS_CARD } from './rows';

interface RowsCardProps {
  children: ComponentChildren;
}

export function RowsCard({ children }: RowsCardProps) {
  return <div class={ROWS_CARD}>{children}</div>;
}
