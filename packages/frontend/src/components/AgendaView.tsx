import { DateTime } from 'luxon';
import { useEffect, useMemo, useState } from 'react';
import { findNextSession } from '../nextSession';
import { groupSessionsByEvent, isGroupPast } from '../eventGroups';
import { UI_TEXT, type Language } from '../i18n';
import { EventGroupCard } from './EventGroupCard';
import type { Session } from '../types';

// Agenda-Ansicht als Alternative zum Monatsraster: chronologische Liste
// aller gefilterten Termine (nicht an einen Monat gebunden), gruppiert nach
// Veranstaltung -- nützlich auf kleinen Bildschirmen oder wenn man schnell
// alle anstehenden Termine untereinander sehen will.
export function AgendaView({
  sessions,
  language,
  timeZone,
}: {
  sessions: Session[];
  language: Language;
  timeZone: string;
}) {
  const [now, setNow] = useState(() => DateTime.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(DateTime.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const text = UI_TEXT[language];

  const groups = useMemo(() => {
    return groupSessionsByEvent(sessions)
      .map((group) => ({ group, next: findNextSession(group.sessions, now) ?? group.sessions[0] }))
      .sort((a, b) => a.next.startUtc.localeCompare(b.next.startUtc))
      .map(({ group }) => group);
  }, [sessions, now]);

  if (groups.length === 0) {
    return <p className="empty-state">{text.agendaEmpty}</p>;
  }

  return (
    <div className="agenda-view">
      {groups.map((group) => (
        <EventGroupCard
          key={group.key}
          group={group}
          now={now}
          language={language}
          timeZone={timeZone}
          defaultExpanded={!isGroupPast(group, now) && group.sessions.length <= 2}
        />
      ))}
    </div>
  );
}
