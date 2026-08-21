import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { adapters } from './adapters/index.js';
import { loadBroadcasterConfig, resolveBroadcasters } from './broadcasters.js';
import { deduplicateCrossSeries } from './dedup.js';
import type { Session, SessionWithBroadcasters } from './types.js';

const here = dirname(fileURLToPath(import.meta.url));
const BROADCASTERS_PATH = resolve(here, '../../../broadcasters.yaml');
const OUTPUT_PATH = resolve(here, '../../frontend/public/data/sessions.json');
const GRACE_PERIOD_MS = 24 * 60 * 60 * 1000;

interface OutputFile {
  generatedAt: string;
  sessions: SessionWithBroadcasters[];
}

async function readPreviousOutput(): Promise<SessionWithBroadcasters[]> {
  try {
    const raw = await readFile(OUTPUT_PATH, 'utf-8');
    return (JSON.parse(raw) as OutputFile).sessions ?? [];
  } catch {
    return [];
  }
}

async function main() {
  const previous = await readPreviousOutput();
  const broadcasterConfig = await loadBroadcasterConfig(BROADCASTERS_PATH);

  const sessionsBySeries = new Map<string, Session[]>();
  for (const session of previous) {
    const list = sessionsBySeries.get(session.series) ?? [];
    list.push(session);
    sessionsBySeries.set(session.series, list);
  }

  for (const adapter of adapters) {
    try {
      const sessions = await adapter.fetchSessions();
      sessionsBySeries.set(adapter.series, sessions);
      console.log(`[${adapter.series}] ${sessions.length} Sessions abgerufen`);
    } catch (error) {
      console.warn(
        `[${adapter.series}] Abruf fehlgeschlagen, behalte vorherigen Stand:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  const allSessions = [...sessionsBySeries.values()].flat();

  // Zentral statt pro Adapter gefiltert, damit alle Quellen (echte API wie
  // Formel E, ICS-Feeds, künftig Scraper) einheitlich behandelt werden.
  // 24h Kulanz nach Sessionbeginn, da uns bei ICS-Einträgen kein endUtc
  // vorliegt und Rennen über Mitternacht laufen können (Le Mans, N24, ...).
  const cutoff = Date.now() - GRACE_PERIOD_MS;
  const upcoming = allSessions.filter((session) => {
    const reference = session.endUtc ?? session.startUtc;
    return new Date(reference).getTime() >= cutoff;
  });

  // IGTC <-> GTWC <-> NLS: dieselbe Veranstaltung kann in mehreren
  // Meisterschaftskalendern auftauchen (s. CLAUDE.md, Konventionen).
  const deduplicated = deduplicateCrossSeries(upcoming);

  const enriched: SessionWithBroadcasters[] = deduplicated.map((session) => {
    const { broadcasters, verifiedAt } = resolveBroadcasters(broadcasterConfig, session);
    return { ...session, broadcasters, broadcastersVerifiedAt: verifiedAt };
  });

  const output: OutputFile = {
    generatedAt: new Date().toISOString(),
    sessions: enriched,
  };

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`Geschrieben: ${OUTPUT_PATH} (${enriched.length} Sessions)`);
}

main().catch((error) => {
  console.error('Datensammlung fehlgeschlagen:', error);
  process.exitCode = 1;
});
