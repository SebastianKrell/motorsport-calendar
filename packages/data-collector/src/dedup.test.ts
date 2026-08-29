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
});
