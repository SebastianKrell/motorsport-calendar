import { afterEach, describe, expect, it, vi } from 'vitest';
import { formula1Adapter } from './formula-1.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Formula 1 adapter', () => {
  it('maps all supported F1 session types from the structured feed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            races: [
              {
                name: 'Chinese',
                location: 'Shanghai',
                round: 2,
                sessions: {
                  fp1: '2026-03-13T03:30:00Z',
                  sprintQualifying: '2026-03-13T07:30:00Z',
                  sprint: '2026-03-14T03:00:00Z',
                  qualifying: '2026-03-14T07:00:00Z',
                  gp: '2026-03-15T07:00:00Z',
                },
              },
            ],
          }),
        ),
      ),
    );

    await expect(formula1Adapter.fetchSessions()).resolves.toEqual([
      expect.objectContaining({ eventName: 'Chinese Grand Prix', sessionType: 'fp' }),
      expect.objectContaining({ sessionType: 'sprint_quali' }),
      expect.objectContaining({ sessionType: 'sprint' }),
      expect.objectContaining({ sessionType: 'quali' }),
      expect.objectContaining({ sessionType: 'race' }),
    ]);
  });
});
