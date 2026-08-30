import type { SessionType, SeriesId } from './types';

export type Language = 'de' | 'en';

export const LANGUAGE_OPTIONS: { value: Language; label: string }[] = [
  { value: 'de', label: 'Deutsch' },
  { value: 'en', label: 'English' },
];

export const SERIES_LABELS: Record<Language, Record<SeriesId, string>> = {
  de: {
    fe: 'Formel E',
    nls: 'NLS',
    wec: 'WEC',
    imsa: 'IMSA',
    gtwc_europe: 'GTWC Europe',
    dtm: 'DTM',
    adac_gt_masters: 'ADAC GT Masters',
    porsche_carrera_cup_de: 'Porsche Carrera Cup',
    igtc: 'IGTC',
    gtwc_america: 'GTWC America',
    gtwc_asia: 'GTWC Asia',
    gtwc_australia: 'GTWC Australia',
    british_gt: 'British GT',
    gt_open: 'GT Open',
    creventic_24h: '24H Series',
    super_gt: 'Super GT',
    gt2_gt4_europe: 'GT2/GT4 Europe',
    gt_gt4_america: 'GT/GT4 America',
    elms: 'ELMS',
    asian_le_mans: 'Asian Le Mans Series',
    michelin_le_mans_cup: 'Michelin Le Mans Cup',
  },
  en: {
    fe: 'Formula E',
    nls: 'NLS',
    wec: 'WEC',
    imsa: 'IMSA',
    gtwc_europe: 'GTWC Europe',
    dtm: 'DTM',
    adac_gt_masters: 'ADAC GT Masters',
    porsche_carrera_cup_de: 'Porsche Carrera Cup',
    igtc: 'IGTC',
    gtwc_america: 'GTWC America',
    gtwc_asia: 'GTWC Asia',
    gtwc_australia: 'GTWC Australia',
    british_gt: 'British GT',
    gt_open: 'GT Open',
    creventic_24h: '24H Series',
    super_gt: 'Super GT',
    gt2_gt4_europe: 'GT2/GT4 Europe',
    gt_gt4_america: 'GT/GT4 America',
    elms: 'ELMS',
    asian_le_mans: 'Asian Le Mans Series',
    michelin_le_mans_cup: 'Michelin Le Mans Cup',
  },
};

export const SESSION_TYPE_LABELS: Record<Language, Record<SessionType, string>> = {
  de: { fp: 'Training', quali: 'Qualifying', sprint: 'Sprint', race: 'Rennen' },
  en: { fp: 'Practice', quali: 'Qualifying', sprint: 'Sprint', race: 'Race' },
};

export const UI_TEXT = {
  de: {
    title: 'MOTORSPORT-KALENDER',
    light: 'Hell',
    dark: 'Dunkel',
    theme: 'Farbschema',
    timeZone: 'Zeitzone',
    language: 'Sprache',
    contact: 'Kontakt',
    series: 'Serie',
    session: 'Session',
    all: 'Alle',
    none: 'Keine',
    loadError: 'Termine konnten nicht geladen werden',
    loading: 'Lade Termine …',
    previousMonth: 'Vorheriger Monat',
    nextMonth: 'Nächster Monat',
    currentMonth: 'Zum heutigen Monat springen',
    today: 'Heute',
    noEvents: 'Keine Termine in diesem Monat.',
    timePending: 'Uhrzeit noch offen',
    live: 'Live',
    unverified: 'ohne Gewähr',
    dataAsOf: 'Datenstand',
    imprint: 'Impressum',
    privacy: 'Datenschutz',
  },
  en: {
    title: 'MOTORSPORT CALENDAR',
    light: 'Light',
    dark: 'Dark',
    theme: 'Colour scheme',
    timeZone: 'Time zone',
    language: 'Language',
    contact: 'Contact',
    series: 'Series',
    session: 'Session',
    all: 'All',
    none: 'None',
    loadError: 'Events could not be loaded',
    loading: 'Loading events …',
    previousMonth: 'Previous month',
    nextMonth: 'Next month',
    currentMonth: 'Jump to the current month',
    today: 'Today',
    noEvents: 'No events this month.',
    timePending: 'Time to be confirmed',
    live: 'Live',
    unverified: 'not guaranteed',
    dataAsOf: 'Data last updated',
    imprint: 'Legal notice',
    privacy: 'Privacy',
  },
} satisfies Record<Language, Record<string, string>>;

export function localeFor(language: Language): string {
  return language === 'de' ? 'de' : 'en-GB';
}

export function broadcasterLabel(name: string, language: Language): string {
  if (language === 'de') return name;
  return name
    .replace('deutscher Kommentar', 'German commentary')
    .replace('zeitversetzt', 'delayed')
    .replace('Free-TV', 'free-to-air TV');
}
