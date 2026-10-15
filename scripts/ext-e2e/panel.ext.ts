// Panneau latéral, Agenda et clavier, sur l'extension construite (docs/audit/MANUAL-TESTS.md §5 et §7).
// Le panneau est sa vraie page (src/sidepanel/sidepanel.html) ouverte dans un onglet de la même fenêtre : il suit
// l'onglet actif de sa fenêtre (sidepanel/presence.ts › watchPanelContext, chrome.tabs.onActivated / onUpdated), comme
// le panneau global de Chrome. L'onglet Crunchyroll ouvert ensuite passe au premier plan : le panneau le suit. Puppeteer
// ne peut pas ouvrir le vrai panneau (sidePanel.open exige un geste de l'utilisateur dans le navigateur).
// Lancement : npm run test:ext
import { describe, expect, it } from 'vitest';
import { ONE_PIECE_E1180, ONE_PIECE_E1181 } from '../../src/content/crunchyroll/__fixtures__/crunchyroll-watch';
import { tl } from '../../src/i18n';
import { FakeSites, autoplayNextCrunchyroll, crunchyrollWatchHtml, play, seek } from './fake-sites';
import { waitFor } from './harness';
import { ANILIST_A, MAL_A, expectCleanRun } from './seed';
import { CREDITS_START, FRIEREN_E3, FRIEREN_S1, FRIEREN_S2, ONE_PIECE, en, hasSkeleton, launch, nowPlayingText, openPanel, sel, stays, storedMappings, waitForEntry } from './scenario';

// ─── Scénarios ────────────────────────────────────────────────────────────

describe('Panneau latéral', () => {
  it('ouvert pendant le chargement de l’épisode (réponse lente, JSON-LD rendu tard) : la fiche s’affiche, jamais de squelette sans fin', async (context) => {
    const sites = new FakeSites().page(ONE_PIECE_E1180.url, crunchyrollWatchHtml(ONE_PIECE_E1180, { lang: 'fr', jsonLdDelayMs: 1_500 }), { delayMs: 2_000 }).creditsStart(ONE_PIECE_E1180.episodeId, CREDITS_START);
    const run = await launch(context, [ONE_PIECE], sites);
    const panel = await openPanel(run.h);
    // Panneau seul au premier plan : Agenda
    await panel.waitForSelector('#sk-tab-agenda[aria-selected="true"]');

    // L'épisode s'ouvre au premier plan ; le panneau le suit pendant que la page charge encore
    await run.h.openTab(ONE_PIECE_E1180.url, { wait: false });
    await panel.waitForSelector('#sk-tab-nowPlaying[aria-selected="true"]', { timeout: 10_000 });
    // Onglet encore en chargement (réponse du site retardée) quand le panneau bascule sur « En lecture »
    expect(await (await run.h.bridge()).evaluate(async (url: string) => (await chrome.tabs.query({ url }))[0]?.status, ONE_PIECE_E1180.url)).toBe('loading');

    const text = await waitForEntry(panel, 'ONE PIECE', en('panel.nowPlaying.episodeNoTotal', { episode: 1180 }));
    expect(text).not.toContain(en('panel.nowPlaying.noPage'));
    // Fiche stable : ni squelette ni relecture sans fin
    await stays('fiche affichée sans squelette', async () => !(await hasSkeleton(panel)) && (await nowPlayingText(panel)).includes('ONE PIECE'), 1_500);
    expectCleanRun(run.h, run.anilist, run.mal);
  });

  it('« +1 » puis épisode suivant aussitôt (SPA) : la fiche du nouvel épisode reste affichée, la réponse tardive du +1 ne la remplace pas', async (context) => {
    const sites = new FakeSites()
      .page(ONE_PIECE_E1180.url, crunchyrollWatchHtml(ONE_PIECE_E1180, { lang: 'fr' }))
      .creditsStart(ONE_PIECE_E1180.episodeId, CREDITS_START)
      .creditsStart(ONE_PIECE_E1181.episodeId, CREDITS_START);
    const run = await launch(context, [ONE_PIECE], sites);
    const panel = await openPanel(run.h);
    const tab = await run.h.openTab(ONE_PIECE_E1180.url);
    await waitForEntry(panel, 'ONE PIECE', en('panel.nowPlaying.episodeNoTotal', { episode: 1180 }));

    // AniList et MAL lents : le +1 est encore en vol quand l'épisode change
    run.anilist.latencyMs = 1_200;
    run.mal.latencyMs = 1_200;
    await panel.$eval(sel('page-plus'), (button) => (button as HTMLButtonElement).click());
    await panel.waitForSelector(`${sel('page-plus')}[aria-disabled="true"]`);
    // Page du nouvel épisode rendue avec son URL (voir le scénario suivant pour un rendu en retard sur l'URL)
    await autoplayNextCrunchyroll(tab, ONE_PIECE_E1181, { renderDelayMs: 0 });

    const line1180 = en('panel.nowPlaying.episodeNoTotal', { episode: 1180 });
    const line1181 = en('panel.nowPlaying.episodeNoTotal', { episode: 1181 });
    await waitForEntry(panel, 'ONE PIECE', line1181, 20_000);
    // +1 terminé (écrit sur les deux services) après le changement d'épisode
    await waitFor('+1 écrit', () => run.anilist.mutations().length === 1 && run.mal.writes().length === 1, 15_000);
    run.anilist.latencyMs = 0;
    run.mal.latencyMs = 0;
    expect(run.anilist.mutations().map((m) => m.variables)).toEqual([{ mediaId: 21, progress: 1180, status: 'CURRENT' }]);
    // Réponse du +1 arrivée : la fiche de E1181 reste là, jamais celle de E1180
    await stays(
      'fiche de E1181 affichée',
      async () => {
        const text = await nowPlayingText(panel);
        return text.includes(line1181) && !text.includes(line1180);
      },
      2_500,
    );
    expectCleanRun(run.h, run.anilist, run.mal);
  }, 90_000);

  // Après une navigation SPA, Crunchyroll change l'URL avant de rendre le <h1> et le JSON-LD du nouvel épisode. Le
  // panneau relit la page 250 ms après le changement d'URL (presence.ts) : <h1> et JSON-LD encore ceux de l'ancien
  // épisode, d'accord entre eux. Le script de contenu ne répond rien tant que ce libellé, déjà attribué à E1180, est
  // récent pour E1181 (parsing.ts › LabelGuard.isUnsettled) : les relectures suivantes trouvent la page rendue. Rendu en
  // retard de 1,5 s ici (300 ms dans le scénario de lecture automatique de playback.ext.ts) pour que la première lecture
  // tombe à coup sûr dans la fenêtre.
  it('lecture automatique avec rendu en retard sur l’URL : la fiche passe au numéro du nouvel épisode, jamais celui de l’ancien', async (context) => {
    const sites = new FakeSites()
      .page(ONE_PIECE_E1180.url, crunchyrollWatchHtml(ONE_PIECE_E1180, { lang: 'fr' }))
      .creditsStart(ONE_PIECE_E1180.episodeId, CREDITS_START)
      .creditsStart(ONE_PIECE_E1181.episodeId, CREDITS_START);
    const run = await launch(context, [ONE_PIECE], sites);
    const panel = await openPanel(run.h);
    const tab = await run.h.openTab(ONE_PIECE_E1180.url);
    await waitForEntry(panel, 'ONE PIECE', en('panel.nowPlaying.episodeNoTotal', { episode: 1180 }));
    await autoplayNextCrunchyroll(tab, ONE_PIECE_E1181, { renderDelayMs: 1_500 });
    await waitForEntry(panel, 'ONE PIECE', en('panel.nowPlaying.episodeNoTotal', { episode: 1181 }), 10_000);
    await stays('fiche de E1181 affichée', async () => (await nowPlayingText(panel)).includes(en('panel.nowPlaying.episodeNoTotal', { episode: 1181 })), 2_000);
    expectCleanRun(run.h, run.anilist, run.mal);
  }, 60_000);

  it('choix de la saison dans le panneau, puis épisode terminé : progression écrite sur la saison choisie, correspondance listée dans Mes données', async (context) => {
    const sites = new FakeSites().page(FRIEREN_E3.url, crunchyrollWatchHtml(FRIEREN_E3, { lang: 'en' })).creditsStart(FRIEREN_E3.episodeId, CREDITS_START);
    const run = await launch(context, [FRIEREN_S1, FRIEREN_S2], sites);
    const panel = await openPanel(run.h);
    const tab = await run.h.openTab(FRIEREN_E3.url);
    // Saison 1 devinée d'après la page (S1 E3)
    await waitForEntry(panel, FRIEREN_S1.anilist.title, en('panel.nowPlaying.episode', { episode: 3, total: 28 }));
    const options = await panel.$$eval(`${sel('page-season')} option`, (list) => list.map((o) => (o).value));
    expect(options).toEqual([String(FRIEREN_S1.anilist.id), String(FRIEREN_S2.anilist.id)]);

    // L'utilisateur choisit la saison 2 (sélecteur « Season »)
    await panel.select(sel('page-season'), String(FRIEREN_S2.anilist.id));
    await waitForEntry(panel, FRIEREN_S2.anilist.title, en('panel.nowPlaying.episode', { episode: 3, total: 10 }));
    const mapping = await waitFor('saison choisie enregistrée', async () => Object.values(await storedMappings(run.h)).find((m) => m.mediaId === FRIEREN_S2.anilist.id));
    expect(mapping).toMatchObject({ numbering: 'season', offset: 0, mediaTitle: FRIEREN_S2.anilist.title });
    expect(run.anilist.mutations()).toEqual([]);

    // Fin de l'épisode (vraie lecture jusqu'au générique) : écrit sur la saison choisie, jamais sur la saison 1
    await play(tab);
    await seek(tab, CREDITS_START + 1);
    await waitFor('progression écrite', () => run.anilist.mutations().length === 1 && run.mal.writes().length === 1);
    expect(run.anilist.mutations().map((m) => m.variables)).toEqual([{ mediaId: FRIEREN_S2.anilist.id, progress: 3, status: 'CURRENT' }]);
    expect(run.mal.writes().map((w) => w.path)).toEqual([`/anime/${FRIEREN_S2.mal.id}/my_list_status`]);
    expect(run.anilist.entry(ANILIST_A.token, FRIEREN_S1.anilist.id)).toMatchObject({ progress: 2 });

    // Réglages › Mes données (dans le panneau) : la correspondance est listée
    await panel.$eval(sel('gear'), (button) => (button as HTMLButtonElement).click());
    await panel.waitForSelector(sel('settings-cat-data'));
    await panel.$eval(sel('settings-cat-data'), (button) => (button as HTMLButtonElement).click());
    await panel.waitForSelector(sel('maps-toggle'));
    expect(await panel.$eval(sel('maps-toggle'), (el) => el.textContent)).toContain(tl('en', 'settings.mappings.count_one', { count: 1 }));
    await panel.$eval(sel('maps-toggle'), (button) => (button as HTMLButtonElement).click());
    const listed = await panel.waitForSelector('#sk-maps li');
    expect(await listed?.evaluate((li) => li.textContent)).toContain(`→ ${FRIEREN_S2.anilist.title}`);
    expectCleanRun(run.h, run.anilist, run.mal);
  });
});

describe('Agenda', () => {
  it('AniList en erreur (500) sur le calendrier : message et « Retry » restent affichés ; AniList rétabli puis « Retry » : la semaine s’affiche', async (context) => {
    const run = await launch(context, [ONE_PIECE]);
    run.anilist.airing = [{ id: 9101, mediaId: ONE_PIECE.anilist.id, episode: 1181, airingAt: Math.floor(Date.now() / 1000) + 120 }];
    run.anilist.failure = { status: 500, operations: ['AiringSchedules'] };
    const panel = await openPanel(run.h);
    await panel.waitForSelector('#sk-tab-agenda[aria-selected="true"]');

    const retry = sel('agenda-retry');
    await panel.waitForSelector(retry, { timeout: 10_000 });
    const errorPrefix = en('agenda.error', { error: '' }).trim();
    const agendaText = (): Promise<string> => panel.evaluate(() => (document.getElementById('sk-tabpanel-agenda'))?.innerText ?? '');
    expect(await agendaText()).toContain(errorPrefix);
    // Ni rechargement automatique qui l'efface, ni squelette : l'erreur et le bouton restent
    await stays('erreur et « Retry » affichés', async () => (await panel.$(retry)) !== null && (await agendaText()).includes(errorPrefix), 2_500);
    expect(run.anilist.requests.filter((r) => r.operation === 'AiringSchedules').map((r) => r.status)).toEqual([500]);

    run.anilist.failure = null;
    await panel.$eval(retry, (button) => (button as HTMLButtonElement).click());
    const episode = en('agenda.episode', { episode: 1181 });
    await waitFor('semaine affichée', async () => {
      const text = await agendaText();
      return text.includes(ONE_PIECE.anilist.title) && text.includes(episode) && !text.includes(errorPrefix);
    });
    expect(await panel.$(retry)).toBeNull();
    expectCleanRun(run.h, run.anilist, run.mal);
  });
});

describe('Clavier', () => {
  it('popup « Watching » : Tab jusqu’à « +1 », Entrée : le focus reste sur le bouton pendant et après l’envoi', async (context) => {
    const run = await launch(context, [FRIEREN_S1]);
    const popup = await run.h.openPage('src/popup/popup.html', { width: 400, height: 580 });
    const plus = `plus-${FRIEREN_S1.anilist.id}:${FRIEREN_S1.mal.id}`;
    await popup.waitForSelector(sel(plus));
    const focused = (): Promise<string | null> => popup.evaluate(() => document.activeElement?.getAttribute('data-focus') ?? null);

    // Tabulations depuis le haut de la page, comme l'utilisateur
    let reached = false;
    for (let i = 0; i < 40 && !reached; i++) {
      await popup.keyboard.press('Tab');
      reached = (await focused()) === plus;
    }
    expect(reached).toBe(true);

    run.anilist.latencyMs = 800;
    run.mal.latencyMs = 800;
    await popup.keyboard.press('Enter');
    // Pendant l'envoi : bouton occupé (aria-disabled), focus toujours dessus
    await popup.waitForSelector(`${sel(plus)}[aria-disabled="true"]`);
    expect(await focused()).toBe(plus);
    await waitFor('+1 écrit', () => run.anilist.mutations().length === 1 && run.mal.writes().length === 1);
    await popup.waitForSelector(`${sel(plus)}:not([aria-disabled="true"])`);
    expect(await focused()).toBe(plus);
    await stays('focus sur « +1 »', async () => (await focused()) === plus, 1_000);
    expect(run.anilist.entry(ANILIST_A.token, FRIEREN_S1.anilist.id)).toMatchObject({ progress: 3 });
    expect(run.mal.entry(MAL_A.token, FRIEREN_S1.mal.id)).toMatchObject({ num_episodes_watched: 3 });
    expectCleanRun(run.h, run.anilist, run.mal);
  });
});
