import { afterEach, describe, expect, it, vi } from 'vitest';
import { extractEvents, gtOpenAdapter } from './gt_open.js';

function calendarHtml() {
  const events = [
    {
      nombre: 'Hockenheim - GTO - 2026',
      fecha: '2026-09-13T16:00:00.000Z',
      circuito: { nombre: 'Hockenheim' },
    },
    {
      nombre: 'Termin ohne Datum - GTO - 2026',
      circuito: { nombre: 'Unbekannt' },
    },
  ];
  const payload = ['$', 'calendar', null, { eventos: events }];
  const chunk = [1, `5:${JSON.stringify(payload)}`];
  return `<html><script>self.__next_f.push(${JSON.stringify(chunk)})</script></html>`;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GT-Open-Adapter', () => {
  it('liest Events aus der Next.js-Flight-Payload', () => {
    expect(extractEvents(calendarHtml())).toEqual([
      expect.objectContaining({ nombre: 'Hockenheim - GTO - 2026' }),
      expect.objectContaining({ nombre: 'Termin ohne Datum - GTO - 2026' }),
    ]);
  });

  it('erzeugt exakte Sessions und überspringt Events ohne Datum', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(calendarHtml(), { status: 200 })));

    await expect(gtOpenAdapter.fetchSessions()).resolves.toEqual([
      {
        series: 'gt_open',
        eventName: 'Hockenheim',
        circuit: 'Hockenheim',
        round: null,
        sessionType: 'race',
        startUtc: '2026-09-13T16:00:00.000Z',
        endUtc: null,
        source: 'scrape',
        confidence: 'exact',
      },
    ]);
  });

  it('meldet eine unlesbare Kalenderseite als Fehler', () => {
    expect(() => extractEvents('<html></html>')).toThrow('Keine Kalenderdaten');
  });
});
