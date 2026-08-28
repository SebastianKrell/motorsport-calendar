import type { Adapter, Session, SessionType, SeriesId } from '../types.js';
import { createIcsAdapter } from './ics.js';

const USER_AGENT = 'motorsport-calendar (https://github.com/SebastianKrell/motorsport-calendar)';
const API_BASE = 'https://api.dtm.com/data';
// Gleiche Kulanzfrist wie der zentrale Filter in index.ts -- verhindert
// unnötige Detailabrufe für Wochenenden, die ohnehin aussortiert würden.
const GRACE_MS = 24 * 60 * 60 * 1000;
// ADAC GT Masters läuft laut Recherche (Saison 2026) nur an vier von sechs
// Wochenenden im Rahmen der DTM; die beiden eigenständigen Termine
// (Nürburgring im Juli, Salzburgring) liefert weiterhin der bisherige
// ICS-Feed (nur Renntag, keine Uhrzeit, s. CLAUDE.md).
const ADAC_GT_MASTERS_CALENDAR_ID = 'bo1ablitg2ecigfcdouq209vj0';

async function fetchJson<T>(query: string): Promise<T> {
  const res = await fetch(`${API_BASE}?query=${query}&lang=de`, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} bei query=${query}`);
  return res.json() as Promise<T>;
}

interface RawEventSummary {
  slug: string;
  startTime: string;
  endTime: string;
  raceSeries: string[];
}

interface RawTimetableEntry {
  start: string;
  end: string | null;
  headline: string | null;
  label: string | null;
}

interface RawEventDetail {
  name: string;
  eventNumber: number | null;
  racetrack: { name: string } | null;
  timetable: RawTimetableEntry[] | null;
}

// "Red Bull Ring by VKB-Bank" -> "Red Bull Ring". Sponsoring-Zusätze ändern
// sich jährlich und sind für Circuit-/Eventnamen nur Rauschen.
function stripSponsorBranding(name: string): string {
  return name.replace(/\s+(by|presented by)\s+.+$/i, '').trim();
}

// Timetable-Label-Präfixe sind über alle DTM-Rahmenserien hinweg einheitlich
// ("Freies Training [N]", "Zeittraining [N]", "Rennen [N]") -- alles andere
// (Pitwalk, Track Safari, Meet the Drivers, Autogrammstunden, ...) sind keine
// fahrbaren Sessions und werden übersprungen.
function classifySessionLabel(label: string | null): SessionType | null {
  if (!label) return null;
  const lower = label.toLowerCase();
  if (lower.startsWith('freies training')) return 'fp';
  if (lower.startsWith('zeittraining')) return 'quali';
  if (lower.startsWith('rennen')) return 'race';
  return null;
}

interface ParsedEvent {
  circuit: string;
  eventName: string;
  eventNumber: number | null;
  windowStartMs: number;
  windowEndMs: number;
  timetable: RawTimetableEntry[];
}

let cachedEvents: Promise<ParsedEvent[]> | null = null;

async function fetchUpcomingEventSummaries(): Promise<RawEventSummary[]> {
  const { events } = await fetchJson<{ events: RawEventSummary[] }>('eventsRacetrack');
  const cutoff = Date.now() - GRACE_MS;
  // "DTMClassic"-Läufe (Historic-Fahrzeuge, keine eigene Rahmenserie mit
  // Sender-Fokus) sind nicht im Serienkatalog und werden hier schon
  // ausgeschlossen.
  return events.filter((event) => event.raceSeries.includes('DTM') && new Date(event.endTime).getTime() >= cutoff);
}

// DTM, ADAC GT Masters und der Porsche Sixt Carrera Cup Deutschland teilen
// sich an gemeinsamen Rennwochenenden dieselbe Event-Detailseite/Timetable
// -- ein gemeinsamer, gecachter Abruf verhindert, dass jede der drei Serien
// denselben Datensatz separat holt (die Adapter laufen laut index.ts
// sequenziell im selben Prozess, ein Modul-Cache reicht deshalb aus).
function fetchAllParsedEvents(): Promise<ParsedEvent[]> {
  if (!cachedEvents) {
    cachedEvents = (async () => {
      const summaries = await fetchUpcomingEventSummaries();
      const parsed: ParsedEvent[] = [];

      for (const summary of summaries) {
        try {
          const { events } = await fetchJson<{ events: RawEventDetail[] }>(`eventDetails&slug=${summary.slug}`);
          const event = events[0];
          if (!event) {
            console.warn(`[dtm] keine Eventdetails für "${summary.slug}" gefunden, überspringe`);
            continue;
          }

          const rawCircuit = stripSponsorBranding(event.racetrack?.name ?? event.name);
          parsed.push({
            circuit: rawCircuit,
            // "Nürburgring Sprint" -> "Nürburgring": das "Sprint"-Suffix
            // bezeichnet nur die Streckenvariante, ist als Eventname aber
            // unnötig sperrig (Circuit-Feld behält es zur Eindeutigkeit).
            eventName: rawCircuit.replace(/\s+Sprint$/i, '').trim(),
            eventNumber: event.eventNumber,
            windowStartMs: new Date(summary.startTime).getTime(),
            windowEndMs: new Date(summary.endTime).getTime(),
            timetable: event.timetable ?? [],
          });
        } catch (error) {
          console.warn(
            `[dtm] Abruf der Eventdetails für "${summary.slug}" fehlgeschlagen:`,
            error instanceof Error ? error.message : error,
          );
        }
      }

      return parsed;
    })();
  }
  return cachedEvents;
}

// DTM und seine Rahmenserien laufen am selben Wochenende auf demselben
// Circuit, sind aber unterschiedliche Rennen (s. dedup.ts: exakter
// Eventname zusätzlich zu Circuit+Zeitfenster nötig). Ein Namenszusatz pro
// Rahmenserie hält die Events auch bei identischem Circuit/Zeitfenster
// unterscheidbar; DTM selbst (nameSuffix null) behält den schlichten
// Streckennamen wie schon bei den bisherigen ICS-Daten.
function buildSessionsForHeadline(
  events: ParsedEvent[],
  series: SeriesId,
  headline: string,
  nameSuffix: string | null,
): Session[] {
  const sessions: Session[] = [];

  for (const event of events) {
    for (const entry of event.timetable) {
      if ((entry.headline ?? '').trim() !== headline) continue;
      const sessionType = classifySessionLabel(entry.label);
      if (!sessionType) continue;

      sessions.push({
        series,
        eventName: nameSuffix ? `${event.eventName} (${nameSuffix})` : event.eventName,
        circuit: event.circuit,
        round: event.eventNumber,
        sessionType,
        startUtc: new Date(entry.start).toISOString(),
        endUtc: entry.end ? new Date(entry.end).toISOString() : null,
        source: 'api',
        confidence: 'exact',
      });
    }
  }

  return sessions;
}

export const dtmAdapter: Adapter = {
  series: 'dtm',
  async fetchSessions(): Promise<Session[]> {
    const events = await fetchAllParsedEvents();
    const sessions = buildSessionsForHeadline(events, 'dtm', 'DTM', null);

    // Wochenenden ohne veröffentlichte Timetable (z.B. weit im Voraus)
    // bekommen wie bei anderen Scrapern einen Datum-ohne-Uhrzeit-Fallback
    // statt ganz zu fehlen.
    const fallback: Session[] = events
      .filter((event) => event.timetable.length === 0)
      .map((event) => ({
        series: 'dtm',
        eventName: event.eventName,
        circuit: event.circuit,
        round: event.eventNumber,
        sessionType: 'race',
        startUtc: new Date(event.windowStartMs).toISOString(),
        endUtc: null,
        source: 'api',
        confidence: 'date-only',
      }));

    return [...sessions, ...fallback];
  },
};

export const porscheCarreraCupAdapter: Adapter = {
  series: 'porsche_carrera_cup_de',
  async fetchSessions(): Promise<Session[]> {
    const events = await fetchAllParsedEvents();
    // Läuft laut Recherche (Saison 2026) nur an DTM-Wochenenden -- die zwei
    // Termine im Rahmen von WEC (Imola) und International GT Open (Spa)
    // fehlen hier bewusst, da dtm.com dafür keine Timetable liefert.
    return buildSessionsForHeadline(
      events,
      'porsche_carrera_cup_de',
      'Porsche Sixt Carrera Cup Deutschland',
      'Porsche Carrera Cup',
    );
  },
};

const adacGtMastersIcsAdapter = createIcsAdapter('adac_gt_masters', ADAC_GT_MASTERS_CALENDAR_ID);
// Beim Abgleich, welche ICS-Termine schon durch die exakten DTM-API-Zeiten
// abgedeckt sind, etwas Puffer um das Eventfenster legen (Zeitzonen-Rundung,
// ICS liefert nur den Renntag).
const COVERED_WINDOW_BUFFER_MS = 3 * 24 * 60 * 60 * 1000;

export const adacGtMastersAdapter: Adapter = {
  series: 'adac_gt_masters',
  async fetchSessions(): Promise<Session[]> {
    const events = await fetchAllParsedEvents();
    const scraped = buildSessionsForHeadline(events, 'adac_gt_masters', 'ADAC GT Masters', 'ADAC GT Masters');

    // Nur Eventfenster als "abgedeckt" zählen, an denen ADAC GT Masters
    // laut Timetable tatsächlich dabei war (nicht jedes DTM-Wochenende --
    // s. Nürburgring, wo im DTM-Kalender nur ADAC GT4 Germany läuft).
    const coveredWindows = events
      .filter((event) => event.timetable.some((entry) => (entry.headline ?? '').trim() === 'ADAC GT Masters'))
      .map((event) => ({ start: event.windowStartMs, end: event.windowEndMs }));

    const icsSessions = await adacGtMastersIcsAdapter.fetchSessions();
    const icsForUncoveredWeekends = icsSessions.filter((session) => {
      const startMs = new Date(session.startUtc).getTime();
      return !coveredWindows.some(
        (window) => startMs >= window.start - COVERED_WINDOW_BUFFER_MS && startMs <= window.end + COVERED_WINDOW_BUFFER_MS,
      );
    });

    return [...scraped, ...icsForUncoveredWeekends];
  },
};
