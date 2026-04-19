## ADDED Requirements

### Requirement: Plugin-Content bleibt innerhalb hostgeführter Sicherheits- und Validierungsgrenzen

Das System SHALL pluginbezogene Content-Erweiterungen nur innerhalb hostgeführter Guard-, Validierungs- und Request-Grenzen zulassen.

#### Scenario: Content-Plugin ergänzt nur deklarative Fachsemantik

- **WHEN** ein Plugin einen Content-Typ oder eine Content-Ansicht beschreibt
- **THEN** liefert es nur deklarative Fachsemantik und UI-Bausteine
- **AND** Request-Grenzen, Persistenzvalidierung und Berechtigungsdurchsetzung bleiben hostgeführt

#### Scenario: Plugin ersetzt keine Host-Validierung

- **WHEN** ein Plugin eigene Validierung oder UI-Prüfung ausführt
- **THEN** ergänzt dies die Host-Regeln höchstens
- **AND** die verbindliche server- und hostseitige Validierung bleibt bestehen
