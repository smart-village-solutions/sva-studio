# Deutsche Texte des öffentlichen Abfallkalender-PDFs zentralisieren

## Warum

Deutsche Vorlagentexte sind über die PDF-Erzeugung verteilt. Frankfurt (Oder)
benötigt eine eigene Bezeichnung für verschobene Abholtermine.

## Was sich ändert

- Studio, Webkalender und PDF verwenden dieselbe Schlüsselauflösung und Platzhaltersyntax.
- Die bestehende PDF-Kernlogik bezieht deutsche Vorlagentexte aus einem typisierten Katalog.
- Die öffentliche Runtime ergänzt für die konfigurierte Frankfurter Instanz genau den Legendenschlüssel.
- Die PDF-Erzeugung bestimmt Wochenenden und Feiertage anhand der Kalenderdaten.

## Auswirkungen

- Betroffen sind die Übersetzungsauflösung der Studio-Oberfläche, der Webkalender und die gemeinsame PDF-Kernlogik.
- Die PDF-Ausgabe verwendet Deutsch. Übergebene Ortsdaten, Fraktionen, Hinweise und Kontaktdaten behalten ihren Wortlaut.
- Die Zuständigkeit der Bausteine ist in arc42 Abschnitt 5 dokumentiert.
