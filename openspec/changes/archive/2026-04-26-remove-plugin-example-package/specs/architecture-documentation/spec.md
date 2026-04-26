## ADDED Requirements

### Requirement: Architektur- und Entwicklerdokumentation entfernt veraltete Beispiel-Plugin-Referenzen

Die Architektur- und Entwicklerdokumentation SHALL das entfernte Beispiel-Plugin nicht weiter als aktiven Bestandteil des Studios fuehren.

#### Scenario: Dokumentation nach Paketentfernung bereinigt

- **WHEN** `plugin-example` aus Workspace und Host entfernt wurde
- **THEN** beschreiben Architektur- und Entwicklerdokumente das Beispiel-Plugin nicht mehr als aktives Paket oder aktiven Host-Bestandteil
- **AND** verbleibende Hinweise auf historische oder optionale Beispiele sind klar als nicht-produktiv markiert
