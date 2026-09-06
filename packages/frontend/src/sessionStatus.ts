import { DateTime } from 'luxon';
import type { Session } from './types';

export function isLive(session: Session, now: DateTime): boolean {
  if (session.confidence !== 'exact' || !session.endUtc) return false;
  const start = DateTime.fromISO(session.startUtc, { zone: 'utc' });
  const end = DateTime.fromISO(session.endUtc, { zone: 'utc' });
  return now >= start && now <= end;
}

export function isPast(session: Session, now: DateTime): boolean {
  const reference = DateTime.fromISO(session.endUtc ?? session.startUtc, { zone: 'utc' });
  return reference < now;
}
