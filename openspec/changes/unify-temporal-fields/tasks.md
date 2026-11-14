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

Die Nachweise sind lokal; der Change ist weder gemergt noch ausgerollt. Die bestehenden Tickets bleiben geschlossen.
