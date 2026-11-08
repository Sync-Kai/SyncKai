import { describe, expect, it } from 'vitest';
import { formatInactivity } from './dormant-view';

// « vu il y a … » des séries en sommeil : semaines sous 60 jours, mois au-delà (Intl.RelativeTimeFormat de la langue)

const NOW = Date.UTC(2026, 10, 8, 12);
const DAY = 86_400_000;
const ago = (days: number, locale: Parameters<typeof formatInactivity>[2] = 'fr'): string => formatInactivity(NOW - days * DAY, NOW, locale);

describe('formatInactivity', () => {
  it('semaines sous 60 jours', () => {
    expect(ago(31)).toBe('il y a 4 semaines');
    expect(ago(45)).toBe('il y a 6 semaines');
    expect(ago(59)).toBe('il y a 8 semaines');
  });
  it('mois à partir de 60 jours', () => {
    expect(ago(60)).toBe('il y a 2 mois');
    expect(ago(95)).toBe('il y a 3 mois');
    expect(ago(400)).toBe('il y a 13 mois');
  });
  it('formes de la langue', () => {
    expect(ago(60, 'en')).toBe('2 months ago');
    expect(ago(45, 'de')).toBe('vor 6 Wochen');
    expect(ago(60, 'ru')).toBe('2 месяца назад');
  });
  it('jamais « dans … » ni zéro (horloge en retard)', () => {
    expect(ago(-3)).toBe('il y a 1 semaine');
    expect(ago(2)).toBe('il y a 1 semaine');
  });
});
