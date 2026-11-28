import { describe, expect, it } from 'vitest';
import { buildIcsCalendar } from './ics';
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

describe('buildIcsCalendar', () => {
  it('produces a valid VCALENDAR wrapper with one VEVENT per session', () => {
    const ics = buildIcsCalendar(
      [makeSession({ sessionType: 'fp' }), makeSession({ sessionType: 'race' })],
      (s) => `F1 – Test Grand Prix (${s.sessionType})`,
    );

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain('SUMMARY:F1 – Test Grand Prix (race)');
    expect(ics).toContain('LOCATION:Test Circuit');
  });

  it('uses the known endUtc when present', () => {
    const ics = buildIcsCalendar(
      [makeSession({ startUtc: '2026-09-13T13:00:00.000Z', endUtc: '2026-09-13T15:00:00.000Z' })],
      () => 'Race',
    );
    expect(ics).toContain('DTSTART:20260913T130000Z');
    expect(ics).toContain('DTEND:20260913T150000Z');
  });

  it('falls back to a default duration per session type when endUtc is missing', () => {
    const ics = buildIcsCalendar([makeSession({ sessionType: 'fp', startUtc: '2026-09-13T10:00:00.000Z', endUtc: null })], () => 'FP');
    expect(ics).toContain('DTSTART:20260913T100000Z');
    expect(ics).toContain('DTEND:20260913T113000Z');
  });

  it('escapes commas and semicolons in free text', () => {
    const ics = buildIcsCalendar(
      [makeSession({ circuit: 'Spa-Francorchamps, Belgium; Ardennes' })],
      () => 'Race',
    );
    expect(ics).toContain('LOCATION:Spa-Francorchamps\\, Belgium\\; Ardennes');
  });
});
