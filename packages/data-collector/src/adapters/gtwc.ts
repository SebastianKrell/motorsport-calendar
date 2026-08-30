import type { Adapter, Session, SessionType, SeriesId } from '../types.js';

const USER_AGENT = 'motorsport-calendar (https://github.com/SebastianKrell/motorsport-calendar)';
const EVENT_URL_REGEX = /href="(\/event\/\d+\/[^"]+)"/g;

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status} bei ${url}`);
  return res.text();
}

async function fetchEventUrls(baseUrl: string): Promise<string[]> {
  const html = await fetchHtml(`${baseUrl}/calendar`);
  const urls = new Set<string>();
  for (const match of html.matchAll(EVENT_URL_REGEX)) {
    urls.add(`${baseUrl}${match[1]}`);
  }
  return [...urls];
}

interface EventInfo {
  name: string;
  circuit: string;
  round: number | null;
  raceDate: string;
  startMonth: number;
  startYear: number;
}

export interface GtwcSite {
  baseUrl: string;
  eventNameSuffix?: string;
  dateOnlyFallback?: boolean;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&uuml;/g, 'ü')
    .replace(/&auml;/g, 'ä')
    .replace(/&ouml;/g, 'ö')
    .replace(/&atilde;/g, 'ã')
    .replace(/&amp;/g, '&');
}

function fallbackCircuit(eventName: string): string {
  if (/^Indianapolis 8 Hour$/i.test(eventName)) return 'Indianapolis Motor Speedway';
  return eventName;
}

// Die "Event"-JSON-LD auf der Detailseite enthält nur Start-/Enddatum ohne
// Uhrzeit ("startDate": "2026-08-28") -- die eigentlichen Session-Zeiten
// stehen in der separaten HTML-Timetable weiter unten (s. extractSchedule).
// "description" liefert "<Serie>, Round <N>, <Name>, <Land>" (teils "Round
// <N> & <M>" bei Doppelrennwochenenden in Asien/Australien -- hier reicht
// die erste Rundennummer, das Feld dient nur zur Test-/Nicht-Punkterennen-
// Erkennung, s.u.) -- reine Test-/Show-Events (z.B. "Official Test Days",
// "2026 End of Year Gala") haben keine Rundennummer und werden anhand
// dessen ausgelassen, da sie keine Meisterschaftspunkte geben.
function extractEventInfo(html: string): EventInfo | null {
  const scriptMatch = html.match(
    /<script type="application\/ld\+json">\s*\{\s*"@context":\s*"https?:\/\/schema\.org",?\s*"@type":\s*"Event"[\s\S]*?\}\s*<\/script>/,
  );
  if (!scriptMatch) return null;

  const nameMatch = scriptMatch[0].match(/"name":\s*"([^"]*)"/);
  const startDateMatch = scriptMatch[0].match(/"startDate":\s*"(\d{4})-(\d{2})-(\d{2})"/);
  const endDateMatch = scriptMatch[0].match(/"endDate":\s*"(\d{4}-\d{2}-\d{2})"/);
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
  // zurückfallen, der bei unbranded Events (z.B. "Nürburgring", "Sepang
  // International Circuit") ohnehin schon der Circuit-Name ist.
  const locationCircuit = decodeHtmlEntities(locationNameMatch?.[1] ?? '').split(',')[0]?.trim();

  return {
    name,
    circuit: locationCircuit || fallbackCircuit(name),
    round: roundMatch ? Number(roundMatch[1]) : null,
    raceDate: endDateMatch?.[1] ?? `${startDateMatch[1]}-${startDateMatch[2]}-${startDateMatch[3]}`,
    startYear: Number(startDateMatch[1]),
    startMonth: Number(startDateMatch[2]),
  };
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
  month: number; // 1-12, lokaler Kalendertag laut Caption
  localMinutes: number; // Minuten seit Mitternacht, lokale Zeit
  gmtHour: number;
  gmtMinute: number;
}

// Sessions ohne eigenen fahrbaren Inhalt (Pit Walk, Parade, Autogrammstunde,
// Test-/Bronze-Sessions) sind für die Sender-Frage irrelevant und werden
// ausgelassen. Rein Keyword-basiert statt exakter Labelliste, da sich die
// Bezeichnungen zwischen den Regionen leicht unterscheiden (z.B. "Free
// Practice 1" in Europa vs. "Practice 1" in USA/Asien/Australien, "Pre-
// Qualifying" in Asien, "Superpole" in Europa) -- funktioniert dadurch
// automatisch für alle GTWC-Regionalseiten, IGTC und British GT.
function classifySession(label: string): SessionType | null {
  const lower = label.toLowerCase();
  // SRO führt bei manchen Endurance-Rennen Zwischenstände wie "Main Race
  // after 0.5 h" als eigene Tabellenzeile. Das ist kein zweiter Rennstart.
  if (/test|pit walk|parade|autograph|grid walk|\bafter\s+\d+(?:\.\d+)?\s*h\b/.test(lower)) return null;
  if (/practice/.test(lower)) return 'fp';
  if (/qualify(?:ing)?|superpole|shootout/.test(lower)) return 'quali';
  if (/warm[\s-]?up/.test(lower)) return 'fp';
  if (/race/.test(lower)) return 'race';
  return null;
}

// Europa/Asien/Australien nutzen 24h-Format ("HH:mm"), die US-Seite ("USA
// Central") ein 12h-Format mit am/pm ("hh:mm am"). Beides in Minuten seit
// Mitternacht umrechnen, damit der Rest der Logik zeitzonenformat-
// unabhängig bleibt.
function parseClockTimeToMinutes(raw: string): number | null {
  const match = raw.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3]?.toLowerCase();
  if (meridiem === 'pm' && hour !== 12) hour += 12;
  if (meridiem === 'am' && hour === 12) hour = 0;
  return hour * 60 + minute;
}

// Jede Timetable-Tabelle (eine pro Veranstaltungstag) hat eine Caption wie
// "Friday, 28 August" (kein Jahr) -- Session-Zeilen bestehen aus Label,
// lokale Zeit, GMT.
function extractSchedule(html: string): ScheduleEntry[] {
  const entries: ScheduleEntry[] = [];
  const tableRegex =
    /<caption class="timetable__caption">\s*<span>([^<]+)<\/span>\s*<\/caption>[\s\S]*?<tbody class="timetable__table-body">([\s\S]*?)<\/tbody>/g;

  for (const tableMatch of html.matchAll(tableRegex)) {
    const captionMatch = tableMatch[1].match(/(\d{1,2})\s+([A-Za-z]+)/);
    if (!captionMatch) continue;
    const day = Number(captionMatch[1]);
    const month = MONTH_NAMES.indexOf(captionMatch[2].toLowerCase()) + 1;
    if (month === 0) continue;

    const rowRegex = /<td>([^<]*)<\/td>\s*<td>\s*([\d:apm\s]+?)\s*<\/td>\s*<td>\s*([\d:apm\s]+?)\s*<\/td>/gi;
    for (const rowMatch of tableMatch[2].matchAll(rowRegex)) {
      const [, label, localTimeRaw, gmtTimeRaw] = rowMatch;
      const sessionType = classifySession(label.trim());
      if (!sessionType) continue;

      const localMinutes = parseClockTimeToMinutes(localTimeRaw);
      const gmtMinutes = parseClockTimeToMinutes(gmtTimeRaw);
      if (localMinutes === null || gmtMinutes === null) continue;

      entries.push({
        sessionType,
        day,
        month,
        localMinutes,
        gmtHour: Math.floor(gmtMinutes / 60),
        gmtMinute: gmtMinutes % 60,
      });
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

// GMT-Zeit kann vor/nach dem lokalen Kalendertag der Caption liegen (z.B.
// USA: später Local-Abend + positiver Offset -> GMT schon "am nächsten Tag";
// Asien/Australien: früher Local-Morgen + negativer Offset -> GMT noch "am
// Vortag"). Ein Tagesversatz von mehr als 12h zwischen lokaler Minute und
// GMT-Minute (beide "seit Mitternacht" desselben Kalendertags gerechnet)
// zeigt so einen Tagesumbruch zuverlässig an, ganz ohne die tatsächliche
// Zeitzone des jeweiligen Austragungsorts zu kennen.
function resolveStartUtc(entry: ScheduleEntry, event: EventInfo): string {
  const year = resolveYear(entry.month, event);
  const gmtMinutesOfDay = entry.gmtHour * 60 + entry.gmtMinute;
  const diff = gmtMinutesOfDay - entry.localMinutes;
  const dayOffset = diff < -720 ? 1 : diff > 720 ? -1 : 0;

  const date = new Date(Date.UTC(year, entry.month - 1, entry.day + dayOffset, entry.gmtHour, entry.gmtMinute));
  return date.toISOString();
}

// "24 Hours of Spa" -> 24h Renndauer für endUtc; alle anderen Events (reine
// Streckennamen ohne Stundenangabe) bleiben ohne endUtc -- lieber keine
// Endzeit als eine geratene (s. CLAUDE.md Konventionen).
function raceDurationHours(eventName: string): number | null {
  const match = eventName.match(/(\d+)\s*Hours?/i);
  return match ? Number(match[1]) : null;
}

// Alle GTWC-Regionalseiten (Europe/America/Asia/Australia), IGTC und British GT
// laufen auf derselben SRO-CMS-Vorlage: Kalenderseite mit Event-Links,
// Event-Detailseite mit schema.org-JSON-LD (Datum, Rundennummer, Circuit) plus
// separater HTML-Timetable (Label, lokale Zeit, GMT) -- ein gemeinsamer Adapter
// reicht, parametrisiert nur über Serie und Basis-URL.
function dateOnlyRace(series: SeriesId, event: EventInfo, eventNameSuffix?: string): Session {
  return {
    series,
    eventName: `${event.name}${eventNameSuffix ?? ''}`,
    circuit: event.circuit,
    round: event.round,
    sessionType: 'race',
    startUtc: `${event.raceDate}T00:00:00.000Z`,
    endUtc: null,
    source: 'scrape',
    confidence: 'date-only',
  };
}

async function fetchSiteSessions(series: SeriesId, site: GtwcSite): Promise<Session[]> {
  const eventUrls = await fetchEventUrls(site.baseUrl);
  const sessions: Session[] = [];

  for (const url of eventUrls) {
    try {
      const html = await fetchHtml(url);
      const event = extractEventInfo(html);
      if (!event) {
        console.warn(`[${series}] kein Event-JSON-LD auf ${url} gefunden, überspringe`);
        continue;
      }
      // Test-/Show-Events (z.B. "Official Test Days", "End of Year
      // Gala") haben keine Rundennummer und sind keine
      // Meisterschaftsrennen -- bewusst ausgelassen.
      if (event.round === null) continue;

      const schedule = extractSchedule(html);
      const isPlaceholder = schedule.length === 1 && schedule[0].localMinutes === 0;
      if (schedule.length === 0 || isPlaceholder) {
        const reason = isPlaceholder ? 'nur Platzhalter-Timetable' : 'keine Timetable';
        if (site.dateOnlyFallback) {
          sessions.push(dateOnlyRace(series, event, site.eventNameSuffix));
        } else {
          console.warn(`[${series}] ${reason} auf ${url} gefunden, überspringe`);
        }
        continue;
      }

      const durationHours = raceDurationHours(event.name);

      for (const entry of schedule) {
        const startUtc = resolveStartUtc(entry, event);
        const endUtc =
          entry.sessionType === 'race' && durationHours
            ? new Date(new Date(startUtc).getTime() + durationHours * 60 * 60 * 1000).toISOString()
            : null;

        sessions.push({
          series,
          eventName: `${event.name}${site.eventNameSuffix ?? ''}`,
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
      console.warn(`[${series}] Scrape von ${url} fehlgeschlagen:`, error instanceof Error ? error.message : error);
    }
  }

  return sessions;
}

export function createGtwcAdapter(series: SeriesId, baseUrl: string): Adapter {
  return createCombinedGtwcAdapter(series, [{ baseUrl }]);
}

export function createCombinedGtwcAdapter(series: SeriesId, sites: GtwcSite[]): Adapter {
  return {
    series,
    async fetchSessions(): Promise<Session[]> {
      const sessions = (await Promise.all(sites.map((site) => fetchSiteSessions(series, site)))).flat();
      if (sessions.length === 0) throw new Error('Keine SRO-Sessions gefunden');
      return sessions;
    },
  };
}
