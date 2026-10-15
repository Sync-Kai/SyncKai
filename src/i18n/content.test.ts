import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import manifest from '../../manifest.json';
import { catalogOf } from '../test/catalogs';
import { installFakeChrome } from '../test/fake-chrome';
import { reachableFrom, SOURCES } from '../test/import-graph';
import { CONTENT_KEYS } from './content-keys';
import { LOCALES, type Locale } from './locale-codes';
import en from './locales/en.json';

// Traductions des scripts de contenu (PERF-01) : sous-ensemble des catalogues (content-keys.ts), jamais les
// catalogues complets, et toutes les clés citées par le code de contenu présentes dans ce sous-ensemble. Seul l'anglais
// est embarqué ; une autre langue est demandée au service worker (GET_CONTENT_CATALOG).

/** Entrées des scripts de contenu : manifeste (Crunchyroll, ADN) et scripts Netflix enregistrés à la demande */
const CONTENT_ENTRIES = [
  ...manifest.content_scripts.flatMap((script) => script.js.map((path) => path.replace(/^src\//, ''))),
  ...[...SOURCES.keys()].filter((path) => path.startsWith('content/') && path.endsWith('.iife.ts')),
];

/** Entrées des pages de l'extension (scripts des pages HTML) et du service worker */
const PAGE_ENTRIES = [
  manifest.background.service_worker.replace(/^src\//, ''),
  ...Object.entries(import.meta.glob<string>('../**/*.html', { query: '?raw', import: 'default', eager: true })).flatMap(([path, html]) =>
    [...html.matchAll(/<script[^>]*\ssrc="\.\/([^"]+\.ts)"/g)].map((match) => `${path.slice(3).replace(/[^/]+$/, '')}${match[1] ?? ''}`),
  ),
];

const contentModules = reachableFrom(CONTENT_ENTRIES, { valuesOnly: true });
/** Code atteignable depuis les scripts de contenu, hors moteur i18n (qui ne cite aucune clé) */
const scanned = [...contentModules].filter((path) => !path.startsWith('i18n/'));

/** Clés des catalogues citées en littéral (`'…'`, `"…"`, `` `…` `` sans interpolation) dans un code source */
function citedKeys(code: string): string[] {
  return [...code.matchAll(/(['"`])((?:(?!\1)[^\\\n$])+)\1/g)].map((match) => match[2] ?? '').filter((text) => Object.hasOwn(en, text));
}

/**
 * Appels `t(…)`, `tp(…)` ou `tl(langue, …)` dont la clé n'est ni un littéral ni un ternaire de littéraux : une clé
 * construite (`` `content.${x}` ``) échapperait au relevé des clés.
 */
function dynamicKeyCalls(code: string): string[] {
  const literal = `'[^'\\n]+'`;
  const key = new RegExp(`^\\s*(?:${literal}|[^,()?'"\\n]+\\?\\s*${literal}\\s*:\\s*${literal})\\s*[,)]`);
  return [...code.matchAll(/(?<![\w.$])(?:tp?\(|tl\([^,()]+,)/g)]
    .filter((match) => !key.test(code.slice((match.index ?? 0) + match[0].length)))
    .map((match) => code.slice(match.index, (match.index ?? 0) + 60).split('\n')[0] ?? '');
}

describe('constantes de build dans les scripts de contenu', () => {
  it('aucune lecture de __SYNCKAI_*__ à l’import (sous `npm run dev`, la constante n’existe pas encore)', () => {
    // Ligne non indentée = code exécuté à l'évaluation du module (fonctions et objets sont indentés)
    const topLevel = [...contentModules].flatMap((path) =>
      (SOURCES.get(path) ?? '')
        .split('\n')
        .filter((line) => /^[^\s/*].*__SYNCKAI_[A-Z_]+__/.test(line) && !/^(?:export\s+)?(?:async\s+)?function\s/.test(line))
        .map((line) => `${path}: ${line.trim()}`),
    );
    expect(topLevel).toEqual([]);
  });
});

describe('traductions des scripts de contenu', () => {
  it('les entrées sont trouvées', () => {
    expect(CONTENT_ENTRIES).toEqual(
      expect.arrayContaining(['content/crunchyroll/content-crunchyroll.iife.ts', 'content/adn/content-adn.iife.ts', 'content/netflix/content-netflix.iife.ts', 'content/netflix/page-bridge.iife.ts']),
    );
    expect(PAGE_ENTRIES).toEqual(expect.arrayContaining(['background/background.ts', 'popup/popup.ts', 'sidepanel/sidepanel.ts', 'import/import.ts', 'import-cr/import-cr.ts']));
  });

  it('aucun module atteignable depuis un script de contenu n’importe les catalogues complets', () => {
    expect(contentModules.has('i18n/content.ts')).toBe(true);
    expect(contentModules.has('i18n/index.ts')).toBe(false);
    // Import de valeur d'un catalogue (`import type` seul toléré : effacé à la compilation)
    const jsonImports = [...contentModules].filter((path) => /(?:^|\n)\s*import\s+(?!type\s)[^;]*from\s+['"][^'"]*locales\/[^'"]+\.json['"]/.test(SOURCES.get(path) ?? ''));
    expect(jsonImports).toEqual([]);
  });

  it('chaque script de contenu qui traduit enregistre le sous-ensemble (i18n/content.ts)', () => {
    for (const entry of CONTENT_ENTRIES) {
      const modules = reachableFrom([entry], { valuesOnly: true });
      if (modules.has('i18n/core.ts')) expect({ entry, registers: modules.has('i18n/content.ts') }).toEqual({ entry, registers: true });
    }
  });

  it('chaque page de l’extension et le service worker chargent les catalogues complets (i18n/index.ts)', () => {
    for (const entry of PAGE_ENTRIES) {
      const modules = reachableFrom([entry], { valuesOnly: true });
      if (modules.has('i18n/core.ts')) expect({ entry, full: modules.has('i18n/index.ts') }).toEqual({ entry, full: true });
    }
  });

  it('les clés citées par le code de contenu sont exactement CONTENT_KEYS (liste triée)', () => {
    const cited = [...new Set(scanned.flatMap((path) => citedKeys(SOURCES.get(path) ?? '')))].sort();
    expect([...CONTENT_KEYS]).toEqual(cited);
  });

  it('aucune clé construite dynamiquement dans le code de contenu', () => {
    expect(scanned.flatMap((path) => dynamicKeyCalls(SOURCES.get(path) ?? '').map((call) => `${path} : ${call}`))).toEqual([]);
    // Le contrôle lui-même détecte bien une clé construite
    expect(dynamicKeyCalls("t(`content.${kind}.title`); t(cond ? 'a.b' : 'c.d'); tl(locale, 'e.f');")).toHaveLength(1);
  });

  it('chaque clé de contenu existe dans toutes les langues', () => {
    for (const locale of LOCALES) {
      const catalog = catalogOf(locale);
      expect({ locale, missing: CONTENT_KEYS.filter((key) => typeof catalog[key] !== 'string') }).toEqual({ locale, missing: [] });
    }
  });

  it('aucun pluriel (tp, tpl) dans le code de contenu : ses variantes varient selon la langue, hors du sous-ensemble', () => {
    const plurals = scanned.filter((path) => /(?<![\w.$])tpl?\(/.test(SOURCES.get(path) ?? ''));
    expect(plurals).toEqual([]);
  });
});

describe('t du module léger (i18n/content)', () => {
  /** Langues demandées au service worker (GET_CONTENT_CATALOG), dans l'ordre */
  const requested: string[] = [];
  /** Réponse du service worker simulé : textes des clés de contenu (comme background/content-catalog.ts) */
  let respond: (locale: Locale) => Promise<unknown> = (locale) => Promise.resolve(contentSubset(locale));
  const fake = installFakeChrome({
    language: 'fr',
    extra: {
      runtime: {
        id: 'synckai-test',
        sendMessage: (message: { type: string; payload: { locale: Locale } }) => {
          if (message.type !== 'GET_CONTENT_CATALOG') return Promise.reject(new Error(`message inattendu ${message.type}`));
          requested.push(message.payload.locale);
          return respond(message.payload.locale);
        },
      },
    },
  });

  beforeEach(() => {
    fake.reset();
    requested.length = 0;
    respond = (locale) => Promise.resolve(contentSubset(locale));
  });
  afterEach(() => vi.useRealTimers());

  /** Moteur neuf, sans les catalogues complets enregistrés par src/test/setup.ts */
  async function freshContentI18n(): Promise<typeof import('./content')> {
    vi.resetModules();
    return import('./content');
  }

  it('anglais embarqué ; autre langue demandée une fois au service worker, puis les vrais textes', async () => {
    const i18n = await freshContentI18n();
    expect(i18n.t('common.retry')).toBe(en['common.retry']);
    for (const locale of ['fr', 'de', 'ja', 'fr'] as const) {
      await expect(i18n.applyLanguageSetting(locale)).resolves.toBe(locale);
      expect(i18n.t('common.retry')).toBe(catalogOf(locale)['common.retry']);
      expect(i18n.t('content.episodeShort', { title: 'Frieren', number: 3 })).toBe(
        (catalogOf(locale)['content.episodeShort'] ?? '').replace('{title}', 'Frieren').replace('{number}', '3'),
      );
    }
    await i18n.applyLanguageSetting('en');
    expect(i18n.getLocale()).toBe('en');
    // Anglais embarqué, chaque autre langue demandée une seule fois
    expect(requested).toEqual(['fr', 'de', 'ja']);
  });

  it('service worker injoignable, catalogue introuvable ou sans réponse : anglais, nouvel essai à la lecture suivante', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const i18n = await freshContentI18n();
    respond = () => Promise.reject(new Error('Could not establish connection. Receiving end does not exist.'));
    await expect(i18n.applyLanguageSetting('fr')).resolves.toBe('en');
    respond = () => Promise.resolve(null);
    await expect(i18n.applyLanguageSetting('fr')).resolves.toBe('en');
    // Service worker muet : abandon après CONTENT_CATALOG_TIMEOUT_MS
    vi.useFakeTimers();
    respond = () => new Promise(() => undefined);
    const silent = i18n.applyLanguageSetting('fr');
    await vi.advanceTimersByTimeAsync(i18n.CONTENT_CATALOG_TIMEOUT_MS);
    await expect(silent).resolves.toBe('en');
    vi.useRealTimers();
    expect(i18n.t('common.close')).toBe(en['common.close']);
    expect(warn).toHaveBeenCalledTimes(3);
    warn.mockRestore();

    respond = (locale) => Promise.resolve(contentSubset(locale));
    await expect(i18n.applyLanguageSetting('fr')).resolves.toBe('fr');
    expect(requested).toEqual(['fr', 'fr', 'fr', 'fr']);
  });

  it('une clé hors du sous-ensemble retombe sur la clé brute, comme une clé inconnue', async () => {
    const i18n = await freshContentI18n();
    const outside = Object.keys(en).find((key): key is keyof typeof en => !(CONTENT_KEYS as readonly string[]).includes(key));
    expect(outside).toBeDefined();
    if (outside === undefined) return;
    await i18n.applyLanguageSetting('de');
    expect(i18n.t(outside)).toBe(outside);
  });

  it('langue des réglages (explicite ou auto) comme avant, sans écouteur', async () => {
    fake.reset({ settings: { language: 'de' } });
    let i18n = await freshContentI18n();
    await expect(i18n.ensureContentLanguage()).resolves.toBe('de');
    expect(i18n.t('common.close')).toBe(catalogOf('de')['common.close']);
    expect(fake.local.onChanged.hasListeners()).toBe(false);

    // auto → langue du navigateur (fr)
    fake.reset({ settings: { language: 'auto' } });
    i18n = await freshContentI18n();
    await expect(i18n.ensureContentLanguage()).resolves.toBe('fr');
    expect(i18n.t('common.close')).toBe(catalogOf('fr')['common.close']);
    expect(fake.local.onChanged.hasListeners()).toBe(false);
  });

  it('langue assurée à la demande (PERF-12) : rien à l’import, une seule demande par page, réglage relu à chaque besoin', async () => {
    fake.reset({ settings: { language: 'de' } });
    const i18n = await freshContentI18n();
    // Premier texte (anglais embarqué) : aucune demande tant que la langue n'est pas assurée
    expect(i18n.t('common.close')).toBe(en['common.close']);
    expect(requested).toEqual([]);
    // Deux besoins simultanés (toast du raccourci, fin d'épisode) puis un troisième : une seule demande
    await expect(Promise.all([i18n.ensureContentLanguage(), i18n.ensureContentLanguage()])).resolves.toEqual(['de', 'de']);
    await expect(i18n.ensureContentLanguage()).resolves.toBe('de');
    expect(i18n.t('common.close')).toBe(catalogOf('de')['common.close']);
    expect(requested).toEqual(['de']);
    // Réglage déjà lu par l'appelant (watch-session) : appliqué sans relecture
    await expect(i18n.ensureContentLanguage('ja')).resolves.toBe('ja');
    // Langue changée dans les réglages : suivie au besoin suivant, sans écouteur ; anglais : aucune demande
    fake.reset({ settings: { language: 'en' } });
    await expect(i18n.ensureContentLanguage()).resolves.toBe('en');
    expect(i18n.t('common.close')).toBe(en['common.close']);
    expect(requested).toEqual(['de', 'ja']);
    expect(fake.local.onChanged.hasListeners()).toBe(false);
  });

  it('langue assurée à la demande : échec → anglais, nouvel essai au besoin suivant', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    fake.reset({ settings: { language: 'de' } });
    const i18n = await freshContentI18n();
    respond = () => Promise.reject(new Error('Could not establish connection. Receiving end does not exist.'));
    await expect(i18n.ensureContentLanguage()).resolves.toBe('en');
    expect(i18n.t('common.close')).toBe(en['common.close']);
    respond = (locale) => Promise.resolve(contentSubset(locale));
    await expect(i18n.ensureContentLanguage()).resolves.toBe('de');
    expect(i18n.t('common.close')).toBe(catalogOf('de')['common.close']);
    expect(requested).toEqual(['de', 'de']);
    warn.mockRestore();
  });
});

/** Textes des clés de contenu d'une langue, tels que les renvoie le service worker */
function contentSubset(locale: Locale): Record<string, string> {
  return Object.fromEntries(CONTENT_KEYS.map((key) => [key, catalogOf(locale)[key] ?? '']));
}
