import { DateTime } from 'luxon';
import type { Session } from './types';

const UNKNOWN_END_GRACE_HOURS = 24;

export function isLive(session: Session, now: DateTime): boolean {
  if (session.confidence !== 'exact' || !session.endUtc) return false;
  const start = DateTime.fromISO(session.startUtc, { zone: 'utc' });
  const end = DateTime.fromISO(session.endUtc, { zone: 'utc' });
  return now >= start && now <= end;
}

export function isPast(session: Session, now: DateTime): boolean {
  const reference = session.endUtc
    ? DateTime.fromISO(session.endUtc, { zone: 'utc' })
    : DateTime.fromISO(session.startUtc, { zone: 'utc' }).plus({ hours: UNKNOWN_END_GRACE_HOURS });
  return reference < now;
}
