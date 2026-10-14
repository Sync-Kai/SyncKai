// Socle des tests de bout en bout de l'extension construite (npm run test:ext) : le vrai dist/ chargé dans Chromium,
// réseau du service worker et des pages intercepté (faux AniList / MyAnimeList, fausses pages de plateformes).
// Aucune requête ne doit atteindre le vrai réseau : toute requête non prévue est refusée et relevée (`unexpected`), et la
// résolution DNS est coupée (--host-resolver-rules) au cas où une requête échapperait à l'interception.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TestContext } from 'vitest';
import puppeteer, { type Browser, type CDPSession, type HTTPRequest, type Page, type Protocol, type Target } from 'puppeteer';
import type { MessagePayload, MessageResponse, MessageType } from '../../src/shared/messages';

export const ROOT: string = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** Identifiant fixé par la clé publique du manifeste (identique au Chrome Web Store) */
export const EXTENSION_ID = 'khokcmigioggannjoojambdgioigdceb';
export const EXTENSION_ORIGIN = `chrome-extension://${EXTENSION_ID}`;

/** Chromium complet (le chrome-headless-shell de test:e2e ne charge pas les extensions) */
const DEFAULT_CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

/** Page sans code de l'application mais avec les API chrome.* de l'extension : pont pour les messages et le stockage */
const BRIDGE_PATH = 'manifest.json';

/** Exécutable : SYNCKAI_EXT_CHROME, sinon le Chromium du conteneur s'il existe, sinon celui de Puppeteer */
export function chromeExecutable(): string | undefined {
  const fromEnv = process.env.SYNCKAI_EXT_CHROME;
  if (fromEnv) return fromEnv;
  return fs.existsSync(DEFAULT_CHROME) ? DEFAULT_CHROME : undefined;
}

/** Profils, copies de l'extension et captures d'échec : hors du dépôt (SYNCKAI_EXT_E2E_DIR ou dossier temporaire) */
export function artifactsDir(): string {
  const dir = process.env.SYNCKAI_EXT_E2E_DIR ?? path.join(os.tmpdir(), 'synckai-ext-e2e');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Build testé : SYNCKAI_EXT_DIST, sinon dist/ (npm run build) */
function distDir(): string {
  const dist = process.env.SYNCKAI_EXT_DIST ?? path.join(ROOT, 'dist');
  if (!fs.existsSync(path.join(dist, 'manifest.json'))) throw new Error(`Extension absente de ${dist} : lancer npm run build`);
  return dist;
}

// ─── Réseau simulé ────────────────────────────────────────────────────────

/** Requête interceptée, côté service worker ou page */
export interface InterceptedRequest {
  source: 'worker' | 'page';
  method: string;
  url: string;
  /** En-têtes, noms en minuscules */
  headers: Record<string, string>;
  body: string | null;
}

/** Réponse simulée : HTTP, ou échec réseau (requête bloquée, hors ligne) */
export type FakeResponse = { status: number; headers?: Record<string, string>; body?: string } | { network: true };

/** Répond à une requête qu'il reconnaît, null sinon (requête suivante dans la liste des routes) */
export type RequestHandler = (request: InterceptedRequest) => FakeResponse | null | Promise<FakeResponse | null>;

/** Réponse JSON */
export function json(status: number, body: unknown, headers: Record<string, string> = {}): FakeResponse {
  return { status, headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) };
}

/** Attend `delay` ms (latence simulée des faux services) */
export function sleep(delay: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/** Attend que `check` renvoie une valeur non nulle (sondage, sans attente fixe) */
export async function waitFor<T>(label: string, check: () => T | null | undefined | Promise<T | null | undefined>, timeout = 10_000): Promise<T> {
  const deadline = Date.now() + timeout;
  for (;;) {
    const value = await check();
    if (value !== null && value !== undefined && value !== false) return value;
    if (Date.now() > deadline) throw new Error(`Délai dépassé : ${label}`);
    await sleep(50);
  }
}

const lowerKeys = (headers: Record<string, string>): Record<string, string> =>
  Object.fromEntries(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]));

/** Corps d'une requête Fetch.requestPaused (postData, ou ses morceaux en base64 pour un gros corps) */
function pausedBody(request: Protocol.Network.Request): string | null {
  if (request.postData !== undefined) return request.postData;
  const entries = request.postDataEntries ?? [];
  if (entries.length === 0) return null;
  return entries.map((entry) => Buffer.from(entry.bytes ?? '', 'base64').toString('utf8')).join('');
}

// ─── Navigateur ───────────────────────────────────────────────────────────

export interface LaunchOptions {
  /** Routes du service worker (faux AniList, faux MAL…), essayées dans l'ordre */
  routes: RequestHandler[];
  /** Version écrite dans le manifeste de la copie testée (mise à jour simulée : voir restart) */
  version?: string;
  /** Routes des onglets (fausses pages de plateformes, données de générique…), essayées avant la page Crunchyroll vide */
  pageRoutes?: RequestHandler[];
}

/** Navigateur lancé avec l'extension, et outils pour la piloter depuis ses propres pages */
export interface ExtensionHarness {
  readonly browser: Browser;
  /** Requêtes refusées : aucune route ne les attendait */
  readonly unexpected: InterceptedRequest[];
  /** Erreurs JavaScript des pages ouvertes par le test */
  readonly pageErrors: string[];
  /** Page pont (manifest.json de l'extension) : messages et stockage */
  bridge(): Promise<Page>;
  /** Message au service worker depuis une page de l'extension (expéditeur « extension ») */
  send<K extends MessageType>(type: K, payload: MessagePayload<K>, page?: Page): Promise<MessageResponse<K>>;
  /** Message au service worker depuis un onglet Crunchyroll simulé (expéditeur « script de contenu ») */
  sendFromContent<K extends MessageType>(type: K, payload: MessagePayload<K>): Promise<MessageResponse<K>>;
  storage(): Promise<Record<string, unknown>>;
  setStorage(items: Record<string, unknown>): Promise<void>;
  /** Ouvre une page de l'extension dans un onglet (ex. src/popup/popup.html), réseau sous surveillance */
  openPage(relativePath: string, viewport?: { width: number; height: number }): Promise<Page>;
  /**
   * Ouvre `url` (fausse page servie par `pageRoutes`) dans un nouvel onglet, réseau sous surveillance. `background` :
   * chargée en arrière-plan, un autre onglet vide restant au premier plan (document.visibilityState « hidden »)
   */
  openTab(url: string, options?: { background?: boolean }): Promise<Page>;
  /** Ferme puis relance le navigateur sur le même profil ; `version` change la version du manifeste (mise à jour) */
  restart(options?: { version?: string }): Promise<void>;
  /** Captures d'écran des pages ouvertes (échec d'un test) */
  capture(label: string): Promise<void>;
  close(): Promise<void>;
}

/** Remplace la version du manifeste de la copie testée */
function writeManifestVersion(extDir: string, version: string): void {
  const file = path.join(extDir, 'manifest.json');
  const manifest: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (typeof manifest !== 'object' || manifest === null) throw new Error('Manifeste illisible');
  fs.writeFileSync(file, JSON.stringify({ ...manifest, version }));
}

function launchArgs(extDir: string): string[] {
  const args = [
    '--disable-gpu',
    `--disable-extensions-except=${extDir}`,
    `--load-extension=${extDir}`,
    // Jamais le vrai réseau : sans proxy, et toute résolution DNS échoue (les requêtes interceptées n'en ont pas besoin)
    '--no-proxy-server',
    '--host-resolver-rules=MAP * ~NOTFOUND',
    '--no-first-run',
    '--lang=en-US',
  ];
  // Chrome refuse de démarrer en root sans --no-sandbox (conteneur) ; espaces de noms restreints en CI
  if (process.getuid?.() === 0 || process.env.CI) args.push('--no-sandbox');
  return args;
}

/** Lance Chromium avec l'extension construite (profil neuf), interception active avant le premier message */
export async function launchExtension(options: LaunchOptions): Promise<ExtensionHarness> {
  const root = fs.mkdtempSync(path.join(artifactsDir(), 'run-'));
  const extDir = path.join(root, 'extension');
  const profileDir = path.join(root, 'profile');
  // Copie : la version du manifeste peut changer entre deux lancements sans toucher à dist/
  fs.cpSync(distDir(), extDir, { recursive: true });
  if (options.version !== undefined) writeManifestVersion(extDir, options.version);

  const unexpected: InterceptedRequest[] = [];
  const pageErrors: string[] = [];
  const pages: Page[] = [];
  let browser: Browser;
  let bridgePage: Page | null = null;
  let contentPage: Page | null = null;
  let closed = false;
  const attached = new WeakSet<Target>();

  async function route(request: InterceptedRequest): Promise<FakeResponse | null> {
    for (const handler of options.routes) {
      const response = await handler(request);
      if (response !== null) return response;
    }
    return null;
  }

  /** Interception du réseau du service worker (domaine Fetch de sa cible), rattachée à chaque nouveau worker */
  async function attachWorker(target: Target): Promise<void> {
    if (attached.has(target)) return;
    attached.add(target);
    const cdp: CDPSession = await target.createCDPSession();
    cdp.on('Fetch.requestPaused', (event: Protocol.Fetch.RequestPausedEvent): void => {
      const request: InterceptedRequest = {
        source: 'worker',
        method: event.request.method,
        url: event.request.url,
        headers: lowerKeys(event.request.headers),
        body: pausedBody(event.request),
      };
      void (async (): Promise<void> => {
        try {
          const response = await route(request);
          if (response === null) {
            unexpected.push(request);
            await cdp.send('Fetch.failRequest', { requestId: event.requestId, errorReason: 'BlockedByClient' });
          } else if ('network' in response) {
            await cdp.send('Fetch.failRequest', { requestId: event.requestId, errorReason: 'InternetDisconnected' });
          } else {
            await cdp.send('Fetch.fulfillRequest', {
              requestId: event.requestId,
              responseCode: response.status,
              responseHeaders: Object.entries({ 'Access-Control-Allow-Origin': '*', ...response.headers }).map(([name, value]) => ({ name, value })),
              body: Buffer.from(response.body ?? '').toString('base64'),
            });
          }
        } catch (error: unknown) {
          // Worker arrêté pendant la réponse : rien à faire, la requête est perdue avec lui
          if (!closed) console.warn('[ext-e2e] Réponse simulée impossible :', request.url, error);
        }
      })();
    });
    await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
  }

  const isOurWorker = (target: Target): boolean => target.type() === 'service_worker' && target.url().startsWith(EXTENSION_ORIGIN);

  async function start(): Promise<void> {
    closed = false;
    browser = await puppeteer.launch({ executablePath: chromeExecutable(), headless: true, pipe: true, userDataDir: profileDir, args: launchArgs(extDir) });
    // Worker redémarré (mise à jour, réveil) : nouvelle cible, interception rattachée aussitôt
    browser.on('targetcreated', (target: Target): void => {
      if (isOurWorker(target)) void attachWorker(target).catch((error: unknown) => console.warn('[ext-e2e] Interception du worker impossible :', error));
    });
    await attachWorker(await browser.waitForTarget(isOurWorker, { timeout: 15_000 }));
  }

  async function routePage(request: InterceptedRequest): Promise<FakeResponse | null> {
    for (const handler of options.pageRoutes ?? []) {
      const response = await handler(request);
      if (response !== null) return response;
    }
    return null;
  }

  /**
   * Réseau d'une page : ressources de l'extension servies, routes des onglets (pageRoutes), pages Crunchyroll vides,
   * tout le reste refusé et relevé
   */
  async function watchPage(page: Page): Promise<void> {
    pages.push(page);
    page.on('pageerror', (error: unknown) => pageErrors.push(`${page.url()} : ${String(error)}`));
    await page.setRequestInterception(true);
    page.on('request', (request: HTTPRequest): void => {
      const url = request.url();
      if (url.startsWith(`${EXTENSION_ORIGIN}/`) || url.startsWith('data:')) {
        void request.continue();
        return;
      }
      const intercepted: InterceptedRequest = { source: 'page', method: request.method(), url, headers: lowerKeys(request.headers()), body: request.postData() ?? null };
      void (async (): Promise<void> => {
        try {
          const response = await routePage(intercepted);
          if (response !== null && 'network' in response) {
            await request.abort('internetdisconnected');
          } else if (response !== null) {
            await request.respond({ status: response.status, headers: { 'Access-Control-Allow-Origin': '*', ...response.headers }, body: response.body ?? '' });
          } else if (url.startsWith('https://www.crunchyroll.com/')) {
            await request.respond({ status: 200, contentType: 'text/html', body: '<!doctype html><html lang="en"><head><title>Crunchyroll</title></head><body></body></html>' });
          } else {
            unexpected.push(intercepted);
            await request.abort('blockedbyclient');
          }
        } catch (error: unknown) {
          // Page fermée pendant la réponse : requête perdue avec elle
          if (!closed && !page.isClosed()) console.warn('[ext-e2e] Réponse de page impossible :', url, error);
        }
      })();
    });
  }

  async function openPage(relativePath: string, viewport = { width: 400, height: 600 }): Promise<Page> {
    const page = await browser.newPage();
    await watchPage(page);
    await page.setViewport(viewport);
    await page.goto(`${EXTENSION_ORIGIN}/${relativePath}`, { waitUntil: 'load' });
    return page;
  }

  async function openTab(url: string, tabOptions: { background?: boolean } = {}): Promise<Page> {
    const page = await browser.newPage();
    await watchPage(page);
    if (tabOptions.background) await (await browser.newPage()).bringToFront();
    await page.goto(url, { waitUntil: 'load' });
    return page;
  }

  async function bridge(): Promise<Page> {
    bridgePage ??= await openPage(BRIDGE_PATH);
    return bridgePage;
  }

  /**
   * Onglet Crunchyroll simulé (le vrai script de contenu du manifeste y tourne). Page hors lecture : sur /watch/, le
   * script lirait les marqueurs de générique sur static.crunchyroll.com
   */
  async function contentTab(): Promise<Page> {
    if (contentPage) return contentPage;
    const page = await browser.newPage();
    await watchPage(page);
    await page.goto('https://www.crunchyroll.com/fr/e2e', { waitUntil: 'load' });
    contentPage = page;
    return page;
  }

  const harness: ExtensionHarness = {
    get browser() {
      return browser;
    },
    unexpected,
    pageErrors,
    bridge,
    async send(type, payload, page) {
      const target = page ?? (await bridge());
      // Message passé en JSON : les `null` doivent arriver tels quels
      return target.evaluate((message: string) => chrome.runtime.sendMessage(JSON.parse(message)), JSON.stringify({ type, payload }));
    },
    async sendFromContent(type, payload) {
      await contentTab();
      const page = await bridge();
      // Script exécuté dans le monde isolé de l'onglet (celui des scripts de contenu) : l'expéditeur est l'onglet
      // Crunchyroll. Message en JSON : executeScript retire les `null` des arguments (champs requis de EpisodeInfo)
      return page.evaluate(async (message: string) => {
        const [tab] = await chrome.tabs.query({ url: 'https://www.crunchyroll.com/*' });
        if (tab?.id === undefined) throw new Error('Onglet Crunchyroll introuvable');
        const [injection] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (raw: string): Promise<unknown> => chrome.runtime.sendMessage(JSON.parse(raw)),
          args: [message],
        });
        return injection?.result;
      }, JSON.stringify({ type, payload })) as Promise<MessageResponse<typeof type>>;
    },
    async storage() {
      return (await bridge()).evaluate(() => chrome.storage.local.get(null));
    },
    async setStorage(items) {
      await (await bridge()).evaluate((raw: string) => chrome.storage.local.set(JSON.parse(raw)), JSON.stringify(items));
    },
    openPage,
    openTab,
    async restart(restartOptions = {}) {
      closed = true;
      await browser.close();
      pages.length = 0;
      bridgePage = null;
      contentPage = null;
      if (restartOptions.version !== undefined) writeManifestVersion(extDir, restartOptions.version);
      await start();
    },
    async capture(label) {
      if (closed) return;
      const dir = path.join(root, 'failure');
      fs.mkdirSync(dir, { recursive: true });
      const safe = label.replace(/[^\w-]+/g, '_').slice(0, 80);
      for (const [index, page] of pages.entries()) {
        if (page.isClosed()) continue;
        try {
          await page.screenshot({ path: path.join(dir, `${safe}-${index}.png`) });
        } catch {
          // Page fermée ou sans rendu (onglet en arrière-plan) : capture ignorée
        }
      }
      console.warn(`[ext-e2e] Captures et profil gardés dans ${root}`);
    },
    async close() {
      if (closed) return;
      closed = true;
      await browser.close();
      // Profil supprimé après un succès (gardé avec les captures après un échec, ou si SYNCKAI_EXT_E2E_KEEP=1)
      if (!fs.existsSync(path.join(root, 'failure')) && process.env.SYNCKAI_EXT_E2E_KEEP !== '1') fs.rmSync(root, { recursive: true, force: true });
    },
  };

  await start();
  return harness;
}

/** Lance l'extension pour le test en cours : captures si le test échoue, navigateur fermé à la fin */
export async function startExtension(context: TestContext, options: LaunchOptions): Promise<ExtensionHarness> {
  const harness = await launchExtension(options);
  context.onTestFailed(() => harness.capture(context.task.name));
  context.onTestFinished(() => harness.close());
  return harness;
}
