import type { Adapter, Session, SessionType } from '../types.js';

const USER_AGENT = 'motorsport-calendar (https://github.com/SebastianKrell/motorsport-calendar)';
const BASE_URL = 'https://www.lemanscup.com';
const SEASON_URL = `${BASE_URL}/en/season/2026`;
const RACE_URL_REGEX = /href="(\/en\/race\/[a-z0-9-]+-2026)"/g;

interface RawSubEvent {
  name: string;
  startDate: string;
}

export interface LeMansCupEvent {
  '@type': string;
  location?: { name?: string };
  subEvent?: RawSubEvent[];
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`HTTP ${response.status} bei ${url}`);
  return response.text();
}

export function extractRaceUrls(html: string): string[] {
  const urls = new Set<string>();
  for (const match of html.matchAll(RACE_URL_REGEX)) {
    if (match[1].includes('collective-tests')) continue;
    urls.add(`${BASE_URL}${match[1]}`);
  }
  return [...urls];
}

export function extractLeMansCupEvent(html: string): LeMansCupEvent | null {
  const scriptRegex = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  for (const match of html.matchAll(scriptRegex)) {
    try {
      const parsed = JSON.parse(match[1]) as LeMansCupEvent;
      if (parsed['@type'] === 'SportsEvent' && Array.isArray(parsed.subEvent)) return parsed;
    } catch {
      // Andere JSON-LD-Blöcke sind für den Kalender nicht relevant.
    }
  }
  return null;
}

function classifySession(label: string): SessionType | null {
  const lower = label.toLowerCase();
  if (lower.startsWith('free practice')) return 'fp';
  if (lower.startsWith('qualifying')) return 'quali';
  if (lower.startsWith('race')) return 'race';
  return null;
}

function splitLabelAndEvent(name: string): { label: string; eventName: string } {
  const parts = name.split(' - ');
  return {
    label: parts.slice(0, -1).join(' - '),
    eventName: parts.at(-1) ?? name,
  };
}

function sessionSuffix(label: string): string {
  const qualifyingClass = label.replace(/^Qualifying\s*-\s*/i, '');
  if (qualifyingClass !== label) return ` (${qualifyingClass})`;
  return /^Race\s+\d+$/i.test(label) ? ` (${label})` : '';
}

export function sessionsFromLeMansCupEvent(event: LeMansCupEvent): Session[] {
  const sessions: Session[] = [];
  for (const subEvent of event.subEvent ?? []) {
    const { label, eventName } = splitLabelAndEvent(subEvent.name);
    const sessionType = classifySession(label);
    if (!sessionType) continue;

    sessions.push({
      series: 'michelin_le_mans_cup',
      eventName: `${eventName}${sessionSuffix(label)}`,
      circuit: event.location?.name ?? '',
      round: null,
      sessionType,
      startUtc: new Date(subEvent.startDate).toISOString(),
      endUtc: null,
      source: 'scrape',
      confidence: 'exact',
    });
  }
  return sessions;
}

export const leMansCupAdapter: Adapter = {
  series: 'michelin_le_mans_cup',
  async fetchSessions(): Promise<Session[]> {
    const raceUrls = extractRaceUrls(await fetchHtml(SEASON_URL));
    const sessions: Session[] = [];

    for (const url of raceUrls) {
      try {
        const event = extractLeMansCupEvent(await fetchHtml(url));
        if (!event) {
          console.warn(`[michelin_le_mans_cup] kein JSON-LD-Zeitplan auf ${url} gefunden, überspringe`);
          continue;
        }
        sessions.push(...sessionsFromLeMansCupEvent(event));
      } catch (error) {
        console.warn(
          `[michelin_le_mans_cup] Scrape von ${url} fehlgeschlagen:`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    if (sessions.length === 0) throw new Error('Keine Le-Mans-Cup-Sessions gefunden');
    return sessions;
  },
};
