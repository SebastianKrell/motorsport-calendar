import type { Adapter, Session } from '../types.js';

// TODO: echte API anbinden — github.com/sportstimes/f1 _db/fe/2026.json
// (s. CLAUDE.md, Abschnitt "Datenquellen"). Feldnamen der Quelle sind noch
// nicht verifiziert, deshalb hier bewusst noch kein Parsing -- lieber keine
// Termine liefern als geratene.
export const formelEAdapter: Adapter = {
  series: 'fe',
  async fetchSessions(): Promise<Session[]> {
    return [];
  },
};
