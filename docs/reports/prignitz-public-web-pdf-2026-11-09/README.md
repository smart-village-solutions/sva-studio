# Prignitz: öffentliche Webansicht und PDF

Prüfstand: 09.11.2026. Quelle: [Prüftabelle, Blatt pruefstand_2026_10_2021](https://docs.google.com/spreadsheets/d/1TAYWlYVIga6SVjd11H5aL2dnhV7lfAcSNNF2HN48uqo/edit#gid=939932647), Zeilen 16, 34, 90 und 91. Tabellenbemerkungen sind Meldungen, keine Abnahmen.

## Auftrag und Grenze

Ziel des PRs: bestätigte Bedienungs- und Darstellungsfehler in der öffentlichen regionalen Standortauswahl und im bestehenden PDF-Export beheben und die vier Meldungen mit Nachweisen einordnen.

Maximal betroffene Bereiche: `apps/public-waste-calendar-web`, der verwendete PDF-Renderer in `packages/waste-management-contracts` und zugehörige Dokumentation/Nachweise. Nicht-Ziele: Terminberechnung, Feiertagslogik, E-Mail-Verarbeitung, mobile App, Mainserver-Synchronisation und PR #2124. Keine produktive Konfiguration, Tabellenänderung, kein Merge und kein Rollout.

## Befunde

| Meldung                                  | Beobachtung                                                                                                                                                                                                                | Einordnung und Ergebnis                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 16: Region entfernen bzw. feste Auswahl  | Die öffentliche Startseite bietet elf feste Optionen mit Suchfilter. Es ist keine freie Regionseingabe nötig.                                                                                                              | Kein reproduzierbarer Fehler der Auswahl. Entfernung zugunsten einer Ortssuche wäre eine neue fachliche Entscheidung; Auswahl bleibt erhalten.                                                                                                                                                                                                                                                                    |
| 34: regionale Einstiege vervollständigen | Regions-API und Startauswahl liefern dieselben elf Regionen. Alle elf aktuellen Slugs öffnen im Browser direkt „Ort wählen“. Die Tabelle führt nur sechs Links auf; `/amt-bad-wilsnack` endet inzwischen im Fehlerzustand. | Veraltete/vervollständigungsbedürftige Linkliste. Aktueller Pfad: `/amt-bad-wilsnack-weisen`. Keine fünf fehlenden Runtime-Routen. Vollständige Liste unten; die Tabelle wurde nicht verändert. Keine Alias-Heuristik oder Lockerung unbekannter Regionspfade.                                                                                                                                                    |
| 34: Zurück und Adresse ändern            | Bisher nur Änderungslinks im Auswahlpfad, kein ausdrücklich beschrifteter Zurück-Button. Live: Wittenberge → Wittenberge → Ahornweg → Kalender → Adresse ändern startet erneut bei den acht Wittenberger Orten.            | Gewünschter Zurück-Button im bestehenden Formular ergänzt. Führt zum letzten selbst gewählten Schritt, überspringt Einzelauswahlen und fokussiert die Suche. Region bleibt gebunden. Adressänderung war live bereits korrekt. Rücksprung zur Landkreis-Karte benötigt ein Ziel auf der Host-Webseite und bleibt offen.                                                                                            |
| 90: Pflegeweg PDF-Legende                | Kein separates Legendenfeld; Inhalte stammen aus Abfallarten, Tourbeschreibungen und Terminnotizen. Im Live-Beispiel sechs Fraktionen, Verschiebungserklärung und eine von vier vorhandenen Schadstoffmobil-Notizen.       | Pflegeweg in bestehender Referenz und Redaktionsdossier dokumentiert. Acht-Zeilen-Limit und Kürzung entsprechen dem bestehenden kompakten Layoutvertrag. Vollständiger Hinweisanhang, andere Priorisierung oder Platzaufteilung sind offene fachliche Entscheidungen. Keine erfundenen Texte.                                                                                                                     |
| 91: Landkreislogo                        | Live-PDF beider Halbjahre zeigt „Kommunales Waste-Management“, `pdfimages -list` enthält keine Bildressource.                                                                                                              | Fehlendes Logo bestätigt. Öffentlich lässt sich die intern konfigurierte URL nicht auslesen. Die freigegebene Grafik wurde im Verlauf der Prüfung vom Nutzer als Medien-Asset bereitgestellt. Bestehender HTTPS-Lader und PDF-Endpunkt betten sie lokal korrekt ein (siehe Nachweis unten). Produktive Konfigurationspflege bleibt gemäß Auftrag ausgenommen; die Live-Ausgabe ist deshalb noch nicht korrigiert. |
| PDF-Sichtprüfung                         | Live-Platzhalter läuft rechts über seinen Rahmen.                                                                                                                                                                          | Im vorhandenen Renderer mit vorhandener Breitenmessung/Kürzung behoben. Reale Logo-Einbettung bleibt unverändert.                                                                                                                                                                                                                                                                                                 |

## Vollständige regionale Einstiege

Live gelesen aus `/api/public-waste/regions` und `/api/public-waste/selection`. Der öffentliche Standortkatalog enthält 718 Kombinationen; alle elf Regionen sind vertreten. Die Anzahl unten zählt die sichtbaren Ortsoptionen am regionalen Einstieg, nicht Straßen oder Adresskombinationen.

| Region                  | Aktueller Einstieg                                                                      | Ortsoptionen |
| ----------------------- | --------------------------------------------------------------------------------------- | ------------ |
| Amt Bad Wilsnack/Weisen | [/amt-bad-wilsnack-weisen](https://prignitz.abfallkalender.pro/amt-bad-wilsnack-weisen) | 23           |
| Amt Lenzen-Elbtalaue    | [/amt-lenzen-elbtalaue](https://prignitz.abfallkalender.pro/amt-lenzen-elbtalaue)       | 30           |
| Amt Meyenburg           | [/amt-meyenburg](https://prignitz.abfallkalender.pro/amt-meyenburg)                     | 26           |
| Amt Putlitz-Berge       | [/amt-putlitz-berge](https://prignitz.abfallkalender.pro/amt-putlitz-berge)             | 36           |
| Gemeinde Groß Pankow    | [/gemeinde-gross-pankow](https://prignitz.abfallkalender.pro/gemeinde-gross-pankow)     | 42           |
| Gemeinde Gumtow         | [/gemeinde-gumtow](https://prignitz.abfallkalender.pro/gemeinde-gumtow)                 | 27           |
| Gemeinde Karstädt       | [/gemeinde-karstaedt](https://prignitz.abfallkalender.pro/gemeinde-karstaedt)           | 40           |
| Gemeinde Plattenburg    | [/gemeinde-plattenburg](https://prignitz.abfallkalender.pro/gemeinde-plattenburg)       | 26           |
| Stadt Perleberg         | [/stadt-perleberg](https://prignitz.abfallkalender.pro/stadt-perleberg)                 | 14           |
| Stadt Pritzwalk         | [/stadt-pritzwalk](https://prignitz.abfallkalender.pro/stadt-pritzwalk)                 | 27           |
| Stadt Wittenberge       | [/stadt-wittenberge](https://prignitz.abfallkalender.pro/stadt-wittenberge)             | 8            |

Die Slugs folgen dem aktuellen Regionsnamen. Bei einer Stammdaten-Umbenennung müssen Landkreis-Links aus dem aktuellen Katalog aktualisiert werden. Der allgemeine Einstieg bleibt [die Startseite](https://prignitz.abfallkalender.pro/).

## Visuelle Nachweise

- [Live-PDF Wittenberge, Ahornweg, 2026](./live-wittenberge-2026.pdf): direkt vom öffentlichen PDF-Endpunkt, alle sechs angebotenen Fraktionen. Beide Seiten mit Poppler gerendert und geprüft. Das Logo fehlt; der Platzhalter überläuft. [Seite 1 vorher](./live-pdf-seite-1.png).
- [Lokales PDF derselben öffentlichen Auswahl](./lokal-wittenberge-2026.pdf): über `handlePublicWastePdfRequest` aus den gelesenen öffentlichen Kalenderdaten und leerer statischer Branding-Konfiguration erzeugt; kein Zugriff auf produktive Einstellungen. [Seite 1 nachher](./lokal-pdf-seite-1.png), [Seite 2 nachher](./lokal-pdf-seite-2.png). Beide visuell geprüft: Raster/Legende unverändert, Platzhalter innerhalb des Rahmens. `pdftotext -bbox` bestätigt x=646 bis 796,997 innerhalb des Rahmens 640–803 mit 5 Punkten Innenabstand.
- [Lokale regionale Rücknavigation](./lokal-region-zurueck.png): Screenshot aus dem bestehenden Browser-Regressionsfall mit synthetischen Rathenow-Daten, keine produktive Prignitz-Abnahme. Tastatur-Rücksprung, Fokus, erneute Auswahl und Adressänderung geprüft. [Automatisch gewählter Ort als reiner Pfadtext](./lokal-automatischer-pfad.png): keine Änderungs-/Zurück-Aktion für den automatischen Schritt; visuell und mit Axe geprüft.

### Freigegebenes Landkreislogo

Der Nutzer hat im Verlauf der Prüfung diese [freigegebene Grafik aus der Medienverwaltung](https://fileserver.smart-village.app/bb-prignitz/bb-prignitz/variants/5d7fedec-2fc5-47cb-bb72-bf194e98a791/de719b16-25c4-47a0-9ae6-d1cbf838c612/original.png) bereitgestellt. Das PNG hat 3000 × 1030 Pixel und Transparenz. Der vorhandene geschützte HTTPS-Lader konvertiert es proportional auf 326 × 112 RGB-Pixel vor weißem Hintergrund; beide PDF-Seiten betten dieselbe Bildressource ein. Es war keine Änderung am Asset-Lader oder an der Logo-Logik erforderlich.

[Lokales PDF mit freigegebenem Landkreislogo](./lokal-mit-landkreislogo-2026.pdf), [Seite 1](./lokal-logo-seite-1.png), [Seite 2](./lokal-logo-seite-2.png): über den bestehenden Endpunkt mit ausschließlich lokal eingespeister `brandingAssetUrl` erzeugt und beide gerenderten Seiten visuell geprüft. Logo, Schrift und Wappen bleiben vollständig im vorgesehenen Kopfbereich. Eine produktive Konfiguration wurde weder gelesen noch geändert; dieser Nachweis zeigt die technische Verwendbarkeit des gelieferten Assets, keine korrigierte Live-Ausgabe.

## Verifikation und Review

- Neue Rücknavigationsprüfung vor Umsetzung rot („Zurück“ fehlt), danach gezielte Komponenten-/Routingtests grün: 21 Tests.
- App-Unit-Gate `pnpm nx run public-waste-calendar-web:test:unit`: 220 Tests bestanden, ein bestehender PostgreSQL-Test ohne Datenbank übersprungen.
- PDF-Regressionsdatei `pnpm nx run waste-management-contracts:test:unit --testFiles=src/waste-management-output.test.ts`: 16 Tests bestanden, einschließlich konfigurierter Bild-Einbettung, Legenden und Kodierung.
- `pnpm nx run public-waste-calendar-web:test:e2e -- --grep='keeps an iframe calendar'`: ein Browserfall bestanden, einschließlich Tastatur/Fokus/Axe, wiederholter regionaler Adresssuche und Export-Regionsparametern. Seine Erinnerungsanfrage ist vollständig gemockt; kein Versand.
- App-Typecheck, App-Lint und Produktionsbuild bestanden. Package-Typecheck/-Lint, Runtime-Guard, Dateiplatzierung und Dokumentationsprüfung ebenfalls bestanden. GitHub-Status ist im PR ausgewiesen.
- Gebündelter Code-/Test-/UX-/i18n-Fachreview ohne blockierenden Befund; Dokumentationsreview abgeschlossen; die Pflegewege wurden an die tatsächlichen UI-Labels „PDF-Inhalte“ und „Hinweis“ angeglichen.

Der erste CI-Lauf meldete ausschließlich einen neuen Dateilängenbefund (273 > 260 Zeilen) im Auswahlformular. Die bereits vorhandene Tastaturnavigation wurde unverändert in die bestehende Datei der Auswahlergebnisse verschoben. Dadurch bleibt das Formular unter dem Grenzwert, ohne neue Datei, Abstraktion oder veränderte Tastatursemantik. Die 21 gezielten Tests, der Typecheck und das Komplexitäts-Gate wurden danach erneut grün geprüft.

Ein anschließender automatischer Review wies auf irreführende Änderungssemantik der automatischen Pfadeinträge hin. Diese stehen nun als nichtinteraktiver Text ohne Zeiger-/Hover-Affordanz im bestehenden Auswahlpfad. Die 21 gezielten Tests und der regionale Browserfall einschließlich Fokus und Axe wurden danach erneut bestanden; es gibt keinen neuen Komponentenpfad.

Der XERJ-Index `studio-code` stand auf `60059753`, der Worktree auf `67a5be6b9`; Fundstellen deshalb am aktuellen zuständigen Pfad geprüft. `payload-code` lieferte nur eine allgemeine Breadcrumb-Referenz (MIT), keine passende Regionsbindung. Es wurde kein Fremdcode übernommen, keine neue Abstraktions- oder Export-Schicht eingeführt.

## Offene fachliche Zuarbeit

1. Die unten nachgewiesene freigegebene Logo-URL später autorisiert unter Ausgabe → PDF-Inhalte als Branding-Grafik pflegen und das Live-PDF erneut prüfen. Dieser Auftrag ändert keine produktiven Einstellungen.
2. Gewünschte Lesbarkeit/Vollständigkeit langer Legenden und mehrerer Terminhinweise festlegen (kompakte acht Zeilen oder weiterer Platz/Anhang).
3. Ziel und Verantwortlichkeit einer Navigation zurück zur vorgeschalteten Landkreis-Karte festlegen.
4. Vollständige aktuelle Einstiegsliste auf Landkreis-Webseite bzw. in der Prüftabelle übernehmen lassen.

Technisch lokal geprüft und als PR bereitgestellt bedeutet weder produktiv ausgerollt noch fachlich abgenommen.
