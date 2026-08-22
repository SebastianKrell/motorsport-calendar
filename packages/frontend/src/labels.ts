import type { SeriesId, SessionType } from './types';

export const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  fp: 'Training',
  quali: 'Qualifying',
  sprint: 'Sprint',
  race: 'Rennen',
};

export const SERIES_LABELS: Record<SeriesId, string> = {
  fe: 'Formel E',
  nls: 'NLS',
  wec: 'WEC',
  imsa: 'IMSA',
  gtwc_europe: 'GTWC Europe',
  dtm: 'DTM',
  adac_gt_masters: 'ADAC GT Masters',
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
};
