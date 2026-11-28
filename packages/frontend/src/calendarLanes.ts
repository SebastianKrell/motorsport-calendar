export interface DaySpan {
  key: string;
  color: string;
  days: number[]; // aufsteigend sortierte Tage-des-Monats mit mind. einer Session
  startDay: number;
  endDay: number;
}

export interface DayOccurrence {
  key: string;
  color: string;
  day: number;
}

// Fasst die Tage, an denen eine Veranstaltung (key = Serie+Event) im Monat
// Sessions hat, zu einer zusammenhängenden Spanne zusammen -- Basis für die
// verbindenden Wochenend-Balken im Kalenderraster.
export function computeEventSpans(occurrences: DayOccurrence[]): DaySpan[] {
  const map = new Map<string, { color: string; days: Set<number> }>();
  for (const occurrence of occurrences) {
    const entry = map.get(occurrence.key) ?? { color: occurrence.color, days: new Set<number>() };
    entry.days.add(occurrence.day);
    map.set(occurrence.key, entry);
  }
  return [...map.entries()].map(([key, { color, days }]) => {
    const sortedDays = [...days].sort((a, b) => a - b);
    return { key, color, days: sortedDays, startDay: sortedDays[0], endDay: sortedDays[sortedDays.length - 1] };
  });
}

// Weist jeder Veranstaltungs-Spanne eine "Lane" (Zeilen-Index innerhalb der
// Tageszelle) zu, so dass sich zeitlich überlappende Spannen nie dieselbe
// Lane teilen -- klassisches Interval-Scheduling/Lane-Packing, wie es
// Kalender-UIs (z.B. Google Calendar) für mehrtägige Termine nutzen. Dadurch
// bleibt eine Veranstaltung über alle ihre Tage hinweg auf derselben
// vertikalen Position, was den verbindenden Balken-Look ergibt.
export function assignLanes(spans: DaySpan[]): Map<string, number> {
  const sorted = [...spans].sort((a, b) => a.startDay - b.startDay || a.key.localeCompare(b.key));
  const laneEnds: number[] = [];
  const laneOf = new Map<string, number>();
  for (const span of sorted) {
    let lane = laneEnds.findIndex((end) => end < span.startDay);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(span.endDay);
    } else {
      laneEnds[lane] = span.endDay;
    }
    laneOf.set(span.key, lane);
  }
  return laneOf;
}
