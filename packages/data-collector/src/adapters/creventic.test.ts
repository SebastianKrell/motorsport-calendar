import { afterEach, describe, expect, it, vi } from 'vitest';
import { extractCreventicRaceUrls, extractCreventicSessions } from './creventic.js';

describe('Creventic adapter', () => {
  it('extracts only current and future official race URLs', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-20T00:00:00Z'));
    const urls = extractCreventicRaceUrls(`
      <a href="/races/hankook-24h-barcelona-2024">Past</a>
      <a href="/races/michelin-24h-barcelona-2026">Current</a>
      <a href="/races/michelin-24h-barcelona-2027">Future</a>
    `);

    expect(urls).toEqual([
      'https://www.24hseries.com/races/michelin-24h-barcelona-2026',
      'https://www.24hseries.com/races/michelin-24h-barcelona-2027',
    ]);
  });

  it('preserves an official 24-hour race start and end time', () => {
    const sessions = extractCreventicSessions(`
      <meta property="og:title" content="Michelin 24H Barcelona 2026">
      <div class="entry" data-date="September 19, 2026 12:00">
        <span class="name">Race - Michelin 24H Barcelona 2026</span>
        <span class="startTime" data-tz="Europe/Amsterdam">12:00</span>
      </div>
    `);

    expect(sessions).toEqual([
      expect.objectContaining({
        eventName: 'Michelin 24H Barcelona',
        sessionType: 'race',
        startUtc: '2026-09-19T10:00:00.000Z',
        endUtc: '2026-09-20T10:00:00.000Z',
      }),
    ]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});
