import { describe, expect, it, vi } from 'vitest';
import { AIRING_ALARM } from '../browser/airing-alarm';
import { catalogOf } from '../test/catalogs';
import { FakeEvent, installFakeChrome } from '../test/fake-chrome';
import type { AiringCheckResult } from '../shared/airing.types';

// Langue du service worker (2026-10-15) : aucun écouteur storage.onChanged, qui réveillait le worker à chaque écriture
// locale d'une page ou d'un script de contenu (mesuré par scripts/ext-e2e/worker-wake.ext.ts) ; la langue des réglages
// est relue avant chaque traitement. Réglage changé sans événement (stockage semé) : comme pendant le sommeil du worker.

const texts = vi.hoisted(() => ({ airing: [] as string[] }));

// Textes traduits au moment du traitement, comme ceux des vrais modules (erreur d'API, bouton de notification)
vi.mock('./airing', async () => {
  const { t } = await import('../i18n');
  return {
    checkNewEpisodes: async (): Promise<AiringCheckResult> => ({ checkedAt: 1, notified: 0, skipped: null, error: t('airing.unknownError') }),
    handleAiringAlarm: async (): Promise<void> => void texts.airing.push(t('common.open')),
    handleNotificationButton: async (): Promise<void> => undefined,
    handleNotificationClick: async (): Promise<void> => undefined,
  };
});

// Scripts des plateformes (imports `?script` de crxjs, sans objet ici)
vi.mock('./platform-access', () => ({ listenPlatformAccess: (): void => undefined }));
vi.mock('./content-reinjection', () => ({ listenContentReinjection: (): void => undefined }));

type Respond =(response: unknown) => void;
const onMessage = new FakeEvent<[unknown, chrome.runtime.MessageSender, Respond]>();
const event = (): FakeEvent<unknown[]> => new FakeEvent<unknown[]>();

const fake = installFakeChrome({
  extensionId: 'synckai-test',
  extra: {
    runtime: {
      id: 'synckai-test',
      getURL: (path: string) => `chrome-extension://synckai-test/${path.replace(/^\//, '')}`,
      onMessage,
      onInstalled: event(),
      onStartup: event(),
    },
    commands: { onCommand: event() },
    notifications: { onClicked: event(), onButtonClicked: event() },
    permissions: { onAdded: event(), onRemoved: event() },
  },
});
fake.reset({ settings: { language: 'en' } });
await import('./background');

/** Message d'une page de l'extension (panneau latéral), réponse attendue */
function send(message: unknown): Promise<unknown> {
  return new Promise((resolve) => {
    onMessage.emit(message, { id: 'synckai-test', url: 'chrome-extension://synckai-test/src/sidepanel/sidepanel.html' }, resolve);
  });
}

/** Langue changée dans les réglages pendant que le worker ne suivait rien : stockage remplacé sans événement */
function changeLanguageSilently(language: string): void {
  fake.local.seed({ settings: { language } });
}

/** Déclenchement de l'alarme horaire des sorties */
const airingAlarm = (): chrome.alarms.Alarm => ({ name: AIRING_ALARM, scheduledTime: Date.now(), persistAcrossSessions: true });

describe('langue du service worker', () => {
  it('aucun écouteur storage.onChanged posé par l’initialisation de la langue', async () => {
    // Initialisation terminée : un premier message traité
    await send({ type: 'CHECK_AIRING', payload: null });
    expect(fake.local.onChanged.hasListeners()).toBe(false);
    expect(fake.onStorageChanged.hasListeners()).toBe(false);
  });

  it('message traité après un changement de langue : réponse traduite dans la nouvelle langue', async () => {
    changeLanguageSilently('de');
    await expect(send({ type: 'CHECK_AIRING', payload: null })).resolves.toMatchObject({ error: catalogOf('de')['airing.unknownError'] });
    changeLanguageSilently('ja');
    await expect(send({ type: 'CHECK_AIRING', payload: null })).resolves.toMatchObject({ error: catalogOf('ja')['airing.unknownError'] });
  });

  it('alerte de sortie (alarme horaire) : texte dans la langue courante des réglages', async () => {
    changeLanguageSilently('fr');
    fake.alarms.onAlarm.emit(airingAlarm());
    await vi.waitFor(() => expect(texts.airing).toHaveLength(1));
    changeLanguageSilently('es-419');
    fake.alarms.onAlarm.emit(airingAlarm());
    await vi.waitFor(() => expect(texts.airing).toHaveLength(2));
    expect(texts.airing).toEqual([catalogOf('fr')['common.open'], catalogOf('es-419')['common.open']]);
  });
});
