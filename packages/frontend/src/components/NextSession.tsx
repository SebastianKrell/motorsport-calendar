import { DateTime } from 'luxon';
import { useEffect, useMemo, useState } from 'react';
import { SERIES_COLORS } from '../colors';
import { formatWhen } from '../formatSessionTime';
import { broadcasterLabel, SERIES_LABELS, SESSION_TYPE_LABELS, UI_TEXT, type Language } from '../i18n';
import { findNextSession } from '../nextSession';
import { isLive } from '../sessionStatus';
import type { Session } from '../types';

export function NextSession({
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

  const session = useMemo(() => findNextSession(sessions, now), [sessions, now]);
  if (!session) return null;

  const text = UI_TEXT[language];
  const live = isLive(session, now);

  return (
    <section className="next-session" aria-labelledby="next-session-heading">
      <div className="next-session-heading">
        <span className="next-session-series-dot" style={{ background: SERIES_COLORS[session.series] }} />
        <h2 id="next-session-heading">{live ? text.liveNow : text.nextSession}</h2>
      </div>
      <div className="next-session-content">
        <div>
          <p className="next-session-when">{formatWhen(session, timeZone, language)}</p>
          <p className="next-session-title">
            {SERIES_LABELS[language][session.series]} — {session.eventName}
          </p>
          <p className="next-session-type">{SESSION_TYPE_LABELS[language][session.sessionType]}</p>
        </div>
        {session.broadcasters.length > 0 && (
          <div className="next-session-broadcasters">
            {session.broadcasters.map((broadcaster) =>
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
