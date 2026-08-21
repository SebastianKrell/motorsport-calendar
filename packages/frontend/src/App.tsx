import { useEffect, useMemo, useState } from 'react';
import { SessionTable } from './components/SessionTable';
import type { Session, SessionsFile } from './types';

export function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [seriesFilter, setSeriesFilter] = useState<string>('all');

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/sessions.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<SessionsFile>;
      })
      .then((data) => setSessions(data.sessions))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  const availableSeries = useMemo(
    () => [...new Set(sessions.map((s) => s.series))].sort(),
    [sessions],
  );

  const filtered = useMemo(
    () => (seriesFilter === 'all' ? sessions : sessions.filter((s) => s.series === seriesFilter)),
    [sessions, seriesFilter],
  );

  return (
    <main>
      <h1>Motorsport-Kalender</h1>
      {error && <p role="alert">Termine konnten nicht geladen werden: {error}</p>}
      <label>
        Serie:{' '}
        <select value={seriesFilter} onChange={(e) => setSeriesFilter(e.target.value)}>
          <option value="all">Alle</option>
          {availableSeries.map((series) => (
            <option key={series} value={series}>
              {series}
            </option>
          ))}
        </select>
      </label>
      <SessionTable sessions={filtered} />
    </main>
  );
}
