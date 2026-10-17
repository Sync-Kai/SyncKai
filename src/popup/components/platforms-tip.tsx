// Astuce « Netflix, Disney+, Prime Video (en option) et ton lecteur préféré se règlent dans Réglages › Plateformes »
// (accueil et état vide de « En cours ») : le chemin des Réglages est un lien au milieu de la phrase traduite.
import { t } from '../../i18n';
import { settingsPath } from '../../ui/settings/navigation';

/** Lien « Réglages › Plateformes » au milieu de la phrase traduite (`watching.tip`) */
export function PlatformsTipText({ onOpen }: { onOpen: () => void }) {
  const [before = '', after = ''] = t('watching.tip').split('{path}');
  return (
    <>
      {before}
      <button
        type="button"
        class="cursor-pointer border-0 bg-transparent p-0 font-extrabold text-ink underline decoration-field underline-offset-2 hover:decoration-ink"
        data-focus="tip-settings"
        onClick={onOpen}
      >
        {settingsPath('platforms')}
      </button>
      {after}
    </>
  );
}
