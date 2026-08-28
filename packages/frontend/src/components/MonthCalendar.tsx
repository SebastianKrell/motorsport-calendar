import { DateTime } from 'luxon';
import { useEffect, useMemo, useRef, useState } from 'react';
import { SERIES_COLORS } from '../colors';
import { SERIES_LABELS, SESSION_TYPE_LABELS } from '../labels';
import type { Session, SeriesId } from '../types';

const WEEKDAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const VERIFIED_STALE_AFTER_DAYS = 60;
const MAX_DOTS_PER_DAY = 4;

interface MonthKey {
  year: number;
  month: number; // 1-12
}

function monthKeyOf(iso: string): MonthKey {
  const dt = DateTime.fromISO(iso, { zone: 'utc' }).setZone('Europe/Berlin');
  return { year: dt.year, month: dt.month };
}

function sameMonth(a: MonthKey, b: MonthKey): boolean {
  return a.year === b.year && a.month === b.month;
}

function shiftMonth(key: MonthKey, delta: number): MonthKey {
  const dt = DateTime.fromObject({ year: key.year, month: key.month, day: 1 }).plus({ months: delta });
  return { year: dt.year, month: dt.month };
}

function formatWhen(session: Session): string {
  const start = DateTime.fromISO(session.startUtc, { zone: 'utc' }).setZone('Europe/Berlin');
  const day = start.setLocale('de').toFormat('ccc dd.LL.');
  return session.confidence === 'date-only' ? day : `${day} · ${start.toFormat('HH:mm')}`;
}

function isStale(verifiedAt: string | null): boolean {
  if (!verifiedAt) return true;
  return DateTime.now().diff(DateTime.fromISO(verifiedAt), 'days').days > VERIFIED_STALE_AFTER_DAYS;
}

// "Läuft gerade" lässt sich nur ausrechnen, wenn wir sowohl Start- als auch
// Endzeit exakt kennen. `date-only`-Einträge (nur Renntag, keine Uhrzeit aus
// dem ICS-Feed) und Sessions ohne `endUtc` werden bewusst nie als live
// markiert -- eine geratene Live-Anzeige wäre schlimmer als keine.
function isLive(session: Session, now: DateTime): boolean {
  if (session.confidence !== 'exact' || !session.endUtc) return false;
  const start = DateTime.fromISO(session.startUtc, { zone: 'utc' });
  const end = DateTime.fromISO(session.endUtc, { zone: 'utc' });
  return now >= start && now <= end;
}

// Sessions bleiben nach Ende noch bis zu 24h in den Daten (s. GRACE_PERIOD_MS
// im data-collector), damit über-Mitternacht-Rennen nicht vorzeitig
// verschwinden. Dieselbe Referenz (endUtc, sonst startUtc) hier verwenden,
// um "schon vorbei" konsistent mit dieser Kulanzregel zu berechnen.
function isPast(session: Session, now: DateTime): boolean {
  const reference = DateTime.fromISO(session.endUtc ?? session.startUtc, { zone: 'utc' });
  return reference < now;
}

export function MonthCalendar({ sessions }: { sessions: Session[] }) {
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
    setVisibleMonth(monthKeyOf(earliest.startUtc));
    initialized.current = true;
  }, [sessions]);

  const monthSessions = useMemo(() => {
    if (!visibleMonth) return [];
    return sessions
      .filter((s) => sameMonth(monthKeyOf(s.startUtc), visibleMonth))
      .sort((a, b) => a.startUtc.localeCompare(b.startUtc));
  }, [sessions, visibleMonth]);

  const seriesByDay = useMemo(() => {
    const map = new Map<number, Set<SeriesId>>();
    for (const session of monthSessions) {
      const day = DateTime.fromISO(session.startUtc, { zone: 'utc' }).setZone('Europe/Berlin').day;
      const set = map.get(day) ?? new Set<SeriesId>();
      set.add(session.series);
      map.set(day, set);
    }
    return map;
  }, [monthSessions]);

  const sessionsByDay = useMemo(() => {
    const map = new Map<number, Session[]>();
    for (const session of monthSessions) {
      const day = DateTime.fromISO(session.startUtc, { zone: 'utc' }).setZone('Europe/Berlin').day;
      const list = map.get(day) ?? [];
      list.push(session);
      map.set(day, list);
    }
    return map;
  }, [monthSessions]);

  if (!visibleMonth) {
    return <p className="empty-state">Lade Termine …</p>;
  }

  const monthStart = DateTime.fromObject({ year: visibleMonth.year, month: visibleMonth.month, day: 1 });
  const leadingBlanks = monthStart.weekday - 1;
  const cells: (number | null)[] = [
    ...Array(leadingBlanks).fill(null),
    ...Array.from({ length: monthStart.daysInMonth ?? 30 }, (_, i) => i + 1),
  ];
  const usedSeries = [...new Set(monthSessions.map((s) => s.series))].sort();
  const isCurrentMonth = visibleMonth.year === now.year && visibleMonth.month === now.month;

  return (
    <div className="calendar-layout">
      <div className="calendar-grid-panel">
        <div className="calendar-nav">
          <button type="button" aria-label="Vorheriger Monat" onClick={() => setVisibleMonth(shiftMonth(visibleMonth, -1))}>
            ‹
          </button>
          <span className="calendar-month-label-group">
            <span className="calendar-month-label">{monthStart.setLocale('de').toFormat('LLLL yyyy')}</span>
            {!isCurrentMonth && (
              <button
                type="button"
                className="calendar-today-button"
                onClick={() => setVisibleMonth({ year: now.year, month: now.month })}
              >
                Heute
              </button>
            )}
          </span>
          <button type="button" aria-label="Nächster Monat" onClick={() => setVisibleMonth(shiftMonth(visibleMonth, 1))}>
            ›
          </button>
        </div>
        <div className="calendar-weekdays">
          {WEEKDAY_LABELS.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
        <div className="calendar-days">
          {cells.map((day, index) => {
            const daySeries = day !== null ? [...(seriesByDay.get(day) ?? [])] : [];
            const daySessions = day !== null ? sessionsByDay.get(day) ?? [] : [];
            return (
              <div className={`calendar-day${day === null ? ' is-blank' : ''}`} key={index}>
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
                              {formatWhen(session)}
                            </span>
                            <span className="calendar-day-tooltip-title">
                              {SERIES_LABELS[session.series]} — {session.eventName}
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
            {usedSeries.map((series) => (
              <span key={series}>
                <span className="calendar-dot" style={{ background: SERIES_COLORS[series] }} /> {SERIES_LABELS[series]}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="calendar-entries">
        {monthSessions.length === 0 ? (
          <p className="calendar-entries-empty">Keine Termine in diesem Monat.</p>
        ) : (
          monthSessions.map((session, index) => (
            <div
              className={`calendar-entry${isLive(session, now) ? ' calendar-entry-live' : ''}${isPast(session, now) ? ' calendar-entry-past' : ''}`}
              key={`${session.series}-${session.eventName}-${session.sessionType}-${index}`}
            >
              <div className="calendar-entry-when">{formatWhen(session)}</div>
              <div className="calendar-entry-title">
                {SERIES_LABELS[session.series]} — {session.eventName}
              </div>
              <div className="calendar-entry-meta">
                {isLive(session, now) && <span className="calendar-chip calendar-chip-live">Live</span>}
                <span className="calendar-chip calendar-chip-type">{SESSION_TYPE_LABELS[session.sessionType]}</span>
                {session.broadcasters.map((b) =>
                  b.url && !isPast(session, now) ? (
                    <a
                      className="calendar-chip calendar-chip-link"
                      href={b.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      key={b.name}
                    >
                      {b.name}
                    </a>
                  ) : (
                    <span className="calendar-chip" key={b.name}>
                      {b.name}
                    </span>
                  ),
                )}
                {session.broadcasters.length > 0 && isStale(session.broadcastersVerifiedAt) && (
                  <span className="calendar-chip calendar-chip-stale">ohne Gewähr</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
