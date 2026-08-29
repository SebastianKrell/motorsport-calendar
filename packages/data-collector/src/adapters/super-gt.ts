import * as cheerio from 'cheerio';
import { DateTime } from 'luxon';
import type { Adapter, Session, SessionType } from '../types.js';

const USER_AGENT = 'motorsport-calendar (https://github.com/SebastianKrell/motorsport-calendar)';
const BASE_URL = 'https://supergt.net';
const CALENDAR_URL = `${BASE_URL}/en/calendar`;

interface SuperGtEvent {
  eventName: string;
  circuit: string;
  round: number;
  raceDate: string;
  scheduleUrl: string;
  timeZone: string;
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`HTTP ${response.status} bei ${url}`);
  return response.text();
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function timeZoneForCircuit(circuit: string): string {
  return /sepang|malaysia/i.test(circuit) ? 'Asia/Kuala_Lumpur' : 'Asia/Tokyo';
}

export function extractSuperGtEvents(html: string): SuperGtEvent[] {
  const $ = cheerio.load(html);
  const yearMatch = $('h2')
    .map((_, heading) => normalizeText($(heading).text()))
    .get()
    .join(' ')
    .match(/\b(20\d{2}) Calendar\b/);
  if (!yearMatch) return [];

  const year = Number(yearMatch[1]);
  const events: SuperGtEvent[] = [];

  $('table tbody tr').each((_, row) => {
    const cells = $(row).find('td');
    const link = $(row).find('a[href*="/races/"]').first();
    const roundMatch = normalizeText(link.text()).match(/Round\s*(\d+)/i);
    const month = Number($(row).find('.numerator_s').text());
    const dayRange = normalizeText($(row).find('.denominator_s').text());
    const raceDay = Number(dayRange.split('-').at(-1));
    const circuit = normalizeText(cells.eq(2).text());
    const title = normalizeText(cells.eq(3).text());
    const href = link.attr('href');

    if (!roundMatch || !month || !raceDay || !circuit || !href || /postponed|cancelled/i.test(title)) return;

    const raceDate = DateTime.fromObject({ year, month, day: raceDay }, { zone: 'utc' });
    if (!raceDate.isValid) return;

    events.push({
      eventName: circuit,
      circuit,
      round: Number(roundMatch[1]),
      raceDate: raceDate.toFormat('yyyy-MM-dd'),
      scheduleUrl: href.replace(`${BASE_URL}/en/races/`, `${BASE_URL}/races/`),
      timeZone: timeZoneForCircuit(circuit),
    });
  });

  return events;
}

function classifySession(label: string): SessionType | null {
  if (!/SUPER GT/i.test(label)) return null;
  if (/公式練習|official practice/i.test(label)) return 'fp';
  if (/公式予選|qualifying/i.test(label)) return 'quali';
  if (/ウォームアップ|warm[\s-]?up/i.test(label)) return 'fp';
  if (/決勝レース|final race/i.test(label)) return 'race';
  return null;
}

export function extractSuperGtSchedule(html: string, event: SuperGtEvent): Session[] {
  const $ = cheerio.load(html);
  const dates = $('.table_date_tab a[data-target]')
    .map((_, tab) => $(tab).attr('data-target') ?? '')
    .get();
  const sessions: Session[] = [];

  $('.table_box').each((dayIndex, table) => {
    const date = dates[dayIndex];
    if (!date) return;

    $(table)
      .children('.schedule_box.pc520')
      .each((_, box) => {
        const label = normalizeText($(box).find('h6').text());
        const sessionType = classifySession(label);
        const startTime = $(box).attr('data-from');
        const endTime = $(box).attr('data-to');
        if (!sessionType || !startTime) return;

        const start = DateTime.fromFormat(`${date} ${startTime}`, 'yyyy-MM-dd HH:mm', { zone: event.timeZone });
        const end = endTime
          ? DateTime.fromFormat(`${date} ${endTime}`, 'yyyy-MM-dd HH:mm', { zone: event.timeZone })
          : null;
        if (!start.isValid || (end && !end.isValid)) return;

        sessions.push({
          series: 'super_gt',
          eventName: event.eventName,
          circuit: event.circuit,
          round: event.round,
          sessionType,
          startUtc: start.toUTC().toISO()!,
          endUtc: end?.toUTC().toISO() ?? null,
          source: 'scrape',
          confidence: 'exact',
        });
      });
  });

  return sessions;
}

function dateOnlyRace(event: SuperGtEvent): Session {
  return {
    series: 'super_gt',
    eventName: event.eventName,
    circuit: event.circuit,
    round: event.round,
    sessionType: 'race',
    startUtc: `${event.raceDate}T00:00:00.000Z`,
    endUtc: null,
    source: 'scrape',
    confidence: 'date-only',
  };
}

export const superGtAdapter: Adapter = {
  series: 'super_gt',
  async fetchSessions(): Promise<Session[]> {
    const events = extractSuperGtEvents(await fetchHtml(CALENDAR_URL));
    if (events.length === 0) throw new Error('Keine SUPER-GT-Rennen im offiziellen Kalender gefunden');

    const sessions: Session[] = [];
    for (const event of events) {
      try {
        const exactSessions = extractSuperGtSchedule(await fetchHtml(event.scheduleUrl), event);
        sessions.push(...(exactSessions.length > 0 ? exactSessions : [dateOnlyRace(event)]));
      } catch (error) {
        console.warn(
          `[super_gt] Zeitplan von ${event.scheduleUrl} fehlgeschlagen, verwende Renntag:`,
          error instanceof Error ? error.message : error,
        );
        sessions.push(dateOnlyRace(event));
      }
    }

    return sessions;
  },
};
