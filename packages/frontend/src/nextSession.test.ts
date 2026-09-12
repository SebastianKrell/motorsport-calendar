import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import { findNextSession } from './nextSession';
import type { Session } from './types';

const makeSession = (overrides: Partial<Session>): Session => ({
  series: 'f1',
  eventName: 'Test Grand Prix',
  circuit: 'Test Circuit',
  round: 1,
  sessionType: 'race',
  startUtc: '2026-09-13T13:00:00.000Z',
  endUtc: null,
  source: 'api',
  confidence: 'exact',
  broadcasters: [],
  broadcastersVerifiedAt: null,
  ...overrides,
});

describe('findNextSession', () => {
  const now = DateTime.fromISO('2026-09-12T12:00:00.000Z');

  it('prefers a currently live session over a later session', () => {
    const live = makeSession({
      eventName: 'Live race',
      startUtc: '2026-09-12T11:00:00.000Z',
      endUtc: '2026-09-12T17:00:00.000Z',
    });
    expect(findNextSession([makeSession({ eventName: 'Later race' }), live], now)).toBe(live);
  });

  it('returns the earliest session that has not finished', () => {
    const next = makeSession({ eventName: 'Next race', startUtc: '2026-09-12T13:00:00.000Z' });
    expect(
      findNextSession([makeSession({ eventName: 'Past race', startUtc: '2026-09-12T10:00:00.000Z' }), next], now),
    ).toBe(next);
  });
});
