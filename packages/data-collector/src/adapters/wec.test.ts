import { afterEach, describe, expect, it, vi } from 'vitest';
import { wecAdapter } from './wec.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('WEC-Adapter', () => {
  it('verwendet die Strecken-Zeitzone und Endzeit aus dem offiziellen ICS-Export', async () => {
    const raceUrl = 'https://www.fiawec.com/en/race/lone-star-le-mans-2026';
    const eventHtml = `
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "SportsEvent",
        "name": "WEC Lone Star Le Mans 2026",
        "location": { "name": "Circuit des Amériques" },
        "subEvent": [{
          "@type": "SportsEvent",
          "name": "Race - Lone Star Le Mans",
          "startDate": "2026-09-06T13:00:00+02:00"
        }]
      }
      </script>
      <a href="/en/race/calendar/4953">Add to calendar</a>`;
    const calendar = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:session-7822@www.fiawec.com
SUMMARY:Lone Star Le Mans - Race
DTSTART;TZID=America/Chicago:20260906T130000
DTEND;TZID=America/Chicago:20260906T190000
END:VEVENT
END:VCALENDAR`;

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.endsWith('/en/season/2026')) {
          return new Response('<a href="/en/race/lone-star-le-mans-2026">Race</a>');
        }
        if (url === raceUrl) return new Response(eventHtml);
        if (url.endsWith('/en/race/calendar/4953')) return new Response(calendar);
        return new Response('', { status: 404 });
      }),
    );

    await expect(wecAdapter.fetchSessions()).resolves.toEqual([
      expect.objectContaining({
        eventName: 'Lone Star Le Mans',
        sessionType: 'race',
        startUtc: '2026-09-06T18:00:00.000Z',
        endUtc: '2026-09-07T00:00:00.000Z',
      }),
    ]);
  });
});
