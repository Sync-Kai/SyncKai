import { describe, expect, it } from 'vitest';
import {
  alertAt,
  alertShifts,
  alertWindow,
  chunk,
  coveredEnd,
  dueAlerts,
  filterNewEpisodes,
  isAiringPageData,
  itemsInWindow,
  legacyCoveredUntil,
  mergeWeekWindow,
  planNotifications,
  toAiringItems,
  trimNotified,
  withSyncedProgress,
  type AiringItem,
} from './airing-policy';
import { setLocale } from '../i18n';

// Textes attendus en français
setLocale('fr');

const NOW = 1_800_000_000;
const item = (scheduleId: number, mediaId: number, episode: number, title = `Série ${mediaId}`): AiringItem => ({
  scheduleId,
  mediaId,
  episode,
  airingAt: NOW - 600,
  title,
  coverUrl: null,
});

describe('alertWindow (diffusions lues)', () => {
  const HOUR = 3600;
  /** Même écart pour toutes les séries : délai des alertes seul, comme avant les délais de l'agenda */
  const uniform = (hours: number): { min: number; max: number } => ({ min: hours * HOUR, max: hours * HOUR });

  it('premier passage : 2 h en arrière', () => {
    expect(alertWindow(NOW, null, uniform(0))).toEqual({ fetch: { from: NOW - 7200, to: NOW }, notBefore: NOW - 7200 });
  });

  it('reprend à la fin de la fenêtre couverte (seconde de reprise incluse), décalée du délai', () => {
    // Vérification précédente une heure plus tôt avec 3 h de délai : couverte jusqu'à NOW - 4 h
    expect(alertWindow(NOW, NOW - 4 * HOUR, uniform(3)).fetch).toEqual({ from: NOW - 4 * HOUR - 1, to: NOW - 3 * HOUR });
  });

  it('délai passé de 6 h à 0 h : la fenêtre reprend à la dernière borne couverte (ALRT-02)', () => {
    // Dernière vérification à NOW - 1 h avec 6 h de délai : sorties traitées jusqu'à NOW - 7 h
    const covered = NOW - HOUR - 6 * HOUR;
    const range = alertWindow(NOW, covered, uniform(0)).fetch;
    expect(range).toEqual({ from: covered - 1, to: NOW });
    // Diffusions de l'intervalle autrefois sauté (entre NOW - 7 h et NOW - 1 h) : dans la fenêtre
    const skipped = [{ airingAt: covered }, { airingAt: NOW - 4 * HOUR }, { airingAt: NOW - HOUR - 1 }];
    expect(itemsInWindow(skipped, range)).toHaveLength(3);
  });

  it('délai augmenté : fenêtre vide jusqu’à rattraper la borne couverte (doublons écartés par airingNotified)', () => {
    expect(alertWindow(NOW, NOW - HOUR, uniform(6)).fetch).toEqual({ from: NOW - 6 * HOUR, to: NOW - 6 * HOUR });
  });

  it('rattrapage borné à 24 h d’alertes', () => {
    expect(alertWindow(NOW, NOW - 10 * 86400, uniform(0))).toEqual({ fetch: { from: NOW - 86400, to: NOW }, notBefore: NOW - 86400 });
  });

  it('borne couverte dans le futur ramenée à la fin de la fenêtre', () => {
    expect(alertWindow(NOW, NOW + 500, uniform(1)).fetch).toEqual({ from: NOW - 3600, to: NOW - 3600 });
  });

  it('ancien format (heure de la dernière vérification) : décalé du délai actuel', () => {
    expect(legacyCoveredUntil(NOW - HOUR, 3)).toBe(NOW - 4 * HOUR);
    expect(alertWindow(NOW, legacyCoveredUntil(NOW - HOUR, 0), uniform(0)).fetch).toEqual({ from: NOW - HOUR - 1, to: NOW });
  });

  it('écarts différents selon les séries : diffusions lues assez loin pour le plus grand, jusqu’au plus petit (sortie avancée)', () => {
    // Une série à +3 jours, une à −1 h (la plateforme publie avant la diffusion japonaise)
    const { fetch, notBefore } = alertWindow(NOW, NOW - HOUR, { min: -HOUR, max: 3 * 24 * HOUR });
    expect(notBefore).toBe(NOW - 24 * HOUR);
    expect(fetch).toEqual({ from: NOW - HOUR - 1, to: NOW + HOUR });
    expect(alertWindow(NOW, null, { min: 0, max: 3 * 24 * HOUR }).fetch).toEqual({ from: NOW - 2 * HOUR - 3 * 24 * HOUR, to: NOW });
  });
});

describe('heure de l’alerte (décision 17, 6-D13 : celle de l’agenda)', () => {
  const settings = { airingDelayHours: 0 as const, platformOffsets: { crunchyroll: 30, adn: 120, netflix: 60, disney: 60, prime: 60 }, seriesOffsets: { '7': { minutes: -15, at: 1 } } };

  it('délai de la série, sinon de la plateforme du lien « Ouvrir », sinon diffusion japonaise ; puis délai des alertes', () => {
    expect(alertAt(NOW, 7, 'adn', settings)).toBe(NOW - 15 * 60);
    expect(alertAt(NOW, 8, 'adn', settings)).toBe(NOW + 120 * 60);
    expect(alertAt(NOW, 8, null, settings)).toBe(NOW);
    expect(alertAt(NOW, 8, null, { ...settings, airingDelayHours: 3 as const })).toBe(NOW + 3 * 3600);
    expect(alertAt(NOW, 8, 'crunchyroll', { ...settings, airingDelayHours: 1 as const })).toBe(NOW + 90 * 60);
  });

  it('écarts extrêmes des séries suivies ; aucune série : délai des alertes seul', () => {
    expect(alertShifts(new Map([[7, 'adn'], [8, 'adn'], [9, null]]), settings)).toEqual({ min: -15 * 60, max: 120 * 60 });
    expect(alertShifts(new Map(), { ...settings, airingDelayHours: 6 as const })).toEqual({ min: 6 * 3600, max: 6 * 3600 });
  });

  it('dueAlerts : alertes échues annoncées, trop anciennes écartées ; une alerte à venir retient la reprise à sa diffusion', () => {
    const items = [item(1, 1, 5), { ...item(2, 2, 3), airingAt: NOW - 5000 }, { ...item(3, 3, 9), airingAt: NOW - 90_000 }];
    // Série 2 : alerte dans 1 h ; série 3 : alerte il y a plus de 24 h
    const at = (i: AiringItem): number => (i.mediaId === 2 ? i.airingAt + 8600 : i.airingAt);
    const { due, coveredUntil } = dueAlerts(items, at, NOW, NOW - 86400, NOW);
    expect(due.map((i) => i.scheduleId)).toEqual([1]);
    expect(coveredUntil).toBe(NOW - 5000);
    expect(dueAlerts(items.slice(0, 1), at, NOW, NOW - 86400, NOW).coveredUntil).toBe(NOW);
  });
});

describe('coveredEnd (pagination tronquée, ALRT-06)', () => {
  const range = { from: NOW - 7200, to: NOW };

  it('lecture complète : toute la fenêtre est couverte', () => {
    expect(coveredEnd(range, null)).toBe(NOW);
    expect(coveredEnd(range, NOW + 3600)).toBe(NOW);
  });

  it('lecture coupée dans la fenêtre : couverte jusqu’à la dernière sortie lue (exclue), qui sera relue', () => {
    expect(coveredEnd(range, NOW - 1800)).toBe(NOW - 1800);
    // Coupée avant même la fenêtre : la reprise avance quand même d'une seconde
    expect(coveredEnd(range, NOW - 9000)).toBe(NOW - 7199);
  });
});

describe('withSyncedProgress (ALRT-01)', () => {
  const progress = new Map([
    [1, 6],
    [2, 3],
  ]);

  it('relève la progression des séries suivies avec les synchros postérieures à la liste', () => {
    const syncs = [
      { mediaId: 1, progress: 7, syncedAt: 2000 },
      { mediaId: 2, progress: 9, syncedAt: 500 }, // antérieure à la lecture de la liste : déjà prise en compte
      { mediaId: 3, progress: 4, syncedAt: 2000 }, // série non suivie : pas ajoutée
      { mediaId: 1, progress: 5, syncedAt: 3000 }, // jamais de baisse
    ];
    expect(withSyncedProgress(progress, syncs, 1000)).toEqual(
      new Map([
        [1, 7],
        [2, 3],
      ]),
    );
    expect(progress.get(1)).toBe(6);
  });
});

describe('chunk', () => {
  it('découpe par lots', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 50)).toEqual([]);
  });
});

describe('filterNewEpisodes', () => {
  const progress = new Map([
    [1, 3],
    [2, 10],
  ]);

  it('ignore les épisodes déjà vus, déjà notifiés, hors liste ou en double', () => {
    const items = [item(100, 1, 4), item(101, 1, 3), item(102, 2, 11), item(103, 9, 1), item(100, 1, 4)];
    expect(filterNewEpisodes(items, progress, [102]).map((i) => i.scheduleId)).toEqual([100]);
  });
});

describe('trimNotified', () => {
  it('ajoute sans doublon et garde les plus récents', () => {
    expect(trimNotified([1, 2, 3], [3, 4], 3)).toEqual([2, 3, 4]);
    expect(trimNotified([], [5])).toEqual([5]);
  });
});

describe('planNotifications', () => {
  it('une notification par sortie jusqu’à 3', () => {
    const plan = planNotifications([item(100, 1, 4, 'Frieren'), item(101, 2, 11)]);
    expect(plan).toHaveLength(2);
    expect(plan[0]).toMatchObject({ id: 'synckai-airing:100', title: 'Ép. 4 de Frieren est sorti', mediaIds: [1], scheduleIds: [100] });
  });

  it('regroupe au-delà de 3', () => {
    const plan = planNotifications([item(1, 1, 2, 'A'), item(2, 2, 2, 'B'), item(3, 3, 2, 'C'), item(4, 3, 3, 'C')]);
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ id: 'synckai-airing:group:4', title: '4 nouveaux épisodes : A, B et C', mediaIds: [1, 2, 3], scheduleIds: [1, 2, 3, 4] });
  });

  it('titres regroupés : liste de la langue (« 、 » en japonais)', () => {
    setLocale('ja');
    const plan = planNotifications([item(1, 1, 2, 'フリーレン'), item(2, 2, 2, 'ダンダダン'), item(3, 3, 2, 'ONE PIECE'), item(4, 4, 3, '薬屋のひとりごと')]);
    expect(plan[0]?.title).toBe('新エピソード4件：フリーレン、ダンダダン、ONE PIECE、薬屋のひとりごと');
    setLocale('fr');
  });

  it('rien à notifier', () => {
    expect(planNotifications([])).toEqual([]);
  });
});

describe('fenêtre élargie à la semaine (agenda)', () => {
  const week = { from: NOW - 3 * 86400, to: NOW + 4 * 86400 };

  it('couvre la fenêtre des alertes et toute la semaine', () => {
    expect(mergeWeekWindow({ from: NOW - 7200, to: NOW }, week.from, week.to)).toEqual({ from: week.from - 1, to: week.to });
    // Rattrapage de 24 h en début de semaine : la fenêtre des alertes déborde sur la semaine précédente
    expect(mergeWeekWindow({ from: NOW - 86400, to: NOW }, NOW - 3600, NOW + 6 * 86400)).toEqual({ from: NOW - 86400, to: NOW + 6 * 86400 });
  });

  it('les notifications ne portent que sur la fenêtre des alertes (bornes exclues)', () => {
    const alerts = alertWindow(NOW, NOW - 3599, { min: 0, max: 0 }).fetch;
    const items = [
      { ...item(1, 1, 4), airingAt: NOW - 1800 },
      { ...item(2, 1, 5), airingAt: NOW + 86400 }, // à venir : agenda seulement
      { ...item(3, 2, 2), airingAt: NOW - 2 * 86400 }, // plus tôt dans la semaine
      { ...item(4, 2, 3), airingAt: alerts.from },
      { ...item(5, 2, 4), airingAt: alerts.to },
    ];
    expect(itemsInWindow(items, alerts).map((i) => i.scheduleId)).toEqual([1]);
    expect(itemsInWindow(items, { from: week.from - 1, to: week.to }).map((i) => i.scheduleId)).toEqual([1, 2, 3, 4, 5]);
    expect(filterNewEpisodes(itemsInWindow(items, alerts), new Map([[1, 3]]), [])).toHaveLength(1);
  });
});

describe('réponse airingSchedules', () => {
  const node = { id: 7, episode: 3, airingAt: NOW, media: { id: 1, title: { userPreferred: 'Frieren' }, coverImage: { medium: 'https://s4.anilist.co/file/1.jpg' } } };

  it('valide une page et ses nœuds', () => {
    expect(isAiringPageData({ Page: { pageInfo: { hasNextPage: true }, airingSchedules: [node] } })).toBe(true);
    expect(isAiringPageData({ Page: { airingSchedules: [] } })).toBe(true);
    expect(isAiringPageData({ Page: { pageInfo: { hasNextPage: 'oui' }, airingSchedules: [] } })).toBe(false);
    expect(isAiringPageData({ Page: { airingSchedules: [{ ...node, episode: '3' }] } })).toBe(false);
    expect(isAiringPageData({ Page: { airingSchedules: [{ ...node, media: { id: 1, title: null } }] } })).toBe(false);
    expect(isAiringPageData(null)).toBe(false);
  });

  it('convertit en sorties (titre et jaquette de repli)', () => {
    const offList = { ...node, id: 9, media: { ...node.media, coverImage: { medium: 'https://img.example/1.jpg' } } };
    const data = { Page: { pageInfo: null, airingSchedules: [node, { ...node, id: 8, media: { id: 2, title: { userPreferred: null }, coverImage: null } }, offList] } };
    expect(toAiringItems(data)).toEqual([
      { scheduleId: 7, mediaId: 1, episode: 3, airingAt: NOW, title: 'Frieren', coverUrl: 'https://s4.anilist.co/file/1.jpg' },
      { scheduleId: 8, mediaId: 2, episode: 3, airingAt: NOW, title: 'Anime #2', coverUrl: null },
      // Hôte hors de la liste des images (SEC-02) : jaquette de repli
      { scheduleId: 9, mediaId: 1, episode: 3, airingAt: NOW, title: 'Frieren', coverUrl: null },
    ]);
  });
});
