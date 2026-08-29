import type { SeriesId, Session } from './types.js';

// Manche Serien fahren dieselbe physische Veranstaltung im Rahmen
// unterschiedlicher Meisterschaften (IGTC-Kronjuwelen wie Indianapolis 8h,
// Bathurst 12h, Spa 24h, Suzuka 1000km tauchen zusätzlich im jeweiligen
// GTWC-Regionalkalender auf, s. CLAUDE.md "Deduplizierung IGTC <-> GTWC <->
// NLS"). Reihenfolge = Priorität bei Konflikten, nicht gelistete Serien
// verlieren gegen jede gelistete.
const DEDUP_PRIORITY: SeriesId[] = ['igtc', 'gtwc_europe', 'gtwc_america', 'gtwc_asia', 'gtwc_australia', 'nls'];
const OVERLAP_WINDOW_MS = 36 * 60 * 60 * 1000;

function priorityRank(series: SeriesId): number {
  const index = DEDUP_PRIORITY.indexOf(series);
  return index === -1 ? DEDUP_PRIORITY.length : index;
}

function normalizeCircuit(circuit: string): string {
  const normalized = circuit.trim().toLowerCase();
  if (normalized.includes('indianapolis')) return 'indianapolis motor speedway';
  return normalized;
}

function normalizeEventName(eventName: string): string {
  const normalized = eventName.trim().toLowerCase();
  if (normalized.includes('indianapolis')) return 'indianapolis';
  return normalized;
}

// Paarweiser statt transitiver Vergleich: verhindert, dass z. B. zwei echte,
// zeitlich nahe GTWC-Sprintrennen am selben Circuit über ein drittes,
// überlappendes IGTC-Rennen fälschlich mitzusammengefasst werden.
//
// Exakter Eventname zusätzlich zu Circuit + Zeitfenster nötig: DTM und ADAC
// GT Masters laufen laut CLAUDE.md am selben Wochenende auf demselben
// Circuit ("läuft im Rahmen der DTM-Wochenenden"), sind aber unterschiedliche
// Rennen -- nur Circuit+Zeit hätte das fälschlich als Duplikat erkannt.
export function deduplicateCrossSeries(sessions: Session[]): Session[] {
  const dropped = new Set<Session>();

  for (let i = 0; i < sessions.length; i++) {
    const a = sessions[i];
    if (dropped.has(a)) continue;

    for (let j = i + 1; j < sessions.length; j++) {
      const b = sessions[j];
      if (dropped.has(b) || a.series === b.series) continue;
      if (normalizeCircuit(a.circuit) !== normalizeCircuit(b.circuit)) continue;
      if (normalizeEventName(a.eventName) !== normalizeEventName(b.eventName)) continue;

      const diffMs = Math.abs(new Date(a.startUtc).getTime() - new Date(b.startUtc).getTime());
      if (diffMs > OVERLAP_WINDOW_MS) continue;

      const loser = priorityRank(a.series) <= priorityRank(b.series) ? b : a;
      const winner = loser === a ? b : a;
      dropped.add(loser);
      console.log(
        `[dedup] "${loser.eventName}" (${loser.series}) übersprungen, Duplikat von "${winner.eventName}" (${winner.series})`,
      );
      if (loser === a) break; // a ist raus, weitere Vergleiche mit a sind sinnlos
    }
  }

  return sessions.filter((session) => !dropped.has(session));
}
