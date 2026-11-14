## Umsetzung

- [x] Freigegebenen Entwurf und Invarianten im separaten Worktree festhalten.
- [x] Bestehende Bausteine für die belegten Wertarten ergänzen und gezielt prüfen.
- [x] App-/Plugin-Eingaben auf passende gemeinsame Bausteine umstellen.
- [x] Anzeigen auf gemeinsame semantisch passende Formatierung umstellen.
- [x] API-Payloads und unveränderte Roundtrips absichern.
- [x] Inventar auf verbliebene alternative Pfade prüfen; Fachkalender begründen.
- [x] Datumseingabe-Dokumentation und arc42 Abschnitte 5/8 aktualisieren.
- [x] Gezielte Tests/Typprüfung, OpenSpec-Validierung und Dateiplatzierung abschließen.


## Lokaler Nachweis im Worktree

- Gemeinsame Eingaben/DatePicker: 38 Tests; SDK-Konvertierung/Formatierung: 13 Tests erfolgreich.
- Gezielte bestehende Formular-, Serializer- und API-Vertragstests für Events, POI, Jobs, Baustellen, News, Umfragen, generische Inhalte, FAQ, Cockpit-Karten, Abfallwirtschaft sowie die betroffenen Admin-/Content-Routen erfolgreich. Die Erwartungen prüfen die tatsächlichen API-Werte; Darstellungsänderungen ändern diese Verträge nicht.
- Lint für 15 betroffene Projekte und App-Typprüfung einschließlich der abhängigen Builds erfolgreich. Die abschließenden App-UI-/Ressourcenprüfungen bestehen mit acht Tests; nach einem hängenden Nx-Start wurde dafür derselbe bestehende Vitest-Target-Runner direkt mit den beiden Dateifiltern ausgeführt. Server-Runtime-Gate, Skript-Typecheck und Plugin-UI-Grenzprüfung erfolgreich.
- Browserprüfung der gemeinsamen Eingaben bei 390/1280 Pixeln in `Pacific/Apia`, `America/Los_Angeles` und `Asia/Tokyo`: Kalendertag 30.12.2011 auswählbar, Monatsnavigation ohne Wertänderung, lokalisierte Datumsteile, korrekte lokale/absolute Payloads einschließlich Millisekunden, keine Browserfehler oder horizontalen Überläufe. Automatisierte WCAG-2.1-AA-Prüfung ohne Befund; Tastaturöffnung, Escape und Fokusrückgabe erfolgreich.
- Inventarprüfung: keine direkten nativen Datums-/Datum-Uhrzeitfelder außerhalb der gemeinsamen Bausteine. `type="date"`/`type="time"` in Jobs-/Events-Konfigurationen werden von ihren bestehenden Feldhelfern auf die gemeinsamen Komponenten abgebildet. Vorhandene Fachkalender und serverseitige Datumsberechnungen bleiben zuständig; generisches `publicationDate` ist laut Vertrag ein freier technischer String.
- OpenSpec-Validierung und Dateiplatzierungsprüfung erfolgreich. Architektur- und Verbraucherdokumentation aktualisiert.

## Nachgezogene Behebung des bestehenden i18n-Formatterfehlers

Auf ausdrücklichen Folgeauftrag wurden die bestehenden Teilressourcen für Rollenbeschreibungen, Content-Fehler und Medieneditor als `.partial.resources.ts` gekennzeichnet. Der vorhandene Formatter formatiert sie weiter, nimmt sie aber nicht als zusätzliche Namespaces in Aggregatoren auf. Der Regressionstest sichert Ausschluss, Formatierung und Idempotenz ab.

Beim vollständigen Regenerieren wurden außerdem direkt in den beiden Instanz-Aggregatoren eingetragene Texte erkannt. `loginMfa`, `mailSync` und `emailVerification` liegen jetzt unverändert in regulären Blattressourcen beider Sprachen, damit die bestehenden Generatorregeln sie erhalten. Ein Ressourcenstrukturtest sichert diese Namespacepfade ab. Der vollständige Vergleich beider Sprachbäume bestätigt: Alle 7.418 bisherigen Übersetzungsschlüssel und Werte sind erhalten; hinzu kommen ausschließlich die 32 bereits beauftragten gemeinsamen Datum-/Zeittexte. Formattertests (5), Ressourcenstrukturtests (6), App- und Skript-Typecheck sowie Dateiplatzierungsprüfung bestehen. Die gesamte Formatierungsprüfung ist nun erfolgreich.

Die beschriebenen Nachweise sind lokal; GitHub-Gates, Merge und Rollout haben getrennte Nachweisketten. Die bestehenden Tickets bleiben geschlossen.


## Korrekturen nach der ersten GitHub-Prüfung

- Der Jahresübernahme-Button zum Aktualisieren der Vorschau prüft jetzt die Formulargültigkeit einschließlich beider Datumsarten und Jahresgrenzen. Der Regressionstest reproduzierte zuvor den unerwünschten API-Aufruf und bestätigt nun für ungültige, unvollständige und außerhalb des Zieljahrs liegende Entwürfe: kein Vorschau-Request; der Entwurf bleibt sichtbar. Nach Korrektur wird das kanonische ISO-Datum übertragen.
- Jobs-, News- und Cockpit-Karten-Tests bedienen die tatsächlich vorhandenen Datum-/Uhrzeitfelder und prüfen weiterhin die API-Werte. Kalender-Schaltflächen werden bei Eingabeabfragen nicht mit dem Textfeld verwechselt. Die betroffenen Tests bestehen gezielt.
- Wiederholte Formularfelder und Datumsfilter werden innerhalb der bestehenden Komponenten aus ihren konkreten Feldern aufgebaut. Die DatePicker-Entwurfslogik trennt lokale Submit-Prüfung, Textformatierung und ARIA-Verknüpfungen. Keine neuen Komponenten, Provider oder Qualitätsausnahmen.
- Frameworkfreie Datums-/Zeitfunktionen liegen im bestehenden schmalen SDK-Unterpfad `temporal`; die Medienhilfen verbleiben in `content-ui-utils`. Die öffentlichen SDK-Exporte bleiben erhalten. Die Konvertierung nutzt die vorhandenen strikten Wertvalidatoren anstelle redundanter Bereichsprüfungen.
- Englische Rollenbeschreibungen sind wie ihre deutsche Entsprechung eine Teilressource. Der Vergleich mit dem ursprünglichen PR-HEAD bestätigt den unveränderten gesamten Sprachbaum: 7.450 Schlüssel, keine entfernten, hinzugefügten oder geänderten Werte.
- Lokale Nachweise: Complexity-Gate mit null neuen Findings; Lint für acht betroffene Projekte; App-Typprüfung einschließlich abhängiger Builds; SDK-Runtime-Gate; gezielte gemeinsame UI-/SDK-, Jahresübernahme-, News-, Jobs-, Cockpit-, generische Inhalte-, Umfragen- und Abfallwirtschaftstests; i18n-Formattertests und globale Ressourcenprüfung erfolgreich. Für das Abfallwirtschafts-Testinventar wurden die tatsächlichen Importpfade vollständig ersetzter SDK-Mocks auf die neu verwendeten Datumshelfer geprüft; 14 der 15 ausgewählten Dateien bestanden direkt, die Datumsanzeige-Erwartung der verbleibenden Datei wurde anschließend gezielt geprüft und angepasst.


## Ergänzung nach dem zweiten GitHub-Lauf

Der FAQ-Editor besitzt wie die übrigen Zeitpunktfelder einen Datumsteil und einen Uhrzeitteil. Seine bestehende Kontrollreihenfolge-Erwartung wurde entsprechend angepasst; die acht FAQ-Seitentests bestehen gezielt.

Zwei zusätzliche Bearbeitungsfolgen sichern die unabhängigen Gültigkeiten des zusammengesetzten Zeitpunktfelds ab: ungültiger Kalendertag → gültiger Kalendertag mit nicht existenter Sommerzeit-Uhrzeit → gültiger Zeitpunkt sowie gültiger Zeitpunkt → Datum außerhalb der Grenzen → gültiges Datum. Vor der Korrektur ließ sich dabei jeweils ein unerwünschter Submit reproduzieren. Zeitpunktfehler gehören nun zum Uhrzeitfeld; die Kalendervalidierung bleibt beim Datumsteil. Die neun gezielten Eingabetests prüfen Ablehnung, anschließende erfolgreiche Korrektur, API-Zeitpunkte und Fehlerfokus. UI-Typprüfung, UI-Lint und Complexity-Gate bestehen. Es gibt keine neue Komponente, Schnittstelle oder Qualitätsausnahme.
