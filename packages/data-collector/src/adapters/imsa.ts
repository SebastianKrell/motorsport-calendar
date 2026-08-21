import { createIcsAdapter } from './ics.js';

// Kalender-ID s. CLAUDE.md, Abschnitt "ICS-Feeds (toomuchracing.com)".
// Liefert nur Renntermine ohne Uhrzeit; TV-/Sender-Zeiten kommen separat
// per Scraper von der IMSA-TV-Seite (noch nicht implementiert).
export const imsaAdapter = createIcsAdapter('imsa', 'njulhksvo83qeoruc3nhend9js');
