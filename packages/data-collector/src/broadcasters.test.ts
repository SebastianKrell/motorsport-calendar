import { describe, expect, it } from 'vitest';
import { resolveBroadcasters } from './broadcasters.js';

const config = {
  wec: {
    default: {
      broadcasters: [{ name: 'FIAWEC+', type: 'streaming-paid' }],
      verifiedAt: '2026-08-01',
    },
    events: [
      {
        match: 'Le Mans',
        broadcasters: [{ name: 'Eurosport 1', type: 'free-tv' }],
        verifiedAt: '2026-08-20',
      },
    ],
  },
};

describe('resolveBroadcasters', () => {
  it('wendet Event-Ausnahmen ohne Beachtung der Großschreibung an', () => {
    const result = resolveBroadcasters(config, { series: 'wec', eventName: '24 HOURS OF LE MANS' });

    expect(result).toEqual({
      broadcasters: [{ name: 'Eurosport 1', type: 'free-tv' }],
      verifiedAt: '2026-08-20',
    });
  });

  it('verwendet andernfalls die Serien-Vorgabe', () => {
    const result = resolveBroadcasters(config, { series: 'wec', eventName: '6 Hours of Spa' });

    expect(result.broadcasters).toEqual([{ name: 'FIAWEC+', type: 'streaming-paid' }]);
  });

  it('liefert für nicht konfigurierte Serien eine leere Zuordnung', () => {
    expect(resolveBroadcasters(config, { series: 'super_gt', eventName: 'Fuji' })).toEqual({
      broadcasters: [],
      verifiedAt: null,
    });
  });
});
