// Spiegelt das Datenmodell aus packages/data-collector/src/types.ts.
// Bewusst dupliziert statt geteilt: das Frontend konsumiert nur die
// generierte JSON-Datei, kein TS-Import über Paketgrenzen nötig.

export type SeriesId =
  | 'fe'
  | 'nls'
  | 'wec'
  | 'imsa'
  | 'gtwc_europe'
  | 'dtm'
  | 'adac_gt_masters'
  | 'igtc'
  | 'gtwc_america'
  | 'gtwc_asia'
  | 'gtwc_australia'
  | 'british_gt'
  | 'gt_open'
  | 'creventic_24h'
  | 'super_gt'
  | 'gt2_gt4_europe'
  | 'gt_gt4_america'
  | 'elms'
  | 'asian_le_mans'
  | 'michelin_le_mans_cup';

export interface Broadcaster {
  name: string;
  type: string;
  url?: string;
}

export interface Session {
  series: SeriesId;
  eventName: string;
  circuit: string;
  round: number | null;
  sessionType: 'fp' | 'quali' | 'sprint' | 'race';
  startUtc: string;
  endUtc: string | null;
  source: 'api' | 'ics' | 'scrape' | 'manual';
  confidence: 'exact' | 'date-only';
  broadcasters: Broadcaster[];
  broadcastersVerifiedAt: string | null;
}

export interface SessionsFile {
  generatedAt: string;
  sessions: Session[];
}
