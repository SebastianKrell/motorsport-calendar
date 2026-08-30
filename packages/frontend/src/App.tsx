import { DateTime } from 'luxon';
import { useEffect, useMemo, useState } from 'react';
import { MonthCalendar } from './components/MonthCalendar';
import { MultiSelectDropdown } from './components/MultiSelectDropdown';
import { SiteHeader } from './components/SiteHeader';
import { SourceAttribution } from './components/SourceAttribution';
import { localeFor, SERIES_LABELS, SESSION_TYPE_LABELS, UI_TEXT, type Language } from './i18n';
import { DEFAULT_TIME_ZONE, isSupportedTimeZone } from './timeZones';
import type { Session, SessionsFile, SessionType, SeriesId } from './types';

const SESSION_TYPE_ORDER: SessionType[] = ['fp', 'quali', 'sprint', 'race'];
const TIME_ZONE_STORAGE_KEY = 'timeZone-v2';
// Standardmäßig nur Rennen anzeigen -- Trainings/Qualifyings sind für die
// Sender-Frage meist irrelevant und würden die Tabelle unnötig aufblähen.
const DEFAULT_SESSION_TYPES: SessionType[] = ['race'];

type Theme = 'light' | 'dark';

// index.html setzt data-theme schon vor dem React-Mount (verhindert Flackern
// beim Laden) -- hier nur den bereits gesetzten Wert übernehmen.
function getInitialTheme(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function getInitialLanguage(): Language {
  return localStorage.getItem('language') === 'en' ? 'en' : 'de';
}

function getInitialTimeZone(): string {
  const stored = localStorage.getItem(TIME_ZONE_STORAGE_KEY);
  return isSupportedTimeZone(stored) ? stored : DEFAULT_TIME_ZONE;
}

function formatGeneratedAt(value: string | null, timeZone: string, language: Language): string | null {
  if (!value) return null;
  const timestamp = DateTime.fromISO(value, { zone: 'utc' }).setZone(timeZone).setLocale(localeFor(language));
  if (!timestamp.isValid) return null;
  return language === 'de'
    ? timestamp.toFormat("dd.LL.yyyy, HH:mm 'Uhr'")
    : timestamp.toFormat('dd/LL/yyyy, HH:mm');
}

export function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedSeries, setSelectedSeries] = useState<Set<SeriesId>>(new Set());
  const [selectedSessionTypes, setSelectedSessionTypes] = useState<Set<SessionType>>(
    new Set(DEFAULT_SESSION_TYPES),
  );
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [language, setLanguage] = useState<Language>(getInitialLanguage);
  const [timeZone, setTimeZone] = useState<string>(getInitialTimeZone);
  const text = UI_TEXT[language];

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = language;
    localStorage.setItem('language', language);
    document.title = language === 'de' ? 'Motorsport-Kalender' : 'Motorsport Calendar';
    const description = language === 'de'
      ? 'Motorsport-Termine und Übertragungen mit frei wählbarer Zeitzone.'
      : 'Motorsport events and broadcasts with a selectable time zone.';
    document.querySelector('meta[name="description"]')?.setAttribute('content', description);
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', description);
    document.querySelector('meta[property="og:title"]')?.setAttribute(
      'content',
      language === 'de' ? 'Motorsport-Kalender' : 'Motorsport Calendar',
    );
    document.querySelector('meta[property="og:locale"]')?.setAttribute(
      'content',
      language === 'de' ? 'de_DE' : 'en_GB',
    );
  }, [language]);

  useEffect(() => {
    localStorage.setItem(TIME_ZONE_STORAGE_KEY, timeZone);
  }, [timeZone]);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/sessions.json`, { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<SessionsFile>;
      })
      .then((data) => {
        setSessions(data.sessions);
        setGeneratedAt(data.generatedAt);
        // Alle Serien starten aktiviert -- erst nach dem Laden bekannt, da
        // die Serienliste aus den tatsächlich vorhandenen Sessions kommt.
        setSelectedSeries(new Set(data.sessions.map((s) => s.series)));
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  const availableSeries = useMemo(() => [...new Set(sessions.map((s) => s.series))].sort(), [sessions]);
  const formattedGeneratedAt = useMemo(
    () => formatGeneratedAt(generatedAt, timeZone, language),
    [generatedAt, timeZone, language],
  );

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
      <SiteHeader
        theme={theme}
        onSelectTheme={setTheme}
        language={language}
        onSelectLanguage={setLanguage}
        timeZone={timeZone}
        onSelectTimeZone={setTimeZone}
      />
      <main>
        {error && <p role="alert">{text.loadError}: {error}</p>}
        <div className="filters">
          <MultiSelectDropdown
            label={text.series}
            options={availableSeries}
            labels={SERIES_LABELS[language]}
            selected={selectedSeries}
            onToggle={toggleSeries}
            onSelectAll={() => setSelectedSeries(new Set(availableSeries))}
            onSelectNone={() => setSelectedSeries(new Set())}
            allLabel={text.all}
            noneLabel={text.none}
          />
          <MultiSelectDropdown
            label={text.session}
            options={availableSessionTypes}
            labels={SESSION_TYPE_LABELS[language]}
            selected={selectedSessionTypes}
            onToggle={toggleSessionType}
            allLabel={text.all}
            noneLabel={text.none}
          />
        </div>
        <MonthCalendar sessions={filtered} language={language} timeZone={timeZone} />
        <footer>
          {formattedGeneratedAt && <p>{text.dataAsOf}: {formattedGeneratedAt}</p>}
          <SourceAttribution language={language} />
          <p>
            <a href={`${import.meta.env.BASE_URL}impressum/`}>{text.imprint}</a> ·{' '}
            <a href={`${import.meta.env.BASE_URL}datenschutz/`}>{text.privacy}</a>
          </p>
        </footer>
      </main>
    </>
  );
}
