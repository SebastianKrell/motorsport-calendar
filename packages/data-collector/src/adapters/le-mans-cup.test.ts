import { describe, expect, it } from 'vitest';
import {
  extractLeMansCupEvent,
  extractRaceUrls,
  sessionsFromLeMansCupEvent,
} from './le-mans-cup.js';

const EVENT = {
  '@type': 'SportsEvent',
  location: { name: 'Silverstone' },
  subEvent: [
    { name: 'Free Practice 1 - Silverstone Round', startDate: '2026-09-11T11:00:00+02:00' },
    { name: 'Bronze Driver Collective Test - Silverstone Round', startDate: '2026-09-11T15:30:00+02:00' },
    { name: 'Qualifying - GT3 - Silverstone Round', startDate: '2026-09-12T12:45:00+02:00' },
    { name: 'Race - Silverstone Round', startDate: '2026-09-12T17:40:00+02:00' },
  ],
};

describe('Le-Mans-Cup-Adapter', () => {
  it('liest Rennseiten und lässt den Testtag aus', () => {
    const html = [
      '<a href="/en/race/collective-tests-barcelona-2026">',
      '<a href="/en/race/silverstone-round-2026">',
      '<a href="/en/race/silverstone-round-2026">',
      '<a href="/en/race/portimao-round-2026">',
    ].join('');

    expect(extractRaceUrls(html)).toEqual([
      'https://www.lemanscup.com/en/race/silverstone-round-2026',
      'https://www.lemanscup.com/en/race/portimao-round-2026',
    ]);
  });

  it('extrahiert den SportsEvent-JSON-LD-Block', () => {
    const html = `<script type="application/ld+json">${JSON.stringify({ '@type': 'BreadcrumbList' })}</script>
      <script type="application/ld+json">${JSON.stringify(EVENT)}</script>`;

    expect(extractLeMansCupEvent(html)).toEqual(EVENT);
  });

  it('übernimmt echte Zeiten und unterscheidet Qualifying-Klassen', () => {
    expect(sessionsFromLeMansCupEvent(EVENT)).toEqual([
      expect.objectContaining({
        eventName: 'Silverstone Round',
        sessionType: 'fp',
        startUtc: '2026-09-11T09:00:00.000Z',
      }),
      expect.objectContaining({
        eventName: 'Silverstone Round (GT3)',
        sessionType: 'quali',
        startUtc: '2026-09-12T10:45:00.000Z',
      }),
      expect.objectContaining({
        eventName: 'Silverstone Round',
        sessionType: 'race',
        startUtc: '2026-09-12T15:40:00.000Z',
      }),
    ]);
  });
});
