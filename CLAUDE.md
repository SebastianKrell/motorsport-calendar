# CLAUDE.md

Kontextdatei für dieses Projekt. Bitte vor Änderungen lesen.

## Projektziel

Eine Web-App, die kommende Motorsport-Rennen tabellarisch anzeigt — mit
**Startzeit in deutscher Zeit** und vor allem **auf welchem Sender / Stream
das Event in Deutschland zu sehen ist**.

Der Sender-Teil ist der eigentliche Mehrwert. Reine Terminkalender gibt es
viele; keiner davon beantwortet „wo kann ich das schauen".

### Nicht-Ziele

* Live-Timing, Telemetrie, Ergebnisse, Meisterschaftsstände
* Push-Benachrichtigungen (evtl. später)
* Mehrsprachigkeit — die App ist deutschsprachig und auf den deutschen
TV-Markt zugeschnitten

## Tech-Stack

> \*\*Annahme — bitte anpassen, falls anders entschieden.\*\*

* Frontend: React + TypeScript, Tabellenansicht, Filter nach Serie
* Backend: Node/TypeScript, täglicher Cron-Job zum Einsammeln der Daten
* Persistenz: SQLite (reicht völlig, Datenmenge ist winzig)
* Zeitzonen: `luxon` oder `date-fns-tz` — **kein** manuelles Offset-Rechnen

## Kernarchitektur

Ein **Adapter pro Serie**, alle schreiben in ein gemeinsames Schema. Kein
Versuch, eine einheitliche Quelle zu finden — die gibt es nicht.

```
adapters/\*.ts  ──►  normalize()  ──►  SQLite  ──►  API  ──►  Frontend
                         ▲
                  broadcasters.yaml (handgepflegt)
```

### Datenmodell

```ts
type Session = {
  series: SeriesId;        // 'f1' | 'fe' | 'wec' | ...
  eventName: string;       // "24 Heures du Mans"
  circuit: string;
  round: number | null;
  sessionType: 'fp' | 'quali' | 'sprint' | 'race';
  startUtc: string;        // ISO 8601, IMMER UTC
  endUtc: string | null;
  source: 'api' | 'ics' | 'scrape' | 'manual';
  confidence: 'exact' | 'date-only';  // s. Zeitzonen-Fallen
};
```

`confidence: 'date-only'` ist wichtig: ICS-Feeds liefern oft nur den Renntag
ohne Uhrzeit. Das Frontend muss solche Einträge sichtbar anders darstellen
(z. B. „Sa 12.09. — Uhrzeit tbc") statt eine erfundene Zeit anzuzeigen.

### Adapter-Prioritätsregel

1. Echte API, wenn vorhanden (nur F1, Formel E)
2. ICS-Feed als Gerüst (alles andere)
3. Scraper nur dort, wo Uhrzeiten wirklich gebraucht werden
4. Manuelle Overrides in YAML gewinnen immer

## Datenquellen

**Keine der Serien bietet eine offizielle öffentliche Entwickler-API an.**
Bitte nicht danach suchen, das wurde geprüft.

### Verlässlich (API)

|Serie|Quelle|Hinweise|
|-|-|-|
|Formel 1|`https://api.jolpi.ca/ergast/f1`|Ergast-Nachfolger, kein API-Key, \~200 Req/h. Rate Limit respektieren, Ergebnisse cachen|
|Formel 1|`https://openf1.org`|Session-Daten ab 2023, ergänzend|
|Formel 1 / E|`github.com/sportstimes/f1` → `\_db/{f1,fe}/2026.json`|MIT-Lizenz, Sessions mit UTC-Zeitstempeln. Für Formel E die beste freie Quelle|

### ICS-Feeds (toomuchracing.com, CC BY-SA)

Muster: `https://calendar.google.com/calendar/ical/{ID}%40group.calendar.google.com/public/basic.ics`

Der Betreiber (Pat W.) pflegt diese seit 2011 manuell. **Einschränkungen laut
eigener Aussage: nur Renntermine, keine Uhrzeiten, keine Trainings, keine
TV-Zeiten.** Als Datumsgerüst trotzdem die beste Quelle — ein ICS zu parsen ist
robuster als ein HTML-Scraper. Attribution im Footer nicht vergessen (CC BY-SA).

|Serie|Kalender-ID|
|-|-|
|FIA WEC|`61jccgg4rshh1temqk0dj4lens`|
|European Le Mans Series|`ur7thj1o6ctignecm0uia024js`|
|Asian Le Mans Series|`lilnartmo4uglqdpatsve4pido`|
|Michelin Le Mans Cup|`niktsnpdfhu2bi3888ld8v24hc`|
|IMSA WeatherTech|`njulhksvo83qeoruc3nhend9js`|
|IMSA Michelin Pilot Challenge|`bg95jli3rdktuuobbksko3h5vg`|
|IMSA VP Racing SportsCar Challenge|`qevooec0eo13lpc26j6kik5goo`|
|GTWC Europe|`drne83rrmn7m9baje25qh2248s`|
|GTWC America|`1g47v5qu33g114060qa1ula9d0`|
|GTWC Asia|`plm3evhsd30l34r2tj68fh9mss`|
|GTWC Australia|`31e7b509e16383e2c02a557c478ba3fe7cac843154c97ca5fbc77d69a578c253`|
|Intercontinental GT Challenge|`kcelko7ictk6okcf4peougahlo`|
|NLS (Nürburgring)|`f7ubn1ltpc4p7amil7kefgj754`|
|DTM|`0urnjij5qqj3ijoht52fdsqk18`|
|ADAC GT Masters|`bo1ablitg2ecigfcdouq209vj0`|
|British GT|`6bh6kok6g3v97ogr2d1s2g1srs`|
|International GT Open|`kug92q3u7fqcg2t0di3e2cklio`|
|24H Series (Creventic)|`6rddivl20t6526fknlbhmhf6ps`|
|Super GT|`5ni9rjbofnkfvmpidmjpep9ek0`|
|GT2 \& GT4 European Series|`pdbbgsms5dmvdhh6i4rucnlplg`|
|GT America \& GT4 America|`eui5lon2nvcv1mbj1oj5cfle0c`|
|Formel E (Fallback)|`vno0ntshopq0nmob26db2pcen8`|
|Formel 1 (Fallback)|`fa9bjl6tu13dd10b066stoo5do`|

### Scraping (nur für Uhrzeiten)

|Serie|Ziel|Hinweise|
|-|-|-|
|IMSA|`imsa.com/weathertech/weathertech-2026-schedule/` und `/weathertech/tv-streaming-schedule/`|WordPress, stabile Struktur. **Alle Zeiten in ET.** Die TV-Seite liefert Sender gleich mit — inkl. der Markierung „Available Globally", die für uns die relevanten YouTube/IMSA-TV-Sessions kennzeichnet|
|WEC|`fiawec.com` Event-Seiten|Zeitpläne pro Event|
|NLS|`vln.de`|Format ist sehr vorhersehbar: Quali 08:30, Rennen 12:00 (4h oder 6h)|
|GTWC|`gt-world-challenge-europe.com`|Zeitpläne oft nur als PDF → höchster manueller Aufwand|

### Ausdrücklich NICHT verwenden

**Al Kamel Systems** (Zeitnehmer für WEC, ELMS, IMSA — `fiawec.alkamelsystems.com`
etc.). Die Seiten enthalten einen expliziten Hinweis, dass die Daten Eigentum
von Al Kamel sind und jede Weiterverbreitung durch Dritte rechtliche Schritte
nach sich zieht. Der V2-Feed ist ohnehin kostenpflichtig und
credential-geschützt. **Nicht anzapfen, nicht scrapen.**

Kommerzielle Alternativen (Sportradar Racing API, Sportmonks, API-Sports)
existieren, sind aber kostenpflichtig und für dieses Hobbyprojekt Overkill.

## Serien-Katalog

### In Scope (Kern)

* Formel 1
* Formel E
* Nürburgring Langstrecken-Serie (NLS, ehem. VLN)
* FIA WEC
* IMSA WeatherTech SportsCar Championship
* GT World Challenge Europe (Sprint + Endurance)

### In Scope (GT3, ergänzt)

Diese GT3-Serien gehören thematisch dazu und haben brauchbare Feeds:

* **DTM** — seit 2021 GT3
* **ADAC GT Masters** — GT3, Silver/Pro-Am, läuft im Rahmen der DTM-Wochenenden
* **Intercontinental GT Challenge (IGTC)** — Bathurst 12h, Nürburgring 24h,
Spa 24h, Suzuka 1000km, Indianapolis 8h.
**Achtung: überschneidet sich mit GTWC Europe/America.** Deduplizierung nötig,
sonst erscheinen Spa 24h und Indy 8h doppelt in der Tabelle
* **GT World Challenge America / Asia / Australia**
* **British GT**
* **International GT Open**
* **24H Series (Creventic)** — inkl. Dubai 24h
* **Super GT** (GT500/GT300, GT300 ist GT3)
* **GT2/GT4 European Series**, **GT America / GT4 America** — verwandt, aber
nicht GT3; optional als Filter

### Bekannt, aber ohne brauchbaren Feed

* **Italian GT** — kein ICS bei toomuchracing, nur Website
* **China GT** — dito

### Verwandt (Le Mans-Familie, GT3-Klassen enthalten)

* European Le Mans Series (LMGT3)
* Asian Le Mans Series
* Michelin Le Mans Cup

## Sender-Mapping Deutschland (Stand: Saison 2026)

Handgepflegt in `broadcasters.yaml`. **Lässt sich nicht automatisieren** — es
gibt keinen maschinenlesbaren Feed für deutsche TV-Rechte. Struktur: Default
pro Serie plus Ausnahmen pro Event.

|Serie|Wo in Deutschland|
|-|-|
|**Formel 1**|Sky Sport F1 / WOW — komplett, alle Sessions (Vertrag bis einschl. 2027). RTL zeigt 2026 fünf Rennwochenenden im Free-TV plus einzelne Qualifyings; Trainings/Quali bei RTL oft nur in RTL+ Premium. **F1 TV Pro ist für Neukunden in DE gesperrt** (Sky-Exklusivrechte)|
|**Formel E**|DF1 (Free-TV) und Stream auf df1.de — alle Rennen und Qualifyings|
|**WEC**|Eurosport (Vertrag bis mind. 2030, alle 8 Saisonrennen), HBO Max / discovery+. Kostenpflichtig: FIAWEC+. **Le Mans zusätzlich auf RTL Nitro (Free-TV) und RTL+**|
|**IMSA**|Peacock/NBC/NBCSN sind **US-only, für uns irrelevant**. Relevant: die als *„Available Globally"* markierten Sessions auf YouTube und IMSA TV — diese Markierung beim Scrapen mit übernehmen und im Frontend als einzige IMSA-Option anzeigen|
|**GT World Challenge**|Kostenloser Livestream auf YouTube-Kanal „GT World" — seit 2022 auch mit **deutschem Kommentar**. Parallel auf gt-world-challenge-europe.com und motorsport-total.com|
|**NLS**|Kostenlos: vln.de, YouTube (`@VLNOFFICIAL`), motorsport-total.com. Kommentar von nürburgring.tv|
|**DTM / ADAC GT Masters**|ProSieben / ran.de bzw. ADAC-Streams — **vor Saisonstart verifizieren**|
|**Le Mans 24h (Sonderfall)**|Eurosport 1 komplett + RTL Nitro + RTL+ + ServusTV On + FIAWEC+|

### Pflegehinweis

Sender-Rechte ändern sich pro Saison, teils mitten in der Saison (RTL/Sky-Sublizenzen
werden oft erst kurzfristig bestätigt). `broadcasters.yaml` enthält pro Eintrag
ein `verifiedAt`-Datum. Einträge älter als 60 Tage im UI als „ohne Gewähr"
kennzeichnen.

## Zeitzonen-Fallen

Das ist die häufigste Fehlerquelle in diesem Projekt.

1. **Alles intern in UTC speichern.** Umrechnung nach `Europe/Berlin` erst im
Frontend bzw. in der Präsentationsschicht.
2. **IMSA-Zeiten sind ET** (`America/New\_York`), nicht UTC. Immer mit
IANA-Zonennamen konvertieren, nie mit festem Offset.
3. **US- und EU-Sommerzeit schalten unterschiedlich** — DST-Wechsel liegen zwei
bzw. drei Wochen auseinander (März/November vs. März/Oktober). In diesen
Fenstern ist die Differenz DE↔US um eine Stunde verschoben. Hier entstehen
die Bugs.
4. Rennen, die über Mitternacht laufen (Le Mans, Spa 24h, Daytona 24h, N24),
brauchen `endUtc` und eine Mehrtages-Darstellung.
5. ICS-Einträge ohne Uhrzeit kommen als `VALUE=DATE` (Ganztag) — nicht als
00:00 Uhr interpretieren, sondern als `confidence: 'date-only'` markieren.

## Konventionen

* Nie Termine „raten" oder aus dem Modellwissen ergänzen. Fehlt eine Uhrzeit,
wird sie als unbekannt markiert — eine falsche Zeit ist schlimmer als keine.
* Jeder Adapter loggt Quelle und Abrufzeitpunkt; bei Parse-Fehlern die alten
Daten behalten statt die Tabelle zu leeren.
* Scraper defensiv bauen: Layout-Änderungen führen zu Warnung, nicht zu Crash.
* Externe Quellen respektvoll abfragen: User-Agent setzen, Caching, kein
Polling im Minutentakt. Ein Lauf pro Tag reicht.
* Deduplizierung IGTC ↔ GTWC ↔ NLS (N24 taucht in IGTC *und* im
NLS-Umfeld auf) über `(circuit, startUtc±12h)`.

## Realistischer Aufwand

* F1 + Formel E: ein Abend (echte APIs)
* WEC/IMSA/NLS über ICS: ein zweiter Abend
* GTWC-Uhrzeiten und Sender-Pflege: dauerhaft ca. 10 Minuten pro Woche

