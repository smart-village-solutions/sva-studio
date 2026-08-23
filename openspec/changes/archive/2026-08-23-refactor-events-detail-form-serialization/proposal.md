# Change: Event-Detailformular-Serialisierung modularisieren

## Warum

Die Serialisierung des Event-Detailformulars bündelt redaktionelle Felder, Datumswerte, Adressen, Kontakte, Medien und Kompatibilitätswerte in einer komplexen Funktion. Fachlich getrennte, reine Serializer sollen den bestehenden Mainserver-Input exakt erhalten und die Datenintegrität leichter prüfbar machen.

## Was ändert sich

- Charakterisiert optionale Felder, leere und ungültige Werte, Datums- und Zeitformate, Geo-Koordinaten, Medien sowie Reihenfolgen gegen den unveränderten Altcode.
- Extrahiert kleine paketinterne Serializer für redaktionelle, Datums-, Adress- und Medienwerte.
- Belässt den öffentlichen Formular-Mapper als alleinigen Assembler des bestehenden `EventFormInput`.
- Erhält Feldpräsenz, Normalisierung, Kompatibilitätswerte und Array-Reihenfolge unverändert.

## Auswirkungen

- Betroffene Spezifikation: `content-management`
- Betroffener Code: `packages/plugin-events/src/events.detail-form.ts` und kleine paketinterne Helper
- Betroffene Tests: `packages/plugin-events/tests/events.detail-form.test.ts`
- Betroffene Dokumentation: Plugin-README und arc42-Bausteinsicht
- Keine Änderungen an POI, Mainserver-Schema, sichtbarer UI, öffentlicher Shared-API oder Datums-/Zeitzonen-Semantik
