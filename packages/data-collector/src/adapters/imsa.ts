import ical from 'node-ical';
import type { CalendarResponse, FetchOptions, ParameterValue } from 'node-ical';
import type { Adapter, Session, SessionType } from '../types.js';

const USER_AGENT = 'motorsport-calendar (https://github.com/SebastianKrell/motorsport-calendar)';
// imsa.com selbst ist per Cloudflare-JS-Challenge gegen Bots abgesichert
// (kein normaler Fetch möglich, s. CLAUDE.md). raceweek.io bietet stattdessen
// einen öffentlichen ICS-Export mit echten UTC-Zeiten pro Session.
const ICS_URL = 'https://raceweek.io/ical/imsa.ics';

const fetchIcs = ical.async.fromURL as (url: string, options?: FetchOptions) => Promise<CalendarResponse>;

function textValue(value: ParameterValue<string> | undefined): string {
  if (!value) return '';
  return typeof value === 'string' ? value : value.val;
}

// SUMMARY-Format: "IMSA — <Event> — <Session-Label>", wobei das Label selbst
// wieder " — " enthalten kann (z.B. "Rolex 24 — Part 3") -- deshalb nur an
// den ersten zwei Trennern splitten, den Rest als Label zusammenfügen.
function parseSummary(summary: string): { eventName: string; label: string } {
  const parts = summary.split(' — ');
  const eventName = parts[1]?.trim() ?? summary;
  const label = parts.slice(2).join(' — ').trim();
  return { eventName, label: label || eventName };
}

// raceweek.io nutzt laut Sichtung nur drei Kategorien (practice/quali/race).
// "Race" taucht im Label oft nicht wörtlich auf (z.B. "Petit Le Mans",
// "Rolex 24 — Part 3" *ist* schon der Rennname) -- daher 'race' als Default
// für alles, was nicht klar Practice/Test/Warm-up oder Qualifying ist.
function classifySessionLabel(label: string): SessionType {
  const lower = label.toLowerCase();
  if (/practice|test|warm-?up/.test(lower)) return 'fp';
  if (/quali/.test(lower)) return 'quali';
  return 'race';
}

export const imsaAdapter: Adapter = {
  series: 'imsa',
  async fetchSessions(): Promise<Session[]> {
    const data = await fetchIcs(ICS_URL, { headers: { 'User-Agent': USER_AGENT } });
    const sessions: Session[] = [];

    for (const component of Object.values(data)) {
      if (!component || component.type !== 'VEVENT') continue;

      const { eventName, label } = parseSummary(textValue(component.summary));

      sessions.push({
        series: 'imsa',
        eventName,
        circuit: textValue(component.location),
        round: null,
        sessionType: classifySessionLabel(label),
        startUtc: component.start.toISOString(),
        endUtc: component.end ? component.end.toISOString() : null,
        source: 'ics',
        confidence: 'exact',
      });
    }

    return sessions;
  },
};
