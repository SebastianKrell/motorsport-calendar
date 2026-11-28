import type { DateTime } from 'luxon';
import type { Language } from './i18n';

const UNIT_LABELS: Record<Language, { day: string; days: string; hour: string; hours: string; minute: string; minutes: string; prefix: string; imminent: string }> = {
  de: { day: 'Tag', days: 'Tage', hour: 'Std.', hours: 'Std.', minute: 'Min.', minutes: 'Min.', prefix: 'in', imminent: 'in Kürze' },
  en: { day: 'day', days: 'days', hour: 'hr', hours: 'hrs', minute: 'min', minutes: 'min', prefix: 'in', imminent: 'starting shortly' },
};

// Formatiert die verbleibende Zeit bis zum Sessionstart als kurzen,
// tickenden Countdown-Text (z.B. "in 2 Std. 14 Min."). Gibt null zurück,
// wenn die Zielzeit bereits erreicht/vergangen ist -- die Live-Anzeige
// übernimmt dann stattdessen.
export function formatCountdown(target: DateTime, now: DateTime, language: Language): string | null {
  const diffMs = target.toMillis() - now.toMillis();
  if (diffMs <= 0) return null;

  const labels = UNIT_LABELS[language];
  const totalMinutes = Math.floor(diffMs / 60_000);
  if (totalMinutes < 1) return labels.imminent;

  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    const dayLabel = days === 1 ? labels.day : labels.days;
    return `${labels.prefix} ${days} ${dayLabel} ${hours} ${hours === 1 ? labels.hour : labels.hours}`;
  }
  if (hours > 0) {
    return `${labels.prefix} ${hours} ${hours === 1 ? labels.hour : labels.hours} ${minutes} ${minutes === 1 ? labels.minute : labels.minutes}`;
  }
  return `${labels.prefix} ${minutes} ${minutes === 1 ? labels.minute : labels.minutes}`;
}
