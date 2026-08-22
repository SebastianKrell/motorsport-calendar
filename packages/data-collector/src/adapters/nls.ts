import * as cheerio from 'cheerio';
import { DateTime } from 'luxon';
import type { Adapter, Session, SessionType } from '../types.js';

const USER_AGENT = 'motorsport-calendar (https://github.com/SebastianKrell/motorsport-calendar)';
// vln.de leitet inzwischen hierher weiter (Stand 2026-08-22, s. CLAUDE.md).
const CALENDAR_URL =
  'https://www.nuerburgring-langstrecken-serie.de/language/de/termine-adac-ravenol-nuerburgring-langstrecken-serie-2026/';
const CIRCUIT = 'Nürburgring';

interface CalendarRow {
  round: number | null;
  eventName: string;
  date: string; // dd.mm.yyyy
  detailUrl: string;
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status} bei ${url}`);
  return res.text();
}

// "NLS9: 66. ADAC ACAS Cup (4h)" -> { round: 9, eventName: "66. ADAC ACAS Cup" }
function parseRoundAndName(linkText: string): { round: number | null; eventName: string } {
  const roundMatch = linkText.match(/^NLS(\d+):\s*/);
  const withoutRound = roundMatch ? linkText.slice(roundMatch[0].length) : linkText;
  const eventName = withoutRound.replace(/\s*\(\d+(?:x\d+)?h(?:\s*Stunden)?\)\s*$/i, '').trim();
  return { round: roundMatch ? Number(roundMatch[1]) : null, eventName };
}

function germanDateToUtcMidnight(dateDe: string): string {
  const [day, month, year] = dateDe.split('.').map(Number);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00.000Z`;
}

function localTimeToUtcIso(dateDe: string, time: string): string {
  const [day, month, year] = dateDe.split('.').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const dt = DateTime.fromObject({ year, month, day, hour, minute }, { zone: 'Europe/Berlin' });
  return dt.toUTC().toISO() ?? germanDateToUtcMidnight(dateDe);
}

// Liest die Kalendertabelle auf der Terminübersichtsseite aus (ein <tr> pro
// Rennen, Spalte 1 Datum, Spalte 2 Link zur Event-Detailseite mit Zeitplan).
async function fetchCalendarRows(): Promise<CalendarRow[]> {
  const html = await fetchHtml(CALENDAR_URL);
  const $ = cheerio.load(html);
  const rows: CalendarRow[] = [];

  $('table.table tr').each((_, tr) => {
    const cells = $(tr).find('td');
    if (cells.length < 2) return;

    const date = $(cells[0]).text().trim();
    const link = $(cells[1]).find('a').first();
    const linkText = link.text().trim();
    const href = link.attr('href');

    // Mehrtägige Sonderevents (z.B. "ADAC 24h Qualifiers") sind laut Seite
    // ("zehn Rennen bei acht Veranstaltungen") keine regulären NLS-Punkte-
    // rennen und verlinken auf eine externe Seite ohne Zeitplan -- bewusst
    // ausgelassen statt Zeiten zu raten.
    if (!date || !linkText.startsWith('NLS') || !href?.includes('nuerburgring-langstrecken-serie.de')) {
      return;
    }

    const { round, eventName } = parseRoundAndName(linkText);
    rows.push({ round, eventName, date, detailUrl: href });
  });

  return rows;
}

interface ScheduleEntry {
  sessionType: SessionType;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
}

// Sucht die Überschrift "Zeitplan" auf der Event-Detailseite und liest die
// direkt danach folgende Tabelle aus (Format je Zeile: "HH:mm – HH:mm Uhr" |
// Aktivität, z.B. "Qualifying" oder "Rennen (4 Stunden)"). Pitwalk/Gridwalk/
// Startaufstellung sind keine fahrbaren Sessions und werden übersprungen.
function extractSchedule($: cheerio.CheerioAPI): ScheduleEntry[] {
  const heading = $('h5')
    .filter((_, el) => $(el).text().trim() === 'Zeitplan')
    .first();
  const table = heading.closest('.wpb_wrapper').find('table').first();
  if (table.length === 0) return [];

  const entries: ScheduleEntry[] = [];
  table.find('tr').each((_, tr) => {
    const cells = $(tr).find('td');
    if (cells.length < 2) return;

    const timeMatch = $(cells[0]).text().trim().match(/(\d{2}:\d{2})\s*[–-]\s*(\d{2}:\d{2})/);
    if (!timeMatch) return;
    const [, startTime, endTime] = timeMatch;

    const activity = $(cells[1]).text().trim().toLowerCase();
    let sessionType: SessionType | null = null;
    if (activity.includes('qualifying')) sessionType = 'quali';
    else if (activity.includes('training')) sessionType = 'fp';
    else if (activity.includes('rennen') || activity.includes('race')) sessionType = 'race';
    if (!sessionType) return;

    entries.push({ sessionType, startTime, endTime });
  });

  return entries;
}

export const nlsAdapter: Adapter = {
  series: 'nls',
  async fetchSessions(): Promise<Session[]> {
    const rows = await fetchCalendarRows();
    const sessions: Session[] = [];

    for (const row of rows) {
      const dateOnlyFallback = (): Session => ({
        series: 'nls',
        eventName: row.eventName,
        circuit: CIRCUIT,
        round: row.round,
        sessionType: 'race',
        startUtc: germanDateToUtcMidnight(row.date),
        endUtc: null,
        source: 'scrape',
        confidence: 'date-only',
      });

      try {
        const html = await fetchHtml(row.detailUrl);
        const $ = cheerio.load(html);
        const schedule = extractSchedule($);

        if (schedule.length === 0) {
          console.warn(`[nls] kein Zeitplan auf ${row.detailUrl} gefunden, nutze Datum ohne Uhrzeit`);
          sessions.push(dateOnlyFallback());
          continue;
        }

        for (const entry of schedule) {
          sessions.push({
            series: 'nls',
            eventName: row.eventName,
            circuit: CIRCUIT,
            round: row.round,
            sessionType: entry.sessionType,
            startUtc: localTimeToUtcIso(row.date, entry.startTime),
            endUtc: localTimeToUtcIso(row.date, entry.endTime),
            source: 'scrape',
            confidence: 'exact',
          });
        }
      } catch (error) {
        console.warn(
          `[nls] Zeitplan-Scrape für "${row.eventName}" fehlgeschlagen, nutze Datum ohne Uhrzeit:`,
          error instanceof Error ? error.message : error,
        );
        sessions.push(dateOnlyFallback());
      }
    }

    return sessions;
  },
};
