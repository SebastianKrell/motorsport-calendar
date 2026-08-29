import * as cheerio from 'cheerio';
import type { Adapter, Session } from '../types.js';

const USER_AGENT = 'motorsport-calendar (https://github.com/SebastianKrell/motorsport-calendar)';
const CALENDAR_URL = 'https://gtopen.gtsport.es/calendario';

interface RawEvent {
  nombre?: string;
  fecha?: string;
  circuito?: {
    nombre?: string;
  };
}

function findEvents(value: unknown): RawEvent[] | null {
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const events = findEvents(entry);
      if (events) return events;
    }
    return null;
  }

  const record = value as Record<string, unknown>;
  if (Array.isArray(record.eventos)) return record.eventos as RawEvent[];
  for (const entry of Object.values(record)) {
    const events = findEvents(entry);
    if (events) return events;
  }
  return null;
}

// Die Next.js-Seite serialisiert ihren Kalender in React-Flight-Scripts. Die
// öffentliche Payload ist stabiler und vollständiger als die sichtbare Liste,
// die vergangene Events clientseitig ausblendet.
function extractEvents(html: string): RawEvent[] {
  const $ = cheerio.load(html);
  for (const script of $('script').toArray()) {
    const content = $(script).html()?.trim() ?? '';
    const match = content.match(/^self\.__next_f\.push\((\[1,.*\])\)$/s);
    if (!match) continue;

    try {
      const flightChunk = JSON.parse(match[1]) as [number, string];
      const separator = flightChunk[1].indexOf(':');
      if (separator === -1) continue;
      const payload = JSON.parse(flightChunk[1].slice(separator + 1)) as unknown;
      const events = findEvents(payload);
      if (events) return events;
    } catch {
      // Andere Flight-Chunks enthalten Referenzen oder unvollständige Daten.
    }
  }
  throw new Error('Keine Kalenderdaten in der GT-Open-Seite gefunden');
}

function eventName(event: RawEvent): string {
  return event.circuito?.nombre?.trim() || event.nombre?.replace(/\s*-\s*GTO\s*-\s*\d{4}\s*$/i, '').trim() || 'GT Open';
}

export const gtOpenAdapter: Adapter = {
  series: 'gt_open',
  async fetchSessions(): Promise<Session[]> {
    const response = await fetch(CALENDAR_URL, { headers: { 'User-Agent': USER_AGENT } });
    if (!response.ok) throw new Error(`HTTP ${response.status} bei ${CALENDAR_URL}`);

    return extractEvents(await response.text())
      .filter((event): event is RawEvent & { fecha: string } => Boolean(event.fecha))
      .map((event) => {
        const name = eventName(event);
        return {
          series: 'gt_open',
          eventName: name,
          circuit: event.circuito?.nombre?.trim() ?? name,
          round: null,
          sessionType: 'race',
          startUtc: new Date(event.fecha).toISOString(),
          endUtc: null,
          source: 'scrape',
          confidence: 'exact',
        };
      });
  },
};
