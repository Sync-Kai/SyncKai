import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatStarValue } from '../ui/rating';
import { describeOutcome } from '../shared/sync-feedback';
import { formatRelativeTime, nextEpisodeBadge } from '../shared/watching';
import type { SyncOutcome } from '../shared/sync.types';
import type { WatchingEntry } from '../shared/watching.types';
import { CATALOG_FILES, catalogOf } from '../test/catalogs';
import { checkCatalog } from './catalog-check';
import { appendSuffix, formatList, getLocale, joinQuantities, joinSentences, LOCALES, lowerFirst, setLocale, t, tp, tpl, upperFirst } from './index';
import en from './locales/en.json';

describe('catalogues de traduction', () => {
  it('un fichier par langue de LOCALES, rien de plus', () => {
    expect([...CATALOG_FILES.keys()].sort()).toEqual([...LOCALES].sort());
  });

  // Mêmes règles que `npm run i18n:check` (scripts/i18n-check.ts) : clés, variantes de pluriel de la langue,
  // placeholders, aucun texte vide (les avertissements de longueur restent informatifs)
  it.each(LOCALES)('%s : clés, variantes de pluriel, placeholders, aucun texte vide', (locale) => {
    expect(checkCatalog(locale, catalogOf(locale), en).filter((issue) => issue.level === 'error')).toEqual([]);
  });

  it('chaque clé plurielle de l’anglais a ses variantes _one et _other', () => {
    for (const key of Object.keys(en)) {
      const base = key.replace(/_(one|other)$/, '');
      if (base === key) continue;
      expect(en).toHaveProperty(`${base}_one`);
      expect(en).toHaveProperty(`${base}_other`);
    }
  });
});

describe('t / tp / tpl', () => {
  const initial = getLocale();
  afterEach(() => setLocale(initial));

  it('remplace les placeholders et laisse les inconnus intacts', () => {
    setLocale('en');
    expect(t('common.connectService', { service: 'AniList' })).toBe('Connect AniList');
    expect(t('watching.tip')).toContain('{path}');
  });

  it('pluriels selon la langue (0 est singulier en français)', () => {
    setLocale('fr');
    expect(tp('footer.toRate', 0)).toBe('0 série à noter');
    expect(tp('footer.toRate', 2)).toBe('2 séries à noter');
    setLocale('en');
    expect(tp('footer.toReview', 1)).toBe('1 item to check');
    expect(tp('footer.toReview', 0)).toBe('0 items to check');
    setLocale('de');
    expect(tp('queue.until.days', 1)).toBe('in 1 Tag');
    expect(tp('queue.until.days', 3)).toBe('in 3 Tagen');
  });

  it('tpl : langue explicite, indépendante de la langue active', () => {
    setLocale('en');
    expect(tpl('fr', 'time.daysAgo', 1)).toBe('il y a 1 jour');
    expect(tpl('de', 'time.daysAgo', 5)).toBe('vor 5 Tagen');
    expect(tpl('en', 'airing.notification.group', 4, { titles: 'A, B' })).toBe('4 new episodes: A, B');
    expect(getLocale()).toBe('en');
  });

  it('variante absente de la langue : `_other`, puis l’anglais selon ses propres règles', async () => {
    vi.resetModules();
    const engine = await import('./core');
    engine.registerCatalogs({ en, ru: { 'footer.toRate_one': '{count} сериал', 'footer.toRate_other': '{count} сериала' } });
    engine.setLocale('ru');
    expect(engine.tp('footer.toRate', 1)).toBe('1 сериал');
    // 5 → `many`, absente : `_other`
    expect(engine.tp('footer.toRate', 5)).toBe('5 сериала');
    // Clé absente de la langue : anglais, pluriel anglais (2 → other)
    expect(engine.tp('footer.toReview', 2)).toBe('2 items to check');
    expect(engine.tp('footer.toReview', 1)).toBe('1 item to check');
  });

  it('textes en anglais et en allemand', () => {
    const outcome: SyncOutcome = {
      status: 'synced',
      mediaTitle: 'Frieren',
      results: [{ service: 'anilist', outcome: { status: 'updated', progress: 2, completed: false } }],
    };
    setLocale('en');
    expect(describeOutcome(outcome).message).toBe('AniList: episode 2 saved');
    expect(formatStarValue(8.5)).toBe('8.5');
    setLocale('de');
    expect(describeOutcome(outcome).message).toBe('AniList: Folge 2 gespeichert');
    expect(formatStarValue(8.5)).toBe('8,5');
    expect(lowerFirst('Kein entsprechender Eintrag')).toBe('Kein entsprechender Eintrag');
  });

  it('upperFirst : majuscule selon la langue (turc : i avec point → İ), langue active par défaut', () => {
    expect(upperFirst('ışık', 'tr')).toBe('Işık');
    expect(upperFirst('iptal', 'tr')).toBe('İptal');
    expect(upperFirst('lundi 12 oct.', 'fr')).toBe('Lundi 12 oct.');
    expect(upperFirst('')).toBe('');
    const previous = getLocale();
    setLocale('tr');
    expect(upperFirst('imza')).toBe('İmza');
    setLocale(previous);
  });

  it('lowerFirst : minuscule selon la langue (turc : I sans point, İ avec point), allemand inchangé', () => {
    expect(lowerFirst('İptal edildi', 'tr')).toBe('iptal edildi');
    expect(lowerFirst('Işık', 'tr')).toBe('ışık');
    expect(lowerFirst('Item', 'en')).toBe('item');
    expect(lowerFirst('Échec', 'fr')).toBe('échec');
    expect(lowerFirst('Folge', 'de')).toBe('Folge');
    expect(lowerFirst('エラー', 'ja')).toBe('エラー');
  });

  it('phrases à la suite : espace et point selon la langue (japonais, chinois : ni espace, ni point latin)', () => {
    expect(joinSentences(['SyncKai can’t access Crunchyroll / ADN', 'Access denied.'], 'en')).toBe('SyncKai can’t access Crunchyroll / ADN. Access denied.');
    expect(joinSentences(['Fini.', '', 'Encore ?'], 'fr')).toBe('Fini. Encore ?');
    expect(joinSentences(['≈ Crunchyroll 18:30', 'Estimated release.'], 'en')).toBe('≈ Crunchyroll 18:30. Estimated release.');
    expect(joinSentences(['SyncKaiがCrunchyroll / ADNにアクセスできません', 'アクセスが拒否されました。'], 'ja')).toBe('SyncKaiがCrunchyroll / ADNにアクセスできません。アクセスが拒否されました。');
    expect(joinSentences(['无法获取 AniList 详情。', 'AniList 无法访问。'], 'zh-CN')).toBe('无法获取 AniList 详情。AniList 无法访问。');
    expect(joinSentences(['AniList 상세 정보를 불러올 수 없어요.', '연결을 확인하세요.'], 'ko')).toBe('AniList 상세 정보를 불러올 수 없어요. 연결을 확인하세요.');
  });

  it('complément qui commence par un point : jamais « .. » ni « 。。 »', () => {
    expect(appendSuffix('MyAnimeList: failed: unreachable.', '. Retrying automatically soon.')).toBe('MyAnimeList: failed: unreachable. Retrying automatically soon.');
    expect(appendSuffix('AniList: episode 5 saved', '. Retrying automatically soon.')).toBe('AniList: episode 5 saved. Retrying automatically soon.');
    expect(appendSuffix('MyAnimeList：失敗：無法連線。', '。稍後會自動重試。')).toBe('MyAnimeList：失敗：無法連線。稍後會自動重試。');
    expect(appendSuffix('AniList：第 5 集已儲存', '。稍後會自動重試。')).toBe('AniList：第 5 集已儲存。稍後會自動重試。');
    expect(appendSuffix('AniList：已保存第 5 集', ' · 稍后会自动重试')).toBe('AniList：已保存第 5 集 · 稍后会自动重试');
  });

  it('résultat mis en file : complément sans point doublé', () => {
    const outcome: SyncOutcome = {
      status: 'synced',
      mediaTitle: 'Frieren',
      queued: true,
      results: [{ service: 'mal', outcome: { status: 'error', message: 'MyAnimeList is unreachable.' } }],
    };
    setLocale('en');
    expect(describeOutcome(outcome).message).toBe('MyAnimeList: failed: MyAnimeList is unreachable. Retrying automatically soon.');
    setLocale('zh-TW');
    expect(describeOutcome({ ...outcome, results: [{ service: 'mal', outcome: { status: 'error', message: '無法連線。' } }] }).message).toBe(
      'MyAnimeList：失敗：無法連線。稍後會自動重試。',
    );
  });

  it('quantités à la suite : une espace, aucune en japonais', () => {
    expect(joinQuantities(['1 h', '30 min'], 'fr')).toBe('1 h 30 min');
    expect(joinQuantities(['1시간', '30분'], 'ko')).toBe('1시간 30분');
    expect(joinQuantities(['1 小时', '30 分钟'], 'zh-CN')).toBe('1 小时 30 分钟');
    expect(joinQuantities(['1時間', '30分'], 'ja')).toBe('1時間30分');
  });

  it('listes de noms : conjonction et séparateurs de la langue', () => {
    expect(formatList(['AniList', 'MyAnimeList'], 'conjunction', 'en')).toBe('AniList and MyAnimeList');
    expect(formatList(['AniList', 'MyAnimeList'], 'conjunction', 'fr')).toBe('AniList et MyAnimeList');
    expect(formatList(['MyAnimeList'], 'conjunction', 'de')).toBe('MyAnimeList');
    expect(formatList(['Frieren', 'Dandadan', 'One Piece'], 'conjunction', 'es')).toBe('Frieren, Dandadan y One Piece');
    expect(formatList(['フリーレン', 'ダンダダン', 'ONE PIECE'], 'conjunction', 'ja')).toBe('フリーレン、ダンダダン、ONE PIECE');
    // Chinois : espace entre « 和 / 或 » et un nom latin, jamais entre caractères chinois ni après « 、 »
    expect(formatList(['AniList', 'MyAnimeList'], 'conjunction', 'zh-CN')).toBe('AniList 和 MyAnimeList');
    expect(formatList(['葬送的芙莉莲', '药屋少女的呢喃'], 'conjunction', 'zh-CN')).toBe('葬送的芙莉莲和药屋少女的呢喃');
    expect(formatList(['葬送的芙莉蓮', 'Dandadan', 'ONE PIECE'], 'disjunction', 'zh-TW')).toBe('葬送的芙莉蓮、Dandadan 或 ONE PIECE');
  });

  it('pastille d’état en anglais et en allemand', () => {
    const now = Date.UTC(2026, 9, 1, 12);
    const entry: WatchingEntry = {
      mediaId: 1, malId: null, title: 'A', coverUrl: null, progress: 4, totalEpisodes: null, updatedAt: null,
      nextEpisode: { episode: 5, airingAt: now + 2 * 86_400_000 }, airingStatus: 'RELEASING', platforms: [], lastSync: null, siteUrl: 'https://anilist.co/anime/1',
    };
    setLocale('en');
    expect(nextEpisodeBadge(entry, now).label).toBe('Ep. 5 in 2 d');
    setLocale('de');
    expect(nextEpisodeBadge(entry, now).label).toBe('Folge 5 in 2 T.');
  });
});

describe('chargement à la demande (moteur neuf : anglais seul enregistré)', () => {
  /** Moteur i18n neuf et son chargeur simulé (src/test/setup.ts enregistre toutes les langues pour les autres tests) */
  async function freshEngine(loader: (locale: string) => Promise<unknown>): Promise<typeof import('./core')> {
    vi.resetModules();
    const engine = await import('./core');
    engine.registerCatalogs({ en });
    engine.setCatalogLoader(loader);
    return engine;
  }

  it('langue chargée une seule fois, appels simultanés regroupés ; textes anglais avant le chargement', async () => {
    const loader = vi.fn((locale: string) => Promise.resolve(CATALOG_FILES.get(locale)));
    const engine = await freshEngine(loader);
    expect(engine.getLocale()).toBe('en');
    expect(engine.hasCatalog('de')).toBe(false);
    expect(engine.tl('de', 'common.close')).toBe(en['common.close']);
    const [a, b] = await Promise.all([engine.loadLocale('de'), engine.loadLocale('de')]);
    expect([a, b]).toEqual([true, true]);
    await expect(engine.loadLocale('de')).resolves.toBe(true);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(engine.tl('de', 'common.close')).toBe(catalogOf('de')['common.close']);
  });

  it('applyLanguageSetting : charge puis change de langue ; la dernière demande l’emporte', async () => {
    const pending = new Map<string, (catalog: unknown) => void>();
    const engine = await freshEngine((locale) => new Promise((resolve) => pending.set(locale, resolve)));
    const changes: string[] = [];
    engine.onLocaleChange((locale) => changes.push(locale));

    const toGerman = engine.applyLanguageSetting('de');
    const toFrench = engine.applyLanguageSetting('fr');
    await vi.waitFor(() => expect([...pending.keys()].sort()).toEqual(['de', 'fr']));
    // Rien ne change tant que le catalogue n'est pas là
    expect(engine.getLocale()).toBe('en');
    pending.get('fr')?.(catalogOf('fr'));
    await expect(toFrench).resolves.toBe('fr');
    // Catalogue allemand arrivé après la demande du français : ignoré
    pending.get('de')?.(catalogOf('de'));
    await toGerman;
    expect(engine.getLocale()).toBe('fr');
    expect(changes).toEqual(['fr']);
    expect(engine.t('common.close')).toBe(catalogOf('fr')['common.close']);
  });

  it('catalogue indisponible ou invalide : anglais, consigné, nouvel essai ensuite', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    let attempt = 0;
    const engine = await freshEngine((locale) => {
      attempt++;
      if (attempt === 1) return Promise.reject(new Error('fichier absent'));
      if (attempt === 2) return Promise.resolve({ 'common.close': 42 });
      return Promise.resolve(CATALOG_FILES.get(locale));
    });
    engine.setLocale('en');
    await expect(engine.applyLanguageSetting('ja')).resolves.toBe('en');
    await expect(engine.applyLanguageSetting('ja')).resolves.toBe('en');
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
    await expect(engine.applyLanguageSetting('ja')).resolves.toBe('ja');
    expect(engine.hasCatalog('ja')).toBe(true);
  });

  it('sans chargeur : seules les langues enregistrées', async () => {
    vi.resetModules();
    const engine = await import('./core');
    engine.registerCatalogs({ en });
    await expect(engine.loadLocale('fr')).resolves.toBe(false);
    await expect(engine.applyLanguageSetting('fr')).resolves.toBe('en');
  });
});

describe('formatRelativeTime par langue', () => {
  const NOW = Date.UTC(2026, 9, 1, 12);
  const MIN = 60_000;
  const DAY = 24 * 60 * MIN;

  it.each([
    ['en', 0, 'just now'],
    ['en', 20 * MIN, '20 min ago'],
    ['en', 2 * 60 * MIN, '2 h ago'],
    ['en', DAY, 'yesterday'],
    ['en', 3 * DAY, '3 days ago'],
    ['de', 0, 'gerade eben'],
    ['de', 20 * MIN, 'vor 20 Min.'],
    ['de', 2 * 60 * MIN, 'vor 2 Std.'],
    ['de', DAY, 'gestern'],
    ['de', 3 * DAY, 'vor 3 Tagen'],
    ['fr', 20 * MIN, 'il y a 20 min'],
    ['fr', 3 * DAY, 'il y a 3 jours'],
  ] as const)('%s, %i ms → %s', (locale, elapsed, expected) => {
    expect(formatRelativeTime(NOW - elapsed, NOW, locale)).toBe(expected);
  });

  it('jours : variante plurielle de la langue (russe : 21 → one, 22 → few, 25 → many)', async () => {
    vi.resetModules();
    const engine = await import('./core');
    const { formatRelativeTime: format } = await import('../shared/watching');
    engine.registerCatalogs({
      en,
      ru: { 'time.daysAgo_one': '{count} день назад', 'time.daysAgo_few': '{count} дня назад', 'time.daysAgo_many': '{count} дней назад', 'time.daysAgo_other': '{count} дня назад' },
    });
    expect(format(NOW - 21 * DAY, NOW, 'ru')).toBe('21 день назад');
    expect(format(NOW - 22 * DAY, NOW, 'ru')).toBe('22 дня назад');
    expect(format(NOW - 25 * DAY, NOW, 'ru')).toBe('25 дней назад');
  });
});
