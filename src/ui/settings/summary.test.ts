import { afterEach, describe, expect, it } from 'vitest';
import { getLocale, setLocale } from '../../i18n';
import { DEFAULT_SETTINGS, effectivePlayer } from '../../shared/settings';
import { LOGGED_OUT } from '../state';
import { accountLink, accountsSummary, azertyKeyHint, formatShortcut, helpSummary, languageSummary, notificationsSummary, platformsSummary, syncSummary } from './summary';

const initial = getLocale();
afterEach(() => setLocale(initial));

describe('accountsSummary', () => {
  it('deux comptes connectés : une phrase, point vert', () => {
    setLocale('fr');
    expect(accountsSummary({ anilist: 'connected', mal: 'connected' })).toEqual({ text: 'AniList et MyAnimeList connectés', tone: 'ok' });
    setLocale('en');
    expect(accountsSummary({ anilist: 'connected', mal: 'connected' }).text).toBe('AniList and MyAnimeList connected');
  });

  it('session expirée signalée en rouge ; compte non connecté nommé (maquette ReglagesEtats)', () => {
    setLocale('fr');
    expect(accountsSummary({ anilist: 'connected', mal: 'expired' })).toEqual({ text: 'AniList connecté · MAL : session expirée', tone: 'danger' });
    expect(accountsSummary({ anilist: 'connected', mal: 'disconnected' })).toEqual({ text: 'AniList connecté · MAL non connecté', tone: 'ok' });
    setLocale('en');
    expect(accountsSummary({ anilist: 'expired', mal: 'disconnected' })).toEqual({ text: 'AniList: session expired · MAL not connected', tone: 'danger' });
    expect(accountsSummary({ anilist: 'disconnected', mal: 'connected' })).toEqual({ text: 'AniList not connected · MAL connected', tone: 'ok' });
  });

  it('aucun compte, ou lecture en cours : point neutre', () => {
    setLocale('fr');
    expect(accountsSummary({ anilist: 'disconnected', mal: 'disconnected' })).toEqual({ text: 'Aucun compte connecté', tone: 'muted' });
    expect(accountsSummary({ anilist: 'loading', mal: 'connected' })).toEqual({ text: 'Chargement…', tone: 'muted' });
    setLocale('de');
    expect(accountsSummary({ anilist: 'disconnected', mal: 'disconnected' }).text).toBe('Kein Konto verbunden');
    expect(accountsSummary({ anilist: 'loading', mal: 'connected' }).text).toBe('Wird geladen…');
  });

  it('accountLink : états du popup → état résumé', () => {
    expect(accountLink({ status: 'loading' })).toBe('loading');
    expect(accountLink({ status: 'logged-in', viewer: null, error: null })).toBe('connected');
    expect(accountLink(LOGGED_OUT)).toBe('disconnected');
    expect(accountLink({ ...LOGGED_OUT, expired: true })).toBe('expired');
  });
});

describe('syncSummary', () => {
  it('synchro automatique et moment de la synchro (le lecteur passe dans Plateformes)', () => {
    setLocale('fr');
    expect(syncSummary(DEFAULT_SETTINGS)).toBe('Auto · au générique');
    expect(syncSummary({ ...DEFAULT_SETTINGS, completionTrigger: 'percentage', completionPercentage: 85 })).toBe('Auto · à 85 %');
    expect(syncSummary({ ...DEFAULT_SETTINGS, autoSync: false })).toBe('En pause');
    setLocale('en');
    expect(syncSummary({ ...DEFAULT_SETTINGS, completionTrigger: 'percentage', completionPercentage: 90 })).toBe('Auto · at 90%');
    expect(syncSummary({ ...DEFAULT_SETTINGS, autoSync: false })).toBe('Paused');
  });
});

describe('platformsSummary', () => {
  it('plateformes suivies (Crunchyroll et ADN toujours, plus les accès accordés) et lecteur préféré', () => {
    setLocale('fr');
    expect(platformsSummary(DEFAULT_SETTINGS, [])).toBe('2 sur 5 actives · lecteur Crunchyroll');
    expect(platformsSummary({ ...DEFAULT_SETTINGS, preferredPlayer: 'adn' }, ['netflix', 'prime'])).toBe('4 sur 5 actives · lecteur ADN');
    setLocale('en');
    expect(platformsSummary(DEFAULT_SETTINGS, ['disney'])).toBe('3 of 5 active · Crunchyroll player');
  });

  it('Netflix lecteur seulement avec l’accès accordé (sinon lecteur par défaut) ; accès pas encore lus', () => {
    setLocale('fr');
    const netflix = { ...DEFAULT_SETTINGS, preferredPlayer: 'netflix' } as const;
    expect(platformsSummary(netflix, ['netflix'])).toBe('3 sur 5 actives · lecteur Netflix');
    expect(platformsSummary(netflix, [])).toBe('2 sur 5 actives · lecteur Crunchyroll');
    expect(platformsSummary(netflix, undefined)).toBe('Chargement…');
    expect(effectivePlayer('adn', [])).toBe('adn');
  });
});

describe('effectivePlayer : lecteur préféré effectif, partout où il est lu', () => {
  it('Netflix et Prime Video seulement avec leur accès accordé ; sinon, ou état inconnu, lecteur par défaut ; jamais Disney+', () => {
    expect(effectivePlayer('netflix', ['netflix'])).toBe('netflix');
    expect(effectivePlayer('netflix', ['prime'])).toBe(DEFAULT_SETTINGS.preferredPlayer);
    expect(effectivePlayer('netflix', undefined)).toBe(DEFAULT_SETTINGS.preferredPlayer);
    expect(effectivePlayer('prime', ['prime'])).toBe('prime');
    expect(effectivePlayer('prime', [])).toBe(DEFAULT_SETTINGS.preferredPlayer);
    expect(effectivePlayer('disney', ['disney'])).toBe(DEFAULT_SETTINGS.preferredPlayer);
    expect(effectivePlayer('adn', undefined)).toBe('adn');
    expect(effectivePlayer('crunchyroll', [])).toBe('crunchyroll');
  });

  it('popup, panneau, agenda et alertes de sortie ne lisent jamais `preferredPlayer` sans passer par lui', () => {
    // Sources de l'extension (hors tests) : chaque lecture du réglage passe par effectivePlayer / effectivePreferredPlayer
    const sources = import.meta.glob<string>(['../../**/*.ts', '!../../**/*.test.ts'], { query: '?raw', import: 'default', eager: true });
    const readers = Object.entries(sources)
      .filter(([path, text]) => !path.endsWith('/shared/settings.ts') && /\.preferredPlayer\b/.test(text))
      .map(([path, text]) => ({ path: path.replace(/^(\.\.\/)+/, ''), helper: /\beffective(Preferred)?Player\(/.test(text) }));
    expect(readers.map((r) => r.path)).toEqual(
      expect.arrayContaining(['popup/popup.ts', 'sidepanel/components/now-playing-controller.ts', 'sidepanel/agenda-controller.ts', 'background/airing.ts']),
    );
    expect(readers.filter((r) => !r.helper).map((r) => r.path)).toEqual([]);
  });
});

describe('notificationsSummary', () => {
  it('niveau de notification et alertes de sortie', () => {
    setLocale('fr');
    expect(notificationsSummary(DEFAULT_SETTINGS)).toBe('Discrètes · alertes à l’heure');
    expect(notificationsSummary({ ...DEFAULT_SETTINGS, airingDelayHours: 1 })).toBe('Discrètes · alertes +1 h');
    expect(notificationsSummary({ ...DEFAULT_SETTINGS, airingAlerts: false, notificationLevel: 'detailed' })).toBe('Détaillées · alertes désactivées');
    setLocale('en');
    expect(notificationsSummary({ ...DEFAULT_SETTINGS, notificationLevel: 'alerts-only' })).toBe('Alerts only · alerts on time');
    setLocale('de');
    expect(notificationsSummary({ ...DEFAULT_SETTINGS, airingDelayHours: 3 })).toBe('Dezent · Alarme +3 h');
  });
});

describe('languageSummary', () => {
  it('automatique : langue détectée entre parenthèses ; sinon nom de la langue', () => {
    setLocale('fr');
    expect(languageSummary('auto', 'fr')).toBe('Automatique (Français)');
    expect(languageSummary('de', 'de')).toBe('Deutsch');
    setLocale('en');
    expect(languageSummary('auto', 'en')).toBe('Automatic (English)');
    setLocale('de');
    expect(languageSummary('auto', 'de')).toBe('Automatisch (Deutsch)');
  });
});

describe('helpSummary', () => {
  it('version, puis erreurs enregistrées (« aucune erreur » à 0)', () => {
    setLocale('fr');
    expect(helpSummary('1.9.0', 0)).toBe('Version 1.9.0 · aucune erreur');
    expect(helpSummary('1.9.0', null)).toBe('Version 1.9.0');
    expect(helpSummary('1.9.0', 2)).toBe('Version 1.9.0 · 2 erreurs');
    setLocale('en');
    expect(helpSummary('1.9.0', 1)).toBe('Version 1.9.0 · 1 error');
    expect(helpSummary('1.9.0', 0)).toBe('Version 1.9.0 · no errors');
  });
});

describe('raccourcis', () => {
  it('formatShortcut : seule la touche Maj est traduite', () => {
    setLocale('fr');
    expect(formatShortcut('Ctrl+Shift+F5')).toBe('Ctrl+Maj+F5');
    expect(formatShortcut('Alt+K')).toBe('Alt+K');
  });

  it('azertyKeyHint : chiffres communs aux AZERTY français et belge, en français seulement', () => {
    setLocale('fr');
    expect(azertyKeyHint('Alt+Shift+1')).toBe('touche &');
    expect(azertyKeyHint('Alt+Shift+2')).toBe('touche é');
    expect(azertyKeyHint('Alt+Shift+0')).toBe('touche à');
    // 6 et 8 diffèrent entre France et Belgique ; lettres, touches de fonction et pavé numérique : rien
    expect(azertyKeyHint('Alt+Shift+6')).toBeNull();
    expect(azertyKeyHint('Alt+Shift+K')).toBeNull();
    expect(azertyKeyHint('Ctrl+Shift+F1')).toBeNull();
    setLocale('en');
    expect(azertyKeyHint('Alt+Shift+1')).toBeNull();
  });
});
