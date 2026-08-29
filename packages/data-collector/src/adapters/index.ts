import type { Adapter, SeriesId } from '../types.js';
import { adacGtMastersAdapter, dtmAdapter, porscheCarreraCupAdapter } from './dtm.js';
import { elmsAdapter } from './elms.js';
import { formelEAdapter } from './formel-e.js';
import { gtOpenAdapter } from './gt_open.js';
import { createCombinedGtwcAdapter, createGtwcAdapter } from './gtwc.js';
import { createIcsAdapter } from './ics.js';
import { imsaAdapter } from './imsa.js';
import { leMansCupAdapter } from './le-mans-cup.js';
import { nlsAdapter } from './nls.js';
import { superGtAdapter } from './super-gt.js';
import { wecAdapter } from './wec.js';

// Kalender-IDs s. CLAUDE.md, Abschnitt "ICS-Feeds (toomuchracing.com)".
// Italian GT und China GT fehlen bewusst: laut CLAUDE.md gibt es dafür
// keinen ICS-Feed, nur eine Website (bräuchte einen eigenen Scraper).
// NLS, WEC, IMSA, ELMS, Michelin Le Mans Cup, British GT und alle vier GTWC-Regionen laufen
// nicht mehr über den generischen ICS-Adapter, sondern über dedizierte Adapter
// (nls.ts, wec.ts, imsa.ts, elms.ts, le-mans-cup.ts, gtwc.ts), die echte
// Uhrzeiten liefern statt nur Datumsangaben ohne Uhrzeit. DTM und der Porsche Carrera Cup Deutschland
// laufen komplett, ADAC GT Masters teilweise über die echte dtm.com-API
// (s. dtm.ts).
const ICS_SERIES: [SeriesId, string][] = [
  ['creventic_24h', '6rddivl20t6526fknlbhmhf6ps'],
  ['asian_le_mans', 'lilnartmo4uglqdpatsve4pido'],
];

// Die vier GTWC-Regionalseiten, IGTC und British GT laufen auf demselben SRO-CMS und liefern
// echte Session-Zeiten über gtwc.ts (s. dort) statt nur Renntage.
const GTWC_SITES: [SeriesId, string][] = [
  ['british_gt', 'https://www.britishgt.com'],
  ['igtc', 'https://www.intercontinentalgtchallenge.com'],
  ['gtwc_europe', 'https://www.gt-world-challenge-europe.com'],
  ['gtwc_america', 'https://www.gt-world-challenge-america.com'],
  ['gtwc_asia', 'https://www.gt-world-challenge-asia.com'],
  ['gtwc_australia', 'https://www.gt-world-challenge-australia.com'],
];

export const adapters: Adapter[] = [
  formelEAdapter,
  nlsAdapter,
  wecAdapter,
  imsaAdapter,
  elmsAdapter,
  leMansCupAdapter,
  superGtAdapter,
  gtOpenAdapter,
  dtmAdapter,
  adacGtMastersAdapter,
  porscheCarreraCupAdapter,
  createCombinedGtwcAdapter('gt2_gt4_europe', [
    {
      baseUrl: 'https://www.gt2europeanseries.com',
      eventNameSuffix: ' (GT2 Europe)',
      dateOnlyFallback: true,
    },
    {
      baseUrl: 'https://www.gt4europeanseries.com',
      eventNameSuffix: ' (GT4 Europe)',
      dateOnlyFallback: true,
    },
  ]),
  createCombinedGtwcAdapter('gt_gt4_america', [
    {
      baseUrl: 'https://www.gtamerica.us',
      eventNameSuffix: ' (GT America)',
      dateOnlyFallback: true,
    },
    {
      baseUrl: 'https://www.gt4-america.com',
      eventNameSuffix: ' (GT4 America)',
      dateOnlyFallback: true,
    },
  ]),
  ...GTWC_SITES.map(([series, baseUrl]) => createGtwcAdapter(series, baseUrl)),
  ...ICS_SERIES.map(([series, calendarId]) => createIcsAdapter(series, calendarId)),
];
