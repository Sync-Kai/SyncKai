// Réveils du service worker (PERF-17) : une écriture locale d'une page de l'extension ne doit pas le réveiller. Le
// worker est arrêté par le protocole DevTools (ServiceWorker.stopAllWorkers), son état suivi par les événements
// ServiceWorker.workerVersionUpdated (runningStatus), puis une page écrit dans le stockage comme en production.
// Lancement : npm run test:ext
import type { CDPSession, Protocol } from 'puppeteer';
import { describe, expect, it } from 'vitest';
import { PANEL_LAST_TAB_KEY } from '../../src/sidepanel/tabs';
import { EXTENSION_ORIGIN, sleep, startExtension, waitFor } from './harness';
import { FakeAniList } from './fake-anilist';
import { seedSettings } from './seed';

/** Attente après une écriture : un réveil par storage.onChanged démarre le worker en quelques dizaines de ms */
const WAKE_WINDOW_MS = 2_500;

/**
 * État du worker de l'extension, suivi par les événements du domaine ServiceWorker. Un démarrage = passage de
 * `stopped` à `starting` / `running` : le navigateur a décidé de lancer le worker pour lui remettre un événement
 * (avec DevTools attaché, il peut rester en `starting`, en attente du débogueur : le réveil a bien eu lieu)
 */
class WorkerWatch {
  status: Protocol.ServiceWorker.ServiceWorkerVersionRunningStatus | null = null;
  starts = 0;
  stops = 0;
  readonly timeline: string[] = [];
  readonly cdp: CDPSession;
  private readonly t0 = Date.now();

  constructor(cdp: CDPSession, resume: () => Promise<void>) {
    this.cdp = cdp;
    cdp.on('ServiceWorker.workerVersionUpdated', (event: Protocol.ServiceWorker.WorkerVersionUpdatedEvent): void => {
      for (const version of event.versions) {
        if (!version.scriptURL.startsWith(EXTENSION_ORIGIN) || version.runningStatus === this.status) continue;
        const next = version.runningStatus;
        if (this.status === 'stopped' && (next === 'starting' || next === 'running')) this.starts += 1;
        if (next === 'starting') void resume().catch((error: unknown) => console.warn('[worker-wake] reprise impossible :', error));
        if (next === 'stopped') this.stops += 1;
        this.timeline.push(`${Date.now() - this.t0} ms ${next}`);
        this.status = next;
      }
    });
  }

  /** Arrête le worker et attend l'arrêt (un redémarrage aussitôt après, événement en attente, reste compté) */
  async stop(): Promise<void> {
    const stops = this.stops;
    await this.cdp.send('ServiceWorker.stopAllWorkers');
    await waitFor('worker arrêté', () => this.stops > stops);
  }
}

describe('Réveils du service worker', () => {
  it('une écriture de storage.local ou storage.session par une page ne réveille pas le worker arrêté', async (context) => {
    const anilist = new FakeAniList({ media: [], accounts: [] });
    const h = await startExtension(context, { routes: [anilist.handler] });
    await seedSettings(h);
    const page = await h.bridge();
    // Worker redémarré sous DevTools : en pause « en attente du débogueur » (auto-attach de Puppeteer), relancé ici
    const resume = async (): Promise<void> => {
      const target = h.browser.targets().find((t) => t.type() === 'service_worker' && t.url().startsWith(EXTENSION_ORIGIN));
      if (!target) return;
      const session = await target.createCDPSession();
      await session.send('Runtime.runIfWaitingForDebugger');
      await session.detach();
    };
    const watch = new WorkerWatch(await page.createCDPSession(), resume);
    await watch.cdp.send('ServiceWorker.enable');
    await waitFor('worker en marche', () => watch.status === 'running');
    // Travail d'installation (alarmes, badge, panneau) terminé avant l'arrêt
    await sleep(1_500);

    // Contrôle de l'observation : un message réveille bien le worker arrêté
    await watch.stop();
    let starts = watch.starts;
    await h.send('GET_CONTENT_CATALOG', { locale: 'fr' });
    expect(watch.starts).toBeGreaterThan(starts);

    // Témoin : écriture dans storage.session (aucun écouteur dans le worker)
    await watch.stop();
    starts = watch.starts;
    await page.evaluate(() => chrome.storage.session.set({ e2eWakeProbe: Date.now() }));
    await sleep(WAKE_WINDOW_MS);
    const afterSession = watch.starts - starts;

    // Écriture locale réelle d'une page : dernier onglet du panneau latéral (sidepanel.ts)
    starts = watch.starts;
    await page.evaluate((key: string) => chrome.storage.local.set({ [key]: 'agenda' }), PANEL_LAST_TAB_KEY);
    await sleep(WAKE_WINDOW_MS);
    const afterLocal = watch.starts - starts;

    // Avant le correctif (écouteur storage.local.onChanged posé par initI18n après un await) : afterLocal = 1, le worker
    // démarré ~10 ms après l'écriture ; l'écriture dans storage.session ne l'a jamais réveillé (3 essais sur 3)
    expect({ afterSession, afterLocal }, `états du worker : ${watch.timeline.join(', ')}`).toEqual({ afterSession: 0, afterLocal: 0 });
  });
});
