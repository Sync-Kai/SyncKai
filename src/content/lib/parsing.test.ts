import { describe, expect, it } from 'vitest';
import { cleanPageTitle, cleanText, createLabelGuard, flattenJsonLd, LABEL_SETTLE_MS, labelKey, MAX_LABELS, meaningfulSeasonTitle, slugToTitle, stripAudioTag, toNumber } from './parsing';

describe('toNumber / cleanText', () => {
  it('lit les nombres, y compris avec virgule décimale', () => {
    expect(toNumber('12')).toBe(12);
    expect(toNumber(25)).toBe(25);
    expect(toNumber('12,5')).toBe(12.5);
    expect(toNumber('abc')).toBeNull();
    expect(toNumber(null)).toBeNull();
  });

  it('normalise les espaces et rejette le vide', () => {
    expect(cleanText('  One   Piece \n')).toBe('One Piece');
    expect(cleanText('   ')).toBeNull();
    expect(cleanText(42)).toBeNull();
  });
});

describe('flattenJsonLd', () => {
  it('aplatit tableaux et @graph', () => {
    const nodes = flattenJsonLd([{ '@type': 'A' }, { '@graph': [{ '@type': 'B' }] }]);
    expect(nodes.map((n) => n['@type'])).toEqual(['A', undefined, 'B']);
  });
});

describe('createLabelGuard', () => {
  it('signale un libellé déjà attribué à un autre épisode (DOM périmé)', () => {
    const guard = createLabelGuard();
    guard.remember('ep-1179', labelKey(1179, 'Titre A'));
    expect(guard.isStale('ep-1180', labelKey(1179, 'Titre A'))).toBe(true);
    expect(guard.isStale('ep-1179', labelKey(1179, 'Titre A'))).toBe(false);
    expect(guard.isStale('ep-1180', labelKey(1180, 'Titre B'))).toBe(false);
  });

  it('isUnsettled : libellé d’un autre épisode suspect pendant LABEL_SETTLE_MS après la première lecture de l’épisode', () => {
    let now = 1_000;
    const guard = createLabelGuard(() => now);
    guard.remember('ep-1180', labelKey(1180, 'Titre A'));
    expect(guard.isUnsettled('ep-dub', labelKey(1180, 'Titre A'))).toBe(true);
    now += LABEL_SETTLE_MS;
    expect(guard.isUnsettled('ep-dub', labelKey(1180, 'Titre A'))).toBe(false);
    expect(guard.isStale('ep-dub', labelKey(1180, 'Titre A'))).toBe(true);
    // Autre épisode lu : délai recommencé ; libellé inconnu ou déjà le sien : jamais suspect
    expect(guard.isUnsettled('ep-1181', labelKey(1180, 'Titre A'))).toBe(true);
    expect(guard.isUnsettled('ep-1181', labelKey(1181, 'Titre B'))).toBe(false);
    expect(guard.isUnsettled('ep-1180', labelKey(1180, 'Titre A'))).toBe(false);
  });

  it('ignore les libellés sans titre', () => {
    const guard = createLabelGuard();
    guard.remember('ep-1', labelKey(1, null));
    expect(guard.isStale('ep-2', labelKey(1, null))).toBe(false);
  });

  it(`au plus ${MAX_LABELS} libellés retenus par page (2-R10) : les plus anciens sont oubliés`, () => {
    const guard = createLabelGuard();
    for (let episode = 1; episode <= MAX_LABELS + 1; episode++) guard.remember(`ep-${episode}`, labelKey(episode, `Titre ${episode}`));
    expect(guard.isStale('ep-x', labelKey(1, 'Titre 1'))).toBe(false);
    expect(guard.isStale('ep-x', labelKey(2, 'Titre 2'))).toBe(true);
    expect(guard.isStale('ep-x', labelKey(MAX_LABELS + 1, `Titre ${MAX_LABELS + 1}`))).toBe(true);
  });
});

describe('titres de page de série', () => {
  it('slugToTitle : dernier repli lisible', () => {
    expect(slugToTitle('black-clover')).toBe('black clover');
    expect(slugToTitle('re%3Azero')).toBe('re:zero');
    expect(slugToTitle(null)).toBeNull();
  });

  it('cleanPageTitle retire la plateforme et l’appel à l’action', () => {
    expect(cleanPageTitle('Black Clover - Watch on Crunchyroll', /crunchyroll/i)).toBe('Black Clover');
    expect(cleanPageTitle('Regarder Black Clover | Crunchyroll', /crunchyroll/i)).toBe('Black Clover');
    expect(cleanPageTitle('TOUGEN ANKI - ADN', /\bADN\b/i)).toBe('TOUGEN ANKI');
    expect(cleanPageTitle('Crunchyroll', /crunchyroll/i)).toBeNull();
  });

  it('stripAudioTag retire la mention de version', () => {
    expect(stripAudioTag('Elbaph (VF)')).toBe('Elbaph');
    expect(stripAudioTag('Frieren (English Dub)')).toBe('Frieren');
    expect(stripAudioTag('Re:Zero (Director’s Cut)')).toBe('Re:Zero (Director’s Cut)');
  });
});

describe('meaningfulSeasonTitle', () => {
  it('écarte les libellés génériques (FR, EN, DE, parties, volumes)', () => {
    for (const name of ['Saison 1', 'Season 2', 'Staffel 3', 'Part 2', 'Partie 1', 'Volume 4', 'season  10']) {
      expect(meaningfulSeasonTitle(name)).toBeNull();
    }
    expect(meaningfulSeasonTitle(null)).toBeNull();
  });

  it('garde un vrai nom de saison ou d’arc', () => {
    expect(meaningfulSeasonTitle('Arc du Pays des Wa')).toBe('Arc du Pays des Wa');
    expect(meaningfulSeasonTitle('Mushoku Tensei II')).toBe('Mushoku Tensei II');
    expect(meaningfulSeasonTitle('Part 2: The Final Chapter')).toBe('Part 2: The Final Chapter');
  });
});
