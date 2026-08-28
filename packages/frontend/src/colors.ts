import type { SeriesId } from './types';

// Feste Zuordnung statt Zyklen durch eine kleine Palette -- so bleibt die
// Farbe einer Serie stabil, unabhängig davon, welche anderen Serien in
// einem Monat sonst noch Termine haben.
export const SERIES_COLORS: Record<SeriesId, string> = {
  fe: '#7F77DD',
  nls: '#1D9E75',
  wec: '#D81E2C',
  imsa: '#378ADD',
  gtwc_europe: '#BA7517',
  dtm: '#D4537E',
  adac_gt_masters: '#997A22',
  porsche_carrera_cup_de: '#C9A0DC',
  igtc: '#639922',
  gtwc_america: '#5DCAA5',
  gtwc_asia: '#85B7EB',
  gtwc_australia: '#F0997B',
  british_gt: '#AFA9EC',
  gt_open: '#E24B4A',
  creventic_24h: '#F09595',
  super_gt: '#0F6E56',
  gt2_gt4_europe: '#B4B2A9',
  gt_gt4_america: '#888780',
  elms: '#993C1D',
  asian_le_mans: '#C0DD97',
  michelin_le_mans_cup: '#F5C4B3',
};
