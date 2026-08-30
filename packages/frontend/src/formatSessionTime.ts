import { DateTime } from 'luxon';
import { localeFor, UI_TEXT, type Language } from './i18n';
import type { Session } from './types';

export function displayStart(session: Session, timeZone: string): DateTime {
  const start = DateTime.fromISO(session.startUtc, { zone: 'utc' });
  return session.confidence === 'date-only' ? start : start.setZone(timeZone);
}

export function formatWhen(session: Session, timeZone: string, language: Language): string {
  const start = displayStart(session, timeZone).setLocale(localeFor(language));
  const day = language === 'de' ? start.toFormat('ccc dd.LL.') : start.toFormat('ccc dd LLL');
  return session.confidence === 'date-only'
    ? `${day} · ${UI_TEXT[language].timePending}`
    : `${day} · ${start.toFormat('HH:mm')}`;
}
