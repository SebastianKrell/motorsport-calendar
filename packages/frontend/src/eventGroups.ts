import type { DateTime } from 'luxon';
import { isLive, isPast } from './sessionStatus';
import type { SeriesId, Session } from './types';

export interface EventGroup {
  key: string;
  series: SeriesId;
  eventName: string;
  circuit: string;
  sessions: Session[]; // chronologisch aufsteigend sortiert
}

export function eventKeyFor(session: Session): string {
  return `${session.series}::${session.eventName}`;
}

// Fasst Sessions zusammen, die zur selben Veranstaltung gehören (gleiche
// Serie + gleicher Eventname) -- z.B. FP/Quali/Rennen eines Grand-Prix-
// Wochenendes landen als eine Gruppe statt als lose Einzeltermine.
export function groupSessionsByEvent(sessions: Session[]): EventGroup[] {
  const map = new Map<string, Session[]>();
  for (const session of sessions) {
    const key = eventKeyFor(session);
    const list = map.get(key) ?? [];
    list.push(session);
    map.set(key, list);
  }

  return [...map.entries()].map(([key, list]) => {
    const sorted = [...list].sort((a, b) => a.startUtc.localeCompare(b.startUtc));
    const first = sorted[0];
    return { key, series: first.series, eventName: first.eventName, circuit: first.circuit, sessions: sorted };
  });
}

// Für die "Weekend-Spotlight"-Karte: die Veranstaltung, die gerade läuft,
// oder sonst die mit der zeitlich nächsten noch ausstehenden Session.
export function findNextEventGroup(sessions: Session[], now: DateTime): EventGroup | null {
  const groups = groupSessionsByEvent(sessions);

  const liveGroup = groups.find((group) => group.sessions.some((session) => isLive(session, now)));
  if (liveGroup) return liveGroup;

  const withNext = groups
    .map((group) => ({ group, next: group.sessions.find((session) => !isPast(session, now)) }))
    .filter((entry): entry is { group: EventGroup; next: Session } => entry.next !== undefined)
    .sort((a, b) => a.next.startUtc.localeCompare(b.next.startUtc));

  return withNext[0]?.group ?? null;
}

export function isGroupLive(group: EventGroup, now: DateTime): boolean {
  return group.sessions.some((session) => isLive(session, now));
}

export function isGroupPast(group: EventGroup, now: DateTime): boolean {
  return group.sessions.every((session) => isPast(session, now));
}
