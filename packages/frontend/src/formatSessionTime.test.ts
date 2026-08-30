import { describe, expect, it } from 'vitest';
import type { Session } from './types';
import { formatWhen } from './formatSessionTime';

const session: Session = {
  series: 'wec',
  eventName: 'Test',
  circuit: 'Test',
  round: 1,
  sessionType: 'race',
  startUtc: '2026-07-04T22:30:00Z',
  endUtc: null,
  source: 'scrape',
  confidence: 'exact',
  broadcasters: [],
  broadcastersVerifiedAt: null,
};

describe('formatWhen', () => {
  it('converts exact session times and dates to the selected time zone', () => {
    expect(formatWhen(session, 'Europe/Berlin', 'de')).toBe('So 05.07. · 00:30');
    expect(formatWhen(session, 'America/New_York', 'en')).toBe('Sat 04 Jul · 18:30');
  });

  it('does not shift a date-only event into a different calendar day', () => {
    expect(
      formatWhen({ ...session, startUtc: '2026-07-04T00:00:00Z', confidence: 'date-only' }, 'America/Los_Angeles', 'en'),
    ).toBe('Sat 04 Jul · Time to be confirmed');
  });
});
