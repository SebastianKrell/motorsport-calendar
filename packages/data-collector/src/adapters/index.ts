import type { Adapter, SeriesId } from '../types.js';
import { formelEAdapter } from './formel-e.js';
import { gtwcEuropeAdapter } from './gtwc-europe.js';
import { createIcsAdapter } from './ics.js';
import { imsaAdapter } from './imsa.js';
import { nlsAdapter } from './nls.js';
import { wecAdapter } from './wec.js';

// Kalender-IDs s. CLAUDE.md, Abschnitt "ICS-Feeds (toomuchracing.com)".
// Italian GT und China GT fehlen bewusst: laut CLAUDE.md gibt es dafür
// keinen ICS-Feed, nur eine Website (bräuchte einen eigenen Scraper).
// NLS, WEC, IMSA und GTWC Europe laufen nicht mehr über den generischen
// ICS-Adapter, sondern über dedizierte Adapter (nls.ts, wec.ts, imsa.ts,
// gtwc-europe.ts), die echte Uhrzeiten liefern statt nur Datumsangaben ohne
// Uhrzeit.
const ICS_SERIES: [SeriesId, string][] = [
  ['gtwc_america', '1g47v5qu33g114060qa1ula9d0'],
  ['gtwc_asia', 'plm3evhsd30l34r2tj68fh9mss'],
  ['gtwc_australia', '31e7b509e16383e2c02a557c478ba3fe7cac843154c97ca5fbc77d69a578c253'],
  ['igtc', 'kcelko7ictk6okcf4peougahlo'],
  ['dtm', '0urnjij5qqj3ijoht52fdsqk18'],
  ['adac_gt_masters', 'bo1ablitg2ecigfcdouq209vj0'],
  ['british_gt', '6bh6kok6g3v97ogr2d1s2g1srs'],
  ['gt_open', 'kug92q3u7fqcg2t0di3e2cklio'],
  ['creventic_24h', '6rddivl20t6526fknlbhmhf6ps'],
  ['super_gt', '5ni9rjbofnkfvmpidmjpep9ek0'],
  ['elms', 'ur7thj1o6ctignecm0uia024js'],
  ['asian_le_mans', 'lilnartmo4uglqdpatsve4pido'],
  ['michelin_le_mans_cup', 'niktsnpdfhu2bi3888ld8v24hc'],
];

export const adapters: Adapter[] = [
  formelEAdapter,
  nlsAdapter,
  wecAdapter,
  imsaAdapter,
  gtwcEuropeAdapter,
  ...ICS_SERIES.map(([series, calendarId]) => createIcsAdapter(series, calendarId)),
];
