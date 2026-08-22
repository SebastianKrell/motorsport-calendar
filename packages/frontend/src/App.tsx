import { useEffect, useMemo, useState } from 'react';
import { SessionTable } from './components/SessionTable';
import type { Session, SessionsFile, SessionType } from './types';

const SESSION_TYPE_ORDER: SessionType[] = ['fp', 'quali', 'sprint', 'race'];
const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  fp: 'Training',
  quali: 'Qualifying',
  sprint: 'Sprint',
  race: 'Rennen',
};
// Standardmäßig nur Rennen anzeigen -- Trainings/Qualifyings sind für die
// Sender-Frage meist irrelevant und würden die Tabelle unnötig aufblähen.
const DEFAULT_SESSION_TYPES: SessionType[] = ['race'];

export function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedSeries, setSelectedSeries] = useState<Set<string>>(new Set());
  const [selectedSessionTypes, setSelectedSessionTypes] = useState<Set<SessionType>>(
    new Set(DEFAULT_SESSION_TYPES),
  );

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/sessions.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<SessionsFile>;
      })
      .then((data) => {
        setSessions(data.sessions);
        // Alle Serien starten aktiviert -- erst nach dem Laden bekannt, da
        // die Serienliste aus den tatsächlich vorhandenen Sessions kommt.
        setSelectedSeries(new Set(data.sessions.map((s) => s.series)));
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  const availableSeries = useMemo(() => [...new Set(sessions.map((s) => s.series))].sort(), [sessions]);

  const availableSessionTypes = useMemo(
    () => SESSION_TYPE_ORDER.filter((type) => sessions.some((s) => s.sessionType === type)),
    [sessions],
  );

  const filtered = useMemo(
    () => sessions.filter((s) => selectedSeries.has(s.series) && selectedSessionTypes.has(s.sessionType)),
    [sessions, selectedSeries, selectedSessionTypes],
  );

  function toggleSeries(series: string) {
    setSelectedSeries((prev) => {
      const next = new Set(prev);
      if (next.has(series)) next.delete(series);
      else next.add(series);
      return next;
    });
  }

  function toggleSessionType(type: SessionType) {
    setSelectedSessionTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  return (
    <main>
      <h1>Motorsport-Kalender</h1>
      {error && <p role="alert">Termine konnten nicht geladen werden: {error}</p>}
      <fieldset>
        <legend>Serie</legend>
        {availableSeries.map((series) => (
          <label key={series}>
            <input
              type="checkbox"
              checked={selectedSeries.has(series)}
              onChange={() => toggleSeries(series)}
            />
            {series}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>Session</legend>
        {availableSessionTypes.map((type) => (
          <label key={type}>
            <input
              type="checkbox"
              checked={selectedSessionTypes.has(type)}
              onChange={() => toggleSessionType(type)}
            />
            {SESSION_TYPE_LABELS[type]}
          </label>
        ))}
      </fieldset>
      <SessionTable sessions={filtered} />
    </main>
  );
}
