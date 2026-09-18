import * as cheerio from 'cheerio';
import { DateTime } from 'luxon';
import type { Adapter, Session, SessionType } from '../types.js';

const USER_AGENT = 'motorsport-calendar (https://github.com/SebastianKrell/motorsport-calendar)';
const ADAC_1000KM_URL = 'https://1000kmnuerburgring.de/besucher/';
const GOODWOOD_URL = 'https://www.goodwood.com/motorsport/festival-of-speed/';

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`HTTP ${response.status} bei ${url}`);
  return response.text();
}

function parseGermanDate(value: string): DateTime | null {
  const date = DateTime.fromFormat(value, 'dd.MM.yyyy', { zone: 'Europe/Berlin' });
  return date.isValid ? date : null;
}

function sessionTypeFor(activity: string): SessionType | null {
  if (/qualifying/i.test(activity)) return 'quali';
  if (/race/i.test(activity)) return 'race';
  return null;
}

function endUtcFor(start: DateTime, duration: string): string | null {
  const minutes = duration.match(/^(\d+)\s*Min\./i)?.[1];
  return minutes ? start.plus({ minutes: Number(minutes) }).toUTC().toISO() : null;
}

export function extractAdac1000KmSessions(html: string): Session[] {
  const $ = cheerio.load(html);
  const sessions: Session[] = [];
  let date: DateTime | null = null;

  $('h3, table').each((_, element) => {
    if (element.tagName === 'h3') {
      date = parseGermanDate(normalizeText($(element).text()));
      return;
    }
    if (!date) return;
    const scheduleDate = date;

    $(element).find('tbody tr').each((_, row) => {
      const cells = $(row)
        .find('td')
        .map((_, cell) => normalizeText($(cell).text()))
        .get();
      const [time, eventName, activity, duration] = cells;
      const type = sessionTypeFor(activity ?? '');
      if (!time || !eventName || !type) return;

      const start = DateTime.fromFormat(`${scheduleDate.toFormat('yyyy-MM-dd')} ${time.replace(/\s*Uhr$/i, '')}`, 'yyyy-MM-dd HH:mm', {
        zone: 'Europe/Berlin',
      });
      if (!start.isValid) return;

      sessions.push({
        series: 'adac_1000km_nuerburgring',
        eventName,
        circuit: 'Nürburgring Gesamtstrecke',
        round: null,
        sessionType: type,
        startUtc: start.toUTC().toISO()!,
        endUtc: endUtcFor(start, duration ?? ''),
        source: 'scrape',
        confidence: 'exact',
      });
    });
  });

  return sessions;
}

interface GoodwoodEvent {
  startDate: string;
  endDate: string;
}

function findGoodwoodEvent(value: unknown): GoodwoodEvent | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  if (typeof item.startDate === 'string' && typeof item.endDate === 'string' && /festival of speed/i.test(String(item.name))) {
    return { startDate: item.startDate, endDate: item.endDate };
  }
  const children = Array.isArray(value) ? value : Object.values(item);
  for (const child of children) {
    const event = findGoodwoodEvent(child);
    if (event) return event;
  }
  return null;
}

export function extractGoodwoodFestivalDays(html: string): Session[] {
  const $ = cheerio.load(html);
  const event = $('script[type="application/ld+json"]')
    .map((_, script) => {
      try {
        return findGoodwoodEvent(JSON.parse($(script).text()));
      } catch {
        return null;
      }
    })
    .get()
    .find((value): value is GoodwoodEvent => value !== null);
  if (!event) return [];

  const start = DateTime.fromISO(event.startDate, { zone: 'Europe/London' }).startOf('day');
  const end = DateTime.fromISO(event.endDate, { zone: 'Europe/London' }).startOf('day');
  if (!start.isValid || !end.isValid || end < start) return [];

  const sessions: Session[] = [];
  for (let day = start; day <= end; day = day.plus({ days: 1 })) {
    sessions.push({
      series: 'goodwood_festival_of_speed',
      eventName: 'Goodwood Festival of Speed',
      circuit: 'Goodwood House',
      round: null,
      sessionType: 'event',
      startUtc: `${day.toISODate()}T00:00:00.000Z`,
      endUtc: null,
      source: 'scrape',
      confidence: 'date-only',
    });
  }
  return sessions;
}

export const adac1000KmNuerburgringAdapter: Adapter = {
  series: 'adac_1000km_nuerburgring',
  async fetchSessions(): Promise<Session[]> {
    const sessions = extractAdac1000KmSessions(await fetchHtml(ADAC_1000KM_URL));
    if (sessions.length === 0) throw new Error('Keine Sessions im offiziellen ADAC-1000-km-Zeitplan gefunden');
    return sessions;
  },
};

export const goodwoodFestivalOfSpeedAdapter: Adapter = {
  series: 'goodwood_festival_of_speed',
  async fetchSessions(): Promise<Session[]> {
    const sessions = extractGoodwoodFestivalDays(await fetchHtml(GOODWOOD_URL));
    if (sessions.length === 0) throw new Error('Keine Termine im offiziellen Goodwood-Festival-Kalender gefunden');
    return sessions;
  },
};
