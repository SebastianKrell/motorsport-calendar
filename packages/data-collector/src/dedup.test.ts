import { describe, expect, it } from 'vitest';
import { deduplicateCrossSeries } from './dedup.js';
import type { Session, SeriesId } from './types.js';

function session(series: SeriesId, eventName = 'Spa 24 Hours'): Session {
  return {
    series,
    eventName,
    circuit: 'Spa-Francorchamps',
    round: null,
    sessionType: 'race',
    startUtc: '2026-06-27T14:00:00.000Z',
    endUtc: null,
    source: 'scrape',
    confidence: 'exact',
  };
}

describe('deduplicateCrossSeries', () => {
  it('bevorzugt IGTC bei demselben Event in einem GTWC-Kalender', () => {
    const result = deduplicateCrossSeries([session('gtwc_europe'), session('igtc')]);

    expect(result).toEqual([expect.objectContaining({ series: 'igtc' })]);
  });

  it('behält unterschiedliche Events auf derselben Strecke', () => {
    const result = deduplicateCrossSeries([
      session('dtm', 'DTM Spa'),
      session('adac_gt_masters', 'Spa (ADAC GT Masters)'),
    ]);

    expect(result).toHaveLength(2);
  });

  it('erkennt abweichende Indianapolis-Namen als dasselbe IGTC-Event', () => {
    const igtc = {
      ...session('igtc', 'Indianapolis 8 Hour'),
      circuit: 'Indianapolis Motor Speedway',
      startUtc: '2026-10-10T16:30:00.000Z',
    };
    const gtwc = {
      ...session('gtwc_america', 'Indianapolis Motor Speedway'),
      circuit: 'Indianapolis Motor Speedway',
      startUtc: '2026-10-10T16:30:00.000Z',
    };

    expect(deduplicateCrossSeries([igtc, gtwc])).toEqual([igtc]);
  });

  it('behält eigenständige Support-Serien am selben Rennwochenende', () => {
    const igtc = {
      ...session('igtc', 'Indianapolis 8 Hour'),
      circuit: 'Indianapolis Motor Speedway',
      startUtc: '2026-10-10T16:30:00.000Z',
    };
    const gtAmerica = {
      ...session('gt_gt4_america', 'Indianapolis Motor Speedway (GT America)'),
      circuit: 'Indianapolis Motor Speedway',
      startUtc: '2026-10-10T12:05:00.000Z',
    };

    expect(deduplicateCrossSeries([igtc, gtAmerica])).toEqual([igtc, gtAmerica]);
  });
});
