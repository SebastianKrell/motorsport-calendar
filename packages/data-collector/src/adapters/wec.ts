import type { Adapter, Session, SessionType } from '../types.js';

const USER_AGENT = 'motorsport-calendar (https://github.com/SebastianKrell/motorsport-calendar)';
// Season-Übersichtsseite listet auch schon Termine der Folgesaison -- wir
// filtern per Slug-Endung "-2026" (s. fetchSeasonRaceUrls).
const SEASON_URL = 'https://www.fiawec.com/en/season/2026';
const RACE_URL_REGEX = /href="(\/en\/race\/[a-z0-9-]+-2026)"/g;

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status} bei ${url}`);
  return res.text();
}

// Der "Official Prologue" ist ein Testtag ohne Meisterschaftspunkte (s.
// CLAUDE.md: "alle 8 Saisonrennen") und hat keinen eigenen Sender-Fokus --
// bewusst ausgelassen.
async function fetchSeasonRaceUrls(): Promise<string[]> {
  const html = await fetchHtml(SEASON_URL);
  const urls = new Set<string>();
  for (const match of html.matchAll(RACE_URL_REGEX)) {
    if (match[1].includes('prologue')) continue;
    urls.add(`https://www.fiawec.com${match[1]}`);
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

// fiawec.com bettet den kompletten Zeitplan als schema.org-JSON-LD ein (ein
// <script type="application/ld+json"> pro Event mit "subEvent"-Array je
// Session) -- deutlich robuster als HTML-Struktur-Scraping.
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

// "Qualifying - LMGT3 - 6 Hours of Imola" -> Label "Qualifying - LMGT3",
// Eventtitel "6 Hours of Imola" (letztes Segment, konsistent über alle
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

// Bei Le Mans gibt es pro Klasse (HYPERCAR, LMGT3, teils "LMP2 & LMGT3")
// eigene Qualifying-/Hyperpole-Sessions -- ohne Klassenzusatz im Namen sähen
// die mehreren "quali"-Zeilen wie Duplikate aus.
function classSuffix(label: string): string {
  const withoutPrefix = label.replace(/^(Qualifying|Hyperpole)(\s+\d+)?\s*-\s*/i, '');
  return withoutPrefix === label ? '' : ` (${withoutPrefix})`;
}

// "6 Hours of Imola" -> 6, "24 Hours of Le Mans" -> 24. Für Events ohne
// Stundenangabe (z.B. "Qatar 1812km") bleibt die Dauer unbekannt -- dann
// lieber kein endUtc als eine geratene Dauer.
function raceDurationHours(eventTitle: string): number | null {
  const match = eventTitle.match(/(\d+)\s*Hours?/i);
  return match ? Number(match[1]) : null;
}

export const wecAdapter: Adapter = {
  series: 'wec',
  async fetchSessions(): Promise<Session[]> {
    const raceUrls = await fetchSeasonRaceUrls();
    const sessions: Session[] = [];

    for (const url of raceUrls) {
      try {
        const html = await fetchHtml(url);
        const event = extractSportsEvent(html);
        if (!event?.subEvent) {
          console.warn(`[wec] kein JSON-LD-Zeitplan auf ${url} gefunden, überspringe`);
          continue;
        }

        const circuit = event.location?.name ?? '';

        for (const subEvent of event.subEvent) {
          const { label, eventTitle } = splitLabelAndEventTitle(subEvent.name);
          const sessionType = classifySession(label);
          if (!sessionType) {
            console.warn(`[wec] unbekannter Session-Typ "${label}" bei "${eventTitle}", übersprungen`);
            continue;
          }

          const startUtc = new Date(subEvent.startDate).toISOString();
          const durationHours = sessionType === 'race' ? raceDurationHours(eventTitle) : null;
          const endUtc = durationHours
            ? new Date(new Date(subEvent.startDate).getTime() + durationHours * 60 * 60 * 1000).toISOString()
            : null;

          sessions.push({
            series: 'wec',
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
        console.warn(`[wec] Scrape von ${url} fehlgeschlagen:`, error instanceof Error ? error.message : error);
      }
    }

    return sessions;
  },
};
