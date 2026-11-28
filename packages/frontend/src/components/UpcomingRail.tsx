import { DateTime } from 'luxon';
import { useEffect, useMemo, useState } from 'react';
import { getCircuitFlag } from '../circuitFlags';
import { SERIES_COLORS } from '../colors';
import { findNextSession } from '../nextSession';
import { groupSessionsByEvent, isGroupLive } from '../eventGroups';
import { formatWhen } from '../formatSessionTime';
import { SERIES_LABELS, UI_TEXT, type Language } from '../i18n';
import { isPast } from '../sessionStatus';
import { SESSION_TYPE_ICONS } from '../sessionTypeIcons';
import type { Session } from '../types';

const RAIL_DAYS = 7;

export function UpcomingRail({
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
    const interval = setInterval(() => setNow(DateTime.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const text = UI_TEXT[language];

  const groups = useMemo(() => {
    const horizon = now.plus({ days: RAIL_DAYS });
    const upcoming = sessions.filter((session) => {
      if (isPast(session, now)) return false;
      const start = DateTime.fromISO(session.startUtc, { zone: 'utc' });
      return start <= horizon;
    });
    return groupSessionsByEvent(upcoming)
      .map((group) => ({ group, next: findNextSession(group.sessions, now) ?? group.sessions[0] }))
      .sort((a, b) => a.next.startUtc.localeCompare(b.next.startUtc));
  }, [sessions, now]);

  if (groups.length === 0) {
    return (
      <section className="upcoming-rail" aria-label={text.next7Days}>
        <h2 className="upcoming-rail-heading">{text.next7Days}</h2>
        <p className="upcoming-rail-empty">{text.noUpcoming}</p>
      </section>
    );
  }

  return (
    <section className="upcoming-rail" aria-label={text.next7Days}>
      <h2 className="upcoming-rail-heading">{text.next7Days}</h2>
      <div className="upcoming-rail-track">
        {groups.map(({ group, next }) => {
          const live = isGroupLive(group, now);
          const flag = getCircuitFlag(group.circuit);
          return (
            <div
              className={`upcoming-rail-card${live ? ' upcoming-rail-card-live' : ''}`}
              style={{ borderLeftColor: SERIES_COLORS[group.series] }}
              key={group.key}
            >
              {live && <span className="calendar-chip calendar-chip-live upcoming-rail-live-chip">{text.live}</span>}
              <span className="upcoming-rail-when">{formatWhen(next, timeZone, language)}</span>
              <span className="upcoming-rail-title">
                {flag && <span>{flag} </span>}
                {SERIES_LABELS[language][group.series]}
              </span>
              <span className="upcoming-rail-event">{group.eventName}</span>
              <span className="upcoming-rail-types" aria-hidden="true">
                {[...new Set(group.sessions.map((s) => s.sessionType))].map((type) => (
                  <span key={type}>{SESSION_TYPE_ICONS[type]}</span>
                ))}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
