import { afterEach, describe, expect, it } from 'vitest';
import { getLocale, setLocale } from '../../i18n';
import { DEFAULT_SETTINGS } from '../../shared/settings';
import { LOGGED_OUT } from '../../popup/state';
import { accountLink, accountsSummary, dataSummary, helpSummary, languageSummary, notificationsSummary, syncSummary } from './summary';

const initial = getLocale();
afterEach(() => setLocale(initial));

describe('accountsSummary', () => {
  it('deux comptes connectés', () => {
    setLocale('fr');
    expect(accountsSummary({ anilist: 'connected', mal: 'connected' })).toEqual({ text: 'AniList ✓ · MAL ✓', tone: 'muted' });
  });

  it('session expirée signalée en rouge, compte non connecté omis', () => {
    setLocale('fr');
    expect(accountsSummary({ anilist: 'connected', mal: 'expired' })).toEqual({ text: 'AniList ✓ · MAL : session expirée', tone: 'danger' });
    setLocale('en');
    expect(accountsSummary({ anilist: 'expired', mal: 'disconnected' })).toEqual({ text: 'AniList: session expired', tone: 'danger' });
    setLocale('de');
    expect(accountsSummary({ anilist: 'disconnected', mal: 'connected' }).text).toBe('MAL ✓');
  });

  it('aucun compte, ou lecture en cours', () => {
    setLocale('fr');
    expect(accountsSummary({ anilist: 'disconnected', mal: 'disconnected' }).text).toBe('Aucun compte connecté');
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
  it('lecteur et moment de la synchro', () => {
    setLocale('fr');
    expect(syncSummary(DEFAULT_SETTINGS)).toBe('Crunchyroll · au générique');
    expect(syncSummary({ ...DEFAULT_SETTINGS, completionTrigger: 'percentage', completionPercentage: 85, preferredPlayer: 'adn' })).toBe('ADN · à 85 %');
    expect(syncSummary({ ...DEFAULT_SETTINGS, autoSync: false })).toBe('Crunchyroll · en pause');
  });

  it('en et de', () => {
    setLocale('en');
    expect(syncSummary({ ...DEFAULT_SETTINGS, completionTrigger: 'percentage', completionPercentage: 90 })).toBe('Crunchyroll · at 90%');
    setLocale('de');
    expect(syncSummary(DEFAULT_SETTINGS)).toBe('Crunchyroll · beim Abspann');
    expect(syncSummary({ ...DEFAULT_SETTINGS, autoSync: false })).toBe('Crunchyroll · pausiert');
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

describe('dataSummary', () => {
  it('correspondances et séries exclues (pluriels)', () => {
    setLocale('fr');
    expect(dataSummary(12, 2)).toBe('12 correspondances · 2 exclues');
    expect(dataSummary(1, 0)).toBe('1 correspondance · 0 exclue');
    setLocale('en');
    expect(dataSummary(1, 3)).toBe('1 match · 3 excluded');
    setLocale('de');
    expect(dataSummary(5, 1)).toBe('5 Zuordnungen · 1 ausgeschlossen');
  });

  it('données pas encore lues', () => {
    setLocale('fr');
    expect(dataSummary(4, null)).toBe('4 correspondances');
    expect(dataSummary(null, null)).toBe('Chargement…');
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
  it('version, précédée des erreurs enregistrées', () => {
    setLocale('fr');
    expect(helpSummary('1.9.0', 0)).toBe('v1.9.0');
    expect(helpSummary('1.9.0', null)).toBe('v1.9.0');
    expect(helpSummary('1.9.0', 2)).toBe('2 erreurs · v1.9.0');
    setLocale('en');
    expect(helpSummary('1.9.0', 1)).toBe('1 error · v1.9.0');
    setLocale('de');
    expect(helpSummary('1.9.0', 3)).toBe('3 Fehler · v1.9.0');
  });
});
