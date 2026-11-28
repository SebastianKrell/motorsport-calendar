import { DateTime } from 'luxon';
import { useState } from 'react';
import { getCircuitFlag } from '../circuitFlags';
import { SERIES_COLORS } from '../colors';
import type { EventGroup } from '../eventGroups';
import { isGroupLive, isGroupPast } from '../eventGroups';
import { displayStart, formatWhen } from '../formatSessionTime';
import { broadcasterLabel, localeFor, SERIES_LABELS, SESSION_TYPE_LABELS, UI_TEXT, type Language } from '../i18n';
import { buildIcsCalendar, triggerIcsDownload } from '../ics';
import { findNextSession } from '../nextSession';
import { isLive, isPast, isToday } from '../sessionStatus';
import { SESSION_TYPE_ICONS } from '../sessionTypeIcons';

const VERIFIED_STALE_AFTER_DAYS = 60;

function isStale(verifiedAt: string | null): boolean {
  if (!verifiedAt) return true;
  return DateTime.now().diff(DateTime.fromISO(verifiedAt), 'days').days > VERIFIED_STALE_AFTER_DAYS;
}

function formatDateRange(group: EventGroup, timeZone: string, language: Language): string {
  const first = displayStart(group.sessions[0], timeZone).setLocale(localeFor(language));
  const last = displayStart(group.sessions[group.sessions.length - 1], timeZone).setLocale(localeFor(language));
  const dayFormat = language === 'de' ? 'dd.LL.' : 'dd LLL';
  if (first.hasSame(last, 'day')) return first.toFormat(dayFormat);
  return `${first.toFormat(dayFormat)} – ${last.toFormat(dayFormat)}`;
}

export function EventGroupCard({
  group,
  now,
  language,
  timeZone,
  defaultExpanded = false,
}: {
  group: EventGroup;
  now: DateTime;
  language: Language;
  timeZone: string;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const text = UI_TEXT[language];
  const live = isGroupLive(group, now);
  const past = isGroupPast(group, now);
  const today = group.sessions.some((session) => isToday(session, now, timeZone));
  const flag = getCircuitFlag(group.circuit);
  const showCircuit = group.circuit && group.circuit !== group.eventName;
  const hasMultipleSessions = group.sessions.length > 1;
  const compactSession = findNextSession(group.sessions, now) ?? group.sessions[group.sessions.length - 1];

  function handleDownload(event: React.MouseEvent) {
    event.stopPropagation();
    const seriesLabel = SERIES_LABELS[language][group.series];
    const ics = buildIcsCalendar(
      group.sessions,
      (session) => `${seriesLabel} – ${group.eventName} (${SESSION_TYPE_LABELS[language][session.sessionType]})`,
    );
    triggerIcsDownload(`${group.series}-${group.eventName}`.replace(/\s+/g, '-').toLowerCase() + '.ics', ics);
  }

  return (
    <div
      className={`calendar-entry${today ? ' calendar-entry-today' : ''}${live ? ' calendar-entry-live' : ''}${past ? ' calendar-entry-past' : ''}`}
    >
      <button
        type="button"
        className="calendar-entry-header"
        aria-expanded={expanded}
        onClick={() => hasMultipleSessions && setExpanded((e) => !e)}
      >
        <span className="calendar-entry-header-main">
          <span className="calendar-entry-when">
            {live && <span className="calendar-chip-live-dot" />}
            {formatDateRange(group, timeZone, language)}
          </span>
          <span className="calendar-entry-title">
            <span className="calendar-entry-series-dot" style={{ background: SERIES_COLORS[group.series] }} />
            {flag && <span className="calendar-entry-flag">{flag}</span>}
            {SERIES_LABELS[language][group.series]} — {group.eventName}
          </span>
          {showCircuit && <span className="calendar-entry-circuit">{group.circuit}</span>}
        </span>
        <span className="calendar-entry-header-actions">
          {hasMultipleSessions && (
            <span className="calendar-entry-count">
              {group.sessions.length} {text.sessionsLabel}
            </span>
          )}
          <span
            className="calendar-entry-ics"
            role="button"
            tabIndex={0}
            aria-label={text.addToCalendar}
            title={text.addToCalendar}
            onClick={handleDownload}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') handleDownload(event as unknown as React.MouseEvent);
            }}
          >
            🗓️+
          </span>
          {hasMultipleSessions && (
            <span
              className={`calendar-entry-caret${expanded ? ' is-open' : ''}`}
              aria-label={expanded ? text.collapseSessions : text.expandSessions}
            >
              ▾
            </span>
          )}
        </span>
      </button>

      {(!hasMultipleSessions || expanded) && (
        <div className="calendar-entry-sessions">
          {(expanded ? group.sessions : [compactSession]).map((session, index) => (
            <div className="calendar-entry-session-row" key={index}>
              <span className="calendar-entry-session-when">
                {isLive(session, now) && <span className="calendar-chip-live-dot" />}
                {formatWhen(session, timeZone, language)}
              </span>
              <div className="calendar-entry-meta">
                {isLive(session, now) && <span className="calendar-chip calendar-chip-live">{text.live}</span>}
                <span className="calendar-chip calendar-chip-type">
                  {SESSION_TYPE_ICONS[session.sessionType]} {SESSION_TYPE_LABELS[language][session.sessionType]}
                </span>
                {session.broadcasters.map((b) =>
                  b.url && !isPast(session, now) ? (
                    <a
                      className="calendar-chip calendar-chip-link"
                      href={b.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      key={b.name}
                    >
                      {broadcasterLabel(b.name, language)}
                    </a>
                  ) : (
                    <span className="calendar-chip" key={b.name}>
                      {broadcasterLabel(b.name, language)}
                    </span>
                  ),
                )}
                {session.broadcasters.length > 0 && isStale(session.broadcastersVerifiedAt) && (
                  <span className="calendar-chip calendar-chip-stale">{text.unverified}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
