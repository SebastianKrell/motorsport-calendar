import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGtwcAdapter } from './gtwc.js';

const BASE_URL = 'https://www.intercontinentalgtchallenge.com';

const EVENT_HTML = `
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Event",
    "name": "Indianapolis 8 Hour",
    "startDate": "2026-10-08",
    "location": { "name": ", United States" },
    "description": "Intercontinental GT Challenge, Round 5, Indianapolis 8 Hour, United States"
  }
  </script>
  <table>
    <caption class="timetable__caption"><span>Wednesday, 7 October</span></caption>
    <tbody class="timetable__table-body">
      <tr><td>Test Session 1</td><td>15:25</td><td>19:25</td></tr>
    </tbody>
  </table>
  <table>
    <caption class="timetable__caption"><span>Friday, 9 October</span></caption>
    <tbody class="timetable__table-body">
      <tr><td>Pole Shootout (Top-10)</td><td>17:35</td><td>21:35</td></tr>
    </tbody>
  </table>
  <table>
    <caption class="timetable__caption"><span>Saturday, 10 October</span></caption>
    <tbody class="timetable__table-body">
      <tr><td>Race</td><td>12:30</td><td>16:30</td></tr>
    </tbody>
  </table>`;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SRO-Adapter für IGTC', () => {
  it('übernimmt Shootout und Rennen in GMT und ignoriert Test-Sessions', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        const body =
          url === `${BASE_URL}/calendar`
            ? '<a href="/event/153/Indianapolis 8 Hour">Indianapolis</a>'
            : EVENT_HTML;
        return new Response(body, { status: 200 });
      }),
    );

    await expect(createGtwcAdapter('igtc', BASE_URL).fetchSessions()).resolves.toEqual([
      expect.objectContaining({
        eventName: 'Indianapolis 8 Hour',
        circuit: 'Indianapolis Motor Speedway',
        round: 5,
        sessionType: 'quali',
        startUtc: '2026-10-09T21:35:00.000Z',
      }),
      expect.objectContaining({
        sessionType: 'race',
        startUtc: '2026-10-10T16:30:00.000Z',
        endUtc: '2026-10-11T00:30:00.000Z',
      }),
    ]);
  });
});
