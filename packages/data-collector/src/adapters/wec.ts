import ical from 'node-ical';
import type { ParameterValue } from 'node-ical';
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

interface RawSportsEvent {
  '@type': string;
  name: string;
  location?: { name?: string };
}

// Das JSON-LD liefert zuverlässige Event-Metadaten, seine Session-Zeiten sind
// jedoch fälschlich mit dem europäischen Seiten-Offset ausgezeichnet. Für die
// Zeiten wird deshalb der offizielle ICS-Export verwendet (s. unten).
function extractSportsEvent(html: string): RawSportsEvent | null {
  const scriptRegex = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  for (const match of html.matchAll(scriptRegex)) {
    try {
      const parsed = JSON.parse(match[1]) as RawSportsEvent;
      if (parsed['@type'] === 'SportsEvent') {
        return parsed;
      }
    } catch {
      // anderer JSON-LD-Block (z.B. BreadcrumbList), ignorieren
    }
  }
  return null;
}

function extractCalendarUrl(html: string): string | null {
  const match = html.match(/href="(\/en\/race\/calendar\/\d+)"/);
  return match ? `https://www.fiawec.com${match[1]}` : null;
}

function textValue(value: ParameterValue<string> | undefined): string {
  if (!value) return '';
  return typeof value === 'string' ? value : value.val;
}

// ICS-Summaries folgen "<Event> - <Session>", wobei Qualifying und Hyperpole
// noch die Klasse als weiteres Segment tragen.
function splitEventTitleAndLabel(summary: string): { eventTitle: string; label: string } | null {
  const match = summary.match(/^(.*?) - ((?:Free Practice|Warm-?up|Qualifying|Hyperpole|Race).*)$/i);
  return match ? { eventTitle: match[1].trim(), label: match[2].trim() } : null;
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

export const wecAdapter: Adapter = {
  series: 'wec',
  async fetchSessions(): Promise<Session[]> {
    const raceUrls = await fetchSeasonRaceUrls();
    const sessions: Session[] = [];

    for (const url of raceUrls) {
      try {
        const html = await fetchHtml(url);
        const event = extractSportsEvent(html);
        if (!event) {
          console.warn(`[wec] keine JSON-LD-Eventdaten auf ${url} gefunden, überspringe`);
          continue;
        }
        const calendarUrl = extractCalendarUrl(html);
        if (!calendarUrl) {
          console.warn(`[wec] kein offizieller Kalenderexport auf ${url} gefunden, überspringe`);
          continue;
        }

        const circuit = event.location?.name ?? '';
        const calendar = ical.sync.parseICS(await fetchHtml(calendarUrl));

        for (const component of Object.values(calendar)) {
          if (!component || component.type !== 'VEVENT') continue;
          const parsedSummary = splitEventTitleAndLabel(textValue(component.summary));
          if (!parsedSummary) continue;
          const { label, eventTitle } = parsedSummary;
          const sessionType = classifySession(label);
          if (!sessionType) {
            console.warn(`[wec] unbekannter Session-Typ "${label}" bei "${eventTitle}", übersprungen`);
            continue;
          }

          sessions.push({
            series: 'wec',
            eventName: `${eventTitle}${classSuffix(label)}`,
            circuit,
            round: null,
            sessionType,
            startUtc: component.start.toISOString(),
            endUtc: component.end?.toISOString() ?? null,
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
