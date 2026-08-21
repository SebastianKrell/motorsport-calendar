import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import type { Broadcaster, SeriesId, Session } from './types.js';

interface BroadcasterEntry {
  broadcasters: Broadcaster[];
  verifiedAt: string;
  unverified?: boolean;
}

interface BroadcasterEventException extends BroadcasterEntry {
  match: string; // Teilstring-Match gegen eventName, case-insensitive
}

interface BroadcasterSeriesConfig {
  default: BroadcasterEntry;
  events?: BroadcasterEventException[];
}

type BroadcasterConfig = Partial<Record<SeriesId, BroadcasterSeriesConfig>>;

export async function loadBroadcasterConfig(path: string): Promise<BroadcasterConfig> {
  const raw = await readFile(path, 'utf-8');
  return (parse(raw) ?? {}) as BroadcasterConfig;
}

export function resolveBroadcasters(
  config: BroadcasterConfig,
  session: Pick<Session, 'series' | 'eventName'>,
): { broadcasters: Broadcaster[]; verifiedAt: string | null } {
  const seriesConfig = config[session.series];
  if (!seriesConfig) {
    return { broadcasters: [], verifiedAt: null };
  }

  const exception = seriesConfig.events?.find((event) =>
    session.eventName.toLowerCase().includes(event.match.toLowerCase()),
  );
  const entry = exception ?? seriesConfig.default;

  return { broadcasters: entry.broadcasters, verifiedAt: entry.verifiedAt };
}
