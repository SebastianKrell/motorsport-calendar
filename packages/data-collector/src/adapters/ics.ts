import ical from 'node-ical';
import type { CalendarResponse, FetchOptions, ParameterValue } from 'node-ical';
import type { Adapter, SeriesId, Session } from '../types.js';

const USER_AGENT = 'motorsport-calendar (https://github.com/SebastianKrell/motorsport-calendar)';

// node-icals Typdeklarationen decken die Kombination Promise-Rückgabe +
// Options-Argument nicht ab (die Overloads mit Options sind callback-basiert
// typisiert), obwohl sie zur Laufzeit funktioniert. Deshalb hier explizit
// nachtypisiert statt mit `any` zu arbeiten.
const fetchIcs = ical.async.fromURL as (url: string, options?: FetchOptions) => Promise<CalendarResponse>;

function textValue(value: ParameterValue<string> | undefined): string {
  if (!value) return '';
  return typeof value === 'string' ? value : value.val;
}

// node-ical konstruiert bei VALUE=DATE (Ganztag) ein Date-Objekt auf
// Mitternacht in der lokalen Zeitzone des Prozesses, das dann in UTC
// serialisiert wird. Der Umweg über lokale Getter macht das rückgängig: sie
// liefern unabhängig von der tatsächlichen Prozess-Zeitzone wieder den
// ursprünglich im Feed stehenden Kalendertag (s. CLAUDE.md, Zeitzonen-Fallen).
function dateOnlyToUtcMidnight(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}T00:00:00.000Z`;
}

// Feeds von toomuchracing.com folgen dem Muster "<Serie> | <Eventname> | ...".
function cleanEventName(summary: string): string {
  const parts = summary.split('|').map((part) => part.trim());
  return parts.length > 1 ? parts.slice(1).join(' | ') : summary.trim();
}

// "location" ist eine volle Adresse ("Autodromo Nazionale Monza, Viale di
// Vedano, 5, ..."); der erste Abschnitt ist der Streckenname.
function cleanCircuit(location: string): string {
  return location.split(',')[0]?.trim() ?? location;
}

export function createIcsAdapter(series: SeriesId, calendarId: string): Adapter {
  const url = `https://calendar.google.com/calendar/ical/${calendarId}%40group.calendar.google.com/public/basic.ics`;

  return {
    series,
    async fetchSessions(): Promise<Session[]> {
      const data = await fetchIcs(url, { headers: { 'User-Agent': USER_AGENT } });
      const sessions: Session[] = [];

      // Vergangene Termine werden nicht hier, sondern zentral in index.ts
      // gefiltert (einheitliche Kulanzregel für alle Adapter-Quellen).
      for (const component of Object.values(data)) {
        if (!component || component.type !== 'VEVENT') continue;

        const summary = textValue(component.summary);
        if (summary.toLowerCase().includes('cancelled')) continue;

        const isDateOnly = component.datetype === 'date';
        sessions.push({
          series,
          eventName: cleanEventName(summary),
          circuit: cleanCircuit(textValue(component.location)),
          round: null,
          sessionType: 'race',
          startUtc: isDateOnly ? dateOnlyToUtcMidnight(component.start) : component.start.toISOString(),
          endUtc: null,
          source: 'ics',
          confidence: isDateOnly ? 'date-only' : 'exact',
        });
      }

      return sessions;
    },
  };
}
