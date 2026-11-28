import { DateTime } from 'luxon';
import type { Session, SessionType } from './types';

// Fallback-Dauer, falls kein endUtc vorliegt (z.B. ICS-Quellen ohne Endzeit) --
// grobe, aber plausible Richtwerte pro Sessiontyp.
const DEFAULT_DURATION_MINUTES: Record<SessionType, number> = {
  fp: 90,
  sprint_quali: 45,
  quali: 60,
  sprint: 60,
  race: 180,
  event: 480,
};

function formatIcsDate(iso: string): string {
  return DateTime.fromISO(iso, { zone: 'utc' }).toFormat("yyyyMMdd'T'HHmmss'Z'");
}

function escapeIcsText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function buildVEvent(session: Session, summary: string): string[] {
  const start = session.startUtc;
  const end =
    session.endUtc ??
    DateTime.fromISO(start, { zone: 'utc' }).plus({ minutes: DEFAULT_DURATION_MINUTES[session.sessionType] }).toISO()!;
  const uid = `${slugify(session.series)}-${slugify(session.eventName)}-${slugify(session.sessionType)}-${formatIcsDate(start)}@motorsport-calendar`;

  return [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatIcsDate(DateTime.utc().toISO()!)}`,
    `DTSTART:${formatIcsDate(start)}`,
    `DTEND:${formatIcsDate(end)}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    `LOCATION:${escapeIcsText(session.circuit)}`,
    'END:VEVENT',
  ];
}

// Baut eine vollständige .ics-Datei aus einer oder mehreren Sessions (z.B.
// allen Sessions eines Rennwochenendes in einem Kalendereintrag pro Session).
export function buildIcsCalendar(sessions: Session[], summaryFor: (session: Session) => string): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//motorsport-calendar//DE',
    'CALSCALE:GREGORIAN',
    ...sessions.flatMap((session) => buildVEvent(session, summaryFor(session))),
    'END:VCALENDAR',
  ];
  return lines.join('\r\n');
}

// Löst den Download der generierten .ics-Datei im Browser aus.
export function triggerIcsDownload(filename: string, icsContent: string): void {
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
