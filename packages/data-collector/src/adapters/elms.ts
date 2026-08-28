import type { Adapter, Session, SessionType } from '../types.js';

const USER_AGENT = 'motorsport-calendar (https://github.com/SebastianKrell/motorsport-calendar)';
// Season-Übersichtsseite listet auch schon Termine der Folgesaison -- wir
// filtern per Slug-Endung "-2026" (s. fetchSeasonRaceUrls). europeanlemans
// series.com läuft, wie fiawec.com, auf der ACO-Plattform mit identischer
// schema.org-JSON-LD-Struktur.
const SEASON_URL = 'https://www.europeanlemansseries.com/en/season/2026';
const RACE_URL_REGEX = /href="(\/en\/race\/[a-z0-9-]+-2026)"/g;

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status} bei ${url}`);
  return res.text();
}

// "Official Tests Barcelona" ist ein Testtag ohne Meisterschaftspunkte und
// hat keinen eigenen Sender-Fokus -- bewusst ausgelassen.
async function fetchSeasonRaceUrls(): Promise<string[]> {
  const html = await fetchHtml(SEASON_URL);
  const urls = new Set<string>();
  for (const match of html.matchAll(RACE_URL_REGEX)) {
    if (match[1].includes('test')) continue;
    urls.add(`https://www.europeanlemansseries.com${match[1]}`);
  }
  return [...urls];
}

interface RawSubEvent {
  name: string;
  startDate: string;
}

interface RawSportsEvent {
  '@type': string;
  name: string;
  location?: { name?: string };
  subEvent?: RawSubEvent[];
}

// Wie fiawec.com bettet auch europeanlemansseries.com den kompletten
// Zeitplan als schema.org-JSON-LD ein (ein <script type="application/ld+
// json"> pro Event mit "subEvent"-Array je Session, "startDate" bereits mit
// korrektem lokalem Offset statt UTC -- Date-Parsing macht die Umrechnung).
function extractSportsEvent(html: string): RawSportsEvent | null {
  const scriptRegex = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  for (const match of html.matchAll(scriptRegex)) {
    try {
      const parsed = JSON.parse(match[1]) as RawSportsEvent;
      if (parsed['@type'] === 'SportsEvent' && Array.isArray(parsed.subEvent)) {
        return parsed;
      }
    } catch {
      // anderer JSON-LD-Block (z.B. BreadcrumbList), ignorieren
    }
  }
  return null;
}

// "Qualifying - LMP2 - 4 Hours of Imola" -> Label "Qualifying - LMP2",
// Eventtitel "4 Hours of Imola" (letztes Segment, konsistent über alle
// subEvents desselben Rennens).
function splitLabelAndEventTitle(subEventName: string): { label: string; eventTitle: string } {
  const parts = subEventName.split(' - ');
  const eventTitle = parts[parts.length - 1];
  const label = parts.slice(0, -1).join(' - ');
  return { label, eventTitle };
}

function classifySession(label: string): SessionType | null {
  const lower = label.toLowerCase();
  if (lower.startsWith('free practice') || lower.startsWith('warm-up') || lower.startsWith('warmup')) return 'fp';
  if (lower.startsWith('qualifying') || lower.startsWith('hyperpole')) return 'quali';
  if (lower.startsWith('race')) return 'race';
  return null;
}

// ELMS fährt pro Klasse (LMP2, LMP2 PRO/AM, LMP3, LMGT3) eigene Qualifyings
// -- ohne Klassenzusatz im Namen sähen die mehreren "quali"-Zeilen wie
// Duplikate aus.
function classSuffix(label: string): string {
  const withoutPrefix = label.replace(/^(Qualifying|Hyperpole)(\s+\d+)?\s*-\s*/i, '');
  return withoutPrefix === label ? '' : ` (${withoutPrefix})`;
}

// ELMS-Rennen sind bisher alle 4h ("4 Hours of Imola") -- Regex statt
// Hardcoding, falls sich das künftig ändert (z.B. Le Castellet war zeitweise
// kürzer).
function raceDurationHours(eventTitle: string): number | null {
  const match = eventTitle.match(/(\d+)\s*Hours?/i);
  return match ? Number(match[1]) : null;
}

export const elmsAdapter: Adapter = {
  series: 'elms',
  async fetchSessions(): Promise<Session[]> {
    const raceUrls = await fetchSeasonRaceUrls();
    const sessions: Session[] = [];

    for (const url of raceUrls) {
      try {
        const html = await fetchHtml(url);
        const event = extractSportsEvent(html);
        if (!event?.subEvent) {
          console.warn(`[elms] kein JSON-LD-Zeitplan auf ${url} gefunden, überspringe`);
          continue;
        }

        const circuit = event.location?.name ?? '';

        for (const subEvent of event.subEvent) {
          const { label, eventTitle } = splitLabelAndEventTitle(subEvent.name);
          const sessionType = classifySession(label);
          if (!sessionType) {
            console.warn(`[elms] unbekannter Session-Typ "${label}" bei "${eventTitle}", übersprungen`);
            continue;
          }

          const startUtc = new Date(subEvent.startDate).toISOString();
          const durationHours = sessionType === 'race' ? raceDurationHours(eventTitle) : null;
          const endUtc = durationHours
            ? new Date(new Date(subEvent.startDate).getTime() + durationHours * 60 * 60 * 1000).toISOString()
            : null;

          sessions.push({
            series: 'elms',
            eventName: `${eventTitle}${classSuffix(label)}`,
            circuit,
            round: null,
            sessionType,
            startUtc,
            endUtc,
            source: 'scrape',
            confidence: 'exact',
          });
        }
      } catch (error) {
        console.warn(`[elms] Scrape von ${url} fehlgeschlagen:`, error instanceof Error ? error.message : error);
      }
    }

    return sessions;
  },
};
