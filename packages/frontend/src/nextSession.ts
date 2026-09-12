import { DateTime } from 'luxon';
import { isLive, isPast } from './sessionStatus';
import type { Session } from './types';

export function findNextSession(sessions: Session[], now: DateTime): Session | null {
  const live = sessions.find((session) => isLive(session, now));
  if (live) return live;

  return (
    sessions
      .filter((session) => !isPast(session, now))
      .sort((a, b) => a.startUtc.localeCompare(b.startUtc))[0] ?? null
  );
}
