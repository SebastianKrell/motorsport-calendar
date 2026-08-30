import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCombinedGtwcAdapter, createGtwcAdapter } from './gtwc.js';

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
  vi.restoreAllMocks();
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

describe('SRO-Adapter für GTWC Europe', () => {
  it('veröffentlicht Zwischenstände eines laufenden Rennens nicht als zweiten Rennstart', async () => {
    const baseUrl = 'https://www.gt-world-challenge-europe.com';
    const eventHtml = `
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Event",
        "name": "Nürburgring",
        "startDate": "2026-08-28",
        "endDate": "2026-08-30",
        "location": { "name": "Nürburgring, Germany" },
        "description": "GT World Challenge Europe, Round 7, Nürburgring, Germany"
      }
      </script>
      <table>
        <caption class="timetable__caption"><span>Sunday, 30 August</span></caption>
        <tbody class="timetable__table-body">
          <tr><td>Main Race</td><td>15:00</td><td>13:00</td></tr>
          <tr><td>Main Race after 0.5 h</td><td>15:30</td><td>13:30</td></tr>
        </tbody>
      </table>`;

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const body =
          String(input) === `${baseUrl}/calendar`
            ? '<a href="/event/252/nürburgring">Nürburgring</a>'
            : eventHtml;
        return new Response(body, { status: 200 });
      }),
    );

    const sessions = await createGtwcAdapter('gtwc_europe', baseUrl).fetchSessions();
    expect(sessions).toEqual([
      expect.objectContaining({
        sessionType: 'race',
        startUtc: '2026-08-30T13:00:00.000Z',
      }),
    ]);
  });
});

describe('SRO-Adapter für British GT', () => {
  it('liest Doppelrennen mit offiziellen GMT-Zeiten und ignoriert Test-Sessions', async () => {
    const baseUrl = 'https://www.britishgt.com';
    const eventHtml = `
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Event",
        "name": "Oulton Park",
        "startDate": "2026-05-22",
        "location": { "name": "Oulton Park International Circuit, Great Britain" },
        "description": "British GT Championship, Round 2 & 3, Oulton Park, Great Britain"
      }
      </script>
      <table>
        <caption class="timetable__caption"><span>Friday, 22 May</span></caption>
        <tbody class="timetable__table-body">
          <tr><td>Test 1</td><td>10:45</td><td>09:45</td></tr>
        </tbody>
      </table>
      <table>
        <caption class="timetable__caption"><span>Saturday, 23 May</span></caption>
        <tbody class="timetable__table-body">
          <tr><td>Free Practice 1</td><td>09:30</td><td>08:30</td></tr>
          <tr><td>GT3 Qualifying 1</td><td>15:35</td><td>14:35</td></tr>
        </tbody>
      </table>
      <table>
        <caption class="timetable__caption"><span>Sunday, 24 May</span></caption>
        <tbody class="timetable__table-body">
          <tr><td>Warm Up</td><td>09:15</td><td>08:15</td></tr>
          <tr><td>Race 1</td><td>11:05</td><td>10:05</td></tr>
          <tr><td>Race 2</td><td>17:15</td><td>16:15</td></tr>
        </tbody>
      </table>`;

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        const body =
          url === `${baseUrl}/calendar` ? '<a href="/event/110/oulton-park">Oulton Park</a>' : eventHtml;
        return new Response(body, { status: 200 });
      }),
    );

    await expect(createGtwcAdapter('british_gt', baseUrl).fetchSessions()).resolves.toEqual([
      expect.objectContaining({
        eventName: 'Oulton Park',
        circuit: 'Oulton Park International Circuit',
        round: 2,
        sessionType: 'fp',
        startUtc: '2026-05-23T08:30:00.000Z',
      }),
      expect.objectContaining({
        sessionType: 'quali',
        startUtc: '2026-05-23T14:35:00.000Z',
      }),
      expect.objectContaining({
        sessionType: 'fp',
        startUtc: '2026-05-24T08:15:00.000Z',
      }),
      expect.objectContaining({
        sessionType: 'race',
        startUtc: '2026-05-24T10:05:00.000Z',
      }),
      expect.objectContaining({
        sessionType: 'race',
        startUtc: '2026-05-24T16:15:00.000Z',
      }),
    ]);
  });

  it('veröffentlicht eine einzelne Mitternachtszeile nicht als exakten Renntermin', async () => {
    const baseUrl = 'https://www.britishgt.com';
    const placeholderHtml = `
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Event",
        "name": "Brands Hatch",
        "startDate": "2026-09-26",
        "location": { "name": "Brands Hatch Circuit, Great Britain" },
        "description": "British GT Championship, Round 8, Brands Hatch, Great Britain"
      }
      </script>
      <table>
        <caption class="timetable__caption"><span>Sunday, 27 September</span></caption>
        <tbody class="timetable__table-body">
          <tr><td>Race</td><td>00:00</td><td>23:00</td></tr>
        </tbody>
      </table>`;

    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const body =
          String(input) === `${baseUrl}/calendar`
            ? '<a href="/event/113/brands-hatch">Brands Hatch</a>'
            : placeholderHtml;
        return new Response(body, { status: 200 });
      }),
    );

    await expect(createGtwcAdapter('british_gt', baseUrl).fetchSessions()).rejects.toThrow(
      'Keine SRO-Sessions gefunden',
    );
  });
});

describe('Kombinierter SRO-Adapter für GT2/GT4', () => {
  it('kennzeichnet Teilserien und behält offizielle Renntage ohne Timetable', async () => {
    const gt2Url = 'https://www.gt2europeanseries.com';
    const gt4Url = 'https://www.gt4europeanseries.com';
    const eventHtml = (series: string, round: number, endDate: string, schedule = '') => `
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Event",
        "name": "Portimao",
        "startDate": "2026-10-16",
        "endDate": "${endDate}",
        "location": { "name": "Portimao Circuit, Portugal" },
        "description": "${series}, Round ${round}, Portimao, Portugal"
      }
      </script>
      ${schedule}`;
    const gt4Schedule = `
      <table>
        <caption class="timetable__caption"><span>Saturday, 17 October</span></caption>
        <tbody class="timetable__table-body">
          <tr><td>Qualify 1</td><td>15:05</td><td>14:05</td></tr>
          <tr><td>Race 1</td><td>17:10</td><td>16:10</td></tr>
        </tbody>
      </table>`;

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url === `${gt2Url}/calendar`) {
          return new Response('<a href="/event/110/portimao">Portimao</a>', { status: 200 });
        }
        if (url === `${gt4Url}/calendar`) {
          return new Response('<a href="/event/76/portimao">Portimao</a>', { status: 200 });
        }
        const body =
          url.startsWith(gt2Url)
            ? eventHtml('GT2 European Series', 9, '2026-10-18')
            : eventHtml('GT4 European Series', 6, '2026-10-18', gt4Schedule);
        return new Response(body, { status: 200 });
      }),
    );

    const adapter = createCombinedGtwcAdapter('gt2_gt4_europe', [
      { baseUrl: gt2Url, eventNameSuffix: ' (GT2 Europe)', dateOnlyFallback: true },
      { baseUrl: gt4Url, eventNameSuffix: ' (GT4 Europe)', dateOnlyFallback: true },
    ]);

    await expect(adapter.fetchSessions()).resolves.toEqual([
      expect.objectContaining({
        eventName: 'Portimao (GT2 Europe)',
        sessionType: 'race',
        startUtc: '2026-10-18T00:00:00.000Z',
        confidence: 'date-only',
      }),
      expect.objectContaining({
        eventName: 'Portimao (GT4 Europe)',
        sessionType: 'quali',
        startUtc: '2026-10-17T14:05:00.000Z',
        confidence: 'exact',
      }),
      expect.objectContaining({
        eventName: 'Portimao (GT4 Europe)',
        sessionType: 'race',
        startUtc: '2026-10-17T16:10:00.000Z',
      }),
    ]);
  });
});
