import type { Adapter } from '../types.js';
import { formelEAdapter } from './formel-e.js';

// Weitere Adapter (WEC, IMSA, NLS, GTWC, ...) kommen hier dazu,
// sobald ICS-/Scraping-Anbindung gebaut ist (s. CLAUDE.md, Adapter-Prioritätsregel).
export const adapters: Adapter[] = [formelEAdapter];
