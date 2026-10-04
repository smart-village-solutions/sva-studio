## ADDED Requirements

### Requirement: Registrierte Dateilängen-Bestandslast wird ohne Policy-Aufweichung abgebaut

Das Projekt SHALL bestehende `fileLines`-Überschreitungen im durch die
Komplexitäts-Policy überwachten produktiven Quellcode in fachlich kohärenten,
einzeln prüfbaren Änderungen abbauen. Ein behobener Befund MUST durch den
kanonischen Messlauf bestätigt sein und darf weder durch geänderte Schwellwerte
oder Ausschlüsse noch durch einen parallelen Implementierungspfad ersetzt
werden.

#### Scenario: Lieferabschnitt beseitigt mehrere zusammengehörige Befunde

- **GIVEN** mehrere aktuelle `fileLines`-Befunde gehören zu einer gemeinsamen Verantwortung
- **WHEN** ein Refactoring-PR diese Verantwortung intern neu zuschneidet
- **THEN** verschwinden seine benannten Befunde im kanonischen Complexity-Gate
- **AND** bleiben Verhalten und öffentliche Verträge durch passende Tests belegt
- **AND** entstehen keine neuen Komplexitäts-Befunde oder parallelen Pfade

#### Scenario: Portfolio-Abschluss wird gemessen

- **WHEN** alle Lieferabschnitte integriert sind
- **THEN** meldet der vollständige Complexity-Lauf null aktuelle `fileLines`-Überschreitungen im überwachten Scope
- **AND** enthält das Finding-Register keine verwaisten `fileLines`-Einträge
- **AND** wurden Grenzwerte, Ausschlüsse und Baseline nicht als Ersatz für die Beseitigung der Befunde gelockert
