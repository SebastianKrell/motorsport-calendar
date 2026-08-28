import type { Adapter, SeriesId } from '../types.js';
import { adacGtMastersAdapter, dtmAdapter, porscheCarreraCupAdapter } from './dtm.js';
import { formelEAdapter } from './formel-e.js';
import { createGtwcAdapter } from './gtwc.js';
import { createIcsAdapter } from './ics.js';
import { imsaAdapter } from './imsa.js';
import { nlsAdapter } from './nls.js';
import { wecAdapter } from './wec.js';

// Kalender-IDs s. CLAUDE.md, Abschnitt "ICS-Feeds (toomuchracing.com)".
// Italian GT und China GT fehlen bewusst: laut CLAUDE.md gibt es dafür
// keinen ICS-Feed, nur eine Website (bräuchte einen eigenen Scraper).
// NLS, WEC, IMSA und alle vier GTWC-Regionen laufen nicht mehr über den
// generischen ICS-Adapter, sondern über dedizierte Adapter (nls.ts, wec.ts,
// imsa.ts, gtwc.ts), die echte Uhrzeiten liefern statt nur Datumsangaben
// ohne Uhrzeit. DTM und der Porsche Carrera Cup Deutschland laufen komplett,
// ADAC GT Masters teilweise über die echte dtm.com-API (s. dtm.ts).
const ICS_SERIES: [SeriesId, string][] = [
  ['igtc', 'kcelko7ictk6okcf4peougahlo'],
  ['british_gt', '6bh6kok6g3v97ogr2d1s2g1srs'],
  ['gt_open', 'kug92q3u7fqcg2t0di3e2cklio'],
  ['creventic_24h', '6rddivl20t6526fknlbhmhf6ps'],
  ['super_gt', '5ni9rjbofnkfvmpidmjpep9ek0'],
  ['elms', 'ur7thj1o6ctignecm0uia024js'],
  ['asian_le_mans', 'lilnartmo4uglqdpatsve4pido'],
  ['michelin_le_mans_cup', 'niktsnpdfhu2bi3888ld8v24hc'],
];

// Alle vier GTWC-Regionalseiten laufen auf demselben SRO-CMS und liefern
// echte Session-Zeiten über gtwc.ts (s. dort) statt nur Renntage.
const GTWC_SITES: [SeriesId, string][] = [
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
  dtmAdapter,
  adacGtMastersAdapter,
  porscheCarreraCupAdapter,
  ...GTWC_SITES.map(([series, baseUrl]) => createGtwcAdapter(series, baseUrl)),
  ...ICS_SERIES.map(([series, calendarId]) => createIcsAdapter(series, calendarId)),
];
