import { describe, expect, it } from 'vitest';
import {
  chunk,
  computeWindow,
  filterNewEpisodes,
  isAiringPageData,
  itemsInWindow,
  mergeWeekWindow,
  planNotifications,
  toAiringItems,
  trimNotified,
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
  it('premier passage : 2 h en arrière', () => {
    expect(computeWindow(NOW, null, 0)).toEqual({ from: NOW - 7200, to: NOW });
  });

  it('reprend depuis la dernière vérification, décalée du délai', () => {
    expect(computeWindow(NOW, NOW - 3600, 3)).toEqual({ from: NOW - 3600 - 3 * 3600, to: NOW - 3 * 3600 });
  });

  it('rattrapage borné à 24 h', () => {
    expect(computeWindow(NOW, NOW - 10 * 86400, 0)).toEqual({ from: NOW - 86400, to: NOW });
  });

  it('dernière vérification dans le futur ramenée à maintenant', () => {
    expect(computeWindow(NOW, NOW + 500, 1)).toEqual({ from: NOW - 3600, to: NOW - 3600 });
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
    expect(plan[0]).toMatchObject({ id: 'synckai-airing:100', title: 'Ép. 4 de Frieren est sorti', mediaIds: [1] });
  });

  it('regroupe au-delà de 3', () => {
    const plan = planNotifications([item(1, 1, 2, 'A'), item(2, 2, 2, 'B'), item(3, 3, 2, 'C'), item(4, 3, 3, 'C')]);
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ id: 'synckai-airing:group:4', title: '4 nouveaux épisodes : A, B, C', mediaIds: [1, 2, 3] });
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
    const alerts = computeWindow(NOW, NOW - 3600, 0);
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
  const node = { id: 7, episode: 3, airingAt: NOW, media: { id: 1, title: { userPreferred: 'Frieren' }, coverImage: { medium: 'https://img/1.jpg' } } };

  it('valide une page et ses nœuds', () => {
    expect(isAiringPageData({ Page: { pageInfo: { hasNextPage: true }, airingSchedules: [node] } })).toBe(true);
    expect(isAiringPageData({ Page: { airingSchedules: [] } })).toBe(true);
    expect(isAiringPageData({ Page: { pageInfo: { hasNextPage: 'oui' }, airingSchedules: [] } })).toBe(false);
    expect(isAiringPageData({ Page: { airingSchedules: [{ ...node, episode: '3' }] } })).toBe(false);
    expect(isAiringPageData({ Page: { airingSchedules: [{ ...node, media: { id: 1, title: null } }] } })).toBe(false);
    expect(isAiringPageData(null)).toBe(false);
  });

  it('convertit en sorties (titre et jaquette de repli)', () => {
    const data = { Page: { pageInfo: null, airingSchedules: [node, { ...node, id: 8, media: { id: 2, title: { userPreferred: null }, coverImage: null } }] } };
    expect(toAiringItems(data)).toEqual([
      { scheduleId: 7, mediaId: 1, episode: 3, airingAt: NOW, title: 'Frieren', coverUrl: 'https://img/1.jpg' },
      { scheduleId: 8, mediaId: 2, episode: 3, airingAt: NOW, title: 'Anime #2', coverUrl: null },
    ]);
  });
});
