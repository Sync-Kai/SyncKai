import { describe, expect, it } from 'vitest';
import {
  chunk,
  computeWindow,
  coveredEnd,
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

describe('computeWindow', () => {
  const HOUR = 3600;

  it('premier passage : 2 h en arrière', () => {
    expect(computeWindow(NOW, null, 0)).toEqual({ from: NOW - 7200, to: NOW });
  });

  it('reprend à la fin de la fenêtre couverte (seconde de reprise incluse), décalée du délai', () => {
    // Vérification précédente une heure plus tôt avec 3 h de délai : couverte jusqu'à NOW - 4 h
    expect(computeWindow(NOW, NOW - 4 * HOUR, 3)).toEqual({ from: NOW - 4 * HOUR - 1, to: NOW - 3 * HOUR });
  });

  it('délai passé de 6 h à 0 h : la fenêtre reprend à la dernière borne couverte (ALRT-02)', () => {
    // Dernière vérification à NOW - 1 h avec 6 h de délai : sorties traitées jusqu'à NOW - 7 h
    const covered = NOW - HOUR - 6 * HOUR;
    const range = computeWindow(NOW, covered, 0);
    expect(range).toEqual({ from: covered - 1, to: NOW });
    // Diffusions de l'intervalle autrefois sauté (entre NOW - 7 h et NOW - 1 h) : dans la fenêtre
    const skipped = [{ airingAt: covered }, { airingAt: NOW - 4 * HOUR }, { airingAt: NOW - HOUR - 1 }];
    expect(itemsInWindow(skipped, range)).toHaveLength(3);
  });

  it('délai augmenté : fenêtre vide jusqu’à rattraper la borne couverte (doublons écartés par airingNotified)', () => {
    expect(computeWindow(NOW, NOW - HOUR, 6)).toEqual({ from: NOW - 6 * HOUR, to: NOW - 6 * HOUR });
  });

  it('rattrapage borné à 24 h', () => {
    expect(computeWindow(NOW, NOW - 10 * 86400, 0)).toEqual({ from: NOW - 86400, to: NOW });
  });

  it('borne couverte dans le futur ramenée à la fin de la fenêtre', () => {
    expect(computeWindow(NOW, NOW + 500, 1)).toEqual({ from: NOW - 3600, to: NOW - 3600 });
  });

  it('ancien format (heure de la dernière vérification) : décalé du délai actuel', () => {
    expect(legacyCoveredUntil(NOW - HOUR, 3)).toBe(NOW - 4 * HOUR);
    expect(computeWindow(NOW, legacyCoveredUntil(NOW - HOUR, 0), 0)).toEqual({ from: NOW - HOUR - 1, to: NOW });
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
    expect(plan[0]).toMatchObject({ id: 'synckai-airing:group:4', title: '4 nouveaux épisodes : A, B, C', mediaIds: [1, 2, 3], scheduleIds: [1, 2, 3, 4] });
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
    const alerts = computeWindow(NOW, NOW - 3599, 0);
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
