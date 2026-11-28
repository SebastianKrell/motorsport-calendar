import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import { formatCountdown } from './countdown';

describe('formatCountdown', () => {
  const now = DateTime.fromISO('2026-09-12T12:00:00.000Z');

  it('returns null for a target in the past', () => {
    expect(formatCountdown(now.minus({ minutes: 1 }), now, 'de')).toBeNull();
  });

  it('shows an imminent message for less than a minute', () => {
    expect(formatCountdown(now.plus({ seconds: 30 }), now, 'de')).toBe('in Kürze');
    expect(formatCountdown(now.plus({ seconds: 30 }), now, 'en')).toBe('starting shortly');
  });

  it('formats minutes only', () => {
    expect(formatCountdown(now.plus({ minutes: 42 }), now, 'de')).toBe('in 42 Min.');
    expect(formatCountdown(now.plus({ minutes: 1 }), now, 'en')).toBe('in 1 min');
  });

  it('formats hours and minutes', () => {
    expect(formatCountdown(now.plus({ hours: 2, minutes: 14 }), now, 'de')).toBe('in 2 Std. 14 Min.');
    expect(formatCountdown(now.plus({ hours: 1, minutes: 0 }), now, 'en')).toBe('in 1 hr 0 min');
  });

  it('formats days and hours', () => {
    expect(formatCountdown(now.plus({ days: 3, hours: 5 }), now, 'de')).toBe('in 3 Tage 5 Std.');
    expect(formatCountdown(now.plus({ days: 1, hours: 1 }), now, 'en')).toBe('in 1 day 1 hr');
  });
});
