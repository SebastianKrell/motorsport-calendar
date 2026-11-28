import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import { findNextEventGroup, groupSessionsByEvent, isGroupLive, isGroupPast } from './eventGroups';
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

describe('groupSessionsByEvent', () => {
  it('groups sessions by series + event name and sorts them chronologically', () => {
    const race = makeSession({ sessionType: 'race', startUtc: '2026-09-13T13:00:00.000Z' });
    const fp = makeSession({ sessionType: 'fp', startUtc: '2026-09-11T10:00:00.000Z' });
    const quali = makeSession({ sessionType: 'quali', startUtc: '2026-09-12T13:00:00.000Z' });
    const other = makeSession({ eventName: 'Other Grand Prix', startUtc: '2026-09-13T13:00:00.000Z' });

    const groups = groupSessionsByEvent([race, fp, quali, other]);

    expect(groups).toHaveLength(2);
    const testGpGroup = groups.find((g) => g.eventName === 'Test Grand Prix')!;
    expect(testGpGroup.sessions.map((s) => s.sessionType)).toEqual(['fp', 'quali', 'race']);
  });

  it('keeps sessions of the same series but different event names separate', () => {
    const groups = groupSessionsByEvent([
      makeSession({ eventName: 'A' }),
      makeSession({ eventName: 'B' }),
    ]);
    expect(groups).toHaveLength(2);
  });
});

describe('findNextEventGroup', () => {
  const now = DateTime.fromISO('2026-09-12T12:00:00.000Z');

  it('prefers the group with a currently live session', () => {
    const liveSession = makeSession({
      eventName: 'Live Event',
      startUtc: '2026-09-12T11:00:00.000Z',
      endUtc: '2026-09-12T17:00:00.000Z',
    });
    const laterSession = makeSession({ eventName: 'Later Event', startUtc: '2026-09-13T13:00:00.000Z' });

    const group = findNextEventGroup([laterSession, liveSession], now);
    expect(group?.eventName).toBe('Live Event');
  });

  it('falls back to the group with the earliest upcoming session', () => {
    const past = makeSession({ eventName: 'Past Event', startUtc: '2026-09-11T10:00:00.000Z' });
    const next = makeSession({ eventName: 'Next Event', startUtc: '2026-09-13T13:00:00.000Z' });
    const group = findNextEventGroup([past, next], now);
    expect(group?.eventName).toBe('Next Event');
  });

  it('returns null when every session is in the past', () => {
    const past = makeSession({ startUtc: '2026-09-11T10:00:00.000Z' });
    expect(findNextEventGroup([past], now)).toBeNull();
  });
});

describe('isGroupLive / isGroupPast', () => {
  const now = DateTime.fromISO('2026-09-12T12:00:00.000Z');

  it('detects a live session anywhere in the group', () => {
    const groups = groupSessionsByEvent([
      makeSession({ sessionType: 'fp', startUtc: '2026-09-11T10:00:00.000Z' }),
      makeSession({
        sessionType: 'race',
        startUtc: '2026-09-12T11:00:00.000Z',
        endUtc: '2026-09-12T17:00:00.000Z',
      }),
    ]);
    expect(isGroupLive(groups[0], now)).toBe(true);
    expect(isGroupPast(groups[0], now)).toBe(false);
  });

  it('marks a group past only once every session has finished', () => {
    const groups = groupSessionsByEvent([
      makeSession({ sessionType: 'fp', startUtc: '2026-09-11T10:00:00.000Z' }),
      makeSession({ sessionType: 'race', startUtc: '2026-09-11T13:00:00.000Z' }),
    ]);
    expect(isGroupPast(groups[0], now)).toBe(true);
  });
});
