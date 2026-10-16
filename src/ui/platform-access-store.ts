// Accès aux plateformes optionnelles (Netflix, Disney+, Prime Video) d'une page : UN store par page (popup, panneau),
// créé au démarrage et partagé par ses écrans (fiche de la page, suivi de l'onglet, Réglages, Agenda), avec une seule
// paire d'écouteurs permissions.onAdded / onRemoved (4-D6). L'accès EST la permission : rien n'est stocké.
import { grantedOptionalPlatforms, requestPlatformAccess } from '../browser/platform-access';
import { isOptionalPlatform, type StreamingPlatform } from '../platforms/registry';
import { createStore, type Store } from './state';

export type GrantedPlatforms = readonly StreamingPlatform[];

export interface PlatformAccessStore extends Pick<Store<GrantedPlatforms | undefined>, 'get' | 'subscribe'> {
  /** Relit les accès ; deux relectures concurrentes : la plus récente l'emporte, même si elle répond la première (4-R2) */
  refresh(): Promise<GrantedPlatforms>;
  /** Accès à jour : relecture en cours attendue (permission tout juste changée), sinon dernière liste lue */
  read(): Promise<GrantedPlatforms>;
  /** Accès à une plateforme (toujours vrai pour une plateforme du manifeste), d'après `read` */
  has(platform: StreamingPlatform): Promise<boolean>;
  /**
   * Rappel à chaque événement permissions.onAdded / onRemoved, quelle que soit la permission (accès aux sites sous
   * Firefox compris), après le lancement de la relecture : un `read` fait dans le rappel attend la nouvelle liste
   */
  onPermissionsChange(listener: () => void): () => void;
  /** Écouteurs retirés (hôte qui recrée ses écrans) */
  dispose(): void;
}

export function createPlatformAccessStore(): PlatformAccessStore {
  const store = createStore<GrantedPlatforms | undefined>(undefined);
  const listeners = new Set<() => void>();
  /** Relecture la plus récente, tant qu'elle n'a pas répondu */
  let inFlight: Promise<GrantedPlatforms> | null = null;
  let run = 0;

  function refresh(): Promise<GrantedPlatforms> {
    const current = ++run;
    const reading = grantedOptionalPlatforms().then(async (granted): Promise<GrantedPlatforms> => {
      // Relecture dépassée (accordé puis retiré aussitôt) : sa réponse, plus ancienne, n'est jamais appliquée
      if (current !== run) return (await inFlight) ?? store.get() ?? [];
      inFlight = null;
      if (store.get()?.join() !== granted.join()) store.set(granted);
      return granted;
    });
    inFlight = reading;
    return reading;
  }

  const read = (): Promise<GrantedPlatforms> => inFlight ?? Promise.resolve(store.get() ?? []);

  const onEvent = (): void => {
    void refresh();
    for (const listener of [...listeners]) listener();
  };
  chrome.permissions?.onAdded?.addListener(onEvent);
  chrome.permissions?.onRemoved?.addListener(onEvent);
  void refresh();

  return {
    get: () => store.get(),
    subscribe: (listener) => store.subscribe(listener),
    refresh,
    read,
    async has(platform) {
      if (!isOptionalPlatform(platform)) return true;
      return (await read()).includes(platform);
    },
    onPermissionsChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      listeners.clear();
      chrome.permissions?.onAdded?.removeListener(onEvent);
      chrome.permissions?.onRemoved?.removeListener(onEvent);
    },
  };
}

/**
 * Demande l'accès depuis un clic (bouton « Activer », interrupteur des Réglages) : permissions.request est appelé tout de
 * suite, sans await avant (geste utilisateur exigé par Firefox), puis les accès de la page sont relus avant la réponse.
 * Une demande en échec est transmise à l'appelant (journal, message d'erreur).
 */
export function requestPlatformAccessFromClick(platform: StreamingPlatform, access: PlatformAccessStore): Promise<boolean> {
  return requestPlatformAccess(platform).then(async (granted) => {
    await access.refresh();
    return granted;
  });
}
