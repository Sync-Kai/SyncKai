// Fausses pages de lecture Crunchyroll et ADN, servies à leurs vraies URL (le script de contenu du manifeste s'y injecte
// pour de vrai), avec une vraie <video> lisible par Chromium, et données de générique de static.crunchyroll.com.
// Pages bâties sur les fixtures des adapters (src/content/adapters/__fixtures__) : mêmes JSON-LD, <h1>, liens et
// surcouche du lecteur que ceux relevés sur les sites.
//
// Vidéo : assets/episode-600s.webm, 600 s, 32×18, 1 image/s, VP8, sans son (22 Ko). Produite par :
//   ffmpeg -f lavfi -i "color=c=0x211C2E:size=32x18:rate=1:duration=600" -c:v libvpx -b:v 1k -g 30 -an -map_metadata -1 \
//     -fflags +bitexact episode-600s.webm
// Plus de 2 minutes (MIN_EPISODE_DURATION_S de watch-session.ts : en dessous, une pub). Servie en URL data: (aucune
// requête réseau, recherche dans le fichier sans requête Range).
import fs from 'node:fs';
import path from 'node:path';
import type { Page } from 'puppeteer';
import type { AdnWatchFixture } from '../../src/content/adapters/__fixtures__/adn-watch';
import type { CrunchyrollWatchFixture } from '../../src/content/adapters/__fixtures__/crunchyroll-watch';
import { ROOT, json, sleep, type FakeResponse, type InterceptedRequest, type RequestHandler } from './harness';

/** Durée de la vidéo de test (s) */
export const VIDEO_SECONDS = 600;

let videoUrl: string | null = null;

/** Vidéo de test en URL data: */
export function episodeVideoUrl(): string {
  videoUrl ??= `data:video/webm;base64,${fs.readFileSync(path.join(ROOT, 'scripts/ext-e2e/assets/episode-600s.webm')).toString('base64')}`;
  return videoUrl;
}

const SKIP_EVENTS_PREFIX = 'https://static.crunchyroll.com/skip-events/production/';

const escapeHtml = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface WatchPageOptions {
  /** Langue du site (<html lang>) */
  lang: string;
  /**
   * Lecteur créé seulement quand l'onglet devient visible (lecteur différé d'un onglet ouvert en arrière-plan, comme
   * les vrais sites) ; sinon présent dès le chargement
   */
  deferPlayer?: boolean;
  /**
   * Données de l'épisode (JSON-LD, <h1>, lien vers la série) ajoutées par le site `jsonLdDelayMs` après le chargement
   * (rendu tardif de l'application Crunchyroll) ; sinon présentes dans le HTML
   */
  jsonLdDelayMs?: number;
}

/** Lecteur : <video> muette (lecture sans geste de l'utilisateur), tout de suite ou à la première visibilité */
function playerMarkup(videoAttributes: string, deferPlayer: boolean | undefined): string {
  if (!deferPlayer) return `<div id="player"><video ${videoAttributes} muted preload="auto" src="${episodeVideoUrl()}"></video></div>`;
  return `<div id="player"></div>
<script>
  (() => {
    const mount = () => {
      if (document.visibilityState !== 'visible' || document.querySelector('#player video')) return;
      document.querySelector('#player').innerHTML = ${JSON.stringify(`<video ${videoAttributes} muted preload="auto" src="${episodeVideoUrl()}"></video>`)};
    };
    document.addEventListener('visibilitychange', mount);
    mount();
  })();
</script>`;
}

/** Page de lecture Crunchyroll : JSON-LD TVEpisode, <h1> de l'épisode, lien vers la série, lecteur Bitmovin */
export function crunchyrollWatchHtml(fixture: CrunchyrollWatchFixture, options: WatchPageOptions): string {
  const details = `<h1 class="title">${escapeHtml(fixture.heading)}</h1>
<a data-t="show-title-link" href="${escapeHtml(fixture.seriesLink.href)}"><h4>${escapeHtml(fixture.seriesLink.text)}</h4></a>`;
  const late = options.jsonLdDelayMs !== undefined;
  const lateScript = `<div id="details"></div>
<script>
  setTimeout(() => {
    const data = document.createElement('script');
    data.type = 'application/ld+json';
    data.textContent = ${JSON.stringify(fixture.jsonLd)};
    document.head.append(data);
    document.getElementById('details').innerHTML = ${JSON.stringify(details)};
  }, ${options.jsonLdDelayMs ?? 0});
</script>`;
  return `<!doctype html>
<html lang="${options.lang}">
<head><meta charset="utf-8"><title>Crunchyroll</title>
${late ? '' : `<script type="application/ld+json">${fixture.jsonLd}</script>`}
</head>
<body>
${playerMarkup('id="bitmovinplayer-video-e2e"', options.deferPlayer)}
${late ? lateScript : details}
</body>
</html>`;
}

/** Page de lecture ADN : JSON-LD TVEpisode, lecteur video.js avec sa surcouche (titre de la série, épisode) */
export function adnWatchHtml(fixture: AdnWatchFixture, options: WatchPageOptions): string {
  return `<!doctype html>
<html lang="${options.lang}">
<head><meta charset="utf-8"><title>ADN</title>
<script type="application/ld+json">${fixture.jsonLd}</script>
</head>
<body>
<div class="video-js">
${playerMarkup('class="vjs-tech"', options.deferPlayer)}
<div class="vjs-meta"><span class="vjs-meta-title">${escapeHtml(fixture.player.seriesTitle)}</span><span class="vjs-meta-subtitle">${escapeHtml(fixture.player.subtitle)}</span></div>
</div>
</body>
</html>`;
}

/** Fausses plateformes : pages par URL (sans requête ni ancre), générique de fin par épisode Crunchyroll */
export class FakeSites {
  /** Requêtes servies (pages et données de générique) */
  readonly requests: InterceptedRequest[] = [];
  private readonly pages = new Map<string, { html: string; delayMs: number }>();
  private readonly credits = new Map<string, number>();

  /** Page servie à `url` ; `delayMs` : réponse retardée d'autant (serveur lent, onglet encore en chargement) */
  page(url: string, html: string, options: { delayMs?: number } = {}): this {
    this.pages.set(url, { html, delayMs: options.delayMs ?? 0 });
    return this;
  }

  /** Début du générique de fin d'un épisode Crunchyroll (s) ; sans appel, l'épisode n'a pas de données (404) */
  creditsStart(episodeId: string, start: number): this {
    this.credits.set(episodeId, start);
    return this;
  }

  /** Demandes de données de générique reçues pour cet épisode */
  skipEventsRequests(episodeId: string): number {
    return this.requests.filter((r) => r.url === `${SKIP_EVENTS_PREFIX}${episodeId}.json`).length;
  }

  readonly handler: RequestHandler = (request: InterceptedRequest): FakeResponse | Promise<FakeResponse> | null => {
    const url = new URL(request.url);
    const bare = `${url.origin}${url.pathname}`;
    if (request.url.startsWith(SKIP_EVENTS_PREFIX)) {
      this.requests.push(request);
      const episodeId = decodeURIComponent(url.pathname.split('/').pop()?.replace(/\.json$/, '') ?? '');
      const start = this.credits.get(episodeId);
      // Structure relevée le 2026-09-29 (voir crunchyrollAdapter.getCreditsStart) ; épisode sans données : 404
      if (start === undefined) return { status: 404, headers: { 'Content-Type': 'text/plain' }, body: 'Not Found' };
      return json(200, { intro: { start: 30, end: 120 }, credits: { start, end: VIDEO_SECONDS - 5 }, mediaId: episodeId });
    }
    const page = this.pages.get(bare);
    if (page !== undefined) {
      this.requests.push(request);
      const response: FakeResponse = { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' }, body: page.html };
      return page.delayMs > 0 ? sleep(page.delayMs).then(() => response) : response;
    }
    // Icône demandée par le navigateur sur les sites simulés
    if (url.pathname === '/favicon.ico' && (url.hostname.endsWith('crunchyroll.com') || url.hostname.endsWith('animationdigitalnetwork.com'))) return { status: 404 };
    return null;
  };
}

// ─── Actions de l'utilisateur sur la page (API de la <video>, monde de la page) ───

/** Lance la lecture et attend qu'elle avance (position vue avant le point de fin par le suivi) */
export async function play(page: Page): Promise<void> {
  await page.waitForSelector('video');
  await page.evaluate(async () => {
    const video = document.querySelector('video');
    if (!video) throw new Error('Pas de <video>');
    if (video.readyState < HTMLMediaElement.HAVE_METADATA) await new Promise((resolve) => video.addEventListener('loadedmetadata', resolve, { once: true }));
    await video.play();
    const start = video.currentTime;
    await new Promise<void>((resolve) => {
      const check = (): void => {
        if (video.currentTime > start + 0.3) resolve();
        else setTimeout(check, 50);
      };
      check();
    });
  });
}

/** Avance (ou recule) la lecture à `seconds`, comme un clic sur la barre de progression */
export async function seek(page: Page, seconds: number): Promise<void> {
  await page.evaluate(async (target: number) => {
    const video = document.querySelector('video');
    if (!video) throw new Error('Pas de <video>');
    const seeked = new Promise((resolve) => video.addEventListener('seeked', resolve, { once: true }));
    video.currentTime = target;
    await seeked;
  }, seconds);
}

export async function pause(page: Page): Promise<void> {
  await page.evaluate(() => document.querySelector('video')?.pause());
}

/**
 * Lecture automatique de l'épisode suivant, comme le lecteur Crunchyroll : URL changée par history.pushState (SPA),
 * <h1> et JSON-LD remplacés `renderDelayMs` plus tard (300 ms par défaut ; 0 : dans la même tâche, aucune lecture
 * possible entre les deux), nouvelle source chargée dans la même <video>, lecture relancée
 */
export async function autoplayNextCrunchyroll(page: Page, next: CrunchyrollWatchFixture, options: { renderDelayMs?: number } = {}): Promise<void> {
  await page.evaluate(async (raw: string, renderDelayMs: number) => {
    const fixture = JSON.parse(raw) as CrunchyrollWatchFixture;
    history.pushState({}, '', fixture.url);
    if (renderDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, renderDelayMs));
    const heading = document.querySelector('h1');
    const jsonLd = document.querySelector('script[type="application/ld+json"]');
    const video = document.querySelector('video');
    if (!heading || !jsonLd || !video) throw new Error('Page de lecture incomplète');
    heading.textContent = fixture.heading;
    jsonLd.textContent = fixture.jsonLd;
    const loaded = new Promise((resolve) => video.addEventListener('loadedmetadata', resolve, { once: true }));
    video.src = video.currentSrc;
    await loaded;
  }, JSON.stringify(next), options.renderDelayMs ?? 300);
}

// ─── Toasts de SyncKai (Shadow DOM fermé) ────────────────────────────────

interface DomNode {
  nodeType: number;
  nodeName: string;
  nodeValue: string;
  children?: DomNode[];
  shadowRoots?: (DomNode & { shadowRootType?: string })[];
}

/** Textes de chaque Shadow DOM fermé de la page (le toast de SyncKai), lus par CDP qui les traverse */
export async function closedShadowTexts(page: Page): Promise<string[]> {
  const cdp = await page.createCDPSession();
  try {
    const { root } = (await cdp.send('DOM.getDocument', { depth: -1, pierce: true })) as { root: DomNode };
    const texts: string[] = [];
    const textOf = (node: DomNode): string =>
      node.nodeType === 3 ? node.nodeValue : node.nodeName === 'STYLE' ? '' : [...(node.children ?? []), ...(node.shadowRoots ?? [])].map(textOf).join(' ');
    const visit = (node: DomNode): void => {
      for (const shadow of node.shadowRoots ?? []) {
        if (shadow.shadowRootType === 'closed') texts.push(textOf(shadow).replace(/\s+/g, ' ').trim());
        else visit(shadow);
      }
      for (const child of node.children ?? []) visit(child);
    };
    visit(root);
    return texts;
  } finally {
    await cdp.detach();
  }
}
