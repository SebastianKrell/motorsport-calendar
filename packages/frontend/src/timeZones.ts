import type { Language } from './i18n';

export const DEFAULT_TIME_ZONE = 'Europe/Berlin';

export const TIME_ZONE_OPTIONS: {
  value: string;
  labels: Record<Language, string>;
}[] = [
  { value: 'Europe/Berlin', labels: { de: 'Berlin · MEZ/MESZ', en: 'Berlin · CET/CEST' } },
  { value: 'UTC', labels: { de: 'UTC', en: 'UTC' } },
  { value: 'Europe/London', labels: { de: 'London · GMT/BST', en: 'London · GMT/BST' } },
  { value: 'Europe/Helsinki', labels: { de: 'Helsinki · OEZ/OESZ', en: 'Helsinki · EET/EEST' } },
  { value: 'America/New_York', labels: { de: 'New York · ET', en: 'New York · ET' } },
  { value: 'America/Chicago', labels: { de: 'Chicago · CT', en: 'Chicago · CT' } },
  { value: 'America/Denver', labels: { de: 'Denver · MT', en: 'Denver · MT' } },
  { value: 'America/Los_Angeles', labels: { de: 'Los Angeles · PT', en: 'Los Angeles · PT' } },
  { value: 'America/Sao_Paulo', labels: { de: 'São Paulo · BRT', en: 'São Paulo · BRT' } },
  { value: 'Asia/Dubai', labels: { de: 'Dubai · GST', en: 'Dubai · GST' } },
  { value: 'Asia/Kolkata', labels: { de: 'Kolkata · IST', en: 'Kolkata · IST' } },
  { value: 'Asia/Shanghai', labels: { de: 'Shanghai · CST', en: 'Shanghai · CST' } },
  { value: 'Asia/Singapore', labels: { de: 'Singapur · SGT', en: 'Singapore · SGT' } },
  { value: 'Asia/Tokyo', labels: { de: 'Tokio · JST', en: 'Tokyo · JST' } },
  { value: 'Australia/Sydney', labels: { de: 'Sydney · AET', en: 'Sydney · AET' } },
  { value: 'Pacific/Auckland', labels: { de: 'Auckland · NZT', en: 'Auckland · NZT' } },
];

export function isSupportedTimeZone(value: string | null): value is string {
  return TIME_ZONE_OPTIONS.some((option) => option.value === value);
}
