import { DateTime } from 'luxon';
import { useEffect, useMemo, useRef, useState } from 'react';
import { SERIES_COLORS } from '../colors';
import { groupSessionsByEvent, isGroupPast } from '../eventGroups';
import { displayStart, formatWhen } from '../formatSessionTime';
import { localeFor, SERIES_LABELS, UI_TEXT, type Language } from '../i18n';
import { isLive, isToday } from '../sessionStatus';
import type { Session, SeriesId } from '../types';
import { EventGroupCard } from './EventGroupCard';

const WEEKDAY_LABELS: Record<Language, string[]> = {
  de: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
};
const MAX_DOTS_PER_DAY = 4;

interface MonthKey {
  year: number;
  month: number; // 1-12
}

function monthKeyOf(session: Session, timeZone: string): MonthKey {
  const dt = displayStart(session, timeZone);
  return { year: dt.year, month: dt.month };
}

function sameMonth(a: MonthKey, b: MonthKey): boolean {
  return a.year === b.year && a.month === b.month;
}

function shiftMonth(key: MonthKey, delta: number): MonthKey {
  const dt = DateTime.fromObject({ year: key.year, month: key.month, day: 1 }).plus({ months: delta });
  return { year: dt.year, month: dt.month };
}

export function MonthCalendar({
  sessions,
  language,
  timeZone,
}: {
  sessions: Session[];
  language: Language;
  timeZone: string;
}) {
  const [visibleMonth, setVisibleMonth] = useState<MonthKey | null>(null);
  const initialized = useRef(false);
  // Für die "läuft gerade"-Markierung: alle 30s neu auswerten, damit sie ohne
  // Reload verschwindet, sobald ein Rennen vorbei ist.
  const [now, setNow] = useState(() => DateTime.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(DateTime.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  // Startmonat ergibt sich automatisch aus dem frühesten Termin: sessions.json
  // enthält ohnehin nur anstehende Termine, d.h. ist der aktuelle Monat leer,
  // liegt der früheste Termin schon im nächsten Monat.
  useEffect(() => {
    if (initialized.current || sessions.length === 0) return;
    const earliest = [...sessions].sort((a, b) => a.startUtc.localeCompare(b.startUtc))[0];
    setVisibleMonth(monthKeyOf(earliest, timeZone));
    initialized.current = true;
  }, [sessions, timeZone]);

  const monthSessions = useMemo(() => {
    if (!visibleMonth) return [];
    return sessions
      .filter((s) => sameMonth(monthKeyOf(s, timeZone), visibleMonth))
      .sort((a, b) => a.startUtc.localeCompare(b.startUtc));
  }, [sessions, visibleMonth, timeZone]);

  const monthGroups = useMemo(() => {
    return groupSessionsByEvent(monthSessions).sort((a, b) =>
      a.sessions[0].startUtc.localeCompare(b.sessions[0].startUtc),
    );
  }, [monthSessions]);

  const sessionsByDay = useMemo(() => {
    const map = new Map<number, Session[]>();
    for (const session of monthSessions) {
      const day = displayStart(session, timeZone).day;
      const list = map.get(day) ?? [];
      list.push(session);
      map.set(day, list);
    }
    return map;
  }, [monthSessions, timeZone]);

  const seriesByDay = useMemo(() => {
    const map = new Map<number, Set<SeriesId>>();
    for (const session of monthSessions) {
      const day = displayStart(session, timeZone).day;
      const set = map.get(day) ?? new Set<SeriesId>();
      set.add(session.series);
      map.set(day, set);
    }
    return map;
  }, [monthSessions, timeZone]);

  if (!visibleMonth) {
    return (
      <div className="calendar-layout">
        <div className="calendar-grid-panel skeleton-panel" aria-hidden="true">
          <div className="skeleton skeleton-nav" />
          <div className="skeleton-grid">
            {Array.from({ length: 35 }, (_, i) => (
              <div className="skeleton skeleton-day" key={i} />
            ))}
          </div>
        </div>
        <div className="calendar-entries skeleton-entries" aria-hidden="true">
          {Array.from({ length: 4 }, (_, i) => (
            <div className="skeleton skeleton-entry" key={i} />
          ))}
        </div>
        <span className="visually-hidden" role="status">
          {UI_TEXT[language].loading}
        </span>
      </div>
    );
  }

  const monthStart = DateTime.fromObject({ year: visibleMonth.year, month: visibleMonth.month, day: 1 });
  const leadingBlanks = monthStart.weekday - 1;
  const cells: (number | null)[] = [
    ...Array(leadingBlanks).fill(null),
    ...Array.from({ length: monthStart.daysInMonth ?? 30 }, (_, i) => i + 1),
  ];
  const usedSeries = [...new Set(monthSessions.map((s) => s.series))].sort();
  const zonedNow = now.setZone(timeZone);
  const isCurrentMonth = visibleMonth.year === zonedNow.year && visibleMonth.month === zonedNow.month;

  return (
    <div className="calendar-layout">
      <div className="calendar-grid-panel">
        <div className="calendar-nav">
          <button type="button" aria-label={UI_TEXT[language].previousMonth} onClick={() => setVisibleMonth(shiftMonth(visibleMonth, -1))}>
            ‹
          </button>
          <span className="calendar-month-label-group">
            <span className="calendar-month-label">{monthStart.setLocale(localeFor(language)).toFormat('LLLL yyyy')}</span>
            {!isCurrentMonth && (
              <button
                type="button"
                className="calendar-today-button"
                onClick={() => setVisibleMonth({ year: zonedNow.year, month: zonedNow.month })}
                aria-label={UI_TEXT[language].currentMonth}
                title={UI_TEXT[language].today}
              >
                📅
              </button>
            )}
          </span>
          <button type="button" aria-label={UI_TEXT[language].nextMonth} onClick={() => setVisibleMonth(shiftMonth(visibleMonth, 1))}>
            ›
          </button>
        </div>
        <div className="calendar-weekdays">
          {WEEKDAY_LABELS[language].map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
        <div className="calendar-days">
          {cells.map((day, index) => {
            const daySeries = day !== null ? [...(seriesByDay.get(day) ?? [])] : [];
            const daySessions = day !== null ? sessionsByDay.get(day) ?? [] : [];
            const isTodayCell = day !== null && isCurrentMonth && day === zonedNow.day;
            return (
              <div className={`calendar-day${day === null ? ' is-blank' : ''}${isTodayCell ? ' is-today' : ''}`} key={index}>
                {day !== null && (
                  <>
                    <span className="calendar-day-number">{day}</span>
                    <span className="calendar-day-dots">
                      {daySeries.slice(0, MAX_DOTS_PER_DAY).map((series) => (
                        <span className="calendar-dot" style={{ background: SERIES_COLORS[series] }} key={series} />
                      ))}
                      {daySeries.length > MAX_DOTS_PER_DAY && (
                        <span className="calendar-dot-more">+{daySeries.length - MAX_DOTS_PER_DAY}</span>
                      )}
                    </span>
                    {daySessions.length > 0 && (
                      <div className="calendar-day-tooltip">
                        {daySessions.map((session, sessionIndex) => (
                          <div className="calendar-day-tooltip-item" key={sessionIndex}>
                            <span className="calendar-day-tooltip-when">
                              {isLive(session, now) && <span className="calendar-chip-live-dot" />}
                              {formatWhen(session, timeZone, language)}
                            </span>
                            <span className="calendar-day-tooltip-title">
                              {SERIES_LABELS[language][session.series]} — {session.eventName}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
        {usedSeries.length > 0 && (
          <div className="calendar-legend">
            {usedSeries.map((series: SeriesId) => (
              <span key={series}>
                <span className="calendar-dot" style={{ background: SERIES_COLORS[series] }} /> {SERIES_LABELS[language][series]}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="calendar-entries">
        {monthGroups.length === 0 ? (
          <p className="calendar-entries-empty">{UI_TEXT[language].noEvents}</p>
        ) : (
          monthGroups.map((group) => (
            <EventGroupCard
              key={group.key}
              group={group}
              now={now}
              language={language}
              timeZone={timeZone}
              defaultExpanded={!isGroupPast(group, now) && group.sessions.some((s) => isToday(s, now, timeZone))}
            />
          ))
        )}
      </div>
    </div>
  );
}
