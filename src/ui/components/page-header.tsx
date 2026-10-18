// En-tête des pages en onglet (maquettes Import*, Sauvegarde) : Kai, « SyncKai » et le kana sur 52 px, bordure `line`
// dessous ; le contenu suit la colonne de la page (`column` : largeur et gouttières).
import { kai } from '../icons';
import { MountedNode } from './icon';

export function PageHeader({ column }: { column: string }) {
  return (
    <header class="shrink-0 border-b border-line">
      <div class={`${column} flex h-13 items-center gap-2`}>
        <MountedNode build={() => kai('h-6 w-6', { size: 'small', tile: true })} inputs={[]} />
        <span class="font-display text-stat">SyncKai</span>
        <span class="text-section font-bold tracking-normal text-muted" aria-hidden="true">
          シンカイ
        </span>
      </div>
    </header>
  );
}
