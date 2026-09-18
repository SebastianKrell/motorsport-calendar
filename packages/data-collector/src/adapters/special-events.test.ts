import { describe, expect, it } from 'vitest';
import { extractAdac1000KmSessions, extractGoodwoodFestivalDays } from './special-events.js';

describe('special events adapters', () => {
  it('extracts dated Nürburgring race sessions and their known durations', () => {
    const sessions = extractAdac1000KmSessions(`
      <h3>19.09.2026</h3>
      <table><tbody>
        <tr><td>14:00 Uhr</td><td>DHLM – Lauf 3</td><td>Race</td><td>180 Min.</td></tr>
        <tr><td>18:15 Uhr</td><td>Porsche Transaxle</td><td>Sonderlauf</td><td>60 Min.</td></tr>
      </tbody></table>
      <h3>20.09.2026</h3>
      <table><tbody>
        <tr><td>11:30 Uhr</td><td>Tourenwagen Golden Ära</td><td>Race</td><td>3 Runden</td></tr>
      </tbody></table>
    `);

    expect(sessions).toEqual([
      expect.objectContaining({
        eventName: 'DHLM – Lauf 3',
        sessionType: 'race',
        startUtc: '2026-09-19T12:00:00.000Z',
        endUtc: '2026-09-19T15:00:00.000Z',
      }),
      expect.objectContaining({
        eventName: 'Tourenwagen Golden Ära',
        sessionType: 'race',
        startUtc: '2026-09-20T09:30:00.000Z',
        endUtc: null,
      }),
    ]);
  });

  it('extracts every official Goodwood festival day as a date-only event', () => {
    const sessions = extractGoodwoodFestivalDays(`
      <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Event","name":"Goodwood Festival of Speed",
         "startDate":"2027-07-15","endDate":"2027-07-18"}
      </script>
    `);

    expect(sessions).toHaveLength(4);
    expect(sessions[0]).toEqual(expect.objectContaining({
      sessionType: 'event',
      confidence: 'date-only',
      startUtc: '2027-07-15T00:00:00.000Z',
    }));
    expect(sessions.at(-1)).toEqual(expect.objectContaining({
      startUtc: '2027-07-18T00:00:00.000Z',
    }));
  });
});
