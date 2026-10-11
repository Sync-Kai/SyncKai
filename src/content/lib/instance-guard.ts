import { isRecord } from '../../shared/guards';

/**
 * Garde contre une double exécution d'un script de contenu dans le même monde isolé (script déclaré puis
 * réinjection par le service worker, accès Netflix retiré puis accordé de nouveau…). La valeur posée sous `flag`
 * est le `chrome.runtime` de l'instance qui tourne : s'il n'a plus d'`id`, cette instance est orpheline
 * (extension rechargée ou mise à jour, Chrome) et ne bloque pas la nouvelle, qui l'arrête ensuite (start.ts).
 * Firefox détruit le bac à sable de l'ancienne instance à la mise à jour : la nouvelle n'y voit aucune garde.
 * Retourne true si cette exécution doit démarrer.
 */
export function claimContentInstance(flag: symbol): boolean {
  const running: unknown = Reflect.get(globalThis, flag);
  if (isRecord(running) && typeof running.id === 'string') return false;
  Reflect.defineProperty(globalThis, flag, { value: chrome.runtime, configurable: true });
  return true;
}
