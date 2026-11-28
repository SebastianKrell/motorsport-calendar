import { describe, expect, it } from 'vitest';
import { assignLanes, computeEventSpans } from './calendarLanes';

describe('computeEventSpans', () => {
  it('builds a contiguous span from the min to max day an event occurs on', () => {
    const spans = computeEventSpans([
      { key: 'f1::GP', color: '#fff', day: 27 },
      { key: 'f1::GP', color: '#fff', day: 29 },
    ]);
    expect(spans).toHaveLength(1);
    expect(spans[0]).toMatchObject({ startDay: 27, endDay: 29, days: [27, 29] });
  });

  it('keeps separate events as separate spans', () => {
    const spans = computeEventSpans([
      { key: 'a', color: '#f00', day: 1 },
      { key: 'b', color: '#0f0', day: 1 },
    ]);
    expect(spans).toHaveLength(2);
  });
});

describe('assignLanes', () => {
  it('gives non-overlapping events the same lane 0', () => {
    const lanes = assignLanes([
      { key: 'a', color: '#f00', days: [1], startDay: 1, endDay: 1 },
      { key: 'b', color: '#0f0', days: [5], startDay: 5, endDay: 5 },
    ]);
    expect(lanes.get('a')).toBe(0);
    expect(lanes.get('b')).toBe(0);
  });

  it('puts overlapping events on different lanes', () => {
    const lanes = assignLanes([
      { key: 'a', color: '#f00', days: [1, 2, 3], startDay: 1, endDay: 3 },
      { key: 'b', color: '#0f0', days: [2, 3, 4], startDay: 2, endDay: 4 },
    ]);
    expect(lanes.get('a')).not.toBe(lanes.get('b'));
  });

  it('reuses a freed lane once the earlier event has ended', () => {
    const lanes = assignLanes([
      { key: 'a', color: '#f00', days: [1, 2], startDay: 1, endDay: 2 },
      { key: 'b', color: '#0f0', days: [3, 4], startDay: 3, endDay: 4 },
    ]);
    expect(lanes.get('a')).toBe(0);
    expect(lanes.get('b')).toBe(0);
  });
});
