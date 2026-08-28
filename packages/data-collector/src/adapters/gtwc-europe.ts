import type { Adapter, Session, SessionType } from '../types.js';

const USER_AGENT = 'motorsport-calendar (https://github.com/SebastianKrell/motorsport-calendar)';
const CALENDAR_URL = 'https://www.gt-world-challenge-europe.com/calendar';
const EVENT_URL_REGEX = /href="(\/event\/\d+\/[^"]+)"/g;

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status} bei ${url}`);
  return res.text();
}

async function fetchEventUrls(): Promise<string[]> {
  const html = await fetchHtml(CALENDAR_URL);
  const urls = new Set<string>();
  for (const match of html.matchAll(EVENT_URL_REGEX)) {
    urls.add(`https://www.gt-world-challenge-europe.com${match[1]}`);
  }
  return [...urls];
}

interface EventInfo {
  name: string;
  circuit: string;
  round: number | null;
  startMonth: number;
  startYear: number;
}

// Die "Event"-JSON-LD auf der Detailseite enthält nur Start-/Enddatum ohne
// Uhrzeit ("startDate": "2026-08-28") -- die eigentlichen Session-Zeiten
// stehen in der separaten HTML-Timetable weiter unten (s. extractSchedule).
// "description" liefert "<Serie>, Round <N>, <Name>, <Land>" -- reine Test-
// Events (z.B. "Official Test Days - Prologue") haben keine Rundennummer und
// werden anhand dessen ausgelassen, da sie keine Meisterschaftspunkte geben.
function extractEventInfo(html: string): EventInfo | null {
  const scriptMatch = html.match(/<script type="application\/ld\+json">\s*\{\s*"@context":\s*"https?:\/\/schema\.org",?\s*"@type":\s*"Event"[\s\S]*?\}\s*<\/script>/);
  if (!scriptMatch) return null;

  const nameMatch = scriptMatch[0].match(/"name":\s*"([^"]*)"/);
  const startDateMatch = scriptMatch[0].match(/"startDate":\s*"(\d{4})-(\d{2})-(\d{2})"/);
  const descriptionMatch = scriptMatch[0].match(/"description":\s*"([^"]*)"/);
  const locationNameMatch = scriptMatch[0].match(/"location":\s*\{[^}]*?"name":\s*"([^"]*)"/);
  if (!nameMatch || !startDateMatch) return null;

  const roundMatch = descriptionMatch?.[1].match(/Round (\d+)/);
  const name = decodeHtmlEntities(nameMatch[1]).trim();
  // "location.name" ist meist "<Circuit>, <Land>" (z.B. "Spa-Francorchamps,
  // Belgium") -- wichtig für den branded Event-Namen "CrowdStrike 24 Hours
  // of Spa", damit die Cross-Series-Dedup mit IGTC (die denselben Circuit-
  // Namen aus einem anderen Feed liefert) greift. Bei manchen Events ist das
  // Feld datenseitig leer (nur ", Land") -- dann auf den Eventnamen selbst
  // zurückfallen, der bei unbranded Events (z.B. "Nürburgring") ohnehin
  // schon der Circuit-Name ist.
  const locationCircuit = decodeHtmlEntities(locationNameMatch?.[1] ?? '').split(',')[0]?.trim();

  return {
    name,
    circuit: locationCircuit || name,
    round: roundMatch ? Number(roundMatch[1]) : null,
    startYear: Number(startDateMatch[1]),
    startMonth: Number(startDateMatch[2]),
  };
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&uuml;/g, 'ü')
    .replace(/&auml;/g, 'ä')
    .replace(/&ouml;/g, 'ö')
    .replace(/&amp;/g, '&');
}

const MONTH_NAMES = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

interface ScheduleEntry {
  sessionType: SessionType;
  day: number;
  month: number; // 1-12
  gmtTime: string; // HH:mm, bereits UTC
}

// Sessions ohne eigenen fahrbaren Inhalt (Pit Walk, Spa Parade, Bronze-/
// Testsessions) sind für die Sender-Frage irrelevant und werden ausgelassen.
function classifySession(label: string): SessionType | null {
  const lower = label.toLowerCase();
  if (/test|pit walk|parade/.test(lower)) return null;
  if (/practice/.test(lower)) return 'fp';
  if (/qualifying|superpole/.test(lower)) return 'quali';
  if (/warm-?up/.test(lower)) return 'fp';
  if (/race/.test(lower)) return 'race';
  return null;
}

// Jede Timetable-Tabelle (eine pro Veranstaltungstag) hat eine Caption wie
// "Friday, 28 August" (kein Jahr) -- Session-Zeilen bestehen aus Label,
// Local Time, GMT. Die GMT-Spalte ist bereits UTC, ein manuelles
// Zeitzonen-Mapping wie bei NLS (Europe/Berlin) entfällt hier.
function extractSchedule(html: string): ScheduleEntry[] {
  const entries: ScheduleEntry[] = [];
  const tableRegex = /<caption class="timetable__caption">\s*<span>([^<]+)<\/span>\s*<\/caption>[\s\S]*?<tbody class="timetable__table-body">([\s\S]*?)<\/tbody>/g;

  for (const tableMatch of html.matchAll(tableRegex)) {
    const captionMatch = tableMatch[1].match(/(\d{1,2})\s+([A-Za-z]+)/);
    if (!captionMatch) continue;
    const day = Number(captionMatch[1]);
    const month = MONTH_NAMES.indexOf(captionMatch[2].toLowerCase()) + 1;
    if (month === 0) continue;

    const rowRegex = /<td>([^<]*)<\/td>\s*<td>(\d{2}:\d{2})<\/td>\s*<td>(\d{2}:\d{2})<\/td>/g;
    for (const rowMatch of tableMatch[2].matchAll(rowRegex)) {
      const [, label, , gmtTime] = rowMatch;
      const sessionType = classifySession(label.trim());
      if (!sessionType) continue;
      entries.push({ sessionType, day, month, gmtTime });
    }
  }

  return entries;
}

// Caption nennt kein Jahr. Ein Event läuft nie über einen Jahreswechsel,
// aber ggf. über einen Monatswechsel (z.B. Ende April/Anfang Mai) -- daher
// Jahr am Startmonat des Events ausrichten statt pauschal zu übernehmen.
function resolveYear(sessionMonth: number, event: EventInfo): number {
  return sessionMonth < event.startMonth ? event.startYear + 1 : event.startYear;
}

// "24 Hours of Spa" -> 24h Renndauer für endUtc; alle anderen Events (reine
// Streckennamen ohne Stundenangabe) bleiben ohne endUtc -- lieber keine
// Endzeit als eine geratene (s. CLAUDE.md Konventionen).
function raceDurationHours(eventName: string): number | null {
  const match = eventName.match(/(\d+)\s*Hours?/i);
  return match ? Number(match[1]) : null;
}

export const gtwcEuropeAdapter: Adapter = {
  series: 'gtwc_europe',
  async fetchSessions(): Promise<Session[]> {
    const eventUrls = await fetchEventUrls();
    const sessions: Session[] = [];

    for (const url of eventUrls) {
      try {
        const html = await fetchHtml(url);
        const event = extractEventInfo(html);
        if (!event) {
          console.warn(`[gtwc_europe] kein Event-JSON-LD auf ${url} gefunden, überspringe`);
          continue;
        }
        // Test-Events (z.B. "Official Test Days") haben keine Rundennummer
        // und sind keine Meisterschaftsrennen -- bewusst ausgelassen.
        if (event.round === null) continue;

        const schedule = extractSchedule(html);
        if (schedule.length === 0) {
          console.warn(`[gtwc_europe] keine Timetable auf ${url} gefunden, überspringe`);
          continue;
        }

        const durationHours = raceDurationHours(event.name);

        for (const entry of schedule) {
          const year = resolveYear(entry.month, event);
          const startUtc = `${year}-${String(entry.month).padStart(2, '0')}-${String(entry.day).padStart(2, '0')}T${entry.gmtTime}:00.000Z`;
          const endUtc =
            entry.sessionType === 'race' && durationHours
              ? new Date(new Date(startUtc).getTime() + durationHours * 60 * 60 * 1000).toISOString()
              : null;

          sessions.push({
            series: 'gtwc_europe',
            eventName: event.name,
            circuit: event.circuit,
            round: event.round,
            sessionType: entry.sessionType,
            startUtc,
            endUtc,
            source: 'scrape',
            confidence: 'exact',
          });
        }
      } catch (error) {
        console.warn(`[gtwc_europe] Scrape von ${url} fehlgeschlagen:`, error instanceof Error ? error.message : error);
      }
    }

    return sessions;
  },
};
