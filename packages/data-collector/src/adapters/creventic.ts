import * as cheerio from 'cheerio';
import { DateTime } from 'luxon';
import type { Adapter, Session, SessionType } from '../types.js';

const USER_AGENT = 'motorsport-calendar (https://github.com/SebastianKrell/motorsport-calendar)';
const RACES_URL = 'https://www.24hseries.com/races';

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`HTTP ${response.status} bei ${url}`);
  return response.text();
}

function classifySession(name: string): SessionType | null {
  if (/free practice|night practice/i.test(name)) return 'fp';
  if (/qualifying/i.test(name)) return 'quali';
  if (/^race\b/i.test(name)) return 'race';
  return null;
}

function raceDurationHours(name: string): number | null {
  const match = name.match(/\b(\d+)H\b/i);
  return match ? Number(match[1]) : null;
}

export function extractCreventicRaceUrls(html: string): string[] {
  const $ = cheerio.load(html);
  const currentYear = new Date().getUTCFullYear();
  return [
    ...new Set(
      $('a[href^="/races/"]')
        .map((_, link) => $(link).attr('href') ?? '')
        .get()
        .filter((href) => {
          const match = href.match(/^\/races\/(?:michelin|hankook)-(?:6|12|24)h-[a-z0-9-]+-(\d{4})$/);
          return match !== null && Number(match[1]) >= currentYear;
        }),
    ),
  ].map((href) => `https://www.24hseries.com${href}`);
}

export function extractCreventicSessions(html: string): Session[] {
  const $ = cheerio.load(html);
  const eventName = normalizeText($('meta[property="og:title"]').attr('content') ?? $('title').text()).replace(/\s+\d{4}$/, '');
  const circuit = normalizeText($('.race-header .location, .header-race .location').first().text()) || eventName;
  const durationHours = raceDurationHours(eventName);
  const sessions: Session[] = [];

  $('.entry').each((_, element) => {
    const entry = $(element);
    const name = normalizeText(entry.find('.name').first().text());
    const sessionType = classifySession(name);
    const date = entry.attr('data-date');
    const zone = entry.find('.startTime').first().attr('data-tz');
    if (!sessionType || !date || !zone) return;

    const start = DateTime.fromFormat(date, 'LLLL d, yyyy HH:mm', { zone, locale: 'en' });
    if (!start.isValid) return;
    const end =
      sessionType === 'race' && durationHours ? start.plus({ hours: durationHours }).toUTC().toISO() : null;
    sessions.push({
      series: 'creventic_24h',
      eventName,
      circuit,
      round: null,
      sessionType,
      startUtc: start.toUTC().toISO()!,
      endUtc: end,
      source: 'scrape',
      confidence: 'exact',
    });
  });

  return sessions;
}

export const creventic24hAdapter: Adapter = {
  series: 'creventic_24h',
  async fetchSessions(): Promise<Session[]> {
    const raceUrls = extractCreventicRaceUrls(await fetchHtml(RACES_URL));
    const sessions = (
      await Promise.all(
        raceUrls.map(async (url) => {
          try {
            return extractCreventicSessions(await fetchHtml(url));
          } catch (error) {
            console.warn(`[creventic_24h] Zeitplan von ${url} fehlgeschlagen:`, error instanceof Error ? error.message : error);
            return [];
          }
        }),
      )
    ).flat();
    if (sessions.length === 0) throw new Error('Keine Sessions auf der offiziellen 24H-Series-Website gefunden');
    return sessions;
  },
};
