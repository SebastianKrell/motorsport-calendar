import { DateTime } from 'luxon';
import type { Session } from '../types';

const VERIFIED_STALE_AFTER_DAYS = 60;

function formatWhen(session: Session): string {
  const start = DateTime.fromISO(session.startUtc, { zone: 'utc' }).setZone('Europe/Berlin');
  if (session.confidence === 'date-only') {
    return `${start.setLocale('de').toFormat('ccc dd.LL.')} — Uhrzeit tbc`;
  }
  return start.setLocale('de').toFormat('ccc dd.LL. HH:mm');
}

function isStale(verifiedAt: string | null): boolean {
  if (!verifiedAt) return true;
  const verified = DateTime.fromISO(verifiedAt);
  return DateTime.now().diff(verified, 'days').days > VERIFIED_STALE_AFTER_DAYS;
}

export function SessionTable({ sessions }: { sessions: Session[] }) {
  const sorted = [...sessions].sort((a, b) => a.startUtc.localeCompare(b.startUtc));

  if (sorted.length === 0) {
    return <p>Keine Termine gefunden.</p>;
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Wann (DE)</th>
          <th>Serie</th>
          <th>Event</th>
          <th>Session</th>
          <th>Sender</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((session, index) => (
          <tr key={`${session.series}-${session.eventName}-${session.sessionType}-${index}`}>
            <td>{formatWhen(session)}</td>
            <td>{session.series}</td>
            <td>{session.eventName}</td>
            <td>{session.sessionType}</td>
            <td>
              {session.broadcasters.length === 0 ? (
                '—'
              ) : (
                <>
                  {session.broadcasters.map((b) => b.name).join(', ')}
                  {isStale(session.broadcastersVerifiedAt) && (
                    <span title="Sender-Info seit über 60 Tagen nicht geprüft"> (ohne Gewähr)</span>
                  )}
                </>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
