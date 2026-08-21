import type { Adapter } from '../types.js';
import { formelEAdapter } from './formel-e.js';
import { imsaAdapter } from './imsa.js';
import { nlsAdapter } from './nls.js';
import { wecAdapter } from './wec.js';

// Weitere Adapter (GTWC, DTM, ...) kommen hier dazu,
// sobald ICS-/Scraping-Anbindung gebaut ist (s. CLAUDE.md, Adapter-Prioritätsregel).
export const adapters: Adapter[] = [formelEAdapter, wecAdapter, imsaAdapter, nlsAdapter];
