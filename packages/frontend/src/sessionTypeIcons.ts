import type { SessionType } from './types';

// Kurze, sprachunabhängige Icons pro Sessiontyp -- ergänzen die Text-Chips,
// damit der Typ auch ohne Lesen der Beschriftung auf einen Blick erkennbar ist.
export const SESSION_TYPE_ICONS: Record<SessionType, string> = {
  fp: '🔧',
  sprint_quali: '⏱️',
  quali: '⏱️',
  sprint: '⚡',
  race: '🏁',
  event: '📅',
};
