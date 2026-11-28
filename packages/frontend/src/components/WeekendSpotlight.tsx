import { DateTime } from 'luxon';
import { useEffect, useMemo, useState } from 'react';
import { getCircuitFlag } from '../circuitFlags';
import { SERIES_COLORS } from '../colors';
import { findNextEventGroup, isGroupLive } from '../eventGroups';
import { formatCountdown } from '../countdown';
import { formatWhen } from '../formatSessionTime';
import { broadcasterLabel, SERIES_LABELS, SESSION_TYPE_LABELS, UI_TEXT, type Language } from '../i18n';
import { findNextSession } from '../nextSession';
import { isLive, isPast } from '../sessionStatus';
import { SESSION_TYPE_ICONS } from '../sessionTypeIcons';
import type { Session } from '../types';

function sessionStatusClass(session: Session, now: DateTime): 'done' | 'live' | 'upcoming' {
  if (isLive(session, now)) return 'live';
  if (isPast(session, now)) return 'done';
  return 'upcoming';
}

export function WeekendSpotlight({
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

  const group = useMemo(() => findNextEventGroup(sessions, now), [sessions, now]);
  const targetSession = useMemo(
    () => (group ? (findNextSession(group.sessions, now) ?? group.sessions[group.sessions.length - 1]) : null),
    [group, now],
  );

  if (!group || !targetSession) return null;

  const text = UI_TEXT[language];
  const live = isGroupLive(group, now);
  const flag = getCircuitFlag(group.circuit);
  const countdown = !isLive(targetSession, now) ? formatCountdown(DateTime.fromISO(targetSession.startUtc, { zone: 'utc' }), now, language) : null;
  const heading = live ? text.liveNow : group.sessions.length > 1 ? text.thisWeekend : text.nextSession;

  return (
    <section className="next-session" aria-labelledby="next-session-heading">
      <div className="next-session-heading">
        <span className="next-session-series-dot" style={{ background: SERIES_COLORS[group.series] }} />
        <h2 id="next-session-heading">{heading}</h2>
        {flag && <span className="next-session-flag">{flag}</span>}
        <span className="next-session-event-name">
          {SERIES_LABELS[language][group.series]} — {group.eventName}
        </span>
      </div>

      {group.sessions.length > 1 && (
        <ol className="session-timeline" aria-label={text.thisWeekend}>
          {group.sessions.map((session, index) => {
            const status = sessionStatusClass(session, now);
            return (
              <li className={`session-timeline-item is-${status}`} key={index}>
                <span className="session-timeline-icon" aria-hidden="true">
                  {status === 'done' ? '✅' : SESSION_TYPE_ICONS[session.sessionType]}
                </span>
                <span className="session-timeline-label">{SESSION_TYPE_LABELS[language][session.sessionType]}</span>
                <span className="session-timeline-when">{formatWhen(session, timeZone, language)}</span>
              </li>
            );
          })}
        </ol>
      )}

      <div className="next-session-content">
        <div>
          <p className="next-session-when">
            {formatWhen(targetSession, timeZone, language)}
            {countdown && <span className="next-session-countdown"> · {countdown}</span>}
          </p>
          <p className="next-session-title">
            {SESSION_TYPE_ICONS[targetSession.sessionType]} {SESSION_TYPE_LABELS[language][targetSession.sessionType]}
          </p>
        </div>
        {targetSession.broadcasters.length > 0 && (
          <div className="next-session-broadcasters">
            {targetSession.broadcasters.map((broadcaster) =>
              broadcaster.url ? (
                <a
                  className="calendar-chip calendar-chip-link"
                  href={broadcaster.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  key={broadcaster.name}
                >
                  {broadcasterLabel(broadcaster.name, language)}
                </a>
              ) : (
                <span className="calendar-chip" key={broadcaster.name}>
                  {broadcasterLabel(broadcaster.name, language)}
                </span>
              ),
            )}
          </div>
        )}
      </div>
    </section>
  );
}
