export type SeriesId =
  | 'fe'
  | 'nls'
  | 'wec'
  | 'imsa'
  | 'gtwc_europe'
  | 'dtm'
  | 'adac_gt_masters'
  | 'porsche_carrera_cup_de'
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

export type SessionType = 'fp' | 'quali' | 'sprint' | 'race';
export type SessionSource = 'api' | 'ics' | 'scrape' | 'manual';
export type Confidence = 'exact' | 'date-only';

export interface Session {
  series: SeriesId;
  eventName: string;
  circuit: string;
  round: number | null;
  sessionType: SessionType;
  startUtc: string;
  endUtc: string | null;
  source: SessionSource;
  confidence: Confidence;
}

export interface Broadcaster {
  name: string;
  type: string;
  url?: string;
}

export interface SessionWithBroadcasters extends Session {
  broadcasters: Broadcaster[];
  broadcastersVerifiedAt: string | null;
}

export interface Adapter {
  series: SeriesId;
  fetchSessions(): Promise<Session[]>;
}
