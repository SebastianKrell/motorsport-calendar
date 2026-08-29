import { useEffect, useMemo, useState } from 'react';
import { MonthCalendar } from './components/MonthCalendar';
import { MultiSelectDropdown } from './components/MultiSelectDropdown';
import { SiteHeader } from './components/SiteHeader';
import { SERIES_LABELS, SESSION_TYPE_LABELS } from './labels';
import type { Session, SessionsFile, SessionType, SeriesId } from './types';

const SESSION_TYPE_ORDER: SessionType[] = ['fp', 'quali', 'sprint', 'race'];
// Standardmäßig nur Rennen anzeigen -- Trainings/Qualifyings sind für die
// Sender-Frage meist irrelevant und würden die Tabelle unnötig aufblähen.
const DEFAULT_SESSION_TYPES: SessionType[] = ['race'];

type Theme = 'light' | 'dark';

// index.html setzt data-theme schon vor dem React-Mount (verhindert Flackern
// beim Laden) -- hier nur den bereits gesetzten Wert übernehmen.
function getInitialTheme(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

export function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedSeries, setSelectedSeries] = useState<Set<SeriesId>>(new Set());
  const [selectedSessionTypes, setSelectedSessionTypes] = useState<Set<SessionType>>(
    new Set(DEFAULT_SESSION_TYPES),
  );
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/sessions.json`, { cache: 'no-store' })
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

  function toggleSeries(series: SeriesId) {
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
    <>
      <SiteHeader theme={theme} onSelectTheme={setTheme} />
      <main>
        {error && <p role="alert">Termine konnten nicht geladen werden: {error}</p>}
        <div className="filters">
          <MultiSelectDropdown
            label="Serie"
            options={availableSeries}
            labels={SERIES_LABELS}
            selected={selectedSeries}
            onToggle={toggleSeries}
            onSelectAll={() => setSelectedSeries(new Set(availableSeries))}
            onSelectNone={() => setSelectedSeries(new Set())}
          />
          <MultiSelectDropdown
            label="Session"
            options={availableSessionTypes}
            labels={SESSION_TYPE_LABELS}
            selected={selectedSessionTypes}
            onToggle={toggleSessionType}
          />
        </div>
        <MonthCalendar sessions={filtered} />
        <footer>
          <p>
            Renntermine (WEC, IMSA, NLS, GTWC, IGTC, ADAC GT Masters, British GT, International GT Open, 24H Series,
            Super GT, ELMS, Asian Le Mans Series, Michelin Le Mans Cup):{' '}
            <a href="https://toomuchracing.com">toomuchracing.com</a>, lizenziert unter{' '}
            <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA</a>. Formel E:{' '}
            <a href="https://github.com/sportstimes/f1">sportstimes/f1</a> (MIT). Uhrzeiten NLS:{' '}
            <a href="https://www.nuerburgring-langstrecken-serie.de">nuerburgring-langstrecken-serie.de</a>.
            Uhrzeiten WEC: <a href="https://www.fiawec.com">fiawec.com</a>. Uhrzeiten IMSA:{' '}
            <a href="https://raceweek.io">raceweek.io</a>. Uhrzeiten GTWC:{' '}
            <a href="https://www.gt-world-challenge-europe.com">gt-world-challenge-*.com</a>. Uhrzeiten
            DTM / ADAC GT Masters / Porsche Carrera Cup: <a href="https://dtm.com">dtm.com</a>.
          </p>
          <p>
            <a href={`${import.meta.env.BASE_URL}impressum/`}>Impressum</a> ·{' '}
            <a href={`${import.meta.env.BASE_URL}datenschutz/`}>Datenschutz</a>
          </p>
        </footer>
      </main>
    </>
  );
}
