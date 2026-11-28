import { describe, expect, it } from 'vitest';
import { getCircuitFlag } from './circuitFlags';

describe('getCircuitFlag', () => {
  it('matches known circuits case-insensitively', () => {
    expect(getCircuitFlag('Nürburgring Nordschleife')).toBe('🇩🇪');
    expect(getCircuitFlag('daytona international speedway')).toBe('🇺🇸');
    expect(getCircuitFlag('Circuit de Spa-Francorchamps')).toBe('🇧🇪');
  });

  it('returns null for unknown circuits instead of guessing', () => {
    expect(getCircuitFlag('Some Brand New Street Circuit')).toBeNull();
  });
});
