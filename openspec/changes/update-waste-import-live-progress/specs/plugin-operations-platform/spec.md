## MODIFIED Requirements
### Requirement: Host bietet eigene Detailseiten für Plugin-Operations-Jobs

Das System SHALL für einzelne Plugin-Operations-Jobs eine eigene lesende Detailansicht mit technischer History bereitstellen.

#### Scenario: Operator öffnet Jobdetail

- **WHEN** ein Operator aus der Monitoring-Liste einen einzelnen Job öffnet
- **THEN** zeigt die Detailansicht Status, Progress, Runtime-Diagnostik, Ergebnis-/Fehlerpayload und technische Event-History
- **AND** die Detailansicht wird nicht als flüchtiges Inline-Panel erzwungen

#### Scenario: Jobdetail und aktive Kurzsicht dürfen strukturierte Fortschrittsdetails nutzen

- **WHEN** ein Plugin für einen laufenden generischen Job strukturierte Fortschrittsdetails wie Gesamtmenge, verarbeitete Menge oder aktuelle Phase meldet
- **THEN** speichert und liefert die Plattform diese Details über den bestehenden generischen Progress-Vertrag aus
- **AND** aktive Kurzsichten und Detailansichten dürfen daraus Prozentwerte und verständliche Fortschrittstexte ableiten
- **AND** der Plattformvertrag verlangt dafür kein plugin-spezifisches Sonderendpunktmodell
