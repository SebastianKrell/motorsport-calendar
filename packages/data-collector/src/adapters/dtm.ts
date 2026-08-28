import * as cheerio from 'cheerio';
import { DateTime } from 'luxon';
import type { Adapter, Session, SessionType } from '../types.js';

const USER_AGENT = 'motorsport-calendar (https://github.com/SebastianKrell/motorsport-calendar)';
const SEASON_YEAR = 2026;
// DTM, ADAC GT Masters und der Porsche Sixt Carrera Cup Deutschland fahren
// ausschließlich in Mitteleuropa (DE/AT/NL/BE/IT) -- alle auf derselben
// CET/CEST-Zeitzone mit gemeinsamem DST-Wechsel, eine einzige IANA-Zone
// reicht deshalb für alle drei Serien (anders als z.B. IMSA/US, s. CLAUDE.md).
const TIMEZONE = 'Europe/Berlin';
// Luxon-Wochentag (1=Montag...7=Sonntag) -> deutsches Kürzel wie auf der Seite.
const WEEKDAY_ABBR: Record<number, string> = { 1: 'Mo', 2: 'Di', 3: 'Mi', 4: 'Do', 5: 'Fr', 6: 'Sa', 7: 'So' };

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status} bei ${url}`);
  return res.text();
}

interface RawSessionRow {
  day: string;
  name: string;
  time: string;
}

interface RawEvent {
  round: number | null;
  circuit: string;
  startIso: string;
  endIso: string;
  sessions: RawSessionRow[];
}

// motorsport-magazin.com veröffentlicht pro Serie EINE Kalenderseite mit
// allen Saison-Events samt vollständigem Zeitplan (Trainings/Qualifyings/
// Rennen je Wochentagskürzel + Uhrzeit) -- anders als die dtm.com-eigene API
// (s. Git-Historie) liefert sie Zeiten schon Monate im Voraus und deckt auch
// die beiden eigenständigen ADAC-GT-Masters-Wochenenden ab, die nicht im
// Rahmen der DTM laufen. Ein gemeinsamer Parser für alle drei Serien, da
// beide Seiten (dtm/adac-gt-masters/porsche-carrera-cup) exakt dasselbe
// HTML-Tabellenschema verwenden.
function parseCalendar(html: string): RawEvent[] {
  const $ = cheerio.load(html);
  const events: RawEvent[] = [];

  $('tr.calendar-event-row').each((_, el) => {
    const row = $(el);
    const eventId = row.attr('data-event-id');
    if (!eventId) return;

    const roundText = row.find('> td').first().text().trim();
    const round = /^\d+$/.test(roundText) ? Number(roundText) : null;
    const circuit = row.find('.calendar-gp a').first().text().trim();
    const times = row.find('.calendar-date time');
    const startIso = times.first().attr('datetime');
    const endIso = times.last().attr('datetime') ?? startIso;
    if (!circuit || !startIso) return;

    const sessions: RawSessionRow[] = [];
    $(`tr.calendar-session-row[data-event-id="${eventId}"]`).each((__, sEl) => {
      const sRow = $(sEl);
      const day = sRow.find('.session-day').first().text().trim();
      const name = sRow.find('.session-name').first().text().trim();
      const time = sRow.find('.session-time').first().text().trim();
      if (day && name && time) sessions.push({ day, name, time });
    });

    events.push({ round, circuit, startIso, endIso: endIso ?? startIso, sessions });
  });

  return events;
}

// "1. Training"/"2. Qualifying"/"Rennen 2" -> fp/quali/race. "Startaufstellung"
// (Grid-Formation) und "Schnellste Runde" sind keine fahrbaren Sessions und
// werden übersprungen.
function classifySessionType(name: string): SessionType | null {
  const lower = name.toLowerCase();
  if (lower.includes('training')) return 'fp';
  if (lower.includes('qualifying')) return 'quali';
  if (/^rennen\b/.test(lower)) return 'race';
  return null;
}

// "10:05 h" -> nur Start; "11:30 - 12:15 h" -> Start und Ende.
function parseTimeRange(time: string): { start: string; end: string | null } {
  const match = time.match(/(\d{2}:\d{2})(?:\s*-\s*(\d{2}:\d{2}))?/);
  if (!match) throw new Error(`Zeit "${time}" nicht erkannt`);
  return { start: match[1], end: match[2] ?? null };
}

// Baut aus Eventfenster (Start-/Enddatum, jeweils Mitternacht mit korrektem
// saisonalen Offset) eine Zuordnung Wochentagskürzel -> tatsächliches Datum,
// um die je Session nur als "Fr"/"Sa"/"So" angegebenen Tage aufzulösen.
function buildDayLookup(startIso: string, endIso: string): Map<string, DateTime> {
  const start = DateTime.fromISO(startIso, { setZone: true }).startOf('day');
  const end = DateTime.fromISO(endIso, { setZone: true }).startOf('day');
  const lookup = new Map<string, DateTime>();
  for (let d = start; d <= end; d = d.plus({ days: 1 })) {
    const abbr = WEEKDAY_ABBR[d.weekday];
    if (abbr) lookup.set(abbr, d);
  }
  return lookup;
}

function localTimeToUtcIso(date: DateTime, time: string): string {
  const [hour, minute] = time.split(':').map(Number);
  // date liefert nur das korrekte Kalenderdatum (aus dem Eventfenster); die
  // Uhrzeit selbst wird bewusst neu mit der IANA-Zone aufgebaut, damit Luxon
  // den richtigen CET/CEST-Offset für genau diesen Tag auflöst statt den
  // festen Offset des Eventfensters weiterzuverwenden.
  return (
    DateTime.fromObject({ year: date.year, month: date.month, day: date.day, hour, minute }, { zone: TIMEZONE })
      .toUTC()
      .toISO() ?? date.toUTC().toISO()!
  );
}

interface AdapterConfig {
  urlSlug: string;
  seriesLabel: string;
  eventNameSuffix: string | null;
}

// DTM behält den schlichten Streckennamen (nameSuffix null), ADAC GT Masters
// und der Porsche Carrera Cup bekommen einen Namenszusatz: sie fahren an
// gemeinsamen Wochenenden auf demselben Circuit wie DTM, sind aber andere
// Rennen -- dedup.ts braucht exakt gleiche Eventnamen, um zwei Sessions als
// Duplikat zu werten, ein Zusatz verhindert also eine fälschliche Dopplung.
async function fetchSessionsFor(config: AdapterConfig): Promise<Session[]> {
  const url = `https://www.motorsport-magazin.com/${config.urlSlug}/rennkalender-${SEASON_YEAR}.html`;
  const html = await fetchHtml(url);
  const rawEvents = parseCalendar(html);
  const sessions: Session[] = [];

  for (const event of rawEvents) {
    const eventName = config.eventNameSuffix ? `${event.circuit} (${config.eventNameSuffix})` : event.circuit;
    const dayLookup = buildDayLookup(event.startIso, event.endIso);

    let addedAny = false;
    for (const raw of event.sessions) {
      const sessionType = classifySessionType(raw.name);
      if (!sessionType) continue;
      const date = dayLookup.get(raw.day);
      if (!date) {
        console.warn(`[${config.seriesLabel}] Wochentag "${raw.day}" bei "${eventName}" nicht im Eventfenster, übersprungen`);
        continue;
      }

      let parsed: { start: string; end: string | null };
      try {
        parsed = parseTimeRange(raw.time);
      } catch {
        console.warn(`[${config.seriesLabel}] Zeit "${raw.time}" bei "${eventName}" nicht erkannt, übersprungen`);
        continue;
      }

      sessions.push({
        series: config.seriesLabel as Session['series'],
        eventName,
        circuit: event.circuit,
        round: event.round,
        sessionType,
        startUtc: localTimeToUtcIso(date, parsed.start),
        endUtc: parsed.end ? localTimeToUtcIso(date, parsed.end) : null,
        source: 'scrape',
        confidence: 'exact',
      });
      addedAny = true;
    }

    // Falls die Seite für ein Event (noch) keinen Zeitplan hat (z.B. weit im
    // Voraus), Datum-ohne-Uhrzeit-Fallback statt das Event ganz auszulassen.
    if (!addedAny) {
      const start = DateTime.fromISO(event.startIso, { setZone: true });
      sessions.push({
        series: config.seriesLabel as Session['series'],
        eventName,
        circuit: event.circuit,
        round: event.round,
        sessionType: 'race',
        startUtc: start.toUTC().toISO()!,
        endUtc: null,
        source: 'scrape',
        confidence: 'date-only',
      });
    }
  }

  return sessions;
}

export const dtmAdapter: Adapter = {
  series: 'dtm',
  async fetchSessions(): Promise<Session[]> {
    return fetchSessionsFor({ urlSlug: 'dtm', seriesLabel: 'dtm', eventNameSuffix: null });
  },
};

export const adacGtMastersAdapter: Adapter = {
  series: 'adac_gt_masters',
  async fetchSessions(): Promise<Session[]> {
    return fetchSessionsFor({
      urlSlug: 'adac-gt-masters',
      seriesLabel: 'adac_gt_masters',
      eventNameSuffix: 'ADAC GT Masters',
    });
  },
};

export const porscheCarreraCupAdapter: Adapter = {
  series: 'porsche_carrera_cup_de',
  async fetchSessions(): Promise<Session[]> {
    return fetchSessionsFor({
      urlSlug: 'porsche-carrera-cup',
      seriesLabel: 'porsche_carrera_cup_de',
      eventNameSuffix: 'Porsche Carrera Cup',
    });
  },
};
