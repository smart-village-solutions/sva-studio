## ADDED Requirements

### Requirement: Verhaltensgleiche Event-Formularserialisierung

Das Events-Plugin SHALL die Serialisierung des Detailformulars in fachlich getrennte, paketinterne und frameworkfreie Serializer gliedern, ohne Feldpräsenz, Normalisierung, Kompatibilitätswerte, Array-Reihenfolge oder den bestehenden `EventFormInput`-Vertrag zu verändern.

#### Scenario: Leere und optionale Eventwerte bleiben kompatibel

- **WHEN** ein Event-Detailformular leere, fehlende, `null`-, `false`-, `0`- oder nicht-endliche optionale Werte enthält
- **THEN** bleiben bestehende Omit-, Kompaktierungs- und Erhaltungsregeln unverändert
- **AND** der öffentliche Formular-Mapper liefert dasselbe exakte Output-Shape wie vor der Modularisierung

#### Scenario: Datum und Zeit werden ohne semantische Korrektur serialisiert

- **WHEN** das Formular ganztägige, lokale oder Offset-tragende Datums- und Zeitwerte enthält
- **THEN** bleiben Wert, Feldpräsenz und Reihenfolge unverändert
- **AND** die Serialisierung führt keine neue Zeitzonen- oder Validierungssemantik ein

#### Scenario: Strukturierte Eventbereiche bewahren Datenintegrität

- **WHEN** Adressen, Geo-Koordinaten, Kontakte, URLs, Medien, Preise oder Barrierefreiheitsinformationen serialisiert werden
- **THEN** bleiben partielle und ungültige Grenzwerte nach den bestehenden Regeln erhalten oder ausgelassen
- **AND** wiederholte Einträge behalten ihre bestehende Reihenfolge

#### Scenario: Paketgrenzen bleiben unverändert

- **WHEN** die Event-Serialisierung modularisiert wird
- **THEN** bleiben die Serializer intern in `@sva/plugin-events`
- **AND** es entsteht keine neue Shared-API und keine Änderung an POI- oder Mainserver-Verträgen
