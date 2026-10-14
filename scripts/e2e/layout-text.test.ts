import { describe, expect, it } from 'vitest';
import { attributeText, collectDataStrings, createDataMatcher, DATA_TOKEN, indexCatalog, normalizeText } from './layout-text';

// Catalogue réduit, aux formes des vrais catalogues (src/i18n/locales) : texte fixe, modèles, pluriels, texte inséré
const CATALOG = {
  'nav.settings': 'Réglages',
  'settings.cat.sync': 'Lecture & synchro',
  'settings.notif.detailed.title': 'Détaillées',
  'settings.summary.airingOnTime': 'À l’heure',
  'recent.line': '{title} · Ép. {progress}',
  'watching.openOn': 'Ouvrir sur {platform}',
  'common.labelValue': '{label} : {value}',
  'panel.nowPlaying.studio': 'Studio',
  'watching.episodesLeft_one': '{count} épisode restant',
  'watching.episodesLeft_other': '{count} épisodes restants',
  'inline.removed': '« {title} » retirée de ta liste',
  'list.remove.confirm': 'Retirer de tes listes AniList et MyAnimeList ?',
};

const index = indexCatalog(CATALOG);
const isData = createDataMatcher(['Dandadan Season 2', 'Frieren: Beyond Journey’s End', 'Kai_fan']);

describe('normalizeText', () => {
  it('ramène espaces insécables, fines et sans chasse à une espace simple', () => {
    expect(normalizeText('  À l’heure :​  ok ')).toBe('À l’heure : ok');
  });
});

describe('attributeText', () => {
  it('texte exact d’une clé (casse ignorée : début de phrase mis en minuscule par le code)', () => {
    expect(attributeText('Réglages', index, isData)).toEqual({ keys: ['nav.settings'], catalogOnly: 'Réglages', letters: 8, data: 0 });
    expect(attributeText('lecture & synchro', index, isData)?.keys).toEqual(['settings.cat.sync']);
  });

  it('modèle rempli par une donnée de démo : la donnée est remplacée dans le texte « catalogue seul »', () => {
    expect(attributeText('Dandadan Season 2 · Ép. 7', index, isData)).toEqual({ keys: ['recent.line'], catalogOnly: `${DATA_TOKEN} · Ép. 7`, letters: 2, data: 1 });
    expect(attributeText('« Frieren: Beyond Journey’s End » retirée de ta liste', index, isData)).toMatchObject({ keys: ['inline.removed'], catalogOnly: `« ${DATA_TOKEN} » retirée de ta liste`, data: 1 });
  });

  it('paramètre constant (plateforme, nombre) gardé tel quel : il compte dans la mesure', () => {
    expect(attributeText('Ouvrir sur Crunchyroll', index, isData)).toMatchObject({ keys: ['watching.openOn'], catalogOnly: 'Ouvrir sur Crunchyroll', data: 0 });
    expect(attributeText('3 épisodes restants', index, isData)).toMatchObject({ keys: ['watching.episodesLeft_other'], catalogOnly: '3 épisodes restants', data: 0 });
  });

  it('paramètre lui-même traduit (« Studio : Madhouse ») : sous-texte du catalogue gardé, donnée remplacée', () => {
    const studio = createDataMatcher(['Madhouse']);
    expect(attributeText('Studio : Madhouse', indexCatalog(CATALOG), studio)).toEqual({
      keys: ['common.labelValue', 'panel.nowPlaying.studio'],
      catalogOnly: `Studio : ${DATA_TOKEN}`,
      letters: 6,
      data: 1,
    });
  });

  it('à lettres égales, le modèle le plus spécifique l’emporte sur « {label} : {value} » rempli de deux sous-textes', () => {
    const tr = indexCatalog({
      'agenda.episode': 'Bölüm {episode}',
      'common.labelValue': '{label}: {value}',
      'queue.until.days_one': '{count} gün sonra',
      'time.countdown.days': '{count} gün',
      'watching.badge.upcoming': 'Bölüm {episode}: {delay} sonra',
    });
    expect(attributeText('Bölüm 1123: 4 gün sonra', tr, isData)?.keys).toEqual(['watching.badge.upcoming', 'time.countdown.days']);
  });

  it('textes traduits joints par « · » ou « › » dans le code : chaque morceau expliqué', () => {
    expect(attributeText('Détaillées · À l’heure', index, isData)).toMatchObject({ keys: ['settings.notif.detailed.title', 'settings.summary.airingOnTime'], data: 0 });
    expect(attributeText('Réglages › Lecture & synchro', index, isData)?.keys).toEqual(['nav.settings', 'settings.cat.sync']);
  });

  it('pas une chaîne du catalogue : titre, pseudo, titre qui ressemble à « {label} : {value} », date', () => {
    expect(attributeText('Dandadan Season 2', index, isData)).toBeNull();
    expect(attributeText('Kai_fan', index, isData)).toBeNull();
    expect(attributeText('Re:Zero : Starting Life', index, isData)).toBeNull();
    expect(attributeText('lun. 13 oct., 17:00', index, isData)).toBeNull();
  });
});

describe('createDataMatcher', () => {
  it('reconnaît une donnée contenue dans le texte, ou un morceau assez long d’une donnée', () => {
    expect(isData('Dandadan Season 2 (VF)')).toBe(true);
    expect(isData('Beyond Journey’s')).toBe(true);
    expect(isData('Ép.')).toBe(false);
    expect(isData('Crunchyroll')).toBe(false);
  });
});

describe('collectDataStrings', () => {
  it('garde titres, pseudos et commentaires ; écarte adresses, identifiants, énumérations et textes du catalogue', () => {
    const found = collectDataStrings(
      [
        {
          title: 'Solo Leveling',
          siteUrl: 'https://anilist.co/anime/1',
          coverUrl: 'data:image/svg+xml,%3Csvg',
          status: 'CURRENT',
          key: 'crunchyroll:DEMO-Kaiju8:S2',
          sort: 'next-episode',
          viewer: { name: 'Kai_fan' },
          notes: ['Combat final à revoir'],
          reason: 'Réglages',
          progress: 7,
        },
      ],
      (text) => text === 'Réglages',
    );
    expect(found).toEqual(['Combat final à revoir', 'Kai_fan', 'Solo Leveling']);
  });
});
