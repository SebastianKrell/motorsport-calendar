import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import { isPast } from './sessionStatus';
import type { Session } from './types';

const session: Session = {
  series: 'gtwc_europe',
  eventName: 'Nürburgring',
  circuit: 'Nürburgring',
  round: 7,
  sessionType: 'race',
  startUtc: '2026-08-30T13:00:00.000Z',
  endUtc: null,
  source: 'scrape',
  confidence: 'exact',
  broadcasters: [],
  broadcastersVerifiedAt: null,
};

describe('isPast', () => {
  it('does not mark a race with unknown end time as past immediately after the start', () => {
    expect(isPast(session, DateTime.fromISO('2026-08-30T14:54:00Z'))).toBe(false);
  });

  it('uses the known end time when one is available', () => {
    expect(
      isPast(
        { ...session, endUtc: '2026-08-30T14:00:00.000Z' },
        DateTime.fromISO('2026-08-30T14:54:00Z'),
      ),
    ).toBe(true);
  });
});
