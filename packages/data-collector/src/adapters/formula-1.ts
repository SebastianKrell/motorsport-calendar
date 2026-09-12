import type { Adapter, Session, SessionType } from '../types.js';

const FEED_URL = 'https://raw.githubusercontent.com/sportstimes/f1/main/_db/f1/2026.json';
const USER_AGENT = 'motorsport-calendar (https://github.com/SebastianKrell/motorsport-calendar)';

interface SportstimesRace {
  name: string;
  location: string;
  round: number;
  sessions: Record<string, string>;
}

interface SportstimesFile {
  races: SportstimesRace[];
}

const SESSION_TYPE_BY_KEY: Record<string, SessionType> = {
  fp1: 'fp',
  fp2: 'fp',
  fp3: 'fp',
  sprintQualifying: 'sprint_quali',
  sprint: 'sprint',
  qualifying: 'quali',
  gp: 'race',
};

function eventName(name: string): string {
  return /grand prix/i.test(name) ? name : `${name} Grand Prix`;
}

export const formula1Adapter: Adapter = {
  series: 'f1',
  async fetchSessions(): Promise<Session[]> {
    const res = await fetch(FEED_URL, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) throw new Error(`sportstimes-Feed antwortete mit HTTP ${res.status}`);
    const data = (await res.json()) as SportstimesFile;

    const sessions: Session[] = [];
    for (const race of data.races) {
      for (const [key, startUtc] of Object.entries(race.sessions)) {
        const sessionType = SESSION_TYPE_BY_KEY[key];
        if (!sessionType) {
          console.warn(`[f1] unbekannter Session-Key "${key}" bei "${race.name}", übersprungen`);
          continue;
        }
        sessions.push({
          series: 'f1',
          eventName: eventName(race.name),
          circuit: race.location,
          round: race.round,
          sessionType,
          startUtc,
          endUtc: null,
          source: 'api',
          confidence: 'exact',
        });
      }
    }
    return sessions;
  },
};
