import type { Language } from './i18n';

export const DEFAULT_TIME_ZONE = 'Europe/Berlin';

export const TIME_ZONE_OPTIONS: {
  value: string;
  labels: Record<Language, string>;
}[] = [
  { value: 'Europe/Berlin', labels: { de: 'Deutschland', en: 'Germany' } },
  { value: 'UTC', labels: { de: 'UTC', en: 'UTC' } },
  { value: 'Europe/London', labels: { de: 'Großbritannien', en: 'United Kingdom' } },
  { value: 'America/New_York', labels: { de: 'US-Ostküste', en: 'US Eastern' } },
  { value: 'America/Chicago', labels: { de: 'US-Zentralzeit', en: 'US Central' } },
  { value: 'America/Los_Angeles', labels: { de: 'US-Westküste', en: 'US Pacific' } },
  { value: 'Asia/Tokyo', labels: { de: 'Japan', en: 'Japan' } },
  { value: 'Australia/Sydney', labels: { de: 'Australien (Sydney)', en: 'Australia (Sydney)' } },
];

export function isSupportedTimeZone(value: string | null): value is string {
  return TIME_ZONE_OPTIONS.some((option) => option.value === value);
}
