// Bouton « Ouvrir » : lien rond de 32 px (jeton logo-button), surface neutre bordée `line`, logo de plateforme de 18 px.
// Survol : fond `raised`, bordure `muted` (docs/design/README.md › Account menu) ; focus clavier : anneau global.
import type { StreamingPlatform } from '../../platforms/ids';
import { ServiceLogo } from './service-logo';

export interface LogoButtonProps {
  platform: StreamingPlatform;
  href: string;
  /** Nom accessible (« Ouvrir Dandadan sur Crunchyroll ») */
  label: string;
  /** Infobulle (« Ouvrir sur Crunchyroll ») ; défaut : le libellé */
  title?: string;
  onClick?: (event: MouseEvent) => void;
  focusKey?: string;
}

export function LogoButton({ platform, href, label, title, onClick, focusKey }: LogoButtonProps) {
  return (
    <a
      class="inline-flex size-logo-button shrink-0 items-center justify-center rounded-pill border border-line bg-surface transition-colors hover:border-muted hover:bg-raised"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={title ?? label}
      data-focus={focusKey}
      onClick={onClick}
    >
      <ServiceLogo id={platform} size="md" />
    </a>
  );
}
